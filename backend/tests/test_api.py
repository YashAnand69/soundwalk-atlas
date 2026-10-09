"""API isolation tests use an explicitly stubbed model, not claimed real inference."""
import io
import threading
import time
import wave

import pytest
from fastapi.testclient import TestClient
from soundwalk.api import create_app


class StubAnalyser:
    def status(self):
        return {"ready": True, "status": "Test stub only"}

    def analyse(self, path):
        return {"suggestions": [{"label": "Test label", "score": 0.1}], "status": "review", "model": "test-stub", "revision": "test", "window": "first ten seconds"}


def validate(path):
    with wave.open(str(path)) as f:
        return {"duration": f.getnframes() / f.getframerate(), "quality": []}


def wav():
    target = io.BytesIO()
    with wave.open(target, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(8000)
        f.writeframes(b"\x00\x00" * 8000)
    return target.getvalue()


@pytest.fixture
def setup(tmp_path):
    app = create_app(tmp_path, StubAnalyser(), validate, {"testserver"})
    with TestClient(app) as client:
        client.headers["X-Soundwalk-Token"] = client.get("/api/config").json()["token"]
        yield client, tmp_path


def create_clip(client):
    route = client.post("/api/routes", json={"name": "Local", "stops": ["Gate"]}).json()
    visit = client.post("/api/visits", json={"routeId": route["id"], "title": "Morning"}).json()
    response = client.post("/api/clips", data={"visitId": visit["id"], "stopId": route["stops"][0]["id"], "note": "My observation"}, files={"file": ("../../private.wav", wav(), "audio/wav")})
    assert response.status_code == 200
    return route, visit, response.json()


def test_security(setup):
    client, _ = setup
    assert client.post("/api/routes", headers={"X-Soundwalk-Token": "wrong"}, json={"name": "x", "stops": ["x"]}).status_code == 403
    assert client.get("/api/config", headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.get("/api/config", headers={"Host": "evil.example"}).status_code == 403
    assert client.get("/api/config", headers={"Origin": "http://testserver"}).status_code == 200


def test_lifecycle_export_delete(setup):
    client, directory = setup
    _, visit, clip = create_clip(client)
    assert clip["filename"] == "private.wav"
    assert clip["analysis"] is None
    response = client.post(f'/api/clips/{clip["id"]}/analyse')
    job = response.json()["jobId"]
    for _ in range(100):
        state = client.get(f"/api/jobs/{job}").json()
        if state["status"] == "done":
            break
        time.sleep(0.01)
    assert state["status"] == "done"
    assert client.get("/api/state").json()["clips"][0]["analysis"]["model"] == "test-stub"
    assert client.patch(f'/api/clips/{clip["id"]}/review', json={"labels": ["Birds", "Birds"], "uncertain": True, "note": "Corrected"}).json()["review"]["labels"] == ["Birds"]
    assert client.get("/api/export").json()["audioIncluded"] is False
    assert client.get(f'/api/clips/{clip["id"]}/audio').content == wav()
    assert client.delete(f'/api/visits/{visit["id"]}').status_code == 200
    assert client.get("/api/state").json()["clips"] == []
    assert list((directory / "audio").iterdir()) == []


def test_membership_and_cleanup(setup):
    client, directory = setup
    _, visit, _ = create_clip(client)
    response = client.post("/api/clips", data={"visitId": visit["id"], "stopId": "invalid"}, files={"file": ("x.wav", wav())})
    assert response.status_code == 400
    assert not list((directory / "audio").glob("upload-*"))
    assert client.post("/api/visits", json={"routeId": "missing", "title": "x"}).status_code == 404
    assert client.post("/api/routes", json={"name": " ", "stops": ["x"]}).status_code == 422
    assert client.post("/api/routes", json={"name": "x", "stops": ["x"] * 6}).status_code == 422


def test_records_survive_restart(tmp_path):
    first = create_app(tmp_path, StubAnalyser(), validate, {"testserver"})
    with TestClient(first) as client:
        client.headers["X-Soundwalk-Token"] = client.get("/api/config").json()["token"]
        _, _, clip = create_clip(client)
        client.patch(f'/api/clips/{clip["id"]}/review', json={"labels": ["Wind"], "uncertain": False, "note": "Reviewed"})
    second = create_app(tmp_path, StubAnalyser(), validate, {"testserver"})
    with TestClient(second) as client:
        assert client.get("/api/state").json()["clips"][0]["review"]["labels"] == ["Wind"]


def test_failure_and_delete_during_analysis(tmp_path):
    started = threading.Event()
    release = threading.Event()

    class Slow(StubAnalyser):
        def analyse(self, path):
            started.set()
            release.wait(2)
            raise ValueError("Test model failure")

    app = create_app(tmp_path, Slow(), validate, {"testserver"})
    with TestClient(app) as client:
        client.headers["X-Soundwalk-Token"] = client.get("/api/config").json()["token"]
        _, _, clip = create_clip(client)
        job = client.post(f'/api/clips/{clip["id"]}/analyse').json()["jobId"]
        assert started.wait(1)
        assert client.post(f'/api/clips/{clip["id"]}/analyse').status_code == 409
        client.delete(f'/api/clips/{clip["id"]}')
        release.set()
        for _ in range(100):
            if client.get(f"/api/jobs/{job}").json()["status"] == "failed":
                break
            time.sleep(0.01)
        assert client.get("/api/state").json()["clips"] == []
        assert client.get(f"/api/jobs/{job}").json()["error"] == "Test model failure"


def test_upload_size_rejection(setup):
    client, directory = setup
    response = client.post('/api/clips', content=b'', headers={"Content-Length": str(22 * 1024 * 1024)})
    assert response.status_code == 413
    assert not list((directory / 'audio').glob('upload-*'))


def test_bounded_queue(tmp_path):
    release = threading.Event()
    started = threading.Event()

    class Slow(StubAnalyser):
        def analyse(self, path):
            started.set()
            release.wait(5)
            return super().analyse(path)

    app = create_app(tmp_path, Slow(), validate, {'testserver'})
    with TestClient(app) as client:
        client.headers['X-Soundwalk-Token'] = client.get('/api/config').json()['token']
        ids = [create_clip(client)[2]['id'] for _ in range(10)]
        assert client.post(f'/api/clips/{ids[0]}/analyse').status_code == 200
        assert started.wait(1)
        for clip_id in ids[1:9]:
            assert client.post(f'/api/clips/{clip_id}/analyse').status_code == 200
        assert client.post(f'/api/clips/{ids[9]}/analyse').status_code == 429
        assert next(c for c in client.get('/api/state').json()['clips'] if c['id'] == ids[9])['status'] == 'ready'
        release.set()


def test_synthetic_demo_is_not_fake_analysis(setup):
    client, _ = setup
    assert client.post('/api/demo').status_code == 200
    state = client.get('/api/state').json()
    assert len(state['visits']) == 2
    assert len(state['clips']) == 6
    assert all(c['sample'] and c['analysis'] is None for c in state['clips'])


def test_chunked_oversize_is_bounded(setup):
    client, directory = setup
    def data():
        for _ in range(22):
            yield b'x' * 1024 * 1024
    response = client.post('/api/clips', content=data(), headers={'Content-Type': 'multipart/form-data; boundary=x'})
    assert response.status_code in {400, 413}
    assert not list((directory / 'audio').glob('upload-*'))


def test_download_cannot_be_client_selected_html(setup):
    client, _ = setup
    _, _, clip = create_clip(client)
    response = client.get(f'/api/clips/{clip["id"]}/audio')
    assert response.headers['Content-Type'] == 'audio/wav'
    assert response.headers['Content-Security-Policy'].find("frame-ancestors 'none'") >= 0


def test_actual_decoder_rejects_invalid_and_long_audio(tmp_path):
    from soundwalk.audio import validate_audio
    app = create_app(tmp_path, StubAnalyser(), validate_audio, {'testserver'})
    with TestClient(app) as client:
        client.headers['X-Soundwalk-Token'] = client.get('/api/config').json()['token']
        route, visit, _ = create_clip(client)
        metadata = {'visitId': visit['id'], 'stopId': route['stops'][0]['id']}
        assert client.post('/api/clips', data=metadata, files={'file': ('bad.wav', b'not audio')}).status_code == 400
        target = io.BytesIO()
        with wave.open(target, 'wb') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(8000)
            f.writeframes(b'\x00\x00' * 31 * 8000)
        assert client.post('/api/clips', data=metadata, files={'file': ('long.wav', target.getvalue())}).status_code == 400
        assert len(client.get('/api/state').json()['clips']) == 1
        assert not list((tmp_path / 'audio').glob('upload-*'))


def test_restart_marks_interrupted_job_retryable(tmp_path):
    from soundwalk.storage import Store
    store = Store(tmp_path)
    store.put('clips', {'id': 'test', 'status': 'analysing'})
    store.close()
    restarted = Store(tmp_path)
    assert restarted.get('clips', 'test')['status'] == 'failed'
    assert 'interrupted' in restarted.get('clips', 'test')['error']
    restarted.close()


def test_audio_mime_comes_from_container_not_filename(setup):
    client, _ = setup
    route = client.post('/api/routes', json={'name': 'Test', 'stops': ['Stop']}).json()
    visit = client.post('/api/visits', json={'routeId': route['id'], 'title': 'Visit'}).json()
    clip = client.post('/api/clips', data={'visitId': visit['id'], 'stopId': route['stops'][0]['id']}, files={'file': ('not-html.html', wav())}).json()
    response = client.get(f'/api/clips/{clip["id"]}/audio')
    assert response.headers['content-type'] == 'audio/wav'
    assert response.headers['x-content-type-options'] == 'nosniff'


def test_decoding_does_not_block_state_or_resurrect_deleted_visit(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    started, release = threading.Event(), threading.Event()

    def slow_validator(path):
        started.set()
        release.wait(3)
        return validate(path)

    app = create_app(tmp_path, StubAnalyser(), slow_validator, {'testserver'})
    with TestClient(app) as client:
        client.headers['X-Soundwalk-Token'] = client.get('/api/config').json()['token']
        route = client.post('/api/routes', json={'name': 'Test', 'stops': ['Stop']}).json()
        visit = client.post('/api/visits', json={'routeId': route['id'], 'title': 'Visit'}).json()
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(client.post, '/api/clips', data={'visitId': visit['id'], 'stopId': route['stops'][0]['id']}, files={'file': ('test.wav', wav())})
            try:
                assert started.wait(1)
                before = time.monotonic()
                assert client.get('/api/state').status_code == 200
                assert client.delete(f'/api/visits/{visit["id"]}').status_code == 200
                assert time.monotonic() - before < 1
            finally:
                release.set()
            assert future.result(timeout=2).status_code == 404
        assert client.get('/api/state').json()['clips'] == []
        assert list((tmp_path / 'audio').iterdir()) == []


def test_route_removal_requires_explicit_visit_cleanup(setup):
    client, _ = setup
    route, visit, _ = create_clip(client)
    assert client.delete(f'/api/routes/{route["id"]}').status_code == 409
    client.delete(f'/api/visits/{visit["id"]}')
    assert client.delete(f'/api/routes/{route["id"]}').status_code == 200
    assert client.get('/api/state').json()['routes'] == []


def test_observations_without_audio_upsert_and_cascade(setup):
    client, _ = setup
    route = client.post('/api/routes', json={'name': 'Notes', 'stops': ['Gate', 'Tree']}).json()
    visit = client.post('/api/visits', json={'routeId': route['id'], 'title': 'Dawn'}).json()
    body = {'visitId': visit['id'], 'stopId': route['stops'][0]['id'], 'note': 'Leaves moving', 'context': 'Breezy', 'observedAt': '2026-10-09T07:00'}
    observation = client.post('/api/observations', json=body).json()
    edited = client.post('/api/observations', json={**body, 'note': 'Wind and birds'}).json()
    assert edited['id'] == observation['id']
    state = client.get('/api/state').json()
    assert state['clips'] == [] and len(state['observations']) == 1
    assert client.post('/api/observations', json={**body, 'stopId': 'missing'}).status_code == 400
    assert client.post('/api/observations', json={**body, 'note': 'x' * 2001}).status_code == 422
    assert client.patch(f"/api/routes/{route['id']}", json={'name': ' Evening walk '}).json()['name'] == 'Evening walk'
    assert client.patch(f"/api/visits/{visit['id']}", json={'title': 'Evening'}).json()['title'] == 'Evening'
    assert client.patch(f"/api/routes/{route['id']}", json={'name': ' '}).status_code == 400
    client.delete(f"/api/visits/{visit['id']}")
    assert client.get('/api/state').json()['observations'] == []


def test_extended_review_and_interval_validation(setup):
    client, _ = setup
    _, _, clip = create_clip(client)
    result = client.patch(f"/api/clips/{clip['id']}/review", json={'labels': ['Paper'], 'uncertain': False, 'mixed': True, 'mismatch': True, 'note': 'None fits'}).json()
    assert result['review']['mixed'] and result['review']['mismatch']
    assert client.post(f"/api/clips/{clip['id']}/analyse", json={'startSeconds': -1}).status_code == 422
    assert client.post(f"/api/clips/{clip['id']}/analyse", json={'startSeconds': 1}).status_code == 400


def test_cancel_running_then_resubmit_never_applies_cancelled_result(tmp_path):
    started = threading.Event()
    release = threading.Event()
    class Blocking(StubAnalyser):
        def __init__(self):
            self.calls = 0
        def analyse(self, path, start_seconds=0):
            self.calls += 1
            if self.calls == 1:
                started.set()
                release.wait(3)
                raise ValueError('Cancelled failure must not corrupt new result')
            return {'suggestions': [], 'status': 'review', 'marker': 'new'}
    analyser = Blocking()
    app = create_app(tmp_path, analyser, validate, {'testserver'})
    with TestClient(app) as client:
        client.headers['X-Soundwalk-Token'] = client.get('/api/config').json()['token']
        _, _, clip = create_clip(client)
        job = client.post(f"/api/clips/{clip['id']}/analyse").json()['jobId']
        assert started.wait(1)
        assert client.post(f'/api/jobs/{job}/cancel').json()['status'] == 'cancelled'
        # Force history pruning while a cancelled inference is still in flight.
        for index in range(105):
            app.state.jobs[f'historical-{index}'] = {'id': f'historical-{index}', 'status': 'done'}
        new = client.post(f"/api/clips/{clip['id']}/analyse").json()['jobId']
        release.set()
        for _ in range(100):
            if client.get(f'/api/jobs/{new}').json()['status'] == 'done':
                break
            time.sleep(.01)
        stored = client.get('/api/state').json()['clips'][0]
        assert stored['status'] == 'ready' and stored['analysis']['marker'] == 'new'
        assert client.get(f'/api/jobs/{job}').json()['status'] == 'cancelled'


def test_backup_restore_roundtrip_new_ids_and_duplicate_guard(setup):
    client, directory = setup
    route, visit, clip = create_clip(client)
    client.post('/api/observations', json={'visitId': visit['id'], 'stopId': route['stops'][0]['id'], 'note': 'Before AI'})
    client.patch(f"/api/clips/{clip['id']}/review", json={'labels': ['Footsteps'], 'uncertain': False, 'mixed': False, 'mismatch': True, 'note': 'Correction'})
    backup = client.get('/api/backup')
    assert backup.status_code == 200 and backup.headers['content-type'] == 'application/zip'
    result = client.post('/api/restore', files={'file': ('backup.zip', backup.content, 'application/zip')})
    assert result.status_code == 200, result.text
    assert result.json() == {'restoredRoutes': 1, 'restoredVisits': 1, 'restoredClips': 1, 'restoredObservations': 1}
    state = client.get('/api/state').json()
    assert len(state['routes']) == 2 and len(state['clips']) == 2
    restored = state['clips'][1]
    assert restored['id'] != clip['id'] and restored['visitId'] != visit['id']
    assert restored['review']['labels'] == ['Footsteps'] and restored['analysis'] is None
    assert (directory / 'audio' / restored['id']).read_bytes() == wav()
    assert client.post('/api/restore', files={'file': ('backup.zip', backup.content)}).status_code == 400
    assert len(client.get('/api/state').json()['clips']) == 2


def rewrite_zip(raw, transform):
    import zipfile
    source = zipfile.ZipFile(io.BytesIO(raw))
    files = {name: source.read(name) for name in source.namelist()}
    transform(files)
    target = io.BytesIO()
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return target.getvalue()


@pytest.mark.parametrize('variant', ['traversal', 'corrupt', 'membership', 'bad-audio', 'duplicate-stop', 'oversize'])
def test_restore_rejects_invalid_without_partial_records(setup, variant):
    import json
    import hashlib
    client, directory = setup
    create_clip(client)
    original = client.get('/api/state').json()
    raw = client.get('/api/backup').content
    def mutate(files):
        if variant == 'traversal':
            files['../outside'] = b'bad'
        elif variant == 'corrupt':
            files['records.json'] += b'bad'
        elif variant == 'oversize':
            # Highly compressed metadata is rejected before JSON parsing.
            files['records.json'] = b'x' * (4 * 1024 * 1024 + 1)
        else:
            state = json.loads(files['records.json'])
            if variant == 'membership':
                state['clips'][0]['visitId'] = 'missing'
            elif variant == 'duplicate-stop':
                state['routes'][0]['stops'].append(state['routes'][0]['stops'][0])
            elif variant == 'bad-audio':
                files['audio/' + state['clips'][0]['id']] = b'not audio'
            files['records.json'] = json.dumps(state).encode()
            manifest = json.loads(files['manifest.json'])
            manifest['files'] = {name: {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)} for name, data in files.items() if name != 'manifest.json'}
            files['manifest.json'] = json.dumps(manifest).encode()
    data = rewrite_zip(raw, mutate)
    response = client.post('/api/restore', files={'file': ('bad.zip', data)})
    assert response.status_code == 400, response.text
    assert client.get('/api/state').json() == original
    assert len(list((directory / 'audio').iterdir())) == 1


def test_backup_preserves_valid_analysis_provenance(setup):
    client, _ = setup
    _, _, clip = create_clip(client)
    job = client.post(f"/api/clips/{clip['id']}/analyse").json()['jobId']
    for _ in range(100):
        if client.get(f'/api/jobs/{job}').json()['status'] == 'done':
            break
        time.sleep(.01)
    backup = client.get('/api/backup').content
    assert client.post('/api/restore', files={'file': ('backup.zip', backup)}).status_code == 200
    analysis = client.get('/api/state').json()['clips'][1]['analysis']
    assert analysis['revision'] == 'test' and analysis['suggestions'][0]['score'] == .1
    assert analysis['restored'] is True


@pytest.mark.parametrize('bad', ['score', 'segment', 'shape', 'manifest'])
def test_backup_rejects_malformed_prediction_atomic(setup, bad):
    import hashlib
    import json
    client, _ = setup
    create_clip(client)
    before = client.get('/api/state').json()
    raw = client.get('/api/backup').content
    def mutate(files):
        if bad == 'manifest':
            files['manifest.json'] = b'[]'
            return
        state = json.loads(files['records.json'])
        prediction = {'suggestions': [{'label': 'Birds', 'score': .2}], 'model': 'local', 'revision': 'pinned', 'window': '10 seconds'}
        if bad == 'score':
            prediction['suggestions'][0]['score'] = float('nan')
        elif bad == 'segment':
            prediction['segment'] = {'startSeconds': 0, 'endSeconds': 999}
        elif bad == 'shape':
            prediction['suggestions'] = 'bad'
        state['clips'][0]['analysis'] = prediction
        files['records.json'] = json.dumps(state).encode()
        manifest = json.loads(files['manifest.json'])
        manifest['files']['records.json'] = {'bytes': len(files['records.json']), 'sha256': hashlib.sha256(files['records.json']).hexdigest()}
        files['manifest.json'] = json.dumps(manifest).encode()
    result = client.post('/api/restore', files={'file': ('bad.zip', rewrite_zip(raw, mutate))})
    assert result.status_code == 400
    assert client.get('/api/state').json() == before


@pytest.mark.parametrize('segment', [
    {'startSeconds': 10, 'endSeconds': 20},
    {'startSeconds': 0, 'endSeconds': 2},
])
def test_restore_rejects_analysis_beyond_decoded_audio_atomic(setup, segment):
    import hashlib
    import json
    client, directory = setup
    _, _, clip = create_clip(client)  # A one-second WAV, independent of archive metadata.
    before = client.get('/api/state').json()
    raw = client.get('/api/backup').content

    def mutate(files):
        state = json.loads(files['records.json'])
        state['clips'][0]['duration'] = 20
        state['clips'][0]['analysis'] = {
            'suggestions': [{'label': 'Birds', 'score': .2}],
            'model': 'local', 'revision': 'pinned', 'window': 'selected',
            'segment': segment,
        }
        files['records.json'] = json.dumps(state).encode()
        manifest = json.loads(files['manifest.json'])
        manifest['files']['records.json'] = {
            'bytes': len(files['records.json']),
            'sha256': hashlib.sha256(files['records.json']).hexdigest(),
        }
        files['manifest.json'] = json.dumps(manifest).encode()

    response = client.post('/api/restore', files={
        'file': ('inconsistent.zip', rewrite_zip(raw, mutate)),
    })
    assert response.status_code == 400
    assert response.json()['detail'] == 'Invalid analysis interval'
    assert client.get('/api/state').json() == before
    assert list((directory / 'audio').iterdir()) == [directory / 'audio' / clip['id']]
    assert (directory / 'audio' / clip['id']).read_bytes() == wav()
    assert client.app.state.store.all('restores') == []


def test_waveform_actual_decoded_preview(setup):
    client, _ = setup
    _, _, clip = create_clip(client)
    response = client.get(f"/api/clips/{clip['id']}/waveform")
    assert response.status_code == 200
    assert response.json()['duration'] == 1
    assert len(response.json()['peaks']) <= 240
    assert all(0 <= peak <= 1 for peak in response.json()['peaks'])
