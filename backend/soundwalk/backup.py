"""Portable, bounded backups. Validation completes before additive restoration."""
import hashlib
import io
import json
import math
import shutil
import tempfile
import uuid
import zipfile
from pathlib import Path

ARCHIVE_LIMIT = 200 * 1024 * 1024
RECORD_LIMIT = 500
KINDS = ("routes", "visits", "clips", "observations")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def create_backup(store):
    state = store.state()
    if sum(map(len, state.values())) > RECORD_LIMIT:
        raise ValueError("Backup is limited to 500 records; export smaller journals separately")
    payload = json.dumps({"schemaVersion": 2, **state}, allow_nan=False).encode()
    files = {"records.json": payload}
    total = len(payload)
    for clip in state["clips"]:
        path = store.audio_dir / clip["id"]
        if not path.is_file():
            raise ValueError("A recording is missing; restore or remove it before backing up")
        total += path.stat().st_size
        if total > ARCHIVE_LIMIT:
            raise ValueError("Backup exceeds the 200 MB portable archive limit")
        files[f'audio/{clip["id"]}'] = path.read_bytes()
    if sum(map(len, files.values())) > ARCHIVE_LIMIT:
        raise ValueError("Backup exceeds the 200 MB portable archive limit")
    manifest = {"schemaVersion": 1, "files": {name: {"sha256": digest(data), "bytes": len(data)} for name, data in files.items()}}
    target = io.BytesIO()
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        for name, data in files.items():
            archive.writestr(name, data)
    if target.tell() > ARCHIVE_LIMIT:
        raise ValueError("Backup exceeds 200 MB")
    return target.getvalue()


def text(record, key, limit, required=True):
    value = record.get(key, "")
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValueError(f"Invalid backup field: {key}")
    return value


def validate_analysis(analysis, duration):
    """Preserve historical suggestions only after bounding every rendered field."""
    if not isinstance(analysis, dict):
        raise ValueError("Invalid analysis record")
    suggestions = analysis.get("suggestions")
    if not isinstance(suggestions, list) or len(suggestions) > 12:
        raise ValueError("Invalid analysis suggestions")
    clean = {"suggestions": [], "status": "review", "restored": True}
    for suggestion in suggestions:
        if not isinstance(suggestion, dict):
            raise ValueError("Invalid sound suggestion")
        label = text(suggestion, "label", 120)
        score = suggestion.get("score")
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score) or not -1 <= score <= 1:
            raise ValueError("Invalid similarity score")
        clean["suggestions"].append({"label": label, "score": score})
    for key in ("model", "revision", "window"):
        clean[key] = text(analysis, key, 500)
    if "matching" in analysis:
        if analysis["matching"] != "candidate-similarity":
            raise ValueError("Unsupported analysis matching method")
        clean["matching"] = analysis["matching"]
    if "vocabularyVersion" in analysis:
        value = analysis["vocabularyVersion"]
        if isinstance(value, bool) or not isinstance(value, (str, int)) or len(str(value)) > 40:
            raise ValueError("Invalid vocabulary version")
        clean["vocabularyVersion"] = value
    if "quality" in analysis:
        quality = analysis["quality"]
        if not isinstance(quality, list) or len(quality) > 20 or any(not isinstance(q, str) or len(q) > 500 for q in quality):
            raise ValueError("Invalid analysis quality notes")
        clean["quality"] = quality
    if "prompts" in analysis:
        prompts = analysis["prompts"]
        if not isinstance(prompts, dict) or len(prompts) > 32 or any(not isinstance(k, str) or not isinstance(v, str) or not 1 <= len(k) <= 120 or not 1 <= len(v) <= 500 for k, v in prompts.items()):
            raise ValueError("Invalid analysis prompts")
        clean["prompts"] = prompts
    if "segment" in analysis:
        segment = analysis["segment"]
        if not isinstance(segment, dict):
            raise ValueError("Invalid analysis segment")
        start, end = segment.get("startSeconds"), segment.get("endSeconds")
        if any(isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) for n in (start, end)) or not 0 <= start < end <= duration + 0.001 or end - start > 10.001:
            raise ValueError("Invalid analysis interval")
        clean["segment"] = {"startSeconds": start, "endSeconds": end}
    return clean


