#!/usr/bin/env python3
"""Run the built application locally. Never bind to the LAN."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import uvicorn

if __name__ == "__main__":
    uvicorn.run("soundwalk.api:app", host="127.0.0.1", port=8765)
