# Upgrade contract — October 9

Preserve existing local data and APIs. No private user recordings in Git/public artifacts. No claims of calibrated accuracy from the two user-provided examples.

## Audio owner

`AudioAnalyser.analyse(path, start_seconds=0)` accepts a bounded selected first-or-offset 10s segment, returns existing fields plus structured `segment: {startSeconds,endSeconds}`, `vocabularyVersion`, `prompts` (label-to-text), `quality`, `matching: 'candidate-similarity'`. Expand a bounded curated vocabulary incl footsteps/paper/rain/insects; no inventedconfidence threshold. Essentially silent recording yields empty suggestions + explicit quality reason. `audio_preview(path)` => `{peaks: number[], duration: number, sampleRate:48000}` (<=240 peaks normalised against fixed digital scale; no dB). Keep actual bounded decoding, pinned local model. Public/private evaluation separated.

## Backend owner

- `GET /state` adds `observations`.
- `POST /observations` upserts `{visitId, stopId, note, observedAt?: string, context?: string}`, response `{id,visitId,stopId,note,observedAt,context,updatedAt}`. Validate memberships and bounds; delete cascades. Preserve no-audio notes independently.
- Review accepts optional `mixed` and `mismatch` booleans default false alongside labels/uncertain/note.
- POST clip analyse optional JSON `{startSeconds: number}` default0. Preserve legacy test-double analyse(path) when start0; nonzero invokes start_seconds keyword. GET `/clips/{id}/waveform` uses audio_preview without inference, bounded cache.
- Perjob cancellation if feasible: POST `/jobs/{id}/cancel`; running computation isn't forcibly killed but cancelled result not applied; restore clip ready, no resurrection.
- PATCH `/routes/{id}` name and PATCH `/visits/{id}` title allow bounded rename.
- GET `/backup` produces a portable zip records+audio with manifest/checksums; POST `/restore` multipart file additive restore, validated membership/types/bounds, new IDs remapped, traversal/zipbomb/invalidaudio rejected, no partial restore. Cap archive200MB/500files; guard secrets/data/existingrecords. Response `{restoredRoutes,restoredVisits,restoredClips,restoredObservations}`. Never silently overwrite. Strictsecurity remains.

## Frontend owner

Own App.tsx/types.ts/new component TSX and tests. Parent owns style.css. Implement independent observations, freeform+chip humanlabels, mismatch/mixed/uncertain separately, compactfocusjournal, perclipjob instead globalbusyanalysis, structured interval selector/actualwaveform, real uploadmetadata/progress/errors, durable private local drafts with successful-saveclear+warnbeforeunload, comparison perclip labels/certainty/partialcounts/context, archivebackuprestore and names controls. Preserve tests and accessible workflow. Treat newfields optional during transition. Keep originaltextarea commafield if neededbackwardtestcompat but makechipsprimary. No remote audio or fabricatedmetrics. Allcontrols accessible reducedmotion.
