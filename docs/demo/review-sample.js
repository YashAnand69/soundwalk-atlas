/* No inference or persistence: the candidates below are saved benchmark evidence. */
(() => {
  'use strict';
  const root = document.querySelector('#review-lab');
  if (!root) return;
  const labels = ['Birds', 'Road traffic', 'Wind and leaves', 'Running water', 'Machinery', 'People and voices', 'Dogs and animals', 'Footsteps', 'Paper rustling', 'Rain', 'Insects'];
  const note = root.querySelector('#sample-observation');
  const panel = root.querySelector('#sample-review');
  const original = root.querySelector('#original-observation');
  const options = root.querySelector('#review-labels');
  const none = root.querySelector('#review-none');
  const mixed = root.querySelector('#review-mixed');
  const uncertain = root.querySelector('#review-uncertain');
  const custom = root.querySelector('#review-other');
  const result = root.querySelector('#review-result');
  const status = root.querySelector('#review-status');
  let savedNote = '';
  labels.forEach((label) => {
    const wrapper = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = label;
    wrapper.append(checkbox, document.createTextNode(label));
    options.append(wrapper);
  });
  root.querySelector('#reveal-candidates').addEventListener('click', () => {
    savedNote = note.value.trim();
    original.textContent = savedNote || 'No observation entered. Notes are optional in this sample.';
    panel.hidden = false;
    root.querySelector('#sample-start').hidden = true;
    root.querySelector('#sample-review-heading').focus();
    status.textContent = 'Saved benchmark candidates revealed. No labels have been selected for you.';
  });
  none.addEventListener('change', () => {
    options.querySelectorAll('input').forEach((input) => {
      input.disabled = none.checked;
      if (none.checked) input.checked = false;
    });
    // A free-text correction can explain why none of the model vocabulary fits.
  });
  root.querySelector('#save-review').addEventListener('click', () => {
    const selected = Array.from(options.querySelectorAll('input:checked'), (input) => input.value);
    const correction = custom.value.trim();
    if (!selected.length && !correction && !none.checked && !uncertain.checked && !mixed.checked) {
      status.textContent = 'Choose a label, add your own description, or preserve uncertainty, a mixture, or none fits.';
      return;
    }
    const review = {
      kind: 'Public sample review — not a journal visit or field evidence',
      originalObservation: savedNote,
      source: 'Procedural synthetic noise; saved real LAION CLAP inference, vocabulary v2',
      modelCandidates: [{ label: 'Running water', similarity: 0.3168 }, { label: 'Rain', similarity: 0.30821 }],
      humanLabels: selected,
      correction,
      noneFits: none.checked,
      mixed: mixed.checked,
      uncertain: uncertain.checked,
    };
    result.textContent = JSON.stringify(review, null, 2);
    root.querySelector('#review-summary').hidden = false;
    root.querySelector('#review-summary-heading').focus();
    status.textContent = 'Your sample review is shown below. It stays in this page and is lost on reset or reload.';
  });
  root.querySelector('#reset-review').addEventListener('click', () => {
    savedNote = '';
    note.value = '';
    custom.value = '';
    none.checked = mixed.checked = uncertain.checked = false;
    options.querySelectorAll('input').forEach((input) => { input.checked = false; input.disabled = false; });
    panel.hidden = true;
    root.querySelector('#review-summary').hidden = true;
    root.querySelector('#sample-start').hidden = false;
    result.textContent = '';
    status.textContent = 'Sample reset. Listen and write a fresh observation before seeing suggestions.';
    note.focus();
  });
})();
