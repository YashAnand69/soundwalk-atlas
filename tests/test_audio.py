from pathlib import Path
import subprocess
import numpy as np
import pytest
import soundfile as sf
from soundwalk.audio import validate_audio, AudioAnalyser, _decode, SAMPLE_RATE, PROMPTS, audio_preview


def write(tmp_path, data, rate=48000):
    path = tmp_path / "sample.wav"
    sf.write(path, data, rate, subtype="FLOAT")
    return path


def test_stereo_resamples_and_preserves_duration(tmp_path):
    data = np.tile(np.sin(np.arange(16000) / 10)[:, None] * .1, (1, 2))
    path = write(tmp_path, data, 16000)
    assert _decode(path).shape == (48000,)
    assert validate_audio(path)["duration"] == 1


def test_quiet_clipping_and_window_flags(tmp_path):
    assert "quiet" in validate_audio(write(tmp_path, np.zeros(48000)))["quality"][0]
    assert "clipping" in validate_audio(write(tmp_path, np.ones(48000)))["quality"][0]
    assert "first 10" in validate_audio(write(tmp_path, np.ones(48000 * 11) * .1))["quality"][0]


def test_invalid_and_long_audio(tmp_path):
    path = tmp_path / "fake.wav"
    path.write_text("not audio")
    with pytest.raises(ValueError, match="decode"):
        validate_audio(path)
    with pytest.raises(ValueError, match="30 seconds"):
        validate_audio(write(tmp_path, np.zeros(48000 * 31)))


def test_nonfinite_rejected(tmp_path):
    with pytest.raises(ValueError, match="invalid sample"):
        validate_audio(write(tmp_path, np.full(48000, np.nan)))


def test_missing_model_does_not_download(tmp_path, monkeypatch):
    monkeypatch.setenv("SOUNDWALK_MODEL_DIR", str(tmp_path / "missing"))
    model = AudioAnalyser()
    assert not model.status()["ready"]
    with pytest.raises(RuntimeError, match="not prepared"):
        model.analyse(write(tmp_path, np.full(48000, .1)))


def test_m4a_decoder_and_duration_limit(tmp_path):
    import imageio_ffmpeg
    source = write(tmp_path, np.sin(np.arange(48000) / 12) * .1)
    target = tmp_path / "recorder.m4a"
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(source), "-c:a", "aac", str(target)], check=True)
    assert 0.99 <= validate_audio(target)["duration"] <= 1.05


def test_oversized_and_empty_rejected(tmp_path):
    path = tmp_path / "large.wav"
    with path.open("wb") as f:
        f.truncate(20 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="20 MB"):
        validate_audio(path)
    with pytest.raises(ValueError, match="contain audio"):
        validate_audio(write(tmp_path, np.empty(0)))


def test_more_than_eight_channels_rejected(tmp_path):
    with pytest.raises(ValueError, match="channel"):
        validate_audio(write(tmp_path, np.zeros((480, 9))))


def test_playlist_is_not_followed(tmp_path):
    path = tmp_path / "recording.m3u"
    path.write_text("#EXTM3U\nfile:///etc/passwd\n")
    with pytest.raises(ValueError, match="Unsupported container"):
        validate_audio(path)


@pytest.mark.skipif(not AudioAnalyser().status()["ready"], reason="Prepare pinned model explicitly")
def test_actual_local_model_is_repeatable_and_offline(monkeypatch):
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    # Block sockets as well: cached assets must not silently fetch missing data.
    import socket
    def forbidden(*args, **kwargs):
        raise AssertionError("Network access during inference")
    monkeypatch.setattr(socket.socket, "connect", forbidden)
    fixture = Path(__file__).parent / "fixtures/synthetic-water.wav"
    model = AudioAnalyser()
    first = model.analyse(fixture)
    second = model.analyse(fixture)
    assert first == second
    assert first["status"] == "review"
    assert len(first["suggestions"]) == 2
    assert all(-1 <= s["score"] <= 1 for s in first["suggestions"])