def validate_records(state):
    if not isinstance(state, dict) or state.get("schemaVersion") != 2:
        raise ValueError("Unsupported backup records version")
    for kind in KINDS:
        if not isinstance(state.get(kind), list):
            raise ValueError("Backup records are incomplete")
    if sum(len(state[k]) for k in KINDS) > RECORD_LIMIT:
        raise ValueError("Backup exceeds 500 records")
    ids = set()
    for kind in KINDS:
        for record in state[kind]:
            if not isinstance(record, dict):
                raise ValueError("Invalid record")
            rid = text(record, "id", 36)
            try:
                if str(uuid.UUID(rid)) != rid:
                    raise ValueError()
            except ValueError as exc:
                raise ValueError("Invalid backup identifier") from exc
            if rid in ids:
                raise ValueError("Duplicate backup identifier")
            ids.add(rid)
            allowed = {"routes": {"id", "name", "stops"}, "visits": {"id", "routeId", "title", "createdAt"}, "clips": {"id", "visitId", "stopId", "filename", "duration", "quality", "createdAt", "note", "analysis", "review", "status", "sample"}, "observations": {"id", "visitId", "stopId", "note", "observedAt", "context", "updatedAt"}}[kind]
            for key in list(record):
                if key not in allowed:
                    del record[key]
    routes = {r["id"]: r for r in state["routes"]}
    visits = {v["id"]: v for v in state["visits"]}
    stops = set()
    for route in routes.values():
        text(route, "name", 120)
        entries = route.get("stops")
        if not isinstance(entries, list) or not 1 <= len(entries) <= 5:
            raise ValueError("Invalid route stops")
        for stop in entries:
            if not isinstance(stop, dict):
                raise ValueError("Invalid stop")
            sid = text(stop, "id", 36)
            if sid in stops or sid in ids:
                raise ValueError("Duplicate stop identifier")
            try:
                if str(uuid.UUID(sid)) != sid:
                    raise ValueError()
            except ValueError as exc:
                raise ValueError("Invalid stop identifier") from exc
            stops.add(sid)
            text(stop, "name", 120)
    for visit in visits.values():
        text(visit, "title", 120)
        text(visit, "createdAt", 80)
        if visit.get("routeId") not in routes:
            raise ValueError("Visit references a missing route")
    observation_pairs = set()
    for kind in ("clips", "observations"):
        for record in state[kind]:
            visit = visits.get(record.get("visitId"))
            if not visit or record.get("stopId") not in {s["id"] for s in routes[visit["routeId"]]["stops"]}:
                raise ValueError("Recording or observation references a missing stop")
            text(record, "note", 2000, False)
            if kind == "observations":
                pair = (record["visitId"], record["stopId"])
                if pair in observation_pairs:
                    raise ValueError("Duplicate observation")
                observation_pairs.add(pair)
                text(record, "context", 500, False)
                if record.get("observedAt") is not None:
                    text(record, "observedAt", 80, False)
                text(record, "updatedAt", 80)
            else:
                text(record, "filename", 180)
                text(record, "createdAt", 80)
                duration = record.get("duration")
                if isinstance(duration, bool) or not isinstance(duration, (float, int)) or not math.isfinite(duration) or not 0 < duration <= 30:
                    raise ValueError("Invalid recording duration")
                if record.get("review") is not None:
                    from .api import ReviewInput
                    try:
                        record["review"] = ReviewInput.model_validate(record["review"]).model_dump()
                    except Exception as exc:
                        raise ValueError("Invalid recording review") from exc
                if record.get("analysis") is not None:
                    record["analysis"] = validate_analysis(record["analysis"], duration)
                record["status"] = "ready"
                record.pop("error", None)
                record["quality"] = []
                if "sample" in record and not isinstance(record["sample"], bool):
                    raise ValueError("Invalid synthetic sample marker")
    return ids | stops


