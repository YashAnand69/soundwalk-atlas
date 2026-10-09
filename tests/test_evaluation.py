"""The evaluation tool must separate claimed splits and keep labels out of inference."""
import importlib.util
import json
from pathlib import Path
import pytest


def module():
    spec = importlib.util.spec_from_file_location('evaluate_audio', Path(__file__).parents[1] / 'scripts/evaluate_audio.py')
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def test_evaluation_does_not_feed_expected_labels_to_model(tmp_path, monkeypatch):
    tool = module()
    calls = []
    class Model:
        def analyse(self, path, start_seconds=0):
            calls.append((path, start_seconds))
            return {'suggestions': [{'label': 'Footsteps', 'score': .4}]}
    monkeypatch.setattr(tool, 'AudioAnalyser', Model)
    (tmp_path / 'sample.wav').write_bytes(b'fixture')
    manifest = tmp_path / 'manifest.json'
    manifest.write_text(json.dumps({'recordings': [
        {'path': 'sample.wav', 'expectedLabels': ['Footsteps'], 'split': 'development', 'provenance': 'Test fixture'},
        {'path': 'sample.wav', 'expectedLabels': ['Unknown sound'], 'split': 'held-out', 'provenance': 'Test fixture', 'startSeconds': 2},
    ]}))
    result = tool.evaluate(manifest)
    assert calls == [(tmp_path / 'sample.wav', 0), (tmp_path / 'sample.wav', 2)]
    assert result['summaries']['development']['topTwoContainsExpectedCount'] == 1
    assert result['summaries']['held-out']['coveredCases'] == 0
    assert result['summaries']['synthetic']['count'] == 0


@pytest.mark.parametrize('entry', [
    {'path': 'a', 'expectedLabels': ['Birds'], 'split': 'held-out'},
    {'path': 'a', 'expectedLabels': 'Birds', 'split': 'synthetic', 'provenance': 'Own'},
    {'path': 'a', 'expectedLabels': [], 'split': 'accuracy', 'provenance': 'Own'},
])
def test_incomplete_evaluation_manifest_is_rejected(tmp_path, entry):
    path = tmp_path / 'manifest.json'
    path.write_text(json.dumps({'recordings': [entry]}))
    with pytest.raises(ValueError):
        module().evaluate(path)
