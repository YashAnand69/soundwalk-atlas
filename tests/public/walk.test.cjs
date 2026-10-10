const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../..");
const requireFrontend = createRequire(path.join(root, "frontend/package.json"));
const { JSDOM } = requireFrontend("jsdom");
const html = fs.readFileSync(path.join(root, "docs/walk.html"), "utf8");
const script = fs.readFileSync(path.join(root, "docs/walk.js"), "utf8");
const key = "soundwalk-pocket-v1";
function setup(t, raw, blocked = false) {
  const { window: w } = new JSDOM(html, {
    url: "https://example.org/walk.html",
    runScripts: "outside-only",
  });
  t.after(() => w.close());
  if (raw) w.localStorage.setItem(key, raw);
  if (blocked)
    Object.defineProperty(w, "localStorage", {
      get() {
        throw Error("blocked");
      },
    });
  w.setInterval = (callback) => {
    w.tick = callback;
    return 1;
  };
  w.eval(script);
  return w;
}
const el = (w, id) => w.document.getElementById(id);
const change = (w, id, value) => {
  el(w, id).value = value;
  el(w, id).dispatchEvent(new w.Event("input"));
};
const click = (w, id) => el(w, id).click();
function firstNote(w) {
  change(w, "route", "Park loop");
  change(w, "name-0", "Bench");
  change(w, "note-0", "A bird, then a bicycle");
}

test("three visits retain separate notes, compare previous visit, and survive reload", (t) => {
  const w = setup(t);
  assert.equal(w.document.querySelectorAll(".stop").length, 3);
  assert.equal(el(w, "return-visit").disabled, true);
  firstNote(w);
  assert.equal(el(w, "progress").textContent, "1 of 3 observations");
  click(w, "return-visit");
  assert.match(
    w.document.querySelector(".original").textContent,
    /A bird, then a bicycle/,
  );
  change(w, "note-0", "Quieter this time");
  click(w, "return-visit");
  change(w, "note-0", "Third day: distant train");
  const saved = w.localStorage.getItem(key);
  const data = JSON.parse(saved);
  assert.equal(data.visits.length, 3);
  assert.deepEqual(
    data.visits.map((v) => v.notes[0]),
    ["A bird, then a bicycle", "Quieter this time", "Third day: distant train"],
  );
  assert.match(
    w.document.querySelector(".original").textContent,
    /Quieter this time/,
  );
  const reloaded = setup(t, saved);
  assert.equal(el(reloaded, "note-0").value, "Third day: distant train");
  el(reloaded, "visit-select").value = "1";
  el(reloaded, "visit-select").dispatchEvent(new reloaded.Event("change"));
  assert.equal(el(reloaded, "note-0").value, "Quieter this time");
  click(reloaded, "first-visit");
  assert.equal(el(reloaded, "note-0").value, "A bird, then a bicycle");
});

test("timers pause without counting paused time and finish once resumed", (t) => {
  const w = setup(t);
  let now = 1000;
  w.Date.now = () => now;
  click(w, "toggle-0");
  now += 10000;
  w.tick();
  assert.equal(el(w, "time-0").textContent, "0:50");
  click(w, "toggle-0");
  now += 20000;
  w.tick();
  assert.equal(el(w, "time-0").textContent, "0:50");
  click(w, "toggle-0");
  now += 50000;
  w.tick();
  assert.equal(el(w, "time-0").textContent, "0:00");
  assert.match(el(w, "action-status").textContent, /stop 1 is complete/);
  click(w, "toggle-0");
  assert.equal(el(w, "time-0").textContent, "1:00");
});

test("corrupt or invalid-schema stored data is preserved instead of overwritten", (t) => {
  for (const raw of ["{invalid", JSON.stringify({ version: 1, visits: [] })]) {
    const w = setup(t, raw);
    change(w, "note-0", "Temporary");
    assert.equal(w.localStorage.getItem(key), raw);
    assert.match(el(w, "storage-status").textContent, /Temporary/);
    assert.equal(el(w, "load-warning").hidden, false);
  }
});

test("unavailable storage and quota errors preserve in-memory edits and warn on leaving", (t) => {
  const blocked = setup(t, null, true);
  change(blocked, "note-0", "Unsaved");
  click(blocked, "clear");
  click(blocked, "confirm-clear");
  assert.match(el(blocked, "action-status").textContent, /Could not delete/);
  assert.equal(el(blocked, "note-0").value, "Unsaved");
  const w = setup(t);
  w.Storage.prototype.setItem = () => {
    throw Error("quota");
  };
  change(w, "note-0", "Keep in memory");
  assert.match(el(w, "storage-status").textContent, /Could not save/);
  assert.equal(el(w, "note-0").value, "Keep in memory");
  const leave = new w.Event("beforeunload", { cancelable: true });
  w.dispatchEvent(leave);
  assert.equal(leave.defaultPrevented, true);
});

test("cross-tab events and stale writes pause saving without overwriting another journal", (t) => {
  const w = setup(t);
  firstNote(w);
  const saved = w.localStorage.getItem(key);
  w.dispatchEvent(new w.StorageEvent("storage", { key, newValue: "other" }));
  change(w, "note-0", "Unmerged");
  assert.equal(w.localStorage.getItem(key), saved);
  assert.match(el(w, "load-warning").textContent, /another tab/);
  const second = setup(t, saved);
  second.localStorage.setItem(key, "changed before event delivered");
  change(second, "note-0", "Do not overwrite");
  assert.equal(
    second.localStorage.getItem(key),
    "changed before event delivered",
  );
  assert.match(el(second, "storage-status").textContent, /Saving paused/);
});

test("clear requires confirmation; cancel preserves notes and confirm removes saved visits", (t) => {
  const w = setup(t);
  firstNote(w);
  click(w, "clear");
  click(w, "cancel-clear");
  assert.equal(el(w, "note-0").value, "A bird, then a bicycle");
  click(w, "clear");
  click(w, "confirm-clear");
  assert.equal(w.localStorage.getItem(key), null);
  assert.equal(el(w, "note-0").value, "");
  assert.equal(el(w, "visit-select").options.length, 1);
});

test("Markdown and JSON downloads include all visits with original notes", async (t) => {
  const w = setup(t);
  firstNote(w);
  click(w, "return-visit");
  change(w, "note-0", "Quieter this time");
  const saved = JSON.parse(w.localStorage.getItem(key));
  const captured = [];
  w.URL.createObjectURL = (blob) => {
    captured.push(blob);
    return "blob:test";
  };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  click(w, "export");
  click(w, "export-json");
  assert.equal(captured.length, 2);
  const [md, json] = await Promise.all(
    captured.map(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new w.FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsText(blob);
        }),
    ),
  );
  assert.match(md, /A bird, then a bicycle/);
  assert.match(md, /Quieter this time/);
  assert.deepEqual(JSON.parse(json), saved);
});

test("printing renders complete textarea contents and restores editors afterwards", (t) => {
  const w = setup(t);
  firstNote(w);
  w.dispatchEvent(new w.Event("beforeprint"));
  assert.equal(w.document.querySelectorAll(".print-note").length, 4);
  assert.match(
    w.document.querySelector(".print-note").textContent,
    /A bird, then a bicycle/,
  );
  assert.equal(el(w, "note-0").hidden, true);
  w.dispatchEvent(new w.Event("afterprint"));
  assert.equal(w.document.querySelectorAll(".print-note").length, 0);
  assert.equal(el(w, "note-0").hidden, false);
});
