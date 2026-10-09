"""Bounded local audio decoding and pinned CLAP audio/text matching.

Model assets are prepared separately. Runtime never downloads a model. Scores
are relative similarity values, not probabilities or validated confidence.
"""
from pathlib import Path
import os
import subprocess
import threading

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from math import gcd

MODEL_ID = "laion/clap-htsat-unfused"
REVISION = "8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a"
SAMPLE_RATE = 48000
MAX_DURATION = 30
MAX_BYTES = 20 * 1024 * 1024
VOCABULARY_VERSION = "2"
PROMPTS = {
    "Birds": "The sound of birds chirping and singing outdoors.",
    "Road traffic": "The sound of road traffic and cars driving past.",
    "Wind and leaves": "The sound of wind blowing and rustling leaves.",
    "Running water": "The sound of flowing water in a stream or fountain.",
    "Machinery": "The sound of machinery or construction work.",
    "People and voices": "The sound of people talking or human voices.",
    "Dogs and animals": "The sound of a dog barking or an animal calling.",
    "Footsteps": "The sound of footsteps, someone walking on a surface.",
    "Paper rustling": "The sound of paper rustling and book pages being turned.",
    "Rain": "The sound of rain falling and raindrops pattering on surfaces.",
    "Insects": "The sound of crickets chirping or insects buzzing outdoors.",
}


def model_directory() -> Path:
    return Path(os.environ.get("SOUNDWALK_MODEL_DIR", Path.home() / ".cache" / "soundwalk-atlas" / REVISION))


