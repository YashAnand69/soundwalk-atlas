"""Offline evaluation runner; user labels are never passed to the model.

A manifest contains recordings [{path, expectedLabels, provenance, split,
startSeconds?}]. Supported splits: development, held-out, synthetic. Hold-out
independence is a human declaration, not verified by this program. Output can
contain private filenames/labels: keep private evaluation reports untracked.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import time

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from soundwalk.audio import AudioAnalyser, PROMPTS, REVISION, VOCABULARY_VERSION


def evaluate(manifest_path: Path) -> dict:
    manifest = json.loads(manifest_path.read_text())
    recordings = manifest.get('recordings')
    if not isinstance(recordings, list) or not 1 <= len(recordings) <= 500:
        raise ValueError('Manifest must contain between 1 and 500 recordings.')
    # Validate the entire manifest before any expensive inference.
    cases = []
    for entry in recordings:
        if not isinstance(entry, dict):
            raise ValueError('Each recording must be an object.')
        labels = entry.get('expectedLabels')
        if not isinstance(labels, list) or not all(isinstance(label, str) and label for label in labels):
            raise ValueError('expectedLabels must be a list of non-empty strings, or [] for silence/unsupported.')
        if entry.get('split') not in {'development', 'held-out', 'synthetic'}:
            raise ValueError('Every recording needs a development, held-out, or synthetic split.')
        if not isinstance(entry.get('provenance'), str) or not entry['provenance'].strip():
            raise ValueError('Every recording needs provenance and permission information.')
        if not isinstance(entry.get('path'), str):
            raise ValueError('Every recording needs a file path.')
        path = (manifest_path.parent / entry['path']).resolve()
        cases.append((entry, path))
    analyser = AudioAnalyser()
    rows = []
    for entry, path in cases:
        started = time.perf_counter()
        # Only audio + requested interval enter inference, never expectedLabels.
        analysis = analyser.analyse(path, start_seconds=entry.get('startSeconds', 0))
        predicted = {item['label'] for item in analysis['suggestions']}
        expected = set(entry['expectedLabels'])
        rows.append({'path': entry['path'], 'inputSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'split': entry['split'], 'provenance': entry['provenance'],
                     'expectedLabels': entry['expectedLabels'],
                     'vocabularyCovered': bool(expected) and expected.issubset(PROMPTS),
                     'topTwoContainsExpected': bool(expected & predicted) if expected else None,
                     'seconds': round(time.perf_counter() - started, 3), 'analysis': analysis})
    summaries = {}
    for split in ('development', 'held-out', 'synthetic'):
        group = [row for row in rows if row['split'] == split]
        covered = [row for row in group if row['vocabularyCovered']]
        summaries[split] = {'count': len(group), 'coveredCases': len(covered),
                            'topTwoContainsExpectedCount': sum(row['topTwoContainsExpected'] for row in covered),
                            'unsupportedOrSilenceCases': len(group) - len(covered)}
    return {'modelRevision': REVISION, 'vocabularyVersion': VOCABULARY_VERSION,
            'offline': True, 'summaries': summaries, 'recordings': rows,
            'limitations': 'Split independence and labels are supplied by the evaluator, not independently verified. Top-two overlap is descriptive, not calibrated confidence or environmental accuracy. Synthetic and development results are not field validation.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    def no_network(*_args, **_kwargs):
        raise RuntimeError('Network connection attempted during offline evaluation')
    socket.socket.connect = no_network
    result = json.dumps(evaluate(args.manifest.resolve()), indent=2)
    if args.output:
        args.output.write_text(result + '\n')
    else:
        print(result)


if __name__ == '__main__':
    main()
