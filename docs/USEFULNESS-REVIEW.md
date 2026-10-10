# What the audio suggestions help with—and where they fail

Verified development observations, October 10, 2026. These are local model runs, not an outdoor trial, an accuracy benchmark, or evidence that someone noticed more on a walk.

Soundwalk Atlas uses audio/text matching to offer words for a recording after a person has written their own observation. It compares a selected interval with eleven fixed descriptions. The useful question is whether a suggestion helps the listener revisit their observation; matching a supplied label alone does not answer that question.

## Two private development examples

The project owner supplied two recordings and described them as book pages being turned and walking sounds. Those descriptions provide context, not independently verified ground truth. Both recordings had already informed vocabulary development, including the paper-rustling and footsteps prompts. They are explicitly **development cases**, not held-out examples. The recordings remain private.

| Supplied description | Interval analysed | First suggestion, similarity | Second suggestion, similarity |
| --- | --- | --- | --- |
| Book pages being turned | First 10 seconds | Paper rustling, 0.57058 | People and voices, 0.35625 |
| Walking sounds | First 10 seconds | Footsteps, 0.43480 | People and voices, 0.32780 |

The supplied category appeared first in each case. That confirms the current system can return a relevant candidate on these two familiar examples; it does not establish general recognition quality. The second suggestion must not be interpreted as proof that voices were present. No independent listening annotation was performed for this review.

Selecting the last five seconds of each recording still produced paper rustling (0.50942) and footsteps (0.50609), respectively. The values changed with the interval. These overlapping intervals are not additional independent examples. Short intervals are zero-padded to the model's ten-second window.

## Controls expose a real limitation

Three procedural controls were evaluated using the same implementation. Each was five seconds at 48 kHz, mono. They contain no actual environmental recordings.

| Control | Returned suggestions | What it demonstrates |
| --- | --- | --- |
| Exact digital zeros | No suggestions | The application's explicit digital-silence rule abstains. This is not a learned unknown-sound detector. |
| Seeded Gaussian noise, amplitude standard deviation 0.04 | Rain, 0.33194; Running water, 0.30438 | A noise signal can receive plausible environmental labels even though neither source is present. |
| 440 Hz sine wave, amplitude 0.1 | People and voices, 0.20408; Machinery, 0.11671 | An unsupported tone still receives labels from the fixed vocabulary. |

The noise and tone results are failure examples for literal source identification. The system chooses nearby descriptions even when the vocabulary does not fit. A lower similarity is not a validated rejection threshold, and a higher similarity is not calibrated confidence. Do not convert these values to confidence percentages or automatically accept either candidate.

The appropriate response to these controls is **none fits**, with the generated sound described in the listener's own words. That is a demonstration of the review workflow, not a claim that a user independently performed the review.

## Reproducibility and scope

- Model: `laion/clap-htsat-unfused`, pinned revision `8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a`; vocabulary version 2.
- Verified local weight SHA-256: `1cd3c601bc4afe0fa87be3de4c13dd2cfadd249fac1e29acf74a9b296c3219bb`.
- CPU execution on a Mac; Torch 2.8.0, Transformers 4.57.1, NumPy 2.2.6, SoundFile 0.13.1, SciPy 1.16.2.
- The existing [offline evaluation runner](../scripts/evaluate_audio.py) received audio and intervals for inference; supplied descriptions were used only afterward for descriptive comparison. Network socket connections were blocked and Transformers/Hugging Face offline modes enabled.
- In the first evaluation process, the first case took 2.086 seconds including model initialization; the second case took 0.051 seconds. Noise and tone each took 0.032 seconds; silence took 0.001 seconds. These are individual local wall-clock observations, not guaranteed latency or model-only timings.
- Raw manifests, private filenames, hashes, timing records, original clips, and detailed outputs are excluded from the public repository. Controls used a fixed noise seed of 20261010. The [evaluation instructions](evaluation/README.md) describe how to run comparable cases with recordings you have permission to use.

## What follows from this review

This evidence supports keeping the model in a limited role: a second perspective on a recording, presented after the listener's initial observation. It also supports explicit rejection and uncertainty controls. It does **not** yet show that the AI improves a real walk, detects biodiversity, measures sound levels, or recognises arbitrary environments accurately.

The next useful validation is a genuine three-stop walk. At each stop, write an observation before inference; optionally record a short clip; then compare suggestions with what was actually heard. Record whether the AI added a useful detail, merely repeated the observation, or distracted with an incorrect suggestion. Preserve examples of disagreement in the write-up. Do not count these two development clips as new field evidence.

Further product improvements should reduce effort around that comparison: an immediately accessible demonstration with known provenance, a direct observation-versus-suggestion view, and a simple return-to-the-same-stop reflection. Extending the label vocabulary or adding a rejection threshold should wait for fresh, consented, independently annotated recordings rather than tuning to these two examples again.
