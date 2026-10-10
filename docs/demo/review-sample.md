# Public human-review sample

This browser experience reduces installation friction for visitors. It does not run
CLAP, upload recordings, or store a journal. JavaScript keeps the visitor's note
and review in memory until reset or reload; no localStorage, cookies, analytics,
or remote model endpoint is used by the sample.

## Reproducible source

`review-sample.wav` is an unchanged copy of `tests/fixtures/synthetic-water.wav`.
Despite the original filename, it is procedural Gaussian noise, not water recorded
in nature. `scripts/generate_fixtures.py` generates the six-second mono 48 kHz
fixture from seed 20261007. It is original CC0 test/demo audio, as recorded in
`tests/fixtures/LICENSE.md`.

SHA-256: `d1173f406b854e92e1f1bbbc99775f79f22ebd228a570d223cca005e2bd591a5`.

The two candidates (Running water 0.3168; Rain 0.30821) are copied exactly from
`docs/benchmark-model-v2.json`. They come from an actual offline inference run of
`laion/clap-htsat-unfused`, revision
`8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a`, vocabulary v2, interval 0–6 seconds.
The benchmark's repeated runs returned the same candidates. Ground truth was
not supplied to inference. The public page does not produce new inference.

## What the exercise demonstrates

An original observation precedes suggestions. No human label is preselected.
Visitors can select independent vocabulary labels, use their own description,
reject the vocabulary, and retain mixture and uncertainty. Rejecting the vocabulary
clears vocabulary labels; a free-text correction remains possible. The preview
shows the original observation, machine candidates and human decisions separately.

## What it does not demonstrate

This is not an outdoor trial, held-out accuracy benchmark, species recognizer,
noise-level meter, or evidence that a real user found the model useful. A procedural
noise sample can match water-like prompts, which illustrates why a numerical
similarity must not silently become a factual human label. Actual field observations
and interviews must be supplied by a person; this sample cannot substitute for them.

The full private local application is in the repository. The recorded demo and
transcript remain available on the public page.