def test_long_aac_rejected_after_bounded_decode(tmp_path):
    import imageio_ffmpeg
    source = write(tmp_path, np.zeros(48000 * 31))
    target = tmp_path / "too-long.m4a"
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(source), "-c:a", "aac", str(target)], check=True)
    with pytest.raises(ValueError, match="30 seconds"):
        validate_audio(target)


def test_deterministic_first_window_and_zero_padding(tmp_path):
    import torch
    captured = []
    class Processor:
        def __call__(self, *, audio, sampling_rate, return_tensors):
            captured.append(audio.copy())
            assert sampling_rate == SAMPLE_RATE
            return {}
    class Model:
        def get_audio_features(self):
            return torch.tensor([[1., 0.]])
    model = AudioAnalyser()
    model._load = lambda: None
    model._processor, model._model = Processor(), Model()
    model._text = torch.tensor([[1., 0.], [0., 1.]] + [[-1., 0.]] * (len(PROMPTS) - 2))
    model.analyse(write(tmp_path, np.concatenate([np.full(48000 * 10, .1), np.full(48000, .5)])))
    assert captured[0].shape == (480000,)
    assert np.allclose(captured[0], .1)
    model.analyse(write(tmp_path, np.full(48000, .2)))
    assert np.allclose(captured[1][:48000], .2)
    assert np.count_nonzero(captured[1][48000:]) == 0


def test_waveform_is_bounded_and_uses_fixed_digital_scale(tmp_path):
    quiet = audio_preview(write(tmp_path, np.full(48000, .01)))
    assert quiet['duration'] == 1
    assert quiet['sampleRate'] == SAMPLE_RATE
    assert len(quiet['peaks']) == 240
    assert quiet['peaks'] == [.01] * 240
    tiny = audio_preview(write(tmp_path, np.array([.2, -.4, .1])))
    assert tiny['peaks'] == [.2, .4, .1]


@pytest.mark.parametrize('start', [-1, float('nan'), float('inf'), True, '0', 1, 1e308])
def test_invalid_segment_is_rejected_before_model_loading(tmp_path, start):
    with pytest.raises(ValueError, match='Segment start'):
        AudioAnalyser().analyse(write(tmp_path, np.full(48000, .1)), start)


def test_silence_abstains_without_preparing_model(tmp_path, monkeypatch):
    monkeypatch.setenv('SOUNDWALK_MODEL_DIR', str(tmp_path / 'missing'))
    result = AudioAnalyser().analyse(write(tmp_path, np.zeros(48000)))
    assert result['suggestions'] == []
    assert 'silent' in result['quality'][-1]
    assert result['segment'] == {'startSeconds': 0, 'endSeconds': 1}
    assert result['matching'] == 'candidate-similarity'
    assert result['vocabularyVersion'] == '2'
    assert result['prompts'] == PROMPTS


def test_selected_window_offset_and_padding(tmp_path):
    import torch
    captured = []
    class Processor:
        def __call__(self, *, audio, **kwargs):
            captured.append(audio.copy())
            return {}
    class Model:
        def get_audio_features(self):
            return torch.tensor([[1., 0.]])
    analyser = AudioAnalyser()
    analyser._load = lambda: None
    analyser._processor, analyser._model = Processor(), Model()
    analyser._text = torch.tensor([[1., 0.]] * len(PROMPTS))
    path = write(tmp_path, np.concatenate([np.full(48000, .1), np.full(48000, .5)]))
    result = analyser.analyse(path, start_seconds=1)
    assert result['segment'] == {'startSeconds': 1, 'endSeconds': 2}
    assert np.allclose(captured[0][:48000], .5)
    assert np.count_nonzero(captured[0][48000:]) == 0
    assert result['suggestions'][0]['label'] == 'Birds'  # stable tied ordering
