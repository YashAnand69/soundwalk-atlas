import { useEffect, useRef, useState } from "react";

const steps = [
  [
    "01",
    "Be here first.",
    "Put the screen away. Listen for a minute. Notice what is near, what is far, what comes and goes.",
    "LISTEN",
  ],
  [
    "02",
    "Bring a little back.",
    "Keep a written note or a short recording. Back at your laptop, local AI offers a second perspective. Your ears have the final say.",
    "NOTICE",
  ],
  [
    "03",
    "Return with curiosity.",
    "Visit the same stops again. Compare your observations, including the sounds the model missed.",
    "RETURN",
  ],
];

/** Scroll moves an illustrated trail marker, never the user's page position. */
export function ListeningPrelude({ paused = false }: { paused?: boolean }) {
  const section = useRef<HTMLElement>(null);
  const path = useRef<SVGPathElement>(null);
  const marker = useRef<SVGGElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const root = section.current;
    const trail = path.current;
    if (!root || !trail) return;
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let length = 0;
    try {
      length = trail.getTotalLength();
    } catch {
      /* Non-SVG test environments keep the static illustration. */
    }
    const update = () => {
      frame = 0;
      const bounds = root.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(
          1,
          (window.innerHeight * 0.38 - bounds.top) /
            Math.max(1, bounds.height - window.innerHeight * 0.48),
        ),
      );
      const next = Math.min(2, Math.floor(progress * 3));
      setActive(next);
      const still = paused || preference?.matches;
      root.style.setProperty(
        "--trail-progress",
        still ? "1" : String(progress),
      );
      if (length && marker.current) {
        const point = trail.getPointAtLength((still ? 1 : progress) * length);
        marker.current.setAttribute(
          "transform",
          `translate(${point.x} ${point.y})`,
        );
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    preference?.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      preference?.removeEventListener("change", schedule);
    };
  }, [paused]);
  return (
    <section
      ref={section}
      className={`listening-prelude trail-stage-${active}`}
      aria-labelledby="prelude-title"
    >
      <div className="prelude-heading" data-reveal>
        <p className="eyebrow">THE ART OF NOTICING</p>
        <h2 id="prelude-title">
          The world has a soundtrack.
          <br />
          <i>Take the long way home.</i>
        </h2>
        <p>Scroll through a small journey. Then make one of your own.</p>
      </div>
      <div className="trail-story">
        <div className="trail-sticky">
          <div className="trail-art" aria-hidden="true">
            <div className="trail-art-meta">
              <span>AN IMAGINED WALK</span>
              <span>NO. 001</span>
            </div>
            <svg viewBox="0 0 520 420" className="scroll-landscape" fill="none">
              <defs>
                <pattern
                  id="trail-grid"
                  width="32"
                  height="32"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M32 0H0V32" stroke="#647559" strokeOpacity=".08" />
                </pattern>
                <linearGradient id="trail-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#e9e4d3" />
                  <stop offset="1" stopColor="#d3ddc1" />
                </linearGradient>
              </defs>
              <rect width="520" height="420" fill="url(#trail-sky)" />
              <circle
                className="trail-sun"
                cx="405"
                cy="85"
                r="30"
                fill="#f8f2d9"
              />
              <g className="trail-terrain trail-terrain-far">
                <path
                  d="M0 220C80 150 130 130 213 183S350 185 520 135V420H0Z"
                  fill="#afbea0"
                />
              </g>
              <g className="trail-terrain trail-terrain-near">
                <path
                  d="M0 295C95 180 195 226 265 258S405 238 520 265V420H0Z"
                  fill="#859a75"
                />
              </g>
              <path
                d="M350 170c-60 30 35 50-20 85s20 56 103 165h87c-32-72-136-123-142-152s39-53-1-74"
                fill="#e8e8d6"
                fillOpacity=".6"
              />
              <rect width="520" height="420" fill="url(#trail-grid)" />
              <g stroke="#eff0dc" strokeOpacity=".28">
                <ellipse cx="225" cy="275" rx="215" ry="110" />
                <ellipse cx="225" cy="275" rx="174" ry="83" />
                <ellipse cx="225" cy="275" rx="133" ry="56" />
              </g>
              <path
                ref={path}
                id="scroll-trail"
                d="M80 335C75 260 195 300 192 228S322 147 350 205 415 300 452 340"
                stroke="#425b3b"
                strokeOpacity=".3"
                strokeWidth="2"
                strokeDasharray="3 7"
              />
              <path
                className="trail-ink"
                pathLength="1"
                d="M80 335C75 260 195 300 192 228S322 147 350 205 415 300 452 340"
                stroke="#3b5034"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {[
                [80, 335, "01"],
                [270, 183, "02"],
                [452, 340, "03"],
              ].map(([x, y, n]) => (
                <g key={n}>
                  <circle
                    cx={x}
                    cy={y}
                    r="17"
                    fill="#ecebd5"
                    stroke="#546d47"
                    strokeOpacity=".3"
                  />
                  <text
                    x={x}
                    y={Number(y) + 4}
                    fill="#46593d"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {n}
                  </text>
                </g>
              ))}
              <g
                ref={marker}
                className="trail-traveller"
                transform="translate(80 335)"
              >
                <circle
                  className="trail-aura"
                  r="22"
                  fill="#f5edd0"
                  fillOpacity=".35"
                />
                <circle r="9" fill="#263f2b" stroke="#faf7df" strokeWidth="3" />
                <circle r="2" fill="#faf7df" />
              </g>
              <path
                className="trail-bird"
                d="M116 88q8-7 16 0 8-7 16 0m42 24q6-6 12 0 6-6 12 0"
                stroke="#617553"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="trail-caption">
              <span>
                {steps[active][0]} / {steps[active][3]}
              </span>
              <span>SCROLL TO FOLLOW THE TRAIL ↓</span>
            </div>
          </div>
          <p className="trail-disclaimer">
            Illustrated journey, not a live route or audio visualisation.
          </p>
        </div>
        <div className="prelude-steps">
          {steps.map(([number, title, text], index) => (
            <article
              className={`prelude-step ${index === active ? "step-current" : ""}`}
              key={number}
              data-reveal
            >
              <span className="prelude-number">{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="step-flourish" aria-hidden="true">
                {index === 0
                  ? "A MINUTE FOR YOUR EARS"
                  : index === 1
                    ? "HUMAN JUDGMENT, ALWAYS"
                    : "SAME PLACE. NEW PERSPECTIVE."}
              </span>
            </article>
          ))}
        </div>
      </div>
      <div className="prelude-line" aria-hidden="true">
        <span>LEAVE THE SCREEN BEHIND</span>
        <span>COME BACK WITH A STORY</span>
      </div>
    </section>
  );
}