def restore_backup(store, source, validator):
    try:
        with zipfile.ZipFile(source) as archive:
            infos = archive.infolist()
            if len(infos) > RECORD_LIMIT + 2 or len({i.filename for i in infos}) != len(infos):
                raise ValueError("Backup contains too many or duplicate files")
            if sum(i.file_size for i in infos) > ARCHIVE_LIMIT:
                raise ValueError("Expanded backup exceeds 200 MB")
            for info in infos:
                name = info.filename
                if info.is_dir() or name.startswith("/") or "\\" in name or any(p in {"..", ".", ""} for p in name.split("/")) or (info.external_attr >> 16) & 0o170000 == 0o120000 or info.flag_bits & 1:
                    raise ValueError("Unsafe backup member")
                if name not in {"records.json", "manifest.json"} and not name.startswith("audio/"):
                    raise ValueError("Unexpected backup member")
            names = {i.filename for i in infos}
            if not {"manifest.json", "records.json"}.issubset(names):
                raise ValueError("Backup is missing its manifest")
            if archive.getinfo("manifest.json").file_size > 256 * 1024 or archive.getinfo("records.json").file_size > 4 * 1024 * 1024:
                raise ValueError("Backup metadata is too large")
            manifest = json.loads(archive.read("manifest.json"))
            if not isinstance(manifest, dict):
                raise ValueError("Invalid backup manifest")
            if manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("files"), dict) or set(manifest["files"]) != names - {"manifest.json"}:
                raise ValueError("Invalid backup manifest")
            files = {}
            for name, expected in manifest["files"].items():
                data = archive.read(name)
                if not isinstance(expected, dict) or expected.get("bytes") != len(data) or expected.get("sha256") != digest(data):
                    raise ValueError("Backup checksum mismatch")
                files[name] = data
            fingerprint = digest(json.dumps(manifest, sort_keys=True).encode())
            if store.get("restores", fingerprint):
                raise ValueError("This backup has already been restored")
            state = json.loads(files["records.json"])
            all_ids = validate_records(state)
            expected_names = {"records.json"} | {f'audio/{c["id"]}' for c in state["clips"]}
            if set(files) != expected_names:
                raise ValueError("Backup recording files do not match the journal")
            remap = {old: str(uuid.uuid4()) for old in all_ids}
            with tempfile.TemporaryDirectory(dir=store.directory, prefix="restore-") as temporary:
                staged = []
                for clip in state["clips"]:
                    data = files[f'audio/{clip["id"]}']
                    if len(data) > 20 * 1024 * 1024:
                        raise ValueError("A recording exceeds 20 MB")
                    path = Path(temporary) / remap[clip["id"]]
                    path.write_bytes(data)
                    try:
                        info = validator(path)
                    except Exception as exc:
                        raise ValueError("Backup contains an invalid recording") from exc
                    clip["duration"] = info["duration"]
                    clip["quality"] = info["quality"]
                    staged.append(path)
                records = []
                for kind in KINDS:
                    for record in state[kind]:
                        record["id"] = remap[record["id"]]
                        for key in ("routeId", "visitId", "stopId"):
                            if key in record:
                                record[key] = remap[record[key]]
                        if kind == "routes":
                            for stop in record["stops"]:
                                stop["id"] = remap[stop["id"]]
                        records.append((kind, record))
                installed = []
                with store.lock:
                    try:
                        store.db.execute("BEGIN")
                        for path in staged:
                            target = store.audio_dir / path.name
                            # Exclusive copy cannot silently overwrite an existing recording.
                            with target.open("xb") as handle, path.open("rb") as origin:
                                installed.append(target)
                                shutil.copyfileobj(origin, handle)
                        for kind, record in records:
                            store.db.execute("INSERT INTO records VALUES(?,?,?)", (kind, record["id"], json.dumps(record, allow_nan=False)))
                        store.db.execute("INSERT INTO records VALUES(?,?,?)", ("restores", fingerprint, json.dumps({"id": fingerprint})))
                        store.db.commit()
                    except Exception:
                        store.db.rollback()
                        for path in installed:
                            path.unlink(missing_ok=True)
                        raise
            return {"restoredRoutes": len(state["routes"]), "restoredVisits": len(state["visits"]), "restoredClips": len(state["clips"]), "restoredObservations": len(state["observations"])}
    except (zipfile.BadZipFile, KeyError, TypeError, AttributeError, json.JSONDecodeError, UnicodeDecodeError, RecursionError) as exc:
        raise ValueError("Invalid or corrupt backup") from exc
