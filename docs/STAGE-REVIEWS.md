# Build stages and review evidence

Completed October 7, 2026 on the user's Apple Silicon Mac, macOS 27.0.1, 24 GB RAM. Built with Codex and three build subagents. Reviews below record performed checks; they do not certify an absence of all defects.

## 1. Audio feasibility — complete

Pinned LAION CLAP revision `8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a` downloaded explicitly. Weight size: **614,525,833 bytes**; SHA-256 verified against `1cd3c601bc4afe0fa87be3de4c13dd2cfadd249fac1e29acf74a9b296c3219bb`. Download transport failures were resolved using HTTP/1.1; truncated assets were never installed as ready.

Independent backend-agent review hardened actual decoded-frame bounds. Tests cover malformed/empty/nonfinite audio, channel/rate/size/duration limits, resampling, WAV and generated AAC/M4A, playlist rejection, deterministic first-ten-second window/zero-padding and real cached-model repeatability. **12 audio/model tests pass, no skips.**

Actual CPU benchmark ran in a fresh process with socket connections blocked: **2.689 seconds first load+analysis**, then **0.046 / 0.045 seconds**; peak RSS **1023.5 MiB**. Exact outputs are in [benchmark-model.json](benchmark-model.json). This measures one synthetic fixture on this machine, not classification accuracy or field usefulness.

## 2. Service and persistence — complete

Routes/stable stops, visits, uploads, serialized/bounded model queue, original notes, human review, playback, JSON export and deletion implemented. Mutation token, loopback host/origin checks, bounded upload streaming and content/security headers verified.

Independent audio/frontend reviews identified browser playback MIME and long decoding under a mutation lock. MIME now derives from actual container bytes; decoding runs outside the lock, then revalidates visit/stop before inserting. Tests prove concurrent deletion cannot recreate records, deleting during analysis cannot resurrect clips, restart recovery allows retry, and misleading `.html` filenames cannot turn audio into active content. Empty-route deletion refuses routes containing visits.

**15 backend tests pass.** Tests of model-job scheduling use explicit inference doubles, separate from actual model evidence.

## 3. Interface — complete

Preparation/listening card, visits, recorder-file import, local analysis, provenance, multi-label/uncertain human corrections, comparison with original notes/playback, JSON export and deletion implemented. Synthetic examples remain clearly labelled. No external font/CDN dependency.

Independent backend review caught upload drafts leaking between visits and stale comparison selection. Corrected visit+stop component keys and successful-save clearing; rejected saves retain drafts, acknowledged saves followed by refresh failures cannot accidentally retain a duplicate submission. Additional review corrected synthetic-banner scope, model/service refresh recovery and printing from comparison.

**12 React tests pass**, TypeScript checks, Prettier and production build pass. Final production build also ran directly with Node **24.19.0**, avoiding the machine's older npm lifecycle Node warning.

## 4. Integrated review — complete

Parent ran combined Python suite: **27 passed, no skips**, with one upstream Starlette/AnyIO deprecation warning. Real HTTP smoke passed: create route/visit, import the synthetic WAV, fetch correct `audio/wav` payload, save human review, inspect JSON export, and clean up only smoke-created records.

Browser checks performed through the actual interface:

- WAV plays with media `readyState=4`, duration six seconds.
- File chooser imports audio and its original note; records persist after reload/service restart.
- Actual CLAP job completes, displays raw relative scores and provenance, and permits uncertain manual correction.
- Matching-stop comparison differentiates uncertain, unreviewed and missing states; original notes/playback are present.
- Responsive 390px layout has no horizontal overflow; normal viewport restored.

[Actual model-review screenshot](model-review.jpg) and [application screenshot](screenshot.jpg) document the running local app. This is a browser smoke review, not exhaustive assistive-technology certification or validation of every phone codec.

## 5. Presentation — complete

Runnable production app at `http://127.0.0.1:8765`, reproducible README, model/provenance documentation, synthetic CC0 fixtures, field-trial protocol, submission checklist and source archive prepared. Model/cache, installed dependencies, private app data and FFmpeg binaries excluded from source distribution. No remote repository, DEV article, contest entry or deployment published.

## Remaining real-world validation

Two genuine outdoor visits, independently labelled evaluation, the user's actual phone recorder compatibility and final public-media/contest review remain unperformed. Phone-to-Mac file transfer is the supported path; on-phone inference/PWA/background capture are outside this release. Similarity is not probability, species identification, decibels or an environmental trend. Synthetic recordings are never represented as outdoor evidence.
