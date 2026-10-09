#!/bin/zsh
# Launch the existing local installation; no downloads or browser permissions.
cd "${0:A:h}/.." || exit 1
if [[ ! -x .venv/bin/python ]]; then
  print 'Complete the installation in README.md first.'
  exit 1
fi
.venv/bin/python scripts/check_setup.py || exit 1
print 'Open http://127.0.0.1:8765 in your browser. Press Control-C to stop.'
exec .venv/bin/python scripts/run.py
