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
import { clipSummary, type Clip } from "./types";
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
function setup(
  ready = true,
  duration = 10,
  analysis: Clip["analysis"] = clip.analysis,
) {
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
        clips: [{ ...clip, duration, analysis }],
      });
    if (url.endsWith("/waveform"))
      return Response.json({ peaks: [0.1, 0.5, 0.2], duration: 10 });
    if (url === "/api/observations")
      return Response.json({ id: "o", ...JSON.parse(String(init?.body)) });
    if (url === "/api/clips") return Response.json(clip);
    if (url === "/api/restore")
      return Response.json({
        restoredRoutes: 1,
        restoredVisits: 2,
        restoredClips: 3,
        restoredObservations: 4,
      });
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
  localStorage.clear();
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
    fireEvent.click(
      screen.getByLabelText(/Uncertain — I cannot give a firm label/),
    );
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
    ).toBe("bird · uncertain");
  });
});

describe("complete review summaries", () => {
  it("preserves labels and every independent judgment", () => {
    expect(
      clipSummary([
        {
          ...clip,
          review: {
            labels: ["Footsteps", "Paper rustling"],
            uncertain: true,
            mixed: true,
            mismatch: true,
            note: "",
          },
        },
      ]),
    ).toBe(
      "Footsteps, Paper rustling · uncertain · multiple sounds · model did not fit",
    );
  });
  it("keeps no-label and mismatch judgments without inventing mixed sounds", () => {
    expect(
      clipSummary([
        {
          ...clip,
          review: {
            labels: [],
            uncertain: false,
            mismatch: true,
            note: "",
          },
        },
      ]),
    ).toBe("No confirmed label · model did not fit");
  });
});

