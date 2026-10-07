#!/usr/bin/env python3
"""Exercise real HTTP CRUD using only records this script creates.

The running service must use a disposable SOUNDWALK_DATA_DIR for development.
No existing visit/clip is modified or deleted. No model predictions are mocked
or claimed: this smoke checks ingestion, manual review and JSON persistence.
"""
import argparse
import json
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import httpx


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:8765")
    parser.add_argument("--audio", type=Path, default=Path(__file__).resolve().parents[1] / "tests/fixtures/synthetic-wind.wav")
    args = parser.parse_args()
    parsed = urlsplit(args.base)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"} or parsed.port != 8765 or parsed.path not in {"", "/"} or parsed.username or parsed.query or parsed.fragment:
        parser.error("Use the local Soundwalk service on loopback port 8765")
    route_id = visit_id = clip_id = None
    with httpx.Client(base_url=args.base.rstrip("/"), timeout=30) as client:
        def request(method, path, **kwargs):
            response = client.request(method, path, **kwargs)
            response.raise_for_status()
            return response.json()

        config = request("GET", "/api/config")
        client.headers["X-Soundwalk-Token"] = config["token"]
        before = request("GET", "/api/state")
        try:
            route = request("POST", "/api/routes", json={"name": "Disposable HTTP smoke " + str(uuid.uuid4())[:8], "stops": ["Synthetic test stop"]})
            route_id = route["id"]
            visit = request("POST", "/api/visits", json={"routeId": route_id, "title": "Synthetic HTTP validation"})
            visit_id = visit["id"]
            with args.audio.open("rb") as source:
                clip = request("POST", "/api/clips", data={"visitId": visit_id, "stopId": route["stops"][0]["id"], "note": "Synthetic fixture; not a real field observation."}, files={"file": (args.audio.name, source, "audio/wav")})
            clip_id = clip["id"]
            assert clip["analysis"] is None
            review = request("PATCH", f"/api/clips/{clip_id}/review", json={"labels": ["Synthetic fixture"], "uncertain": True, "note": "Manual smoke-test review, not an accuracy result."})
            assert review["review"]["uncertain"] is True
            export = request("GET", "/api/export")
            assert export["schemaVersion"] == 1 and export["audioIncluded"] is False
            assert next(c for c in export["clips"] if c["id"] == clip_id)["review"] == review["review"]
            audio = client.get(f"/api/clips/{clip_id}/audio")
            audio.raise_for_status()
            assert audio.content == args.audio.read_bytes()
            result = {"status": "passed", "checks": ["real HTTP route/visit/import", "audio playback payload", "manual review", "JSON export", "owned-record cleanup"], "duration": clip["duration"], "audioMime": audio.headers.get("content-type"), "modelInferenceTested": False}
        finally:
            if visit_id:
                request("DELETE", f"/api/visits/{visit_id}")
            if route_id:
                request("DELETE", f"/api/routes/{route_id}")
            after = request("GET", "/api/state")
            for kind in ("routes", "visits", "clips"):
                assert {r["id"] for r in before[kind]} <= {r["id"] for r in after[kind]}, "Existing records must remain intact"
            assert not any(c["id"] == clip_id for c in after["clips"])
            assert not any(v["id"] == visit_id for v in after["visits"])
            assert not any(r["id"] == route_id for r in after["routes"])
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
