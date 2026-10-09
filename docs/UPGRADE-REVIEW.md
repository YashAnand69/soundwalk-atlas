# Integrated upgrade review — October 9, 2026

This upgrade was implemented with audio, persistence/API and interface subagents, followed by parent integration review. The account usage limit interrupted final subagent reporting; the parent completed integration fixes and verification. No contest success or independent field accuracy is claimed.

## Stage 1: observations and safe persistence

Written notes now save independently of audio, with optional local observation time and context. Walks and visits can be renamed. Private ZIP backups include original recordings and validated historical analyses/reviews; restoration is additive with fresh IDs and checksums, atomic on failure, and rejects duplicate archives, invalid references, corrupt audio, traversal and oversized content. JSON export remains records-only. A private pre-upgrade database snapshot was retained locally and excluded from Git.

Review replaced an unreliable native restore confirmation with an inline confirmation and populated the previously missing result counts. Two interface regressions cover confirmation and cancellation. Review corrected malformed archive metadata handling, excessive pre-validation reads, missing analysis provenance on restore, and a visit-creation/deletion race. Backup restoration serializes mutations while validation completes; it is bounded, but large imports can temporarily delay other writes. Backups and unsaved browser drafts have distinct privacy/lifetime rules.

## Stage 2: audio with honest interpretation

Eleven versioned prompts include footsteps and paper rustling. Selected intervals are bounded to ten seconds, with a waveform from actual decoded samples. Saved results record interval bounds, vocabulary and exact prompts. Moving the selector explicitly marks previous matches as stale. Digital silence returns no candidates; quiet/clipping warnings describe digital amplitude, not ambient decibels. Non-silent unsupported audio still requires human rejection.

Review corrected a huge finite-offset overflow before sample-index conversion. Per-clip cancellation now protects queued/running jobs against premature history pruning and prevents late results from being applied. The pinned real model was exercised offline in the benchmark and through real local HTTP inference. The user's two OPUS files were development examples only, kept out of public artifacts.

## Stage 3: integrated interface

Focus mode, contextual next action, note/context forms, real waveform selection, canonical/custom label controls, explicit mismatch/multiple-sound/uncertainty judgments, richer comparisons, backup/restore and rename controls share the journal. AI suggestions never populate human labels automatically. Draft text persists locally; pending files survive internal navigation, but require reselection after reload. Failed uploads retain drafts. Deleting an owned visit clears its pending file references.

Original illustrated landscape, day/dusk controls, subtle arrivals and scroll reveals remain decorative. Pause motion and OS reduced-motion preferences disable decorative animations. At 390 × 844, document width was 390 pixels with no horizontal overflow. The native phone-recorder → local Mac transfer remains the supported field workflow; this is not on-phone inference or a phone PWA.

## Verification performed

- 57 Python regressions passed: API/storage/backup/cancellation, audio bounds/codecs/offline model and evaluation manifest handling. One upstream Starlette/AnyIO deprecation warning remains.
- 31 interface tests passed. TypeScript checks and production build passed; built JS ~81.7 KB gzip and CSS ~8 KB gzip.
- Real browser: note-only saving, synthetic 24-second import, keyboard interval selection, pinned-model analysis at 14–24 seconds, rejection of candidate matches, persistence after reload, comparison context/review counts, inline backup confirmation/restored counts and mobile width.
- Isolated real HTTP service: note-only save, actual waveform, pinned-model 14–24 second inference, human rejection, private ZIP restoration preserving analysis and review, duplicate-restore rejection. Synthetic data only; the temporary service shut down afterward.
- Read-only setup diagnostics passed for installed dependencies, built interface, decoder and prepared model. Mac launcher delegates to the same loopback runner; no downloads are hidden in launch.

Screenshots use synthetic journal records. No user audio, model weights, database, private backup or installed binary is committed.

## Remaining evidence and scope

Two genuine listening visits, consented original media, a short demo video and a carefully reviewed DEV article are still needed for the proposed submission narrative. Those are user fieldwork/editorial steps, not fabricated app tests. An independent held-out audio evaluation remains unperformed; the evaluation script and protocol are provided. Prompt expansion is not calibrated unknown-sound detection. A signed desktop installer, phone inference and automatic byte-by-byte upload progress are not delivered; local setup, bounded uploads with decoding state, and truthful recovery messages are delivered. Broader cross-browser/device and assistive-technology testing remains useful before claiming universal accessibility.
