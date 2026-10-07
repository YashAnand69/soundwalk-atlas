"""Original procedural sounds: demo/test only, never presented as field audio."""
from pathlib import Path
import numpy as np
import soundfile as sf
folder = Path(__file__).resolve().parents[1] / "tests/fixtures"
folder.mkdir(exist_ok=True)
rng = np.random.default_rng(20261007)
rate = 48000
x = np.arange(rate * 6) / rate
water = rng.normal(0, .08, x.size)
wind = np.convolve(rng.normal(0, .12, x.size), np.ones(240) / 240, mode="same") * 8
birds = np.sin(2 * np.pi * (2000 * x + 400 * np.sin(2 * np.pi * x))) * ((x % 1) < .2) * .12
for name, data in [("water", water), ("wind", wind), ("birds", birds)]:
    sf.write(folder / f"synthetic-{name}.wav", data, rate)