def _decode(path: Path) -> np.ndarray:
    if not path.is_file() or path.stat().st_size > MAX_BYTES:
        raise ValueError("Audio must be a file no larger than 20 MB.")
    try:
        with sf.SoundFile(path) as source:
            if source.channels > 8 or not 8000 <= source.samplerate <= 192000:
                raise ValueError("Unsupported audio channel count or sample rate.")
            if source.frames > MAX_DURATION * source.samplerate:
                raise ValueError("Recordings must be at most 30 seconds.")
            decoded = source.read(frames=MAX_DURATION * source.samplerate + 1, dtype="float32", always_2d=True)
            if len(decoded) > MAX_DURATION * source.samplerate:
                raise ValueError("Recordings must be at most 30 seconds.")
            data = decoded.mean(axis=1)
            rate = source.samplerate
        if rate != SAMPLE_RATE:
            divisor = gcd(rate, SAMPLE_RATE)
            data = resample_poly(data, SAMPLE_RATE // divisor, rate // divisor)
    except (sf.LibsndfileError, RuntimeError):
        # Decode recorder formats using an independently installed ffmpeg binary.
        # Structured args, a timeout, and a 31-second PCM bound avoid shell/path
        # injection and prevent unbounded decoded output.
        import imageio_ffmpeg
        with path.open("rb") as handle:
            header = handle.read(32)
        permitted = (header.startswith((b"ID3", b"OggS", b"fLaC", b"\x1aE\xdf\xa3"))
                     or header[4:8] == b"ftyp"
                     or (len(header) >= 2 and header[0] == 255 and header[1] & 224 == 224))
        if not permitted:
            raise ValueError("Could not decode this audio recording. Unsupported container.")
        try:
            result = subprocess.run(
                [imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error",
                 "-protocol_whitelist", "file,pipe", "-i", str(path.resolve()),
                 "-t", "31", "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE),
                 "-f", "f32le", "pipe:1"],
                capture_output=True, timeout=20, check=True,
            )
            data = np.frombuffer(result.stdout, dtype="<f4").copy()
        except (subprocess.SubprocessError, OSError, RuntimeError) as error:
            raise ValueError("Could not decode this audio recording.") from error
    if data.size == 0 or data.size > MAX_DURATION * SAMPLE_RATE:
        raise ValueError("Recordings must contain audio and be at most 30 seconds.")
    if not np.isfinite(data).all():
        raise ValueError("Audio contains invalid sample values.")
    return np.asarray(data, dtype=np.float32)


def validate_audio(path: Path) -> dict:
    data = _decode(Path(path))
    quality = []
    if float(np.sqrt(np.mean(data.astype(np.float64) ** 2))) < 0.001:
        quality.append("Very quiet recording; suggestions may be unreliable.")
    if float(np.mean(np.abs(data) >= 0.999)) > 0.01:
        quality.append("Possible clipping; this is a recording-quality flag, not a sound-level measurement.")
    if data.size > 10 * SAMPLE_RATE:
        quality.append("Analysis uses a selected 10-second segment; the first 10 seconds are the default.")
    return {"duration": data.size / SAMPLE_RATE, "quality": quality}


def audio_preview(path: Path) -> dict:
    """Bounded peak envelope at a fixed digital scale, never sound-pressure dB."""
    data = _decode(Path(path))
    bins = min(240, data.size)
    edges = np.linspace(0, data.size, bins + 1, dtype=int)
    peaks = [round(min(1.0, float(np.max(np.abs(data[left:right])))), 5)
             for left, right in zip(edges[:-1], edges[1:])]
    return {"peaks": peaks, "duration": data.size / SAMPLE_RATE,
            "sampleRate": SAMPLE_RATE}


def _segment(data: np.ndarray, start_seconds: float) -> tuple[np.ndarray, dict]:
    # bool is not an interval, although Python considers it a number.
    if isinstance(start_seconds, bool) or not isinstance(start_seconds, (int, float)):
        raise ValueError("Segment start must be a finite non-negative number.")
    if not np.isfinite(start_seconds) or start_seconds < 0:
        raise ValueError("Segment start must be a finite non-negative number.")
    if start_seconds >= data.size / SAMPLE_RATE:
        raise ValueError("Segment start must be before the end of the recording.")
    start = int(start_seconds * SAMPLE_RATE)
    if start >= data.size:
        raise ValueError("Segment start must be before the end of the recording.")
    selected = data[start:start + 10 * SAMPLE_RATE]
    return selected, {"startSeconds": start / SAMPLE_RATE,
                      "endSeconds": (start + selected.size) / SAMPLE_RATE}


class AudioAnalyser:
    def __init__(self):
        self._lock = threading.Lock()
        self._model = None
        self._processor = None
        self._text = None

    def status(self) -> dict:
        folder = model_directory()
        assets = ("config.json", "pytorch_model.bin", "preprocessor_config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.json", "merges.txt")
        available = all((folder / filename).is_file() for filename in assets)
        if available:
            available = (folder / "pytorch_model.bin").stat().st_size == 614525833
        return {"ready": available, "status": "Local model loaded" if self._model is not None else "Local model prepared" if available else "Run scripts/prepare_model.py to download the local model", "revision": REVISION}

    def _load(self):
        if self._model is not None:
            return
        if not self.status()["ready"]:
            raise RuntimeError("Local model is not prepared. Run scripts/prepare_model.py first.")
        import torch
        from transformers import ClapModel, ClapProcessor
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        directory = str(model_directory())
        processor = ClapProcessor.from_pretrained(directory, local_files_only=True)
        model = ClapModel.from_pretrained(directory, local_files_only=True).eval().to("cpu")
        with torch.inference_mode():
            text = model.get_text_features(**processor(text=list(PROMPTS.values()), return_tensors="pt", padding=True))
            text = torch.nn.functional.normalize(text, dim=-1)
        self._processor, self._model, self._text = processor, model, text

    def analyse(self, path: Path, start_seconds: float = 0) -> dict:
        data, segment = _segment(_decode(Path(path)), start_seconds)
        # Only effectively digital silence abstains automatically. This is a
        # recording-quality check, not a calibrated confidence or ambient level.
        rms = float(np.sqrt(np.mean(data.astype(np.float64) ** 2)))
        quality = []
        if rms < 0.001:
            quality.append("Very quiet segment; candidate matches may be unreliable.")
        if float(np.mean(np.abs(data) >= 0.999)) > 0.01:
            quality.append("Possible clipping in the selected segment.")
        result = {"suggestions": [], "status": "review", "model": MODEL_ID,
                  "revision": REVISION, "segment": segment,
                  "vocabularyVersion": VOCABULARY_VERSION,
                  "prompts": dict(PROMPTS), "quality": quality,
                  "matching": "candidate-similarity",
                  "window": "Selected segment at 48 kHz mono, up to 10 seconds; shorter clips zero-padded. Vocabulary v2. Relative similarities, not confidence probabilities."}
        if rms <= 1e-6:
            result["quality"].append("Effectively silent digital segment; no sound suggestions generated.")
            return result
        # CLAP's unfused processor takes a fixed 10-second window. Explicit zero
        # padding prevents random cropping/repeat padding for shorter recordings.
        window = np.zeros(10 * SAMPLE_RATE, dtype=np.float32)
        window[:data.size] = data
        with self._lock:
            self._load()
            import torch
            inputs = self._processor(audio=window, sampling_rate=SAMPLE_RATE, return_tensors="pt")
            with torch.inference_mode():
                audio = self._model.get_audio_features(**inputs)
                audio = torch.nn.functional.normalize(audio, dim=-1)
                scores = (audio @ self._text.T)[0].cpu().numpy()
        labels = list(PROMPTS)
        order = np.argsort(-scores, kind="stable")[:2]
        result["suggestions"] = [{"label": labels[int(i)], "score": round(float(scores[i]), 5)} for i in order]
        return result
