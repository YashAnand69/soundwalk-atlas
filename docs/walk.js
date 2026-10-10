/* A browser-only field journal. No network requests or model inference. */
(() => {
  "use strict";
  const KEY = "soundwalk-pocket-v1";
  const $ = (id) => document.getElementById(id);
  const prompts = [
    "Find a safe place to pause. What is closest to you?",
    "Listen beyond the first sound. What sits further away?",
    "Notice a rhythm, a gap, or something that changed.",
  ];
  const fresh = () => ({
    version: 1,
    route: "",
    selected: 0,
    stops: ["stop-1", "stop-2", "stop-3"].map((id) => ({ id, name: "" })),
    visits: [
      {
        started: new Date().toISOString(),
        notes: ["", "", ""],
        reflection: "",
      },
    ],
    updated: null,
  });
  const valid = (s) =>
    s &&
    s.version === 1 &&
    typeof s.route === "string" &&
    s.route.length <= 120 &&
    Number.isInteger(s.selected) &&
    s.selected >= 0 &&
    Array.isArray(s.stops) &&
    s.stops.length === 3 &&
    s.stops.every(
      (p, i) =>
        p &&
        p.id === `stop-${i + 1}` &&
        typeof p.name === "string" &&
        p.name.length <= 120,
    ) &&
    Array.isArray(s.visits) &&
    s.visits.length >= 1 &&
    s.visits.length <= 30 &&
    s.selected < s.visits.length &&
    s.visits.every(
      (v) =>
        v &&
        typeof v.started === "string" &&
        !Number.isNaN(Date.parse(v.started)) &&
        Array.isArray(v.notes) &&
        v.notes.length === 3 &&
        v.notes.every((n) => typeof n === "string" && n.length <= 4000) &&
        typeof v.reflection === "string" &&
        v.reflection.length <= 4000,
    );
  let state = fresh();
  let storageBlocked = false;
  let unsaved = false;
  let storedRaw = null;
  try {
    const raw = localStorage.getItem(KEY);
    storedRaw = raw;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!valid(parsed)) throw new Error("Invalid saved journal");
      state = parsed;
    }
  } catch {
    storageBlocked = true;
    $("load-warning").hidden = false;
    $("load-warning").textContent =
      "Saved notes could not be read. This temporary journal will not overwrite them. Export new notes before leaving. To reset storage, use Clear this journal.";
  }
  const timers = [0, 1, 2].map(() => ({ remaining: 60, end: null }));
  function setStorageStatus(message) {
    if ($("storage-status").textContent !== message)
      $("storage-status").textContent = message;
  }
  function save() {
    state.updated = new Date().toISOString();
    unsaved = true;
    if (storageBlocked) {
      setStorageStatus(
        "Temporary notes only — export before closing this page.",
      );
      return;
    }
    try {
      if (localStorage.getItem(KEY) !== storedRaw) {
        storageBlocked = true;
        $("load-warning").hidden = false;
        $("load-warning").textContent =
          "This journal changed in another tab. Saving here is paused. Export these notes, then reload to open the saved version.";
        setStorageStatus("Saving paused — export before leaving.");
        return;
      }
      const next = JSON.stringify(state);
      localStorage.setItem(KEY, next);
      storedRaw = next;
      unsaved = false;
      setStorageStatus("Saved in this browser · export a copy to keep it.");
    } catch {
      setStorageStatus(
        "Could not save in this browser. Your notes are on this page only — export before closing it.",
      );
    }
  }
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY && event.key !== null) return;
    storageBlocked = true;
    $("load-warning").hidden = false;
    $("load-warning").textContent =
      "This journal changed in another tab. Saving here is paused to avoid overwriting it. Export notes from this tab, then reload to open the latest saved version.";
    setStorageStatus("Saving paused — another tab changed this journal.");
  });
  window.addEventListener("beforeunload", (event) => {
    if (!unsaved) return;
    event.preventDefault();
    event.returnValue = "";
  });
  function progress() {
    const count = state.visits[state.selected].notes.filter((n) =>
      n.trim(),
    ).length;
    $("progress").textContent = `${count} of 3 observations`;
    $("return-visit").disabled =
      !state.visits[state.selected].notes.some((n) => n.trim()) ||
      state.visits.length >= 30;
  }
  function element(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function resetTimers() {
    timers.forEach((t) => {
      t.remaining = 60;
      t.end = null;
    });
  }
  function render() {
    $("route").value = state.route;
    $("reflection").value = state.visits[state.selected].reflection;
    $("first-visit").classList.toggle("active", state.selected === 0);
    $("return-visit").classList.remove("active");
    $("first-visit").setAttribute("aria-pressed", String(state.selected === 0));
    $("return-visit").removeAttribute("aria-pressed");
    $("visit-select").replaceChildren();
    state.visits.forEach((v, i) => {
      const option = element(
        "option",
        "",
        `${i === 0 ? "First listen" : `Return ${i}`} · ${new Date(v.started).toLocaleString()}`,
      );
      option.value = String(i);
      $("visit-select").append(option);
    });
    $("visit-select").value = String(state.selected);
    $("visit-context").textContent =
      `${state.selected === 0 ? "First listen" : "Return visit"} · started ${new Date(state.visits[state.selected].started).toLocaleDateString()}. ${state.selected > 0 ? "Use the same stops. What sounds different today?" : "Write what you hear in your own words. Every field is optional."}`;
    $("stops").replaceChildren();
    state.stops.forEach((stop, i) => {
      const card = element("section", "stop");
      card.setAttribute("aria-labelledby", `heading-${i}`);
      const head = element("div", "stop-head");
      head.append(
        element("span", "stop-number", String(i + 1).padStart(2, "0")),
      );
      const title = element("div");
      const h = element(
        "h3",
        "",
        ["Arrive", "Listen closer", "Leave a trace"][i],
      );
      h.id = `heading-${i}`;
      title.append(h, element("p", "", prompts[i]));
      head.append(title);
      card.append(head);
      const label = element("label", "", `Stop ${i + 1} name (optional)`);
      label.htmlFor = `name-${i}`;
      const input = element("input");
      input.id = `name-${i}`;
      input.maxLength = 120;
      input.placeholder = "A name you will recognise, no address needed";
      input.value = stop.name;
      input.addEventListener("input", () => {
        stop.name = input.value;
        save();
      });
      card.append(label, input);
      const timer = element("div", "timer");
      const time = element("span", "timer-value", "1:00");
      time.id = `time-${i}`;
      time.setAttribute("aria-label", "60 seconds remaining");
      const toggle = element("button", "secondary", "Listen for one minute");
      toggle.type = "button";
      toggle.id = `toggle-${i}`;
      toggle.addEventListener("click", () => toggleTimer(i));
      const reset = element("button", "secondary", "Reset");
      reset.type = "button";
      reset.setAttribute("aria-label", `Reset timer at stop ${i + 1}`);
      reset.addEventListener("click", () => {
        timers[i] = { remaining: 60, end: null };
        paintTimer(i);
      });
      timer.append(time, toggle, reset);
      card.append(
        timer,
        element(
          "p",
          "timer-note",
          "Optional and silent. Pause whenever you like; a timer is not required to save a note.",
        ),
      );
      if (state.selected > 0) {
        const original = element("div", "original");
        original.append(
          element("h4", "", "Your previous visit’s observation"),
          element(
            "p",
            "",
            state.visits[state.selected - 1].notes[i] ||
              "No observation recorded at this stop.",
          ),
        );
        card.append(original);
      }
      const noteLabel = element(
        "label",
        "",
        state.selected > 0
          ? "What is different, or still the same?"
          : "What do you hear?",
      );
      noteLabel.htmlFor = `note-${i}`;
      const note = element("textarea");
      note.id = `note-${i}`;
      note.maxLength = 4000;
      note.rows = 4;
      note.placeholder =
        "A sound, a rhythm, a feeling. Uncertainty belongs here too.";
      note.value = state.visits[state.selected].notes[i];
      note.addEventListener("input", () => {
        state.visits[state.selected].notes[i] = note.value;
        save();
        progress();
      });
      card.append(noteLabel, note);
      $("stops").append(card);
    });
    progress();
  }
  function paintTimer(i) {
    const t = timers[i];
    if (t.end !== null) {
      t.remaining = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
      if (t.remaining === 0) {
        t.end = null;
        $("action-status").textContent =
          `One minute at stop ${i + 1} is complete. Take as much time as you need.`;
      }
    }
    $(`time-${i}`).textContent =
      `${Math.floor(t.remaining / 60)}:${String(t.remaining % 60).padStart(2, "0")}`;
    $(`time-${i}`).setAttribute(
      "aria-label",
      `${t.remaining} seconds remaining`,
    );
    $(`toggle-${i}`).textContent =
      t.end !== null
        ? "Pause listening"
        : t.remaining === 0
          ? "Listen again"
          : t.remaining < 60
            ? "Resume listening"
            : "Listen for one minute";
  }
  function toggleTimer(i) {
    const t = timers[i];
    if (t.end !== null) {
      t.remaining = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
      t.end = null;
    } else {
      if (t.remaining === 0) t.remaining = 60;
      t.end = Date.now() + t.remaining * 1000;
    }
    paintTimer(i);
  }
  setInterval(() => timers.forEach((_, i) => paintTimer(i)), 250);
  $("route").addEventListener("input", () => {
    state.route = $("route").value;
    save();
  });
  $("reflection").addEventListener("input", () => {
    state.visits[state.selected].reflection = $("reflection").value;
    save();
  });
  $("first-visit").addEventListener("click", () => {
    state.selected = 0;
    resetTimers();
    render();
    save();
  });
  $("return-visit").addEventListener("click", () => {
    if (state.visits.length >= 30) return;
    state.visits.push({
      started: new Date().toISOString(),
      notes: ["", "", ""],
      reflection: "",
    });
    state.selected = state.visits.length - 1;
    resetTimers();
    render();
    save();
  });
  $("visit-select").addEventListener("change", () => {
    state.selected = Number($("visit-select").value);
    resetTimers();
    render();
    save();
  });
  $("export").addEventListener("click", () => {
    const lines = [
      "# Soundwalk Atlas — field notes",
      "",
      state.route || "Untitled walk",
      "",
      "Human observations. No AI inference was used in this pocket journal.",
      "",
    ];
    state.visits.forEach((v, index) => {
      lines.push(
        `## ${index === 0 ? "First listen" : `Return visit ${index}`} — ${new Date(v.started).toLocaleString()}`,
        "",
      );
      state.stops.forEach((s, i) =>
        lines.push(
          `### Stop ${i + 1}: ${s.name || "Unnamed stop"}`,
          v.notes[i] || "(No observation recorded)",
          "",
          "",
        ),
      );
      lines.push(
        "### What I noticed",
        v.reflection || "(No reflection recorded)",
        "",
      );
    });
    try {
      const blob = new Blob([lines.join("\n")], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "soundwalk-field-notes.md";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $("action-status").textContent =
        "Export requested. Check your browser downloads or share menu for soundwalk-field-notes.md.";
    } catch {
      $("action-status").textContent =
        "Export could not start. Copy your notes or use Print / save PDF before leaving.";
    }
  });
  $("export-json").addEventListener("click", () => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "soundwalk-field-notes.json";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $("action-status").textContent =
        "JSON export requested. Check your downloads or share menu. JSON is a portable record; this page does not support re-import.";
    } catch {
      $("action-status").textContent =
        "JSON export could not start. Copy your notes or use Print / save PDF.";
    }
  });
  const printCopies = [];
  window.addEventListener("beforeprint", () => {
    document.querySelectorAll("textarea").forEach((field) => {
      const copy = element(
        "p",
        "print-note",
        field.value || "(No observation recorded)",
      );
      copy.style.whiteSpace = "pre-wrap";
      copy.style.overflowWrap = "anywhere";
      field.after(copy);
      field.hidden = true;
      printCopies.push([field, copy]);
    });
  });
  window.addEventListener("afterprint", () => {
    printCopies.splice(0).forEach(([field, copy]) => {
      field.hidden = false;
      copy.remove();
    });
  });
  $("print").addEventListener("click", () => window.print());
  $("clear").addEventListener("click", () => {
    $("clear-confirm").hidden = false;
    $("confirm-clear").focus();
  });
  $("cancel-clear").addEventListener("click", () => {
    $("clear-confirm").hidden = true;
    $("clear").focus();
  });
  $("confirm-clear").addEventListener("click", () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      $("action-status").textContent =
        "Could not delete saved notes from browser storage. They have not been cleared. Use your browser settings to remove this website’s data.";
      return;
    }
    storageBlocked = false;
    storedRaw = null;
    unsaved = false;
    state = fresh();
    resetTimers();
    render();
    $("load-warning").hidden = true;
    $("clear-confirm").hidden = true;
    setStorageStatus("Journal cleared. New notes will be saved as you write.");
    $("action-status").textContent =
      "All visits and their notes were removed from this browser.";
    $("route").focus();
  });
  render();
  $("storage-status").textContent = storageBlocked
    ? "Temporary notes only — export before closing this page."
    : state.updated
      ? "Previous notes restored from this browser."
      : "Your notes will be saved in this browser as you write.";
})();
