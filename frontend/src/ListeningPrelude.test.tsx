// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListeningPrelude } from "./ListeningPrelude";

const originalLength = Object.getOwnPropertyDescriptor(
  SVGElement.prototype,
  "getTotalLength",
);
const originalPoint = Object.getOwnPropertyDescriptor(
  SVGElement.prototype,
  "getPointAtLength",
);
let top = 2000;
let scheduled: FrameRequestCallback | undefined;
let reduced = false;

beforeEach(() => {
  top = 2000;
  reduced = false;
  scheduled = undefined;
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    scheduled = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ top, height: 2000 }) as DOMRect,
  );
  Object.defineProperties(SVGElement.prototype, {
    getTotalLength: { configurable: true, value: () => 1000 },
    getPointAtLength: {
      configurable: true,
      value: (length: number) => ({ x: length, y: length / 2 }),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of [
    ["getTotalLength", originalLength],
    ["getPointAtLength", originalPoint],
  ] as const) {
    if (descriptor)
      Object.defineProperty(SVGElement.prototype, name, descriptor);
    else Reflect.deleteProperty(SVGElement.prototype, name);
  }
});

function scrollTo(sectionTop: number) {
  top = sectionTop;
  fireEvent.scroll(window);
  act(() => scheduled?.(0));
}

describe("illustrated listening journey", () => {
  it("advances and clamps the trail marker as the section crosses the viewport", () => {
    const { container } = render(<ListeningPrelude />);
    const section = container.querySelector<HTMLElement>(".listening-prelude")!;
    const marker = container.querySelector(".trail-traveller")!;
    expect(section.style.getPropertyValue("--trail-progress")).toBe("0");
    expect(marker.getAttribute("transform")).toBe("translate(0 0)");
    scrollTo(-600);
    const progress = Number(section.style.getPropertyValue("--trail-progress"));
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
    expect(section.classList.contains("trail-stage-1")).toBe(true);
    scrollTo(-3000);
    expect(section.style.getPropertyValue("--trail-progress")).toBe("1");
    expect(marker.getAttribute("transform")).toBe("translate(1000 500)");
    expect(section.classList.contains("trail-stage-2")).toBe(true);
  });

  it.each(["paused", "reduced"])(
    "keeps the marker and trail static when %s",
    (mode) => {
      reduced = mode === "reduced";
      const { container } = render(
        <ListeningPrelude paused={mode === "paused"} />,
      );
      const section =
        container.querySelector<HTMLElement>(".listening-prelude")!;
      const marker = container.querySelector(".trail-traveller")!;
      expect(section.style.getPropertyValue("--trail-progress")).toBe("1");
      const initialTransform = marker.getAttribute("transform");
      scrollTo(-600);
      expect(marker.getAttribute("transform")).toBe(initialTransform);
      expect(section.style.getPropertyValue("--trail-progress")).toBe("1");
    },
  );

  it("retains explanatory content when SVG geometry APIs are unavailable", () => {
    Reflect.deleteProperty(SVGElement.prototype, "getTotalLength");
    Reflect.deleteProperty(SVGElement.prototype, "getPointAtLength");
    const { getByText, container } = render(<ListeningPrelude />);
    expect(getByText("Be here first.")).toBeTruthy();
    expect(
      container.querySelector(".trail-traveller")?.getAttribute("transform"),
    ).toBe("translate(80 335)");
  });

  it("cancels pending frames on unmount", () => {
    const view = render(<ListeningPrelude />);
    fireEvent.scroll(window);
    view.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
