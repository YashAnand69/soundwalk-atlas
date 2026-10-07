# Soundwalk Atlas integration contract

New project October 7 2026. Repo root soundwalk-atlas. Local production FastAPI serves frontend/dist on loopback port 8765. Node frontend React/TS/Vite. Data outside tracked repo at SOUNDWALK_DATA_DIR or ~/.local/share/soundwalk-atlas. No external inference/cloud fallback. Full model optional install but actual CLAP must be validated. Public demo clearly labelled synthetic/sample; no fabricated field trials.

## API
All mutating requests require X-Soundwalk-Token from GET /api/config. Origin/Host validation, no wildcard CORS. GET /api/config returns {token, model:{ready:boolean, status:string, revision?:string}, limits:{maxBytes:20971520,maxDuration:30}, version:"1"}. Model ready only real cached assets loaded/available; preparation scripts separate.
GET /api/state returns {routes:Route[],visits:Visit[],clips:Clip[]}.
POST /api/routes {name,stops:string[]} returns Route {id,name,stops:[{id,name}]} (1-5 stops).
POST /api/visits {routeId,title} returns Visit {id,routeId,title,createdAt}.
POST /api/clips multipart file,visitId,stopId,note (note pre-AI human observation) returns Clip.
Clip {id,visitId,stopId,filename,duration,createdAt,note,quality:string[],analysis:null|{suggestions:[{label,score}],status:"review",model,revision,window:string},review:null|{labels:string[],uncertain:boolean,note:string},status:"ready"|"analysing"|"failed",error?:string}.
GET /api/clips/{id}/audio serves original audio; safe stored random IDs.
POST /api/clips/{id}/analyse returns {jobId,status:"queued"}; GET /api/jobs/{jobId} returns {id,status:"queued"|"running"|"done"|"failed",error?:string}. UI polls state/job.
PATCH /api/clips/{id}/review {labels:string[],uncertain:boolean,note:string} returns Clip.
DELETE /api/clips/{id} removes owned audio/data. DELETE /api/visits/{id} cascades clips.
GET /api/export returns attachment JSON schemaVersion:1 with records (no audio). No archive import in MVP.
GET /api/health returns {status:"ok"}.
POST /api/demo creates explicitly synthetic example route/visits/clips with NO fake real model predictions. Result {routeId}; frontend clearly indicates demo/sample and missing analysis until actual inference. Can use fixture WAVs provided by model agent.
Errors {detail:string}; validate bounds. No file paths from client. UUID clip IDs.

## Model interface (backend/soundwalk/audio.py model agent owns)
validate_audio(path: pathlib.Path) -> dict duration:float,quality:list[str] raises ValueError for invalid/long input. Decode WAV initially, support actual recorder codec using imageio_ffmpeg binary if available, bounded decode max30sec+detectlong and channels with temp cleanup.
class AudioAnalyser: status() -> dict ready,status,revision; analyse(path)->dict suggestions:[{label,score}],status:'review',model:str,revision:str,window:str. Local cached CLAP only. Lazy load, CPU; fixed deterministic first10second window explicitly disclosed for longer clips. Scores relative not probability; never claim threshold certified unknown. User decides uncertain/mixed labels. Cache text embeddings once. Lock serialized inference in service/backend worker.
Model agent provides scripts/prepare_model.py, scripts/benchmark_model.py, demo WAV fixtures license/provenance, requirements-model.txt. Actual test CPU + offline load, no field trial invented.

## Ownership
Backend agent: backend/soundwalk/api.py storage.py, backend tests, backend requirements, scripts/run.py. Model agent: audio.py/model package, model dependencies/preparation/benchmarks/tests/fixtures. Frontend agent: all frontend files. Parent: docs, git, root setup, integration fixes/review evidence. Coordinate contract changes before editing shared files. No agents commit/push remotely. Do not touch existing OSS worktrees.
