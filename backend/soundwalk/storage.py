"""Small transactional local record store; client names never become paths."""
import json
import sqlite3
import threading
from pathlib import Path


class Store:
    def __init__(self, directory: Path):
        self.directory = directory
        self.audio_dir = directory / "audio"
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.audio_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(directory / "atlas.sqlite3", check_same_thread=False)
        self.db.execute("CREATE TABLE IF NOT EXISTS records(kind TEXT, id TEXT PRIMARY KEY, body TEXT NOT NULL)")
        self.db.commit()
        # A restarted process cannot resume an in-memory analysis job.
        for clip in self.all("clips"):
            if clip["status"] == "analysing":
                clip.update(status="failed", error="Analysis was interrupted. Please retry.")
                self.put("clips", clip)

    def all(self, kind):
        with self.lock:
            return [json.loads(row[0]) for row in self.db.execute("SELECT body FROM records WHERE kind=? ORDER BY rowid", (kind,))]

    def get(self, kind, record_id):
        with self.lock:
            row = self.db.execute("SELECT body FROM records WHERE kind=? AND id=?", (kind, record_id)).fetchone()
            return json.loads(row[0]) if row else None

    def put(self, kind, record):
        with self.lock:
            self.db.execute("INSERT OR REPLACE INTO records VALUES(?,?,?)", (kind, record["id"], json.dumps(record, allow_nan=False)))
            self.db.commit()
        return record

    def delete(self, kind, record_id):
        with self.lock:
            self.db.execute("DELETE FROM records WHERE kind=? AND id=?", (kind, record_id))
            self.db.commit()

    def state(self):
        with self.lock:
            return {kind: self.all(kind) for kind in ("routes", "visits", "clips")}

    def close(self):
        self.db.close()
