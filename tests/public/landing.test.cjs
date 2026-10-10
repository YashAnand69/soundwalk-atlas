const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("../../frontend/node_modules/jsdom");
const docs = path.resolve(__dirname, "../../docs");
function page(reduced = false) {
  const dom = new JSDOM(
    fs.readFileSync(path.join(docs, "index.html"), "utf8"),
    { runScripts: "outside-only", pretendToBeVisual: true },
  );
  dom.window.matchMedia = () => ({ matches: reduced, addEventListener() {} });
  dom.window.eval(fs.readFileSync(path.join(docs, "atlas.js"), "utf8"));
  dom.window.eval(
    fs.readFileSync(path.join(docs, "demo/review-sample.js"), "utf8"),
  );
  return dom;
}
test("motion control pauses decorations and reduced-motion preference is respected", () => {
  const dom = page();
  const button = dom.window.document.querySelector("#motion-toggle");
  button.click();
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(
    dom.window.document.body.classList.contains("motion-paused"),
    true,
  );
  button.click();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  dom.window.close();
  const reduced = page(true);
  assert.equal(
    reduced.window.document.querySelector("#motion-toggle").disabled,
    true,
  );
  assert.equal(
    reduced.window.document.body.classList.contains("motion-paused"),
    true,
  );
  reduced.window.close();
});
test("sample preserves observation as text, keeps labels empty, and records independent judgment", () => {
  const dom = page();
  const d = dom.window.document;
  const note = "<img src=x onerror=alert(1)> distant hiss";
  d.querySelector("#sample-observation").value = note;
  d.querySelector("#reveal-candidates").click();
  assert.equal(d.querySelector("#original-observation").textContent, note);
  assert.equal(d.querySelector("#original-observation img"), null);
  assert.equal(d.querySelectorAll("#review-labels input:checked").length, 0);
  d.querySelector("#save-review").click();
  assert.equal(d.querySelector("#review-summary").hidden, true);
  d.querySelector("#review-labels input").click();
  d.querySelector("#review-none").click();
  assert.equal(d.querySelectorAll("#review-labels input:checked").length, 0);
  d.querySelector("#review-other").value = "Generated hiss";
  d.querySelector("#review-uncertain").click();
  d.querySelector("#save-review").click();
  const result = JSON.parse(d.querySelector("#review-result").textContent);
  assert.equal(result.originalObservation, note);
  assert.deepEqual(result.humanLabels, []);
  assert.equal(result.noneFits, true);
  assert.equal(result.uncertain, true);
  assert.equal(result.correction, "Generated hiss");
  assert.equal(result.modelCandidates[0].similarity, 0.3168);
  d.querySelector("#reset-review").click();
  assert.equal(d.querySelector("#review-summary").hidden, true);
  assert.equal(d.querySelector("#sample-observation").value, "");
  dom.window.close();
});
