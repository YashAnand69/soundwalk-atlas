// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  FieldHero,
  JournalStats,
  ListeningTimer,
  StationRail,
} from "./FieldInstrument";
import type { Clip, Route, State } from "./types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("listening timer", () => {
  it("pauses elapsed time, resumes the remaining minute, and resets", () => {
    vi.useFakeTimers();
    render(<ListeningTimer />);
    fireEvent.click(
      screen.getByRole("button", { name: "Start one-minute timer" }),
    );
    act(() => vi.advanceTimersByTime(12000));
    expect(screen.getByText("0:48")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Pause listening timer" }),
    );
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByText("0:48")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Resume listening timer" }),
    );
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByText("0:40")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset timer" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("1:00")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Start one-minute timer" }),
    ).toBeTruthy();
  });

  it("finishes without going negative and can start another full minute", () => {
    vi.useFakeTimers();
    render(<ListeningTimer />);
    fireEvent.click(
      screen.getByRole("button", { name: "Start one-minute timer" }),
    );
    act(() => vi.advanceTimersByTime(65000));
    expect(screen.getByText("0:00")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "Listening minute complete.",
    );
    expect(
      screen.getByRole("heading", { name: "What did you notice?" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Listen for another minute" }),
    );
    expect(screen.getByText("1:00")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("0:59")).toBeTruthy();
  });

  it("cleans up the interval when the timer leaves the screen", () => {
    vi.useFakeTimers();
    const { unmount } = render(<ListeningTimer />);
    fireEvent.click(
      screen.getByRole("button", { name: "Start one-minute timer" }),
    );
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("illustrated field guide", () => {
  it("exposes visual toggle states and never adds an audio player", () => {
    const begin = vi.fn(),
      prepare = vi.fn();
    const { container } = render(
      <FieldHero onBegin={begin} onPrepare={prepare} />,
    );
    const day = screen.getByRole("button", { name: "Daylight" });
    const dusk = screen.getByRole("button", { name: "Dusk" });
    expect(day.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(dusk);
    expect(dusk.getAttribute("aria-pressed")).toBe("true");
    expect(day.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "at dusk",
    );
    const birds = screen.getByRole("button", { name: "Birds" });
    fireEvent.click(birds);
    expect(birds.getAttribute("aria-pressed")).toBe("false");
    expect(
      container.querySelector(".scene-birds")?.classList.contains("is-visible"),
    ).toBe(false);
    expect(
      screen
        .getByRole("button", { name: "Water" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(container.querySelector("audio")).toBe(null);
    expect(screen.getByText(/An imagined landscape/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Open your field journal" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare a listening walk" }),
    );
    expect(begin).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});

const route: Route = {
  id: "walk",
  name: "Park loop",
  stops: [
    { id: "oak", name: "Under the oak" },
    { id: "pond", name: "At the pond" },
  ],
};
const clip: Clip = {
  id: "one",
  visitId: "morning",
  stopId: "oak",
  filename: "one.wav",
  duration: 10,
  createdAt: "now",
  note: "Wind",
  quality: [],
  analysis: null,
  review: null,
  status: "ready",
};
const state: State = {
  routes: [route],
  visits: [
    { id: "morning", routeId: "walk", title: "Morning", createdAt: "now" },
  ],
  clips: [
    clip,
    {
      ...clip,
      id: "two",
      review: { labels: [], uncertain: true, note: "Mixed" },
    },
    { ...clip, id: "another-visit", visitId: "evening" },
  ],
};

describe("journal and station counts", () => {
  it("counts saved state and human uncertainty as review, without implying model accuracy", () => {
    render(<JournalStats state={state} />);
    const totals = screen.getByRole("region", { name: "Your journal totals" });
    expect(
      within(totals).getByText("Recordings").previousSibling?.textContent,
    ).toBe("03");
    expect(
      within(totals).getByText("Human reviews").previousSibling?.textContent,
    ).toBe("01");
    expect(
      within(totals).getByText("Walks prepared").previousSibling?.textContent,
    ).toBe("01");
  });

  it("scopes station counts to the selected visit and selects the actual stable stop ID", () => {
    const select = vi.fn();
    render(
      <StationRail
        route={route}
        state={state}
        visitId="morning"
        onSelect={select}
      />,
    );
    const oak = screen.getByRole("button", { name: /Under the oak/ });
    expect(oak.textContent).toContain("2 recordings · 1 reviewed");
    expect(
      screen.getByRole("button", { name: /At the pond/ }).textContent,
    ).toContain("0 recordings · 0 reviewed");
    fireEvent.click(oak);
    expect(select).toHaveBeenCalledWith("oak");
    expect(oak.getAttribute("aria-current")).toBe("location");
    expect(oak.classList.contains("selected")).toBe(true);
    const pond = screen.getByRole("button", { name: /At the pond/ });
    fireEvent.click(pond);
    expect(pond.getAttribute("aria-current")).toBe("location");
    expect(oak.getAttribute("aria-current")).toBe(null);
  });

  it("disables station actions until a visit exists", () => {
    const select = vi.fn();
    render(
      <StationRail route={route} state={state} visitId="" onSelect={select} />,
    );
    const oak = screen.getByRole("button", {
      name: /Under the oak/,
    }) as HTMLButtonElement;
    expect(oak.disabled).toBe(true);
    fireEvent.click(oak);
    expect(select).not.toHaveBeenCalled();
  });
});

describe("motion accessibility", () => {
  it("lets the user pause decorative motion without changing visual layers", () => {
    const { container } = render(
      <FieldHero onBegin={() => {}} onPrepare={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause motion" }));
    expect(
      container
        .querySelector(".field-hero")
        ?.classList.contains("motion-paused"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Resume motion" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Birds" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Resume motion" }));
    expect(
      container
        .querySelector(".field-hero")
        ?.classList.contains("motion-paused"),
    ).toBe(false);
  });
  it("announces the timer as ready before it starts", () => {
    render(<ListeningTimer />);
    expect(screen.getByRole("status").textContent).toBe(
      "Listening timer ready.",
    );
  });
});
