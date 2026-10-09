import { useEffect, type RefObject } from "react";

/** Progressive enhancement: content stays readable when motion is unavailable. */
export function useScrollMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const tracked = new Set<HTMLElement>();
    let observer: IntersectionObserver | null = null;
    let frame = 0;
    let enabled = false;

    const reveal = (element: HTMLElement) => {
      element.classList.add("is-visible");
      element.classList.remove("motion-ready");
      observer?.unobserve(element);
    };
    const discover = () => {
      for (const element of tracked) {
        if (!root.contains(element)) {
          observer?.unobserve(element);
          tracked.delete(element);
        }
      }
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        if (tracked.has(element)) return;
        tracked.add(element);
        // Content already in view is never hidden during hydration or navigation.
        if (
          !enabled ||
          element.getBoundingClientRect().top < window.innerHeight * 0.9
        ) {
          reveal(element);
        } else {
          element.classList.add("motion-ready");
          observer?.observe(element);
        }
      });
    };
    const updateProgress = () => {
      frame = 0;
      if (!enabled) return;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        scrollable > 0
          ? Math.min(1, Math.max(0, window.scrollY / scrollable))
          : 0;
      root.style.setProperty("--scroll-progress", String(progress));
    };
    const scheduleProgress = () => {
      if (enabled && !frame)
        frame = window.requestAnimationFrame(updateProgress);
    };
    const syncMotion = () => {
      const next =
        Boolean(window.IntersectionObserver) &&
        !preference?.matches &&
        !root.matches(".motion-paused") &&
        !root.querySelector(".motion-paused");
      if (next === enabled) return;
      enabled = next;
      if (enabled) {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) reveal(entry.target as HTMLElement);
            });
          },
          { threshold: 0, rootMargin: "0px 0px -5% 0px" },
        );
        scheduleProgress();
      } else {
        observer?.disconnect();
        observer = null;
        tracked.forEach(reveal);
        window.cancelAnimationFrame(frame);
        frame = 0;
        root.style.removeProperty("--scroll-progress");
      }
    };
    syncMotion();
    discover();
    const revealFocused = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      let element: HTMLElement | null = event.target;
      while (element && element !== root) {
        if (tracked.has(element)) reveal(element);
        element = element.parentElement;
      }
    };
    const mutations = new MutationObserver((records) => {
      syncMotion();
      if (records.some((record) => record.type === "childList")) {
        discover();
        scheduleProgress();
      }
    });
    mutations.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    preference?.addEventListener("change", syncMotion);
    root.addEventListener("focusin", revealFocused);
    window.addEventListener("scroll", scheduleProgress, { passive: true });
    window.addEventListener("resize", scheduleProgress, { passive: true });
    return () => {
      mutations.disconnect();
      observer?.disconnect();
      preference?.removeEventListener("change", syncMotion);
      root.removeEventListener("focusin", revealFocused);
      window.removeEventListener("scroll", scheduleProgress);
      window.removeEventListener("resize", scheduleProgress);
      window.cancelAnimationFrame(frame);
      tracked.forEach((element) =>
        element.classList.remove("motion-ready", "is-visible"),
      );
      root.style.removeProperty("--scroll-progress");
    };
  }, [rootRef]);
}
