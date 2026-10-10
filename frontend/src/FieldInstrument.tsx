import { useEffect, useRef, useState } from "react";
import type { Route, State } from "./types";

export function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function FieldHero({
  onBegin,
  onPrepare,
  motionPaused: controlledPause,
  onToggleMotion,
}: {
  onBegin: () => void;
  onPrepare: () => void;
  motionPaused?: boolean;
  onToggleMotion?: () => void;
}) {
  const [localPause, setLocalPause] = useState(false);
  const motionPaused = controlledPause ?? localPause;
  const [scene, setScene] = useState<"day" | "dusk">("day");
  const [layers, setLayers] = useState({
    birds: true,
    water: true,
    wind: true,
  });
  return (
    <section
      className={`hero field-hero scene-${scene} ${motionPaused ? "motion-paused" : ""}`}
    >
      <div className="hero-copy">
        <span className="hero-folio" aria-hidden="true">
          FIELD NOTES / 001
        </span>
        <p className="eyebrow">
          <span className="live-dot" /> A FIELD GUIDE TO PAYING ATTENTION
        </p>
        <h1>
          Make room
          <br />
          to <i>listen.</i>
        </h1>
        <p className="intro">
          Step outside. Hear what’s already there.
          <br />A small listening walk, a journal that stays yours.
        </p>
        <div className="hero-actions">
          <button className="hero-primary" onClick={onBegin}>
            Open your field journal <ArrowIcon />
          </button>
          <button className="hero-secondary" onClick={onPrepare}>
            Prepare a listening walk <ArrowIcon />
          </button>
        </div>
        <div className="hero-meta">
          <span>Listen before you label</span>
          <span>Offline AI, human judgment</span>
          <span>Your audio stays yours</span>
        </div>
      </div>
      <div className="atlas-art">
        <button
          type="button"
          className="motion-toggle"
          aria-pressed={motionPaused}
          onClick={() =>
            onToggleMotion
              ? onToggleMotion()
              : setLocalPause((paused) => !paused)
          }
        >
          {motionPaused ? "Resume motion" : "Pause motion"}
        </button>
        <div
          className="scene-controls"
          role="group"
          aria-label="Illustration time of day"
        >
          {(["day", "dusk"] as const).map((value) => (
            <button
              key={value}
              className={`scene-toggle ${scene === value ? "selected" : ""}`}
              aria-pressed={scene === value}
              onClick={() => setScene(value)}
            >
              {value === "day" ? "Daylight" : "Dusk"}
            </button>
          ))}
        </div>
        <svg
          className="atlas-scene"
          viewBox="0 0 600 490"
          role="img"
          aria-label={`Illustrated listening landscape at ${scene}. Visual layers can be switched below; no audio is played.`}
        >
          <defs>
            <linearGradient id="landscape-sky" x1="0" y1="0" x2="0" y2="1">
              <stop
                className="sky-top"
                offset="0"
                stopColor={scene === "day" ? "#e8c994" : "#7e8fa2"}
              />
              <stop
                offset="1"
                stopColor={scene === "day" ? "#eae2ba" : "#caaba7"}
              />
            </linearGradient>
            <pattern
              id="atlas-grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M48 0H0V48"
                fill="none"
                stroke="#efefd7"
                strokeOpacity=".13"
              />
            </pattern>
          </defs>
          <rect width="600" height="490" rx="20" fill="url(#landscape-sky)" />
          <g
            className="sun-halo"
            fill="none"
            stroke="#faf0c7"
            strokeOpacity=".22"
          >
            <circle cx="445" cy="118" r="58" />
            <circle cx="445" cy="118" r="74" />
            <circle cx="445" cy="118" r="90" />
          </g>
          <circle
            className="landscape-sun"
            cx="445"
            cy="118"
            r="43"
            fill={scene === "day" ? "#faf0c7" : "#f7dfbb"}
          />
          <g
            className="atlas-contours"
            fill="none"
            stroke="#fcf1d1"
            strokeOpacity=".25"
          >
            <ellipse cx="315" cy="325" rx="260" ry="145" />
            <ellipse cx="315" cy="325" rx="224" ry="117" />
            <ellipse cx="315" cy="325" rx="185" ry="89" />
          </g>
          <path
            d="M0 271C87 227 122 198 205 233S346 280 401 240s150-9 199 12v238H0Z"
            fill="#6e8c71"
          />
          <path
            d="M0 317c128-65 188 31 276-8s201-3 324 35v146H0Z"
            fill="#456951"
          />
          <path
            d="M0 418c131-129 239-67 334-55s192-3 266-2v129H0Z"
            fill="#203f34"
          />
          <g className={`scene-water ${layers.water ? "is-visible" : ""}`}>
            <path
              d="M360 271c-40 31-28 38 29 50s-34 38-39 72 80 45 126 97h102c-32-64-137-80-146-108s65-52 14-74-72-21-57-37Z"
              fill="#c7d5c2"
              fillOpacity=".65"
            />
            <path
              className="water-current"
              d="M372 283c-13 16 14 19 40 31m-7 26c-45 16-44 34-13 51m35 35 36 17"
              fill="none"
              stroke="#f6f1d8"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
          <g fill="#18392c">
            <path d="m101 187-37 111h74Zm-37 100-20 51h113l-24-51Z" />
            <path d="m164 225-27 85h54Zm-26 72-18 39h91l-19-39Z" />
            <path d="m505 216-31 98h64Zm-27 79-23 53h103l-24-53Z" />
          </g>
          <g
            className={`scene-birds ${layers.birds ? "is-visible" : ""}`}
            fill="none"
            stroke="#274c3d"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path
              className="bird-flight bird-one"
              d="M183 129q10-9 20 0 10-9 20 0"
            />
            <path
              className="bird-flight bird-two"
              d="M240 157q8-7 16 0 8-7 16 0"
            />
            <path
              className="bird-flight bird-three"
              d="M329 104q7-6 14 0 7-6 14 0"
            />
          </g>
          <g
            className={`scene-wind ${layers.wind ? "is-visible" : ""}`}
            fill="none"
            stroke="#e8ecd5"
            strokeOpacity=".55"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path
              className="wind-line wind-one"
              d="M32 180h102q17 0 17-12t-14-10"
            />
            <path
              className="wind-line wind-two"
              d="M371 207h136q21 0 21-13t-16-10"
            />
            <path className="wind-line wind-three" d="M200 383h80q14 0 14-10" />
          </g>
          <path
            className="listening-route"
            d="M92 370c44-74 149-65 192-7s56 100 192 80"
            stroke="#dfbfa0"
            strokeWidth="2"
            strokeDasharray="4 7"
            fill="none"
          />
          {[
            { x: 92, y: 370, n: "01" },
            { x: 284, y: 363, n: "02" },
            { x: 476, y: 443, n: "03" },
          ].map((p) => (
            <g key={p.n}>
              <circle cx={p.x} cy={p.y} r="14" fill="#e8e9ba" />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fill="#18392c"
                fontSize="10"
                fontFamily="monospace"
              >
                {p.n}
              </text>
            </g>
          ))}
          <rect
            width="600"
            height="490"
            rx="20"
            fill="url(#atlas-grid)"
            pointerEvents="none"
          />
          <g fill="#e8ecd5" fontFamily="monospace" fontSize="10">
            <text x="22" y="460">
              A MOMENT, NOT A MEASUREMENT.
            </text>
            <text x="554" y="40">
              N ↑
            </text>
          </g>
        </svg>
        <div
          className="layer-controls"
          role="group"
          aria-label="Illustration layers"
        >
          {(["birds", "water", "wind"] as const).map((layer) => (
            <button
              key={layer}
              className={`layer-toggle ${layers[layer] ? "selected" : ""}`}
              aria-pressed={layers[layer]}
              onClick={() =>
                setLayers((previous) => ({
                  ...previous,
                  [layer]: !previous[layer],
                }))
              }
            >
              <span className="layer-dot" />
              {layer[0].toUpperCase() + layer.slice(1)}
            </button>
          ))}
        </div>
        <div className="scene-annotation" aria-hidden="true">
          <span>AN IMAGINED PLACE</span>
          <span>THREE MOMENTS TO LISTEN</span>
        </div>
        <p className="illustration-caption">
          An imagined landscape. Explore the visual layers — no audio plays.
        </p>
      </div>
    </section>
  );
}

