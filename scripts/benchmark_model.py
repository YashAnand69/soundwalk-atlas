"""Real offline inference evidence; fixture is synthetic, not a field study."""
import json
import hashlib
import platform
import os
import sys
import time
import resource
import socket
from pathlib import Path
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import psutil
from soundwalk.audio import AudioAnalyser, REVISION
path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "tests/fixtures/synthetic-water.wav"
def no_network(*args, **kwargs):
    raise RuntimeError("Network connection attempted during offline benchmark")
socket.socket.connect = no_network
model = AudioAnalyser()
results = []
for run in range(3):
    start = time.perf_counter()
    analysis = model.analyse(path)
    results.append({"seconds": round(time.perf_counter() - start, 3), "rssMiB": round(psutil.Process().memory_info().rss / 1024**2, 1), "analysis": analysis})
print(json.dumps({"revision": REVISION, "platform": platform.platform(), "inputSha256": hashlib.sha256(path.read_bytes()).hexdigest(), "source": "Synthetic generated fixture, not outdoor evidence" if len(sys.argv) == 1 else "User-provided recording; provenance and ground truth not independently verified", "offlineEnvironment": True, "socketConnectionsBlocked": True, "peakRssMiB": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024**2 if sys.platform == "darwin" else 1024), 1), "runs": results}, indent=2))
