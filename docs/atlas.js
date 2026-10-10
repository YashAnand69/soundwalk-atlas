(() => {
  "use strict";
  const scene = document.querySelector("#landscape");
  const path = document.querySelector("#hero-trail");
  const marker = document.querySelector("#trail-marker");
  const pause = document.querySelector("#motion-toggle");
  const light = document.querySelector("#light-toggle");
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = false;
  let frame = 0;
  let observer;
  let length = 0;
  try {
    length = path.getTotalLength();
  } catch {
    /* Static drawing remains usable. */
  }
  function render() {
    frame = 0;
    const still = paused || preference.matches;
    if (!scene || !length || !marker) return;
    const box = scene.getBoundingClientRect();
    const progress = still
      ? 0.48
      : Math.max(
          0,
          Math.min(
            1,
            (window.innerHeight - box.top) / (window.innerHeight + box.height),
          ),
        );
    const point = path.getPointAtLength(progress * length);
    marker.setAttribute("transform", `translate(${point.x} ${point.y})`);
    scene.style.setProperty(
      "--ridge-shift",
      still ? "0px" : `${(progress - 0.5) * 14}px`,
    );
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function sync() {
    document.body.classList.toggle(
      "motion-paused",
      paused || preference.matches,
    );
    pause.textContent = preference.matches
      ? "Reduced motion"
      : paused
        ? "Resume motion"
        : "Pause motion";
    pause.setAttribute("aria-pressed", String(paused || preference.matches));
    pause.disabled = preference.matches;
    observer?.disconnect();
    const steps = document.querySelectorAll(".ritual-step");
    steps.forEach((step) => step.classList.remove("waiting"));
    if (!paused && !preference.matches && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("seen");
              entry.target.classList.remove("waiting");
              observer.unobserve(entry.target);
            }
          }),
        { threshold: 0.15 },
      );
      steps.forEach((step) => {
        if (step.getBoundingClientRect().top > innerHeight) {
          step.classList.add("waiting");
          observer.observe(step);
        }
      });
    }
    schedule();
  }
  pause.addEventListener("click", () => {
    paused = !paused;
    sync();
  });
  light.addEventListener("click", () => {
    const dusk = scene.classList.toggle("dusk");
    light.setAttribute("aria-pressed", String(dusk));
    light.textContent = dusk ? "Switch to daylight" : "Switch to dusk";
  });
  document.addEventListener("focusin", (event) => {
    const step = event.target.closest?.(".ritual-step");
    if (step) {
      step.classList.remove("waiting");
      step.classList.add("seen");
    }
  });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  preference.addEventListener("change", sync);
  sync();
})();
