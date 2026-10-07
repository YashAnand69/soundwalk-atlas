"""One-time network preparation; runtime inference is strictly cached/offline."""
import hashlib
import json
import os
import sys
from pathlib import Path
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from huggingface_hub import snapshot_download
from soundwalk.audio import MODEL_ID, REVISION, model_directory
WEIGHT_SHA256 = "1cd3c601bc4afe0fa87be3de4c13dd2cfadd249fac1e29acf74a9b296c3219bb"
folder = model_directory()
snapshot_download(repo_id=MODEL_ID, revision=REVISION, local_dir=folder,
                  allow_patterns=["*.json", "*.txt", "README.md", "pytorch_model.bin"], max_workers=1)
weights = folder / "pytorch_model.bin"
with weights.open("rb") as source:
    digest = hashlib.file_digest(source, "sha256").hexdigest()
if digest != WEIGHT_SHA256:
    raise RuntimeError("Model checksum mismatch; remove the cached weight file and prepare again.")
(folder / "soundwalk-prepared.json").write_text(json.dumps({"revision": REVISION, "weightSha256": digest, "weightBytes": weights.stat().st_size}))
print(f"Prepared and verified {MODEL_ID}@{REVISION} in {folder}")
