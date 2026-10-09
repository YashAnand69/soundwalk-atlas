import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ListeningPrelude } from "./ListeningPrelude";
import { useScrollMotion } from "./useScrollMotion";
import {
  FieldHero,
  JournalStats,
  ListeningTimer,
  StationRail,
} from "./FieldInstrument";
import type { Clip, Config, Route, State, Visit, Observation } from "./types";
import { clipSummary, stopClips } from "./types";
const empty: State = { routes: [], visits: [], clips: [] };
export default function App() {
  const [config, setConfig] = useState<Config | null>(null),
    [state, setState] = useState<State>(empty),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState<"walk" | "compare">("walk"),
    [routeId, setRouteId] = useState(""),
    [visitId, setVisitId] = useState(""),
    [compareId, setCompareId] = useState("");
  const [focus, setFocus] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const appRoot = useRef<HTMLDivElement>(null);
  useScrollMotion(appRoot);
  const [jobs, setJobs] = useState<
    Record<string, { id: string; status: string }>
  >({});
  const [routeName, setRouteName] = useState("My neighborhood loop"),
    [stops, setStops] = useState(
      "At the gate\nUnder the trees\nA quiet corner",
    ),
    [title, setTitle] = useState("");
  const retainedFiles = useRef(new Map<string, File>());
  const activeJobs = useRef(new Map<string, string>());
  const [restoreResult, setRestoreResult] = useState("");
  const [pendingBackup, setPendingBackup] = useState<File | null>(null);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (retainedFiles.current.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const mounted = useRef(true);
  const workspace = useRef<HTMLDivElement>(null);
  const preparation = useRef<HTMLDetailsElement>(null);
  function openWorkspace(prepare = false) {
    setTab("walk");
    if (prepare && preparation.current) preparation.current.open = true;
    window.requestAnimationFrame(() => {
      const target = prepare ? preparation.current : workspace.current;
      target?.scrollIntoView({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      if (prepare)
        preparation.current
          ?.querySelector("input")
          ?.focus({ preventScroll: true });
      else workspace.current?.focus({ preventScroll: true });
    });
  }
  function selectStation(id: string) {
    const target = document.getElementById("station-" + id);
    target?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    target?.focus({ preventScroll: true });
  }
  const route = state.routes.find((r) => r.id === routeId),
    visits = state.visits.filter((v) => v.routeId === routeId),
    visit = visits.find((v) => v.id === visitId);
  const pendingReviews = state.clips.filter(
    (c) => c.visitId === visitId && !c.review,
  ).length;
  const hasObservation = !!state.observations?.some(
    (o) => o.visitId === visitId && o.note.trim(),
  );
  const visitClips = state.clips.filter((c) => c.visitId === visitId);
  const nextAction = !route
    ? "Prepare your first walk"
    : !visit
      ? "Start a visit"
      : !hasObservation
        ? "Save your first written observation"
        : !visitClips.length
          ? "Import an optional recording"
          : pendingReviews
            ? `Review ${pendingReviews} recording${pendingReviews === 1 ? "" : "s"}`
            : visits.length < 2
              ? "Return for another visit"
              : "Compare your visits";
  function followNextAction() {
    if (!route) {
      openWorkspace(true);
      return;
    }
    if (
      visit &&
      hasObservation &&
      visitClips.length &&
      !pendingReviews &&
      visits.length > 1
    ) {
      setTab("compare");
      setCompareId(visits.find((v) => v.id !== visitId)?.id || "");
      openWorkspace();
      setTab("compare");
      return;
    }
    openWorkspace();
    window.requestAnimationFrame(() => {
      const selector =
        !visit || (hasObservation && visitClips.length && !pendingReviews)
          ? ".visit-controls input"
          : !hasObservation
            ? ".observation-editor textarea"
            : !visitClips.length
              ? ".upload input[type=file]"
              : ".review input";
      const target = workspace.current?.querySelector<HTMLElement>(selector);
      target?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "instant"
          : "smooth",
      });
      target?.focus({ preventScroll: true });
    });
  }
  async function request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const h = new Headers(options.headers);
    if (options.method && options.method !== "GET")
      h.set("X-Soundwalk-Token", config?.token || "");
    if (options.body && !(options.body instanceof FormData))
      h.set("Content-Type", "application/json");
    const res = await fetch("/api" + path, { ...options, headers: h });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(
        typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail),
      );
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }
  async function refresh() {
    const next = await request<State>("/state");
    if (mounted.current) setState(next);
    return next;
  }
  useEffect(() => {
    mounted.current = true;
    Promise.all([
      fetch("/api/config").then((r) => {
        if (!r.ok) throw new Error("Local service unavailable");
        return r.json();
      }),
      fetch("/api/state").then((r) => {
        if (!r.ok) throw new Error("Cannot read your journal");
        return r.json();
      }),
    ])
      .then(([c, s]) => {
        if (!mounted.current) return;
        setConfig(c);
        setState(s);
        if (s.routes.length) {
          setRouteId(s.routes[0].id);
          setVisitId(
            s.visits.find((v: Visit) => v.routeId === s.routes[0].id)?.id || "",
          );
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
    };
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function chooseRoute(id: string) {
    setRouteId(id);
    setVisitId(state.visits.find((v) => v.routeId === id)?.id || "");
    setCompareId("");
  }
  async function createRoute(e: React.FormEvent) {
    e.preventDefault();
    await act(async () => {
      const r = await request<Route>("/routes", {
        method: "POST",
        body: JSON.stringify({
          name: routeName,
          stops: stops
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      await refresh();
      setRouteId(r.id);
      setVisitId("");
      setCompareId("");
    });
  }
  async function createVisit(e: React.FormEvent) {
    e.preventDefault();
    await act(async () => {
      const v = await request<Visit>("/visits", {
        method: "POST",
        body: JSON.stringify({
          routeId,
          title:
            title ||
            new Date().toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            }),
        }),
      });
      await refresh();
      setVisitId(v.id);
      setTitle("");
    });
  }
  async function analyse(id: string, startSeconds: number) {
    if (activeJobs.current.has(id)) return;
    activeJobs.current.set(id, "starting");
    setJobs((j) => ({ ...j, [id]: { id: "starting", status: "queued" } }));
    let ownJob = "starting";
    setError("");
    try {
      const job = await request<{ jobId: string }>(
        "/clips/" + id + "/analyse",
        { method: "POST", body: JSON.stringify({ startSeconds }) },
      );
      ownJob = job.jobId;
      activeJobs.current.set(id, ownJob);
      setJobs((j) => ({ ...j, [id]: { id: job.jobId, status: "queued" } }));
      await refresh();
      for (let n = 0; n < 300; n++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (!mounted.current) return;
        let status: { status: string; error?: string };
        try {
          status = await request<{ status: string; error?: string }>(
            "/jobs/" + job.jobId,
          );
        } catch (error) {
          // A restarted service loses its in-memory job, but retains the recording.
          await refresh().catch(() => undefined);
          throw error;
        }
        if (activeJobs.current.get(id) === ownJob)
          setJobs((j) => ({
            ...j,
            [id]: { id: job.jobId, status: status.status },
          }));
        if (["done", "failed", "cancelled"].includes(status.status)) {
          await refresh();
          if (status.status === "failed")
            throw new Error(status.error || "Analysis failed");
          return;
        }
      }
      await refresh();
      throw new Error(
        "Analysis is taking longer than expected. Reload to check its status; your recording is saved.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      if (activeJobs.current.get(id) === ownJob) {
        activeJobs.current.delete(id);
        setJobs((j) => {
          if (j[id]?.id !== ownJob) return j;
          const next = { ...j };
          delete next[id];
          return next;
        });
      }
    }
  }
  return (
    <div
      ref={appRoot}
      className={`app ${focus ? "focus-mode" : ""} ${motionPaused ? "motion-paused" : ""}`}
    >
      <div className="reading-progress" aria-hidden="true" />
      <header>
        <a className="brand" href="#">
          <span className="brand-icon">◌</span> Soundwalk <em>Atlas</em>
        </a>
        <span className="header-edition" aria-hidden="true">
          A PERSONAL FIELD GUIDE / VOL. 01
        </span>
        <div className="privacy">
          <span /> Local & private
        </div>
      </header>
      <main>
        {!focus && (
          <FieldHero
            motionPaused={motionPaused}
            onToggleMotion={() => setMotionPaused((p) => !p)}
            onBegin={() => openWorkspace()}
            onPrepare={() => openWorkspace(true)}
          />
        )}
        {!focus && <ListeningPrelude paused={motionPaused} />}
        <div className="journal-intro" data-reveal>
          <div>
            <p className="eyebrow">YOUR OWN SMALL ATLAS</p>
            <h2>Your field journal.</h2>
          </div>
          <p>
            Keep what you noticed.
            <br />
            Return when the world sounds different.
          </p>
        </div>
        <JournalStats state={state} />
        {error && (
          <div className="alert" role="alert">
            {error}
            <button className="text-button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        {!config ? (
          <div className="notice">
            Connecting to your local journal… Start the Soundwalk service if
            this persists.
          </div>
        ) : !config.model.ready ? (
          <div className="notice">
            <b>
              Your listening journal is ready. The local AI model isn’t yet.
            </b>
            <span>
              {config.model.status}. You can prepare walks, import audio and
              review manually. Follow the README’s model setup before analysing.
            </span>
          </div>
        ) : (
          <div className="model-note">
            Local model ready · audio stays on this computer · suggestions need
            your review
          </div>
        )}
        <div className="workflow-strip">
          <span>01 Listen</span>
          <span>02 Observe</span>
          <span>03 Import</span>
          <span>04 Review</span>
          <span>05 Compare</span>
          <button className="next-action" onClick={followNextAction}>
            {nextAction} →
          </button>
          <button className="text-button" onClick={() => setFocus(!focus)}>
            {focus ? "Show landscape" : "Focus on journal"}
          </button>
        </div>
        <nav className="tabs" aria-label="Workspace">
          <button
            className={tab === "walk" ? "active" : ""}
            onClick={() => setTab("walk")}
          >
            01 <span>My listening walks</span>
          </button>
          <button
            className={tab === "compare" ? "active" : ""}
            onClick={() => setTab("compare")}
          >
            02 <span>Compare visits</span>
          </button>
          <details className="journal-tools">
            <summary>
              Journal tools <span aria-hidden="true">↗</span>
            </summary>
            <div className="journal-tools-menu">
              <button
                className="refresh-button"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    setConfig(await request<Config>("/config"));
                    await refresh();
                  })
                }
              >
                Refresh status ↻
              </button>
              <a href="/api/export" download>
                Export JSON records ↗
              </a>
              <a href="/api/backup" download>
                Private backup + audio ↗
              </a>
              <label className="restore-control">
                Restore backup
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 200 * 1024 * 1024) {
                      setRestoreResult(
                        "Backup exceeds 200 MB. Choose a smaller archive.",
                      );
                      e.target.value = "";
                      return;
                    }
                    setPendingBackup(file);
                    setRestoreResult("");
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </details>
        </nav>
        {pendingBackup && (
          <div
            className="notice restore-confirm"
            role="region"
            aria-label="Confirm backup restore"
          >
            <p>
              Restore {pendingBackup.name} as new walks? This includes private
              audio and notes. Existing walks will not be overwritten.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const body = new FormData();
                  body.append("file", pendingBackup);
                  const result = await request<{
                    restoredRoutes: number;
                    restoredVisits: number;
                    restoredClips: number;
                    restoredObservations: number;
                  }>("/restore", { method: "POST", body });
                  await refresh();
                  setRestoreResult(
                    `Restored ${result.restoredRoutes} walk${result.restoredRoutes === 1 ? "" : "s"}, ${result.restoredVisits} visit${result.restoredVisits === 1 ? "" : "s"}, ${result.restoredClips} recording${result.restoredClips === 1 ? "" : "s"} and ${result.restoredObservations} written observation${result.restoredObservations === 1 ? "" : "s"}.`,
                  );
                  setPendingBackup(null);
                })
              }
            >
              Restore as new walks
            </button>
            <button disabled={busy} onClick={() => setPendingBackup(null)}>
              Cancel restore
            </button>
          </div>
        )}
        {restoreResult && (
          <p className="notice" role="status">
            {restoreResult}
          </p>
        )}
        <p className="backup-notice tiny">
          Private backup includes your original audio and notes. Keep it
          private. JSON export contains records only.
        </p>
        <div className="workspace" ref={workspace} tabIndex={-1}>
          <aside>
            <p className="eyebrow">YOUR PLACES</p>
            {state.routes.map((r) => (
              <button
                key={r.id}
                className={
                  "route-button " + (r.id === routeId ? "selected" : "")
                }
                onClick={() => chooseRoute(r.id)}
              >
                {r.name}
                <small>{r.stops.length} listening stops</small>
              </button>
            ))}
            <details ref={preparation} open={!state.routes.length}>
              <summary>+ Prepare a new walk</summary>
              <form onSubmit={createRoute}>
                <label>
                  Place or loop
                  <input
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  Stops, one per line
                  <textarea
                    rows={4}
                    value={stops}
                    onChange={(e) => setStops(e.target.value)}
                    required
                  />
                </label>
                <small>
                  Choose 1–5 familiar, publicly accessible places. This is a
                  listening card, not route navigation.
                </small>
                <button disabled={busy || !config} className="primary">
                  Create listening card
                </button>
              </form>
            </details>
            <button
              className="demo-button"
              disabled={busy || !config}
              onClick={() =>
                act(async () => {
                  const result = await request<{ routeId: string }>("/demo", {
                    method: "POST",
                  });
                  const next = await refresh();
                  setRouteId(result.routeId);
                  setCompareId("");
                  setVisitId(
                    next.visits.find((v) => v.routeId === result.routeId)?.id ||
                      "",
                  );
                })
              }
            >
              Explore a synthetic example ↗
            </button>
            <p className="tiny">
              Sample audio demonstrates the workflow. It is not a real field
              trial or a claimed AI result.
            </p>
          </aside>
          <section className="journal">
            {!route ? (
              <div className="empty">
                <span>◌</span>
                <h2>Your first walk starts here.</h2>
                <p>
                  Pick three familiar places. Bring a listening card, not
                  another feed.
                </p>
              </div>
            ) : (
              <>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">
                      {tab === "walk"
                        ? "YOUR LISTENING CARD"
                        : "SAME PLACE, DIFFERENT MOMENT"}
                    </p>
                    <h2>{route.name}</h2>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      flushSync(() => setTab("walk"));
                      window.print();
                    }}
                  >
                    Print card ↗
                  </button>
                </div>
                <div className="rename-controls">
                  <button
                    className="text-button"
                    onClick={() => {
                      const name = window.prompt("Rename walk", route.name);
                      if (name?.trim())
                        void act(async () => {
                          await request("/routes/" + route.id, {
                            method: "PATCH",
                            body: JSON.stringify({ name: name.trim() }),
                          });
                          await refresh();
                        });
                    }}
                  >
                    Rename walk
                  </button>
                  {visit && (
                    <button
                      className="text-button"
                      onClick={() => {
                        const title = window.prompt(
                          "Rename visit",
                          visit.title,
                        );
                        if (title?.trim())
                          void act(async () => {
                            await request("/visits/" + visit.id, {
                              method: "PATCH",
                              body: JSON.stringify({ title: title.trim() }),
                            });
                            await refresh();
                          });
                      }}
                    >
                      Rename visit
                    </button>
                  )}
                </div>
                {route.name === "Synthetic sample · not a field walk" && (
                  <div className="sample">
                    Synthetic example — simulated audio, not observations from
                    an outdoor walk.
                  </div>
                )}
                {tab === "walk" ? (
                  <>
                    <div
                      data-reveal
                      className={"walk-card " + (focus ? "compact-card" : "")}
                    >
                      <div className="card-top">
                        <b>Before you press record</b>
                        <span>LEAVE THE SCREEN BEHIND</span>
                      </div>
                      <p>
                        Pause for a minute. Notice near and far sounds. Write
                        what you hear before looking at any AI suggestion.
                        Record a short clip only when it’s safe.
                      </p>
                      <ol>
                        {route.stops.map((s) => (
                          <li key={s.id}>
                            {s.name}
                            <small>Listen → notice → record 10 seconds</small>
                          </li>
                        ))}
                      </ol>
                      <p className="tiny">
                        Respect nearby people; avoid recording conversations.
                        Don’t trespass or use this as a safety or navigation
                        tool.
                      </p>
                    </div>
                    <ListeningTimer />
                    <div className="visit-controls">
                      <label>
                        Visit
                        <select
                          value={visitId}
                          onChange={(e) => setVisitId(e.target.value)}
                        >
                          <option value="">Choose a visit</option>
                          {visits.map((v) => (
                            <option value={v.id} key={v.id}>
                              {v.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <form onSubmit={createVisit}>
                        <label>
                          New visit
                          <input
                            placeholder="Morning after the rain"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={120}
                          />
                        </label>
                        <button disabled={busy} className="secondary">
                          Start visit +
                        </button>
                      </form>
                    </div>
                    {visit && (
                      <>
                        <StationRail
                          route={route}
                          state={state}
                          visitId={visit.id}
                          onSelect={selectStation}
                        />
                        {route.stops.map((stop, index) => (
                          <div className="stop" key={stop.id} data-reveal>
                            <div
                              className="stop-heading"
                              id={"station-" + stop.id}
                              tabIndex={-1}
                            >
                              <span className="number">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <div>
                                <h3>{stop.name}</h3>
                                <p>What did you notice before the model?</p>
                              </div>
                            </div>
                            <ObservationEditor
                              key={"observation:" + visit.id + ":" + stop.id}
                              draftKey={visit.id + ":" + stop.id}
                              observation={state.observations?.find(
                                (o) =>
                                  o.visitId === visit.id &&
                                  o.stopId === stop.id,
                              )}
                              onSave={(values) =>
                                act(async () => {
                                  await request("/observations", {
                                    method: "POST",
                                    body: JSON.stringify({
                                      ...values,
                                      visitId: visit.id,
                                      stopId: stop.id,
                                    }),
                                  });
                                  await refresh();
                                })
                              }
                            />
                            <Upload
                              retainedFiles={retainedFiles.current}
                              draftKey={visit.id + ":" + stop.id}
                              key={visit.id + ":" + stop.id}
                              disabled={busy}
                              maxBytes={config?.limits.maxBytes || 20971520}
                              onUpload={(file, note) =>
                                act(async () => {
                                  const body = new FormData();
                                  body.append("file", file);
                                  body.append("note", note);
                                  body.append("visitId", visit.id);
                                  body.append("stopId", stop.id);
                                  const saved = await request<Clip>("/clips", {
                                    method: "POST",
                                    body,
                                  });
                                  setState((previous) => ({
                                    ...previous,
                                    clips: [
                                      ...previous.clips.filter(
                                        (clip) => clip.id !== saved.id,
                                      ),
                                      saved,
                                    ],
                                  }));
                                  // A committed upload must clear its draft even if the next read fails.
                                  await refresh().catch(() =>
                                    setError(
                                      "Recording saved, but the journal could not refresh. Use Refresh status to reconnect.",
                                    ),
                                  );
                                })
                              }
                            />
                            {stopClips(state, visit.id, stop.id).map((c) => (
                              <ClipCard
                                key={c.id}
                                clip={c}
                                busy={busy}
                                job={jobs[c.id]}
                                onCancel={() => {
                                  const job = jobs[c.id];
                                  if (job)
                                    void request(
                                      "/jobs/" + job.id + "/cancel",
                                      { method: "POST" },
                                    )
                                      .then(() => refresh())
                                      .catch((e) => setError(e.message));
                                }}
                                canAnalyse={!!config?.model.ready}
                                onAnalyse={(start) => analyse(c.id, start)}
                                onReview={(review) =>
                                  act(async () => {
                                    const saved = await request<Clip>(
                                      "/clips/" + c.id + "/review",
                                      {
                                        method: "PATCH",
                                        body: JSON.stringify(review),
                                      },
                                    );
                                    setState((previous) => ({
                                      ...previous,
                                      clips: previous.clips.map((clip) =>
                                        clip.id === saved.id ? saved : clip,
                                      ),
                                    }));
                                    await refresh().catch(() =>
                                      setError(
                                        "Review saved, but the journal could not refresh. Use Refresh status to reconnect.",
                                      ),
                                    );
                                  })
                                }
                                onDelete={() => {
                                  if (
                                    window.confirm(
                                      "Delete this recording and its review? This cannot be undone.",
                                    )
                                  )
                                    void act(async () => {
                                      await request("/clips/" + c.id, {
                                        method: "DELETE",
                                      });
                                      try {
                                        localStorage.removeItem(
                                          "soundwalk:draft:review:" + c.id,
                                        );
                                      } catch {
                                        /* No browser draft available. */
                                      }
                                      await refresh();
                                    });
                                }}
                              />
                            ))}
                          </div>
                        ))}
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Delete this visit and all of its recordings?",
                              )
                            )
                              void act(async () => {
                                await request("/visits/" + visit.id, {
                                  method: "DELETE",
                                });
                                for (const key of retainedFiles.current.keys()) {
                                  if (key.startsWith(visit.id + ":"))
                                    retainedFiles.current.delete(key);
                                }
                                try {
                                  const clipIds = state.clips
                                    .filter((c) => c.visitId === visit.id)
                                    .map((c) => c.id);
                                  for (const key of Object.keys(localStorage)) {
                                    if (
                                      key.startsWith("soundwalk:draft:") &&
                                      (key.includes(":" + visit.id + ":") ||
                                        clipIds.some(
                                          (id) =>
                                            key ===
                                            "soundwalk:draft:review:" + id,
                                        ))
                                    )
                                      localStorage.removeItem(key);
                                  }
                                } catch {
                                  /* No browser drafts available. */
                                }
                                await refresh();
                                setVisitId("");
                              });
                          }}
                        >
                          Delete this visit
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p className="description">
                      Compare your reviewed observations at matching stops.
                      Relative model scores aren’t probabilities or sound-level
                      measurements.
                    </p>
                    <div className="compare-select">
                      <label>
                        First visit
                        <select
                          value={visitId}
                          onChange={(e) => setVisitId(e.target.value)}
                        >
                          <option value="">Choose a visit</option>
                          {visits.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Second visit
                        <select
                          value={compareId}
                          onChange={(e) => setCompareId(e.target.value)}
                        >
                          <option value="">Choose another visit</option>
                          {visits
                            .filter((v) => v.id !== visitId)
                            .map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.title}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    {visitId && compareId && visitId !== compareId ? (
                      <div className="comparison">
                        {route.stops.map((s) => (
                          <div
                            className="comparison-row"
                            key={s.id}
                            data-reveal
                          >
                            <h3>{s.name}</h3>
                            {[visitId, compareId].map((id) => (
                              <div key={id}>
                                <span>
                                  {visits.find((v) => v.id === id)?.title}
                                </span>
                                <b>{clipSummary(stopClips(state, id, s.id))}</b>
                                <small>
                                  {
                                    stopClips(state, id, s.id).filter(
                                      (c) => c.review,
                                    ).length
                                  }{" "}
                                  of {stopClips(state, id, s.id).length}{" "}
                                  reviewed
                                </small>
                                {state.observations
                                  ?.filter(
                                    (o) =>
                                      o.visitId === id && o.stopId === s.id,
                                  )
                                  .map((o) => (
                                    <div
                                      key={o.id}
                                      className="comparison-observation"
                                    >
                                      <p>{o.note}</p>
                                      <small>
                                        {o.observedAt} · {o.context}
                                      </small>
                                    </div>
                                  ))}
                                <small>
                                  {stopClips(state, id, s.id).length}{" "}
                                  recording(s)
                                </small>
                                {stopClips(state, id, s.id)
                                  .slice(0, 3)
                                  .map((clip) => (
                                    <section
                                      className="comparison-recording"
                                      key={clip.id}
                                    >
                                      <p className="tiny">
                                        Original observation
                                      </p>
                                      <p>
                                        {clip.note || "No observation recorded"}
                                      </p>
                                      <p className="review-summary">
                                        {clip.review
                                          ? clip.review.labels.join(", ") ||
                                            "No confirmed label"
                                          : "Review pending"}
                                        {clip.review?.uncertain
                                          ? " · uncertain"
                                          : ""}
                                        {clip.review?.mixed
                                          ? " · multiple sounds"
                                          : ""}
                                        {clip.review?.mismatch
                                          ? " · model did not fit"
                                          : ""}
                                      </p>
                                      <audio
                                        aria-label={
                                          "Recording " + clip.filename
                                        }
                                        controls
                                        preload="none"
                                        src={"/api/clips/" + clip.id + "/audio"}
                                      />
                                    </section>
                                  ))}
                                {stopClips(state, id, s.id).length > 3 && (
                                  <small>
                                    Showing the first three recordings. Open
                                    this visit to review all recordings.
                                  </small>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty">
                        <h3>Return to the same place.</h3>
                        <p>
                          Two visits make change visible. Missing recordings
                          stay visible, too.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <footer>
        <span>Soundwalk Atlas</span>
        <p>Less scrolling. More noticing.</p>
        <span>LOCAL FIRST · HUMAN REVIEWED</span>
      </footer>
    </div>
  );
}
function useDraft<T>(key: string, initial: T) {
  const storageKey = "soundwalk:draft:" + key;
  const [value, setValue] = useState<T>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (parsed === null || typeof parsed !== typeof initial) return initial;
      if (
        typeof initial === "object" &&
        initial !== null &&
        !Object.entries(initial).every(
          ([key, value]) => typeof parsed[key] === typeof value,
        )
      )
        return initial;
      return parsed as T;
    } catch {
      return initial;
    }
  });
  const dirty = useRef(JSON.stringify(value) !== JSON.stringify(initial));
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const update = (next: T) => {
    dirty.current = true;
    setValue(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Browser storage may be unavailable. */
    }
  };
  const clear = (next: T) => {
    dirty.current = false;
    setValue(next);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Saved server data remains authoritative. */
    }
  };
  return [value, update, clear] as const;
}
function ObservationEditor({
  draftKey,
  observation,
  onSave,
}: {
  draftKey: string;
  observation?: Observation;
  onSave: (v: {
    note: string;
    observedAt: string;
    context: string;
  }) => Promise<boolean>;
}) {
  const [value, setValue, clear] = useDraft("observation:" + draftKey, {
    note: observation?.note || "",
    observedAt: observation?.observedAt || "",
    context: observation?.context || "",
  });
  const [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  return (
    <form
      className="observation-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        if (await onSave(value)) {
          clear(value);
          setSaved(true);
        }
        setSaving(false);
      }}
    >
      <p className="eyebrow">YOUR FIRST IMPRESSION · AUDIO OPTIONAL</p>
      <label>
        Written listening note
        <textarea
          value={value.note}
          maxLength={2000}
          rows={2}
          onChange={(e) => {
            setValue({ ...value, note: e.target.value });
            setSaved(false);
          }}
          placeholder="Near sounds, far sounds, something unexpected…"
        />
      </label>
      <div className="observation-context">
        <label>
          Observed at
          <input
            type="datetime-local"
            value={value.observedAt}
            onChange={(e) => setValue({ ...value, observedAt: e.target.value })}
          />
        </label>
        <label>
          Conditions / context
          <input
            value={value.context}
            maxLength={500}
            placeholder="After rain, quiet morning…"
            onChange={(e) => setValue({ ...value, context: e.target.value })}
          />
        </label>
      </div>
      <button className="secondary" disabled={saving || !value.note.trim()}>
        {saving ? "Saving note…" : "Save written observation"}
      </button>
      {saved && <span role="status">Written observation saved</span>}
      <small>
        Drafts stay in this browser on this computer. Saving does not require a
        recording.
      </small>
    </form>
  );
}
function Upload({
  disabled,
  maxBytes,
  onUpload,
  draftKey,
  retainedFiles,
}: {
  retainedFiles: Map<string, File>;
  disabled: boolean;
  maxBytes: number;
  draftKey: string;
  onUpload: (file: File, note: string) => Promise<boolean>;
}) {
  const [file, setFile] = useState<File | null>(
      () => retainedFiles.get(draftKey) || null,
    ),
    [note, setNote, clearNote] = useDraft("upload:" + draftKey, ""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className="upload"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        if (file.size > maxBytes) {
          setError(
            "That file exceeds the 20 MB limit. Choose a shorter recording.",
          );
          return;
        }
        setError("");
        setSaving(true);
        try {
          if (await onUpload(file, note)) {
            setFile(null);
            retainedFiles.delete(draftKey);
            clearNote("");
            if (input.current) input.current.value = "";
          } else {
            setError(
              "Recording was not saved. Your file and note are retained; check the service message and try again.",
            );
          }
        } finally {
          setSaving(false);
        }
      }}
    >
      <label>
        Your observation
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="I heard leaves moving and a distant engine…"
          rows={2}
          maxLength={2000}
        />
      </label>
      <div className="upload-bottom">
        <label className="file-label">
          {file ? file.name : "Choose an audio recording ↗"}
          <input
            ref={input}
            type="file"
            accept="audio/*,.wav,.opus,.m4a"
            onChange={(e) => {
              const selected = e.target.files?.[0] || null;
              setFile(selected);
              if (selected) retainedFiles.set(draftKey, selected);
              else retainedFiles.delete(draftKey);
            }}
          />
        </label>
        <button className="primary" disabled={disabled || saving || !file}>
          {saving ? "Saving recording…" : "Save recording"}
        </button>
      </div>
      {file && (
        <p className="file-metadata">
          {(file.size / 1024).toFixed(1)} KB ·{" "}
          {file.type || "Format checked by decoder"} · duration verified on
          import
        </p>
      )}
      {saving && (
        <p className="job-status" role="status">
          Transferring and validating audio locally…
        </p>
      )}
      <small>
        Maximum 30 seconds / 20 MB. WAV, M4A and WhatsApp OPUS are supported by
        the local decoder. Save original files without conversion. Draft notes
        stay in this browser; selected files must be reselected after closing
        it.
      </small>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function Waveform({
  clip,
  start,
  onStart,
}: {
  clip: Clip;
  start: number;
  onStart: (n: number) => void;
}) {
  const [preview, setPreview] = useState<{
      peaks: number[];
      duration: number;
    } | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/clips/" + clip.id + "/waveform")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((p) => {
        if (active) setPreview(p);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [clip.id]);
  const max = Math.max(0, clip.duration - 10),
    end = Math.min(clip.duration, start + 10);
  return (
    <div className="waveform-panel">
      <div className="waveform-heading">
        <span>Actual recording waveform</span>
        <span>
          {start.toFixed(1)}–{end.toFixed(1)} seconds selected
        </span>
      </div>
      {preview ? (
        <svg
          role="img"
          aria-label="Waveform of your recording, highlighted selected interval"
          viewBox="0 0 480 80"
          preserveAspectRatio="none"
        >
          <rect
            x={(start / clip.duration) * 480}
            width={((end - start) / clip.duration) * 480}
            y="0"
            height="80"
            className="waveform-selection"
          />
          {preview.peaks.map((p, i) => (
            <line
              key={i}
              x1={(i / preview.peaks.length) * 480}
              x2={(i / preview.peaks.length) * 480}
              y1={40 - p * 36}
              y2={40 + p * 36}
            />
          ))}
        </svg>
      ) : (
        <p className="tiny">
          {failed
            ? "Waveform unavailable. Playback and interval selection remain available."
            : "Decoding waveform locally…"}
        </p>
      )}
      <label className="segment-controls">
        Analysis start (seconds)
        <input
          type="range"
          min="0"
          max={max}
          step="0.1"
          value={start}
          disabled={!max}
          onChange={(e) => onStart(Number(e.target.value))}
        />
        <output>{start.toFixed(1)}s</output>
      </label>
      <small>
        Only the selected interval, up to 10 seconds, is compared with candidate
        descriptions. The waveform is digital amplitude, not a sound-level
        measurement.
      </small>
    </div>
  );
}
function ClipCard({
  clip,
  busy,
  canAnalyse,
  onAnalyse,
  onReview,
  onDelete,
  job,
  onCancel,
}: {
  clip: Clip;
  busy: boolean;
  canAnalyse: boolean;
  onAnalyse: (start: number) => void;
  onReview: (r: {
    labels: string[];
    uncertain: boolean;
    note: string;
    mixed?: boolean;
    mismatch?: boolean;
  }) => Promise<boolean>;
  onDelete: () => void;
  job?: { id: string; status: string };
  onCancel: () => void;
}) {
  const [draft, setDraft, clearDraft] = useDraft("review:" + clip.id, {
    labels: clip.review?.labels.join(", ") || "",
    uncertain: clip.review?.uncertain || false,
    note: clip.review?.note || "",
    mixed: clip.review?.mixed || false,
    mismatch: clip.review?.mismatch || false,
  });
  const [start, setStart] = useState(clip.analysis?.segment?.startSeconds || 0),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  const choices = [
    "Birds",
    "Road traffic",
    "Wind and leaves",
    "Running water",
    "Machinery",
    "Dogs and animals",
    "People and voices",
    "Footsteps",
    "Paper rustling",
    "Rain",
    "Insects",
    ...(clip.analysis?.suggestions.map((s) => s.label) || []),
  ].filter((v, i, a) => a.indexOf(v) === i);
  const labels = draft.labels
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const update = (v: Partial<typeof draft>) => {
    setDraft({ ...draft, ...v });
    setSaved(false);
  };
  return (
    <article className="clip">
      <div className="clip-head">
        <strong>{clip.filename}</strong>
        <span>
          {clip.duration.toFixed(1)}s ·{" "}
          {clip.review ? "Reviewed" : "Awaiting your review"}
        </span>
      </div>
      <audio controls preload="none" src={"/api/clips/" + clip.id + "/audio"} />
      <Waveform clip={clip} start={start} onStart={setStart} />
      {clip.note && (
        <div className="original-observation">
          <p className="eyebrow">YOUR ORIGINAL OBSERVATION</p>
          <p className="observation">“{clip.note}”</p>
        </div>
      )}
      {clip.quality.length > 0 && (
        <p className="quality">Recording notes: {clip.quality.join(", ")}</p>
      )}
      {clip.error && <p role="alert">{clip.error}</p>}
      {clip.analysis ? (
        <div className="suggestions">
          <p className="eyebrow">
            PROVISIONAL CANDIDATE MATCHES · CHECK WHAT FITS
          </p>
          <p className="analysis-interval">
            Last analysed interval:{" "}
            {clip.analysis.segment
              ? `${clip.analysis.segment.startSeconds.toFixed(1)}–${clip.analysis.segment.endSeconds.toFixed(1)} seconds`
              : clip.analysis.window}
          </p>
          {Math.abs(start - (clip.analysis.segment?.startSeconds || 0)) >
            0.05 && (
            <p className="segment-pending" role="status">
              Selection changed. These saved matches describe the previous
              interval; analyse again to update them.
            </p>
          )}
          {!!clip.analysis.quality?.length && (
            <p className="quality">
              Selected audio: {clip.analysis.quality.join(" ")}
            </p>
          )}
          <div className="candidate-labels">
            {clip.analysis.suggestions.map((s) => (
              <span key={s.label}>{s.label}</span>
            ))}
          </div>
          {!clip.analysis.suggestions.length && (
            <p>
              No usable candidate match. Your observation is the source of
              truth.
            </p>
          )}
          <small>
            These compare candidate descriptions; they are not confidence
            percentages. Unfamiliar and mixed sounds can be misleading.{" "}
            {clip.analysis.window}
          </small>
          <details>
            <summary>Technical details and model provenance</summary>
            <p>
              {clip.analysis.model}
              <br />
              Revision: {clip.analysis.revision}
              <br />
              Vocabulary:{" "}
              {clip.analysis.vocabularyVersion || "Original candidate set"}
            </p>
            {clip.analysis.suggestions.map((s) => (
              <p key={s.label}>
                {s.label}: cosine similarity {s.score.toFixed(3)}
              </p>
            ))}
          </details>
        </div>
      ) : (
        <p className="tiny">
          No AI suggestion yet. Your observation is enough to review manually.
        </p>
      )}
      <div className="match-actions">
        <button
          className={"secondary " + (job ? "analysing" : "")}
          disabled={!canAnalyse || !!job || clip.status === "analysing"}
          onClick={() => onAnalyse(start)}
        >
          {job || clip.status === "analysing"
            ? "Analysing locally…"
            : clip.analysis
              ? "Analyse again locally"
              : "Analyse locally"}
        </button>
        {job && (
          <>
            <span role="status" className="job-status">
              {job.status === "queued"
                ? "Waiting for local model"
                : "Comparing selected audio locally"}
            </span>
            <button
              className="text-button"
              disabled={job.id === "starting"}
              onClick={onCancel}
            >
              Cancel analysis
            </button>
          </>
        )}
      </div>
      <form
        className="review"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const review = {
            labels,
            uncertain: draft.uncertain,
            note: draft.note,
            ...(draft.mixed ? { mixed: true } : {}),
            ...(draft.mismatch ? { mismatch: true } : {}),
          };
          if (await onReview(review)) {
            clearDraft(draft);
            setSaved(true);
          }
          setSaving(false);
        }}
      >
        <p className="eyebrow">YOUR JUDGMENT · NEVER AUTOMATICALLY FILLED</p>
        <div className="label-chips" aria-label="Choose human sound labels">
          {choices.map((label) => (
            <button
              className={
                "label-chip " + (labels.includes(label) ? "selected" : "")
              }
              key={label}
              type="button"
              aria-pressed={labels.includes(label)}
              onClick={() =>
                update({
                  labels: (labels.includes(label)
                    ? labels.filter((l) => l !== label)
                    : [...labels, label]
                  ).join(", "),
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Your labels, separated by commas
          <input
            value={draft.labels}
            maxLength={500}
            onChange={(e) => update({ labels: e.target.value })}
            placeholder="Add your own: book pages, footsteps…"
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.mismatch}
            onChange={(e) => update({ mismatch: e.target.checked })}
          />
          None of these model matches fits
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.mixed}
            onChange={(e) => update({ mixed: e.target.checked })}
          />
          Multiple sounds heard — I can identify more than one
        </label>
        <label className="checkbox">
          <input
            aria-label="Uncertain — I cannot give a firm label"
            type="checkbox"
            checked={draft.uncertain}
            onChange={(e) => update({ uncertain: e.target.checked })}
          />
          Uncertain — I cannot give a firm label
        </label>
        <label>
          Review note
          <input
            value={draft.note}
            maxLength={2000}
            onChange={(e) => update({ note: e.target.value })}
            placeholder="What did the model miss?"
          />
        </label>
        <div>
          <button className="primary" disabled={busy || saving}>
            {saving ? "Saving review…" : "Save my review"}
          </button>
          <button
            className="text-button danger"
            type="button"
            disabled={busy || saving}
            onClick={onDelete}
          >
            Delete recording
          </button>
        </div>
        {saved && <p role="status">Your review is saved</p>}
      </form>
    </article>
  );
}
