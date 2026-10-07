"""Same-origin loopback API. Model failures are explicit, never synthetic predictions."""
import json
import os
import queue
import secrets
import threading
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.exceptions import RequestValidationError
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator

from .storage import Store

MAX_BYTES = 20 * 1024 * 1024
ROOT = Path(__file__).resolve().parents[2]


def identifier():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc).isoformat()


class RouteInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    stops: list[str] = Field(min_length=1, max_length=5)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value):
        if not value.strip():
            raise ValueError("A name is required")
        return value.strip()

    @field_validator("stops")
    @classmethod
    def valid_stops(cls, values):
        if any(not v.strip() or len(v) > 120 for v in values):
            raise ValueError("Stop names must contain 1–120 characters")
        return [v.strip() for v in values]


class VisitInput(BaseModel):
    routeId: str
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value):
        if not value.strip():
            raise ValueError("A title is required")
        return value.strip()


class ReviewInput(BaseModel):
    labels: list[str] = Field(max_length=12)
    uncertain: bool
    note: str = Field(max_length=2000)

    @field_validator("labels")
    @classmethod
    def label_bounds(cls, labels):
        if any(not v.strip() or len(v) > 120 for v in labels):
            raise ValueError("Labels must contain 1–120 characters")
        return list(dict.fromkeys(v.strip() for v in labels))


