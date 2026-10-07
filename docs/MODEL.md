# Local audio and model pipeline

The model is LAION CLAP `laion/clap-htsat-unfused`, pinned to
`8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a`. The model card declares
Apache-2.0: https://huggingface.co/laion/clap-htsat-unfused/tree/8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a

`python scripts/prepare_model.py` is an explicit one-time network download.
Weights (614,525,833 bytes) are verified against SHA-256
`1cd3c601bc4afe0fa87be3de4c13dd2cfadd249fac1e29acf74a9b296c3219bb`.
Assets live outside the source tree under `~/.cache/soundwalk-atlas/<revision>`.
`SOUNDWALK_MODEL_DIR` can override that directory. Runtime passes
`local_files_only=True` to both model and processor, runs on CPU, and never
falls back to remote inference. A missing model causes a visible failure.

Audio is capped at 20 MB compressed and 30 seconds decoded. WAV, FLAC and
other libsndfile-supported audio are decoded with bounded frame reads;
recognised recorder containers such as MP4/AAC, MP3 and WebM can use the
imageio-ffmpeg binary. Codec checks use actual content, not file extensions.
FFmpeg has a 20-second subprocess timeout, no shell, permitted file/pipe
protocols only and a maximum 31-second output window to detect oversized audio.
Playlists are rejected. Generated AAC/M4A decoding is tested; an actual user's
phone recorder has not been validated yet.

Inference uses **only the first 10 seconds**, mono at 48 kHz. Shorter audio is
zero-padded to exactly ten seconds so the processor cannot randomly choose a
crop. Seven fixed prompt embeddings are cached once; normalised audio-text
cosine similarities produce two review suggestions. Scores are **not calibrated
probabilities**, and a runner-up label does not prove a mixed sound source.
Human review permits multiple labels and uncertainty. No speech transcription,
speaker identity, species recognition or environmental health claims are made.

Quiet and clipping flags describe digital recording quality, not measured
ambient decibels. Synthetic fixtures are CC0 procedural signals, explicitly
labelled sample data, and are not evidence of outdoors performance. Real field
recordings and independent labels remain necessary before any accuracy claim.

Run `python scripts/benchmark_model.py` after preparation for real offline
CPU timings and process memory, with socket connections blocked. Run
`PYTHONPATH=backend python -m pytest tests/test_audio.py` for bounds, codecs and
repeatability. The actual-model test skips if assets have not been prepared;
that skip is not an inference pass.

Dependency notices: PyTorch is BSD-style, Transformers Apache-2.0,
NumPy/SciPy BSD, SoundFile BSD-3-Clause with libsndfile LGPL-2.1-or-later,
imageio-ffmpeg wrapper BSD-2-Clause. Its installed macOS FFmpeg 7.1 binary
reports **GPL-2.0-or-later** (`ffmpeg -L`), including GPL-enabled codecs.
The external runtime/model cache is not included in the project source archive.
Preserve vendor notices and source obligations if separately redistributing
binaries; the project's own source license does not replace these licenses.

## Verified local feasibility — October 7, 2026

The real pinned CPU model successfully ran in a fresh process with both Hugging
Face offline settings and socket connections blocked. On this Apple Silicon Mac,
first inference including model/text load took **2.689 seconds**; two warm runs
took **0.046 and 0.045 seconds**. Peak process RSS was **1023.5 MiB**. The input
was the six-second original synthetic noise fixture, zero-padded by the fixed
window policy; these timings are not a claim about all devices or field clips.
Raw results and input hash are in `benchmark-model.json`. All **12 audio/model
regressions passed**, including actual cached-model offline repeatability.

The synthetic fixture's top candidates were Running water (0.3168) and People
and voices (0.2904). Those values are cosine similarities, not probabilities;
there are no recorded people in the procedural fixture. This demonstrates why
the UI requires interpretation and human review rather than asserting every
candidate is physically present. Outdoor usefulness and independently labelled
field accuracy remain unmeasured.
