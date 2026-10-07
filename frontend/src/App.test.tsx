// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import App from "./App";
import { clipSummary } from "./types";
const route = {
  id: "r",
  name: "Park loop",
  stops: [
    { id: "s1", name: "Under the oak" },
    { id: "s2", name: "At the pond" },
  ],
};
const clip = {
  id: "c",
  visitId: "v1",
  stopId: "s1",
  filename: "morning.wav",
  duration: 10,
  createdAt: "now",
  note: "Wind and a truck",
  quality: [],
  analysis: {
    suggestions: [{ label: "traffic", score: 0.42 }],
    status: "review",
    model: "CLAP",
    revision: "abc",
    window: "First ten seconds",
  },
  review: null,
  status: "ready",
};
function setup(ready = true) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/config")
      return Response.json({
        token: "secret",
        model: { ready, status: ready ? "ready" : "Model not installed" },
        limits: { maxBytes: 20971520, maxDuration: 30 },
        version: "1",
      });
    if (url === "/api/state")
      return Response.json({
        routes: [route],
        visits: [
          { id: "v1", routeId: "r", title: "Morning", createdAt: "now" },
          { id: "v2", routeId: "r", title: "Evening", createdAt: "now" },
        ],
        clips: [clip],
      });
    if (url === "/api/clips") return Response.json(clip);
    if (url.endsWith("/review"))
      return Response.json({ ...clip, review: JSON.parse(String(init?.body)) });
    throw new Error("Unexpected " + url);
  });
  vi.stubGlobal("fetch", fetch);
  render(<App />);
  return fetch;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("listening workflow", () => {
  it("offers manual review while the model is unavailable, without claiming confidence", async () => {
    setup(false);
    await screen.findByRole("heading", { name: "Park loop" });
    expect(screen.getByText(/local AI model isn’t yet/)).toBeTruthy();
    const analyse = screen.getByRole("button", {
      name: "Analyse again locally",
    }) as HTMLButtonElement;
    expect(analyse.disabled).toBe(true);
    expect(screen.getByText(/not confidence percentages/)).toBeTruthy();
  });
  it("refreshes model readiness and session credentials without discarding saved visits", async () => {
    const fetch = setup(false);
    await screen.findByText("morning.wav");
    fetch.mockResolvedValueOnce(
      Response.json({
        token: "renewed",
        model: { ready: true, status: "ready" },
        limits: { maxBytes: 20971520, maxDuration: 30 },
        version: "1",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh status ↻" }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Analyse again locally",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(screen.getByText("morning.wav")).toBeTruthy();
  });
  it("sends explicit human correction and uncertain state with the mutation token", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    fireEvent.change(
      screen.getByLabelText("Your labels, separated by commas"),
      { target: { value: "wind, traffic" } },
    );
    fireEvent.click(screen.getByLabelText(/Uncertain or mixed/));
    fireEvent.click(screen.getByRole("button", { name: "Save my review" }));
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([u]) => String(u).endsWith("/review")),
      ).toBe(true),
    );
    const call = fetch.mock.calls.find(([u]) => String(u).endsWith("/review"))!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      labels: ["wind", "traffic"],
      uncertain: true,
      note: "",
    });
    expect(new Headers(call[1]?.headers).get("X-Soundwalk-Token")).toBe(
      "secret",
    );
  });
  it("keeps absent recordings distinct from unreviewed recordings when comparing stops", async () => {
    setup();
    await screen.findByRole("heading", { name: "Park loop" });
    fireEvent.click(screen.getByRole("button", { name: /Compare visits/ }));
    fireEvent.change(screen.getByLabelText("Second visit"), {
      target: { value: "v2" },
    });
    expect(screen.getByText("Not reviewed")).toBeTruthy();
    expect(screen.getAllByText("No recording").length).toBe(3);
    expect(screen.getByText("Under the oak")).toBeTruthy();
  });
  it("does not suggest two copies of the same visit as a comparison", async () => {
    setup();
    await screen.findByRole("heading", { name: "Park loop" });
    fireEvent.click(screen.getByRole("button", { name: /Compare visits/ }));
    const select = screen.getByLabelText("Second visit") as HTMLSelectElement;
    expect([...select.options].some((o) => o.value === "v1")).toBe(false);
  });
});
describe("recording drafts", () => {
  it("does not carry a selected file or observation into another visit", async () => {
    setup();
    await screen.findByText("morning.wav");
    const file = new File(["RIFF"], "draft.wav", { type: "audio/wav" });
    fireEvent.change(screen.getAllByLabelText(/Choose an audio recording/)[0], {
      target: { files: [file] },
    });
    fireEvent.change(screen.getAllByLabelText("Your observation")[0], {
      target: { value: "This belongs to morning" },
    });
    fireEvent.change(screen.getByLabelText("Visit"), {
      target: { value: "v2" },
    });
    expect(screen.queryByText("draft.wav")).toBe(null);
    expect(
      (screen.getAllByLabelText("Your observation")[0] as HTMLTextAreaElement)
        .value,
    ).toBe("");
    expect(
      (
        screen.getAllByRole("button", {
          name: "Save recording",
        })[0] as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("clears the draft after a successful save so a second click cannot duplicate it", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    const file = new File(["RIFF"], "draft.wav", { type: "audio/wav" });
    fireEvent.change(screen.getAllByLabelText(/Choose an audio recording/)[0], {
      target: { files: [file] },
    });
    fireEvent.change(screen.getAllByLabelText("Your observation")[0], {
      target: { value: "A distant engine" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Save recording" })[0],
    );
    await waitFor(() => expect(screen.queryByText("draft.wav")).toBe(null));
    expect(
      (screen.getAllByLabelText("Your observation")[0] as HTMLTextAreaElement)
        .value,
    ).toBe("");
    expect(
      fetch.mock.calls.filter(([u]) => String(u) === "/api/clips"),
    ).toHaveLength(1);
    expect(
      (
        screen.getAllByRole("button", {
          name: "Save recording",
        })[0] as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("clears an acknowledged upload even when the following journal refresh fails", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    fireEvent.change(screen.getAllByLabelText(/Choose an audio recording/)[0], {
      target: {
        files: [new File(["RIFF"], "saved.wav", { type: "audio/wav" })],
      },
    });
    fetch.mockResolvedValueOnce(
      Response.json({ ...clip, id: "saved", filename: "saved.wav" }),
    );
    fetch.mockRejectedValueOnce(new Error("service interrupted"));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Save recording" })[0],
    );
    await screen.findByText(
      /Recording saved, but the journal could not refresh/,
    );
    expect(
      (
        screen.getAllByRole("button", {
          name: "Save recording",
        })[0] as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("saved.wav").tagName).toBe("STRONG");
  });
  it("retains the draft when the service rejects the upload", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    fireEvent.change(screen.getAllByLabelText(/Choose an audio recording/)[0], {
      target: {
        files: [new File(["RIFF"], "retry.wav", { type: "audio/wav" })],
      },
    });
    fireEvent.change(screen.getAllByLabelText("Your observation")[0], {
      target: { value: "Keep this note" },
    });
    fetch.mockResolvedValueOnce(
      Response.json(
        { detail: "Recording could not be saved" },
        { status: 400 },
      ),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Save recording" })[0],
    );
    await screen.findByText("Recording could not be saved");
    expect(screen.getByText("retry.wav")).toBeTruthy();
    expect(
      (screen.getAllByLabelText("Your observation")[0] as HTMLTextAreaElement)
        .value,
    ).toBe("Keep this note");
  });
  it("prints the listening card even when opened from the comparison view", async () => {
    setup();
    await screen.findByText("morning.wav");
    fireEvent.click(screen.getByRole("button", { name: /Compare visits/ }));
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(screen.getByText("Before you press record")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Print card ↗" }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });
  it("keeps original human notes and playable audio available in comparison", async () => {
    setup();
    await screen.findByText("morning.wav");
    fireEvent.click(screen.getByRole("button", { name: /Compare visits/ }));
    fireEvent.change(screen.getByLabelText("Second visit"), {
      target: { value: "v2" },
    });
    expect(screen.getByText("Wind and a truck")).toBeTruthy();
    expect(
      screen.getByLabelText("Recording morning.wav").getAttribute("src"),
    ).toBe("/api/clips/c/audio");
  });
});
describe("review summaries", () => {
  it("retains uncertain human review instead of promoting a model label", () => {
    expect(
      clipSummary([
        {
          ...clip,
          analysis: null,
          review: { labels: ["bird"], uncertain: true, note: "" },
        },
      ]),
    ).toBe("Uncertain / mixed");
  });
});