describe("integrated trust and field workflow", () => {
  it("retains a successful note save when the subsequent refresh fails", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    const original = fetch.getMockImplementation()!;
    let saved = false;
    fetch.mockImplementation(async (input, init) => {
      if (String(input) === "/api/observations") saved = true;
      if (saved && String(input) === "/api/state") {
        return Response.json(
          { detail: "Journal temporarily unavailable" },
          { status: 503 },
        );
      }
      return original(input, init);
    });
    fireEvent.change(screen.getAllByLabelText("Written listening note")[0], {
      target: { value: "Leaves moving after rain" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Save written observation" })[0],
    );
    await screen.findByText("Written observation saved");
    expect(screen.getByText(/journal could not refresh/)).toBeTruthy();
    expect(
      localStorage.getItem("soundwalk:draft:observation:v1:s1"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Compare visits/ }));
    fireEvent.change(screen.getByLabelText("Second visit"), {
      target: { value: "v2" },
    });
    expect(screen.getByText("Leaves moving after rain")).toBeTruthy();
  });
  it("saves a written observation without selecting any audio", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    fireEvent.change(screen.getAllByLabelText("Written listening note")[0], {
      target: { value: "Leaves moving, no recording needed" },
    });
    fireEvent.change(screen.getAllByLabelText("Conditions / context")[0], {
      target: { value: "After rain" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Save written observation" })[0],
    );
    await screen.findByText("Written observation saved");
    const call = fetch.mock.calls.find(
      ([u]) => String(u) === "/api/observations",
    )!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      visitId: "v1",
      stopId: "s1",
      note: "Leaves moving, no recording needed",
      context: "After rain",
      observedAt: "",
    });
    expect(fetch.mock.calls.some(([u]) => String(u) === "/api/clips")).toBe(
      false,
    );
  });
  it("separates unsupported matches, confidently mixed labels and uncertainty", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    fireEvent.click(screen.getByRole("button", { name: "Footsteps" }));
    fireEvent.click(screen.getByRole("button", { name: "Paper rustling" }));
    fireEvent.click(screen.getByLabelText("None of these model matches fits"));
    fireEvent.click(screen.getByLabelText(/Multiple sounds heard/));
    fireEvent.click(screen.getByRole("button", { name: "Save my review" }));
    await screen.findByText("Your review is saved");
    const call = fetch.mock.calls.find(([u]) => String(u).endsWith("/review"))!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      labels: ["Footsteps", "Paper rustling"],
      uncertain: false,
      mixed: true,
      mismatch: true,
      note: "",
    });
  });
  it("restores private notes when returning to a visit and clears saved upload drafts", async () => {
    setup();
    await screen.findByText("morning.wav");
    fireEvent.change(screen.getAllByLabelText("Your observation")[0], {
      target: { value: "Private morning draft" },
    });
    fireEvent.change(screen.getByLabelText("Visit"), {
      target: { value: "v2" },
    });
    expect(
      (screen.getAllByLabelText("Your observation")[0] as HTMLTextAreaElement)
        .value,
    ).toBe("");
    fireEvent.change(screen.getByLabelText("Visit"), {
      target: { value: "v1" },
    });
    expect(
      (screen.getAllByLabelText("Your observation")[0] as HTMLTextAreaElement)
        .value,
    ).toBe("Private morning draft");
    fireEvent.change(screen.getAllByLabelText(/Choose an audio recording/)[0], {
      target: {
        files: [new File(["RIFF"], "private.wav", { type: "audio/wav" })],
      },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Save recording" })[0],
    );
    await waitFor(() =>
      expect(localStorage.getItem("soundwalk:draft:upload:v1:s1")).toBe(null),
    );
  });
  it("focus mode leaves the journal and corrections mounted", async () => {
    setup();
    await screen.findByText("morning.wav");
    fireEvent.change(screen.getByLabelText("Review note"), {
      target: { value: "Do not lose this" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Focus on journal" }));
    expect(screen.queryByText("A field journal")).toBe(null);
    expect(
      (screen.getByLabelText("Review note") as HTMLInputElement).value,
    ).toBe("Do not lose this");
    expect(screen.getByRole("button", { name: "Show landscape" })).toBeTruthy();
  });
  it("analyses the selected segment without blocking another review", async () => {
    const fetch = setup(true, 30);
    await screen.findByText("morning.wav");
    fireEvent.change(screen.getByLabelText("Analysis start (seconds)"), {
      target: { value: "12" },
    });
    fetch.mockResolvedValueOnce(
      Response.json({ jobId: "job1", status: "queued" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Analyse again locally" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Cancel analysis" }),
      ).toBeTruthy(),
    );
    const call = fetch.mock.calls.find(([u]) =>
      String(u).endsWith("/analyse"),
    )!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({ startSeconds: 12 });
    expect(
      (
        screen.getByRole("button", {
          name: "Save my review",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        screen.getAllByRole("button", {
          name: "Save written observation",
        })[0] as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(screen.getAllByLabelText("Written listening note")[0], {
      target: { value: "Still usable while analysing" },
    });
    expect(
      (
        screen.getAllByRole("button", {
          name: "Save written observation",
        })[0] as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("draws decoded waveform samples rather than invented animation data", async () => {
    setup();
    await screen.findByText("morning.wav");
    const svg = await screen.findByRole("img", {
      name: /Waveform of your recording/,
    });
    expect(svg.querySelectorAll("line")).toHaveLength(3);
    expect(screen.getByText("0.0–10.0 seconds selected")).toBeTruthy();
  });
});

describe("analysis interval and quality provenance", () => {
  it("keeps saved matches tied to their actual interval when selection changes", async () => {
    setup(true, 24, {
      ...clip.analysis,
      segment: { startSeconds: 0, endSeconds: 10 },
    });
    await screen.findByRole("heading", { name: "Park loop" });
    expect(
      screen.getByText(/Last analysed interval: 0.0–10.0 seconds/),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Analysis start (seconds)"), {
      target: { value: "12" },
    });
    expect(
      screen.getByText(/These saved matches describe the previous interval/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Last analysed interval: 0.0–10.0 seconds/),
    ).toBeTruthy();
  });
  it("explains silent abstention and still allows a human review", async () => {
    setup(true, 10, {
      ...clip.analysis,
      suggestions: [],
      quality: [
        "Effectively silent digital segment; no sound suggestions generated.",
      ],
    });
    await screen.findByRole("heading", { name: "Park loop" });
    expect(screen.getByText(/Effectively silent digital segment/)).toBeTruthy();
    expect(screen.getByText(/No usable candidate match/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Footsteps" })).toBeTruthy();
  });
});

describe("portable backup confirmation", () => {
  it("reports a committed restore even when the following journal read fails", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    const original = fetch.getMockImplementation()!;
    let restored = false;
    fetch.mockImplementation(async (input, init) => {
      if (String(input) === "/api/restore") restored = true;
      if (restored && String(input) === "/api/state") {
        return Response.json({ detail: "Unavailable" }, { status: 503 });
      }
      return original(input, init);
    });
    fireEvent.change(screen.getByLabelText("Restore backup"), {
      target: { files: [new File(["fixture"], "journal.zip")] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Restore as new walks" }),
    );
    await screen.findByText(
      "Restored 1 walk, 2 visits, 3 recordings and 4 written observations.",
    );
    expect(
      screen.getByText(/Backup restored, but the journal could not refresh/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Confirm backup restore" }),
    ).toBeNull();
    expect(
      fetch.mock.calls.filter(([url]) => url === "/api/restore"),
    ).toHaveLength(1);
  });

  it("does not transmit an archive before explicit confirmation and shows restore counts", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    const file = new File(["synthetic archive"], "journal.zip", {
      type: "application/zip",
    });
    fireEvent.change(screen.getByLabelText("Restore backup"), {
      target: { files: [file] },
    });
    expect(fetch.mock.calls.some(([url]) => url === "/api/restore")).toBe(
      false,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Restore as new walks" }),
    );
    await screen.findByText(
      "Restored 1 walk, 2 visits, 3 recordings and 4 written observations.",
    );
    const call = fetch.mock.calls.find(([url]) => url === "/api/restore");
    expect(call?.[1]?.body).toBeInstanceOf(FormData);
    expect(
      screen.queryByRole("region", { name: "Confirm backup restore" }),
    ).toBeNull();
  });
  it("cancels a selected archive without a restore request", async () => {
    const fetch = setup();
    await screen.findByText("morning.wav");
    fireEvent.change(screen.getByLabelText("Restore backup"), {
      target: { files: [new File(["fixture"], "journal.zip")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel restore" }));
    expect(
      screen.queryByRole("region", { name: "Confirm backup restore" }),
    ).toBeNull();
    expect(fetch.mock.calls.some(([url]) => url === "/api/restore")).toBe(
      false,
    );
  });
});