export function JournalStats({ state }: { state: State }) {
  const stats = [
    [state.routes.length, "Walks prepared"],
    [state.visits.length, "Visits saved"],
    [state.clips.length, "Recordings"],
    [
      state.clips.filter((clip) => clip.review !== null).length,
      "Human reviews",
    ],
  ];
  return (
    <section className="journal-stats" aria-label="Your journal totals">
      {stats.map(([value, label]) => (
        <div key={label}>
          <span className="stat-value">{String(value).padStart(2, "0")}</span>
          <span className="stat-label">{label}</span>
        </div>
      ))}
    </section>
  );
}

export function ListeningTimer() {
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const next = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(next);
      if (!next) setRunning(false);
    }, 200);
    return () => window.clearInterval(timer);
  }, [running]);
  function toggle() {
    if (running) {
      setRemaining(
        Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
      );
      setRunning(false);
    } else {
      const seconds = remaining || 60;
      setRemaining(seconds);
      deadline.current = Date.now() + seconds * 1000;
      setRunning(true);
    }
  }
  return (
    <section
      className={`listening-timer ${running ? "is-running" : ""}`}
      aria-label="One-minute listening timer"
    >
      <div className="timer-dial">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".12"
            strokeWidth="2"
          />
          <circle
            className="timer-progress"
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="276.46"
            strokeDashoffset={276.46 * (1 - remaining / 60)}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span className="timer-time">
          {remaining === 60
            ? "1:00"
            : `0:${String(remaining).padStart(2, "0")}`}
        </span>
      </div>
      <div className="timer-copy">
        <p className="eyebrow">A MINUTE FOR YOUR EARS</p>
        <h3>
          {remaining === 0
            ? "What did you notice?"
            : "Pause. Notice one thing."}
        </h3>
        <p>
          Notice one near sound, one far sound, and what fills the space
          between. This timer does not record audio.
        </p>
        <div className="timer-controls">
          <button type="button" className="secondary" onClick={toggle}>
            {running
              ? "Pause listening timer"
              : remaining === 0
                ? "Listen for another minute"
                : remaining < 60
                  ? "Resume listening timer"
                  : "Start one-minute timer"}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setRunning(false);
              setRemaining(60);
            }}
          >
            Reset timer
          </button>
        </div>
        <span className="sr-only" role="status">
          {remaining === 0
            ? "Listening minute complete."
            : running
              ? "Listening timer running."
              : remaining === 60
                ? "Listening timer ready."
                : "Listening timer paused."}
        </span>
      </div>
    </section>
  );
}

export function StationRail({
  route,
  state,
  visitId,
  onSelect,
}: {
  route: Route;
  state: State;
  visitId: string;
  onSelect: (id: string) => void;
}) {
  const [selection, setSelection] = useState<{
    visitId: string;
    stopId: string;
  } | null>(null);
  const selectedId = selection?.visitId === visitId ? selection.stopId : "";
  return (
    <nav className="station-rail" aria-label="Listening stations">
      {route.stops.map((stop, index) => {
        const clips = state.clips.filter(
          (clip) => clip.visitId === visitId && clip.stopId === stop.id,
        );
        return (
          <button
            className={`station-button ${selectedId === stop.id ? "selected" : ""}`}
            aria-current={selectedId === stop.id ? "location" : undefined}
            key={stop.id}
            onClick={() => {
              setSelection({ visitId, stopId: stop.id });
              onSelect(stop.id);
            }}
            disabled={!visitId}
          >
            <span className="station-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="station-name">{stop.name}</span>
            <span className="station-count">
              {clips.length} recording{clips.length === 1 ? "" : "s"} ·{" "}
              {clips.filter((clip) => clip.review !== null).length} reviewed
            </span>
          </button>
        );
      })}
    </nav>
  );
}
