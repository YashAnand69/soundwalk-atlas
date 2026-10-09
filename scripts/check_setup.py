#!/usr/bin/env python3
"""Read-only local readiness check. Does not download or alter journal data."""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
checks = [('Python 3.12+', sys.version_info >= (3, 12)),
          ('Built interface', (ROOT / 'frontend/dist/index.html').is_file())]
for module in ('fastapi', 'uvicorn', 'numpy', 'soundfile', 'scipy', 'torch', 'transformers', 'imageio_ffmpeg'):
    checks.append((module, importlib.util.find_spec(module) is not None))
if all(ok for _, ok in checks):
    from soundwalk.audio import AudioAnalyser
    checks.append(('Prepared local model', AudioAnalyser().status()['ready']))
    import imageio_ffmpeg
    try:
        checks.append(('Local audio decoder', Path(imageio_ffmpeg.get_ffmpeg_exe()).is_file()))
    except RuntimeError:
        checks.append(('Local audio decoder', False))
for label, ok in checks:
    print(f"{'READY' if ok else 'MISSING'}  {label}")
print('Setup instructions: README.md. This check does not validate field accuracy.')
sys.exit(0 if all(ok for _, ok in checks) else 1)