def create_app(data_dir=None, analyser=None, validator=None, allowed_hosts=None):
    if analyser is None or validator is None:
        from .audio import AudioAnalyser, validate_audio
        analyser = analyser or AudioAnalyser()
        validator = validator or validate_audio
    store = Store(Path(data_dir or os.environ.get("SOUNDWALK_DATA_DIR", Path.home() / ".local/share/soundwalk-atlas")))
    token = secrets.token_urlsafe(32)
    hosts = set(allowed_hosts or {"127.0.0.1:8765", "localhost:8765"})
    jobs = {}
    pending = queue.Queue(maxsize=8)
    state_lock = threading.RLock()
    stop = threading.Event()

    def require(kind, record_id):
        record = store.get(kind, record_id)
        if record is None:
            raise HTTPException(404, "Record not found")
        return record

    def worker():
        while not stop.is_set():
            try:
                job_id, clip_id = pending.get(timeout=0.2)
            except queue.Empty:
                continue
            with state_lock:
                jobs[job_id]["status"] = "running"
                clip = store.get("clips", clip_id)
            try:
                if clip is None:
                    raise ValueError("Recording was deleted")
                result = analyser.analyse(store.audio_dir / clip_id)
                with state_lock:
                    current = store.get("clips", clip_id)
                    if current:
                        current.update(analysis=result, status="ready")
                        current.pop("error", None)
                        store.put("clips", current)
                    jobs[job_id]["status"] = "done"
            except Exception as exc:
                # Keep errors local and comprehensible without exposing filesystem paths.
                message = str(exc) if isinstance(exc, ValueError) else "Local analysis failed. Check the model installation and retry."
                message = message[:500]
                with state_lock:
                    current = store.get("clips", clip_id)
                    if current:
                        current.update(status="failed", error=message)
                        store.put("clips", current)
                    jobs[job_id].update(status="failed", error=message)
            finally:
                pending.task_done()

    @asynccontextmanager
    async def lifespan(app):
        thread = threading.Thread(target=worker, daemon=True, name="soundwalk-inference")
        thread.start()
        yield
        stop.set()
        thread.join(timeout=2)
        # A running model thread may still own the connection; process shutdown
        # releases it. Do not close SQLite under an active worker.
        if not thread.is_alive():
            store.close()

    app = FastAPI(title="Soundwalk Atlas", lifespan=lifespan)
    app.state.store = store
    app.state.jobs = jobs

    @app.exception_handler(RequestValidationError)
    async def invalid_input(request, exc):
        return JSONResponse({"detail": "Invalid input: " + "; ".join(error["msg"] for error in exc.errors())}, status_code=422)

    @app.middleware("http")
    async def local_boundary(request: Request, call_next):
        host = request.headers.get("host", "")
        if host not in hosts:
            return JSONResponse({"detail": "Only the configured local host is allowed"}, status_code=403)
        origin = request.headers.get("origin")
        if origin:
            try:
                parsed = urlsplit(origin)
            except ValueError:
                return JSONResponse({"detail": "Invalid origin"}, status_code=403)
            if parsed.scheme != "http" or parsed.netloc != host or parsed.path or parsed.query or parsed.fragment:
                return JSONResponse({"detail": "Cross-origin access is not allowed"}, status_code=403)
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            if not secrets.compare_digest(request.headers.get("x-soundwalk-token", "").encode("utf-8"), token.encode("ascii")):
                return JSONResponse({"detail": "Local session token required"}, status_code=403)
        if request.url.path == "/api/clips" and request.method == "POST":
            try:
                length = int(request.headers.get("content-length", "0"))
            except ValueError:
                return JSONResponse({"detail": "Invalid content length"}, status_code=400)
            body_limit = MAX_BYTES + 64 * 1024
            if length > body_limit:
                return JSONResponse({"detail": "Recording exceeds 20 MB"}, status_code=413)
            received = 0
            original_receive = request._receive

            async def bounded_receive():
                nonlocal received
                message = await original_receive()
                received += len(message.get("body", b""))
                if received > body_limit:
                    raise HTTPException(413, "Recording exceeds 20 MB")
                return message

            request._receive = bounded_receive
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/config")
    def config():
        return {"token": token, "model": analyser.status(), "limits": {"maxBytes": MAX_BYTES, "maxDuration": 30}, "version": "1"}

    @app.get("/api/state")
    def state():
        with state_lock:
            return store.state()

    @app.post("/api/routes")
    def add_route(body: RouteInput):
        return store.put("routes", {"id": identifier(), "name": body.name, "stops": [{"id": identifier(), "name": name} for name in body.stops]})

    @app.post("/api/visits")
    def add_visit(body: VisitInput):
        require("routes", body.routeId)
        return store.put("visits", {"id": identifier(), "routeId": body.routeId, "title": body.title, "createdAt": now()})

    def import_path(path, filename, visit_id, stop_id, note, demo=False, info=None):
        visit = require("visits", visit_id)
        route = require("routes", visit["routeId"])
        if stop_id not in {s["id"] for s in route["stops"]}:
            raise HTTPException(400, "Stop does not belong to this visit's route")
        try:
            info = info if info is not None else validator(path)
        except ValueError as exc:
            raise HTTPException(400, str(exc)[:500]) from exc
        clip_id = identifier()
        target = store.audio_dir / clip_id
        path.replace(target)
        clip = {"id": clip_id, "visitId": visit_id, "stopId": stop_id, "filename": filename,
                "duration": info["duration"], "quality": info["quality"], "createdAt": now(), "note": note,
                "analysis": None, "review": None, "status": "ready"}
        if demo:
            clip["sample"] = True
        try:
            return store.put("clips", clip)
        except Exception:
            target.unlink(missing_ok=True)
            raise

    @app.post("/api/clips")
    async def upload(file: UploadFile = File(...), visitId: str = Form(...), stopId: str = Form(...), note: str = Form("")):
        if len(note) > 2000:
            raise HTTPException(400, "Note is too long")
        path = store.audio_dir / ("upload-" + identifier())
        try:
            total = 0
            with path.open("wb") as handle:
                while chunk := await file.read(65536):
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise HTTPException(413, "Recording exceeds 20 MB")
                    handle.write(chunk)
            filename = (file.filename or "recording").replace("\\", "/").split("/")[-1][:180]
            # Decode outside the mutation lock; recheck visit/stop membership
            # during insertion so a concurrently deleted visit cannot be revived.
            try:
                info = await run_in_threadpool(validator, path)
            except ValueError as exc:
                raise HTTPException(400, str(exc)[:500]) from exc
            def import_record():
                with state_lock:
                    return import_path(path, filename, visitId, stopId, note, info=info)
            return await run_in_threadpool(import_record)
        finally:
            path.unlink(missing_ok=True)
            await file.close()

    @app.get("/api/clips/{clip_id}/audio")
    def audio(clip_id: str):
        clip = require("clips", clip_id)
        path = store.audio_dir / clip["id"]
        with path.open("rb") as handle:
            header = handle.read(16)
        # Derive MIME from validated audio container bytes, never its filename.
        if header.startswith(b"RIFF") and header[8:12] == b"WAVE":
            mime = "audio/wav"
        elif header.startswith(b"fLaC"):
            mime = "audio/flac"
        elif header.startswith(b"OggS"):
            mime = "audio/ogg"
        elif header[4:8] == b"ftyp":
            mime = "audio/mp4"
        elif header.startswith(b"\x1aE\xdf\xa3"):
            mime = "audio/webm"
        elif header.startswith(b"FORM") and header[8:12] in {b"AIFF", b"AIFC"}:
            mime = "audio/aiff"
        elif header.startswith(b".snd"):
            mime = "audio/basic"
        elif header.startswith(b"caff"):
            mime = "audio/x-caf"
        elif len(header) >= 2 and header[0] == 255 and header[1] & 246 == 240:
            mime = "audio/aac"
        elif header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 255 and header[1] & 224 == 224):
            mime = "audio/mpeg"
        else:
            mime = "application/octet-stream"
        return FileResponse(path, filename=clip["filename"], media_type=mime, content_disposition_type="inline")

    @app.post("/api/clips/{clip_id}/analyse")
    def analyse(clip_id: str):
        with state_lock:
            clip = require("clips", clip_id)
            if clip["status"] == "analysing":
                raise HTTPException(409, "This recording is already queued or analysing")
            if not analyser.status().get("ready"):
                raise HTTPException(409, "Prepare the local model before analysis")
            job_id = identifier()
            jobs[job_id] = {"id": job_id, "status": "queued"}
            try:
                pending.put_nowait((job_id, clip_id))
            except queue.Full:
                jobs.pop(job_id)
                raise HTTPException(429, "Analysis queue is full. Try again shortly.")
            clip.update(status="analysing")
            clip.pop("error", None)
            store.put("clips", clip)
            # Retain bounded job history while preserving all pending jobs.
            for old in list(jobs):
                if len(jobs) <= 100:
                    break
                if jobs[old]["status"] in {"done", "failed"}:
                    del jobs[old]
            return {"jobId": job_id, "status": "queued"}

    @app.get("/api/jobs/{job_id}")
    def job(job_id: str):
        with state_lock:
            if job_id not in jobs:
                raise HTTPException(404, "Job not found")
            return dict(jobs[job_id])

    @app.patch("/api/clips/{clip_id}/review")
    def review(clip_id: str, body: ReviewInput):
        with state_lock:
            clip = require("clips", clip_id)
            clip["review"] = body.model_dump()
            return store.put("clips", clip)

    def remove_clip(clip_id):
        clip = require("clips", clip_id)
        (store.audio_dir / clip["id"]).unlink(missing_ok=True)
        store.delete("clips", clip_id)

    @app.delete("/api/clips/{clip_id}")
    def delete_clip(clip_id: str):
        with state_lock:
            remove_clip(clip_id)
        return {"deleted": True}

    @app.delete("/api/visits/{visit_id}")
    def delete_visit(visit_id: str):
        with state_lock:
            require("visits", visit_id)
            for clip in store.all("clips"):
                if clip["visitId"] == visit_id:
                    remove_clip(clip["id"])
            store.delete("visits", visit_id)
        return {"deleted": True}

    @app.delete("/api/routes/{route_id}")
    def delete_empty_route(route_id: str):
        with state_lock:
            require("routes", route_id)
            if any(visit["routeId"] == route_id for visit in store.all("visits")):
                raise HTTPException(409, "Delete this route's visits before removing the route")
            store.delete("routes", route_id)
        return {"deleted": True}

    @app.get("/api/export")
    def export():
        return Response(json.dumps({"schemaVersion": 1, "exportedAt": now(), "audioIncluded": False, **store.state()}, indent=2), media_type="application/json", headers={"Content-Disposition": 'attachment; filename="soundwalk-atlas.json"'})

    @app.post("/api/demo")
    def demo():
        import shutil
        fixtures = sorted((ROOT / "tests/fixtures").glob("*.wav"))
        if not fixtures:
            raise HTTPException(503, "Synthetic example fixtures are not installed")
        with state_lock:
            route = add_route(RouteInput(name="Synthetic sample · not a field walk", stops=["Sample courtyard", "Sample path", "Sample garden"]))
            try:
                for index in range(2):
                    visit = add_visit(VisitInput(routeId=route["id"], title=f"Synthetic sample visit {index + 1}"))
                    for n, stop_entry in enumerate(route["stops"]):
                        source = fixtures[(index + n) % len(fixtures)]
                        temporary = store.audio_dir / ("upload-" + identifier())
                        try:
                            shutil.copyfile(source, temporary)
                            import_path(temporary, source.name, visit["id"], stop_entry["id"], "Generated demonstration audio; not an outdoor observation.", demo=True)
                        finally:
                            temporary.unlink(missing_ok=True)
            except Exception:
                for visit in store.all("visits"):
                    if visit["routeId"] == route["id"]:
                        delete_visit(visit["id"])
                store.delete("routes", route["id"])
                raise
        return {"routeId": route["id"]}

    @app.get("/{path:path}")
    def frontend(path: str):
        dist = ROOT / "frontend/dist"
        candidate = (dist / path).resolve()
        if not candidate.is_relative_to(dist.resolve()):
            raise HTTPException(404, "Not found")
        if candidate.is_file():
            return FileResponse(candidate)
        if path.startswith("api/"):
            raise HTTPException(404, "API endpoint not found")
        index = dist / "index.html"
        if index.exists():
            return FileResponse(index)
        return JSONResponse({"detail": "Build the frontend first: npm run build in frontend/"}, status_code=503)

    return app


app = create_app()
