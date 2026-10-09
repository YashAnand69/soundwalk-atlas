// @vitest-environment jsdom
import { useRef } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScrollMotion } from "./useScrollMotion";

function Scene({
  paused = false,
  extra = false,
}: {
  paused?: boolean;
  extra?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useScrollMotion(root);
  return (
    <div ref={root} className={paused ? "motion-paused" : ""}>
      <section data-reveal>Journal</section>
      {extra && <section data-reveal>New stop</section>}
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function browserMotion(reduced = false) {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();
  let deliver: IntersectionObserverCallback = () => {};
  let options: IntersectionObserverInit | undefined;
  let changePreference: (() => void) | undefined;
  const preference = {
    matches: reduced,
    addEventListener: vi.fn((_event: string, listener: () => void) => {
      changePreference = listener;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: IntersectionObserverCallback,
        init?: IntersectionObserverInit,
      ) {
        deliver = callback;
        options = init;
      }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("matchMedia", () => preference);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 2000,
  } as DOMRect);
  return {
    observe,
    unobserve,
    disconnect,
    options: () => options,
    reduce: () => {
      preference.matches = true;
      changePreference?.();
    },
    intersect: (target: Element) =>
      deliver(
        [{ target, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
  };
}

describe("scroll motion enhancement", () => {
  it("keeps content visible without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Scene />);
    expect(screen.getByText("Journal").classList.contains("motion-ready")).toBe(
      false,
    );
  });

  it("does not schedule reveals for reduced motion", () => {
    const motion = browserMotion(true);
    render(<Scene />);
    expect(motion.observe).not.toHaveBeenCalled();
    expect(screen.getByText("Journal").classList.contains("motion-ready")).toBe(
      false,
    );
  });

  it("reveals each off-screen section once and cleans up", () => {
    const motion = browserMotion();
    const view = render(<Scene />);
    const section = screen.getByText("Journal");
    expect(section.classList.contains("motion-ready")).toBe(true);
    motion.intersect(section);
    expect(section.classList.contains("is-visible")).toBe(true);
    expect(motion.unobserve).toHaveBeenCalledWith(section);
    view.unmount();
    expect(motion.disconnect).toHaveBeenCalled();
    expect(section.classList.contains("is-visible")).toBe(false);
  });

  it("discovers dynamic sections and reveals pending content when paused", async () => {
    const motion = browserMotion();
    const view = render(<Scene />);
    view.rerender(<Scene extra />);
    await waitFor(() =>
      expect(motion.observe).toHaveBeenCalledWith(screen.getByText("New stop")),
    );
    view.rerender(<Scene extra paused />);
    await waitFor(() =>
      expect(
        screen.getByText("New stop").classList.contains("motion-ready"),
      ).toBe(false),
    );
    expect(motion.disconnect).toHaveBeenCalled();
  });

  it("allows very tall sections to reveal on their first intersection", () => {
    const motion = browserMotion();
    render(<Scene />);
    expect(motion.options()?.threshold).toBe(0);
    motion.intersect(screen.getByText("Journal"));
    expect(screen.getByText("Journal").classList.contains("motion-ready")).toBe(
      false,
    );
  });

  it("reveals focused sections immediately without waiting for scrolling", () => {
    browserMotion();
    render(<Scene />);
    const section = screen.getByText("Journal");
    fireEvent.focusIn(section);
    expect(section.classList.contains("is-visible")).toBe(true);
    expect(section.classList.contains("motion-ready")).toBe(false);
  });

  it("reveals all pending sections when reduced motion is enabled at runtime", () => {
    const motion = browserMotion();
    render(<Scene />);
    motion.reduce();
    expect(screen.getByText("Journal").classList.contains("motion-ready")).toBe(
      false,
    );
    expect(motion.disconnect).toHaveBeenCalled();
  });
});
