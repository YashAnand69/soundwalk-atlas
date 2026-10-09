# Audio matching evaluation

The model compares audio against eleven curated descriptions in vocabulary v2.
Its nearest two matches are provisional. Unsupported sounds can still receive
incorrect suggestions; no score threshold has been validated. Only effectively
silent digital segments abstain automatically (RMS <= 0.000001 in decoded float
samples). That is a digital-quality check, never a sound-pressure measurement.

Run the offline evaluation tool with a JSON manifest:

```
.venv/bin/python scripts/evaluate_audio.py /private/path/manifest.json --output /private/path/results.json
```

```json
{
  "recordings": [{
    "path": "clip.wav",
    "expectedLabels": ["Footsteps"],
    "split": "development",
    "provenance": "Own recording; private evaluation only",
    "startSeconds": 0
  }]
}
```

Use `development` for recordings used to choose prompts, `held-out` only for
previously unseen, independently labelled recordings, and `synthetic` for generated
fixtures. Do not reuse tuning recordings as hold-out evidence. Include mixtures,
unknown sounds and silence; use labels outside the vocabulary to document its
limits. The tool separates split counts and reports vocabulary coverage and
descriptive top-two overlap. It cannot verify permission, labels, or independence.
Ground-truth labels never enter model inference. No percentage of GSoC success,
contest winning likelihood, biodiversity, ambient noise, or field accuracy follows
from this test. Private recordings and reports must stay outside Git.

The two user-provided OPUS clips motivated adding paper rustling and footsteps;
they are development debugging cases, not an independent validation set. A new,
consented hold-out field set remains necessary for recognition-quality claims.

## Verified engineering checks (October 9, 2026)

The v2 synthetic fixture benchmark is recorded in `../benchmark-model-v2.json`;
the earlier v1 benchmark remains unchanged. Socket connections were blocked.
Cold run: 1.282 seconds; warm runs: 0.032, 0.032 seconds.
This is runtime evidence only. It is not a recognition-quality benchmark.

Regression tests cover deterministic interval selection, zero padding, invalid
intervals (including huge finite numbers), silent abstention without model loading,
fixed-scale waveform peaks, malformed/oversized/non-finite/channel-count audio,
AAC duration bounds, and real offline repeatable CLAP inference. Evaluation-tool
tests verify split separation and that expected labels never enter inference.
