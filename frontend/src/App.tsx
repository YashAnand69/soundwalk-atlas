import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Clip, Config, Route, State, Visit } from "./types";
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
  const [routeName, setRouteName] = useState("My neighborhood loop"),
    [stops, setStops] = useState(
      "At the gate\nUnder the trees\nA quiet corner",
    ),
    [title, setTitle] = useState("");
  const mounted = useRef(true);
  const route = state.routes.find((r) => r.id === routeId),
    visits = state.visits.filter((v) => v.routeId === routeId),
    visit = visits.find((v) => v.id === visitId);
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
  async function analyse(id: string) {
    await act(async () => {
      const job = await request<{ jobId: string }>(
        "/clips/" + id + "/analyse",
        { method: "POST" },
      );
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
        if (status.status === "done" || status.status === "failed") {
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
    });
  }
  return (
    <div className="app">
      <header>
        <a className="brand" href="#">
          <span className="brand-icon">◌</span> Soundwalk <em>Atlas</em>
        </a>
        <div className="privacy">
          <span /> Local & private
        </div>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">A FIELD GUIDE TO PAYING ATTENTION</p>
            <h1>
              Make room
              <br />
              to <i>listen.</i>
            </h1>
            <p className="intro">
              Step outside. Hear what’s already there.
              <br />A small listening walk, a journal that stays yours.
            </p>
            <div className="hero-meta">
              <span>3 stops</span>
              <span>10 seconds per recording</span>
              <span>No cloud inference</span>
            </div>
          </div>
          <div className="art" aria-hidden="true">
            <div className="sun" />
            <div className="ring r1" />
            <div className="ring r2" />
            <div className="ring r3" />
            <div className="hill h1" />
            <div className="hill h2" />
            <div className="stem s1" />
            <div className="stem s2" />
            <div className="art-caption">THE WORLD IS ALREADY PLAYING.</div>
          </div>
        </section>
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
            Export journal ↗
          </a>
        </nav>
        <div className="workspace">
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
            <details open={!state.routes.length}>
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
                {route.name === "Synthetic sample · not a field walk" && (
                  <div className="sample">
                    Synthetic example — simulated audio, not observations from
                    an outdoor walk.
                  </div>
                )}
                {tab === "walk" ? (
                  <>
                    <div className="walk-card">
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
                        {route.stops.map((stop, index) => (
                          <div className="stop" key={stop.id}>
                            <div className="stop-heading">
                              <span className="number">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <div>
                                <h3>{stop.name}</h3>
                                <p>What did you notice before the model?</p>
                              </div>
                            </div>
                            <Upload
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
                                canAnalyse={!!config?.model.ready}
                                onAnalyse={() => analyse(c.id)}
                                onReview={(review) =>
                                  act(async () => {
                                    await request<Clip>(
                                      "/clips/" + c.id + "/review",
                                      {
                                        method: "PATCH",
                                        body: JSON.stringify(review),
                                      },
                                    );
                                    await refresh();
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
                          <div className="comparison-row" key={s.id}>
                            <h3>{s.name}</h3>
                            {[visitId, compareId].map((id) => (
                              <div key={id}>
                                <span>
                                  {visits.find((v) => v.id === id)?.title}
                                </span>
                                <b>{clipSummary(stopClips(state, id, s.id))}</b>
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
function Upload({
  disabled,
  maxBytes,
  onUpload,
}: {
  disabled: boolean;
  maxBytes: number;
  onUpload: (file: File, note: string) => Promise<boolean>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [note, setNote] = useState(""),
    [error, setError] = useState("");
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
        if (await onUpload(file, note)) {
          setFile(null);
          setNote("");
          if (input.current) input.current.value = "";
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
            accept="audio/*,.wav"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button className="primary" disabled={disabled || !file}>
          Save recording
        </button>
      </div>
      <small>
        Prefer a 10-second WAV. Maximum 30 seconds / 20 MB. Other audio formats
        depend on the installed decoder.
      </small>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function ClipCard({
  clip,
  busy,
  canAnalyse,
  onAnalyse,
  onReview,
  onDelete,
}: {
  clip: Clip;
  busy: boolean;
  canAnalyse: boolean;
  onAnalyse: () => void;
  onReview: (r: { labels: string[]; uncertain: boolean; note: string }) => void;
  onDelete: () => void;
}) {
  const [labels, setLabels] = useState(clip.review?.labels.join(", ") || ""),
    [uncertain, setUncertain] = useState(clip.review?.uncertain || false),
    [note, setNote] = useState(clip.review?.note || "");
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
      {clip.note && <p className="observation">“{clip.note}”</p>}
      {clip.quality.length > 0 && (
        <p className="quality">Recording notes: {clip.quality.join(", ")}</p>
      )}
      {clip.error && <p role="alert">{clip.error}</p>}
      {clip.analysis ? (
        <div className="suggestions">
          <p className="eyebrow">MODEL SUGGESTIONS · RELATIVE SCORES</p>
          {clip.analysis.suggestions.map((s) => (
            <div key={s.label}>
              <span>{s.label}</span>
              <span>{s.score.toFixed(3)}</span>
            </div>
          ))}
          <small>
            These scores compare candidate labels; they are not confidence
            percentages. Mixed and unfamiliar sounds may be misleading.{" "}
            {clip.analysis.window}
          </small>
          <details>
            <summary>Model provenance</summary>
            <p>
              {clip.analysis.model}
              <br />
              Revision: {clip.analysis.revision}
            </p>
          </details>
        </div>
      ) : (
        <p className="tiny">
          No AI suggestion yet. Your observation is enough to review manually.
        </p>
      )}
      <button
        className="secondary"
        disabled={busy || !canAnalyse || clip.status === "analysing"}
        onClick={onAnalyse}
      >
        {clip.status === "analysing"
          ? "Analysing locally…"
          : clip.analysis
            ? "Analyse again locally"
            : "Analyse locally"}
      </button>
      <form
        className="review"
        onSubmit={(e) => {
          e.preventDefault();
          onReview({
            labels: labels
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            uncertain,
            note,
          });
        }}
      >
        <label>
          Your labels, separated by commas
          <input
            value={labels}
            maxLength={500}
            onChange={(e) => setLabels(e.target.value)}
            placeholder="wind, traffic"
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={uncertain}
            onChange={(e) => setUncertain(e.target.checked)}
          />{" "}
          Uncertain or mixed — don’t treat this as a firm label
        </label>
        <label>
          Review note
          <input
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did the model miss?"
          />
        </label>
        <div>
          <button className="primary" disabled={busy}>
            Save my review
          </button>
          <button
            className="text-button danger"
            type="button"
            disabled={busy}
            onClick={onDelete}
          >
            Delete recording
          </button>
        </div>
      </form>
    </article>
  );
}
