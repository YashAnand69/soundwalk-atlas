export type Route = {
  id: string;
  name: string;
  stops: { id: string; name: string }[];
};
export type Visit = {
  id: string;
  routeId: string;
  title: string;
  createdAt: string;
};
export type Clip = {
  id: string;
  visitId: string;
  stopId: string;
  filename: string;
  duration: number;
  createdAt: string;
  note: string;
  quality: string[];
  analysis: null | {
    suggestions: { label: string; score: number }[];
    status: string;
    model: string;
    revision: string;
    window: string;
    segment?: { startSeconds: number; endSeconds: number };
    vocabularyVersion?: string;
    matching?: string;
    quality?: string[];
  };
  review: null | {
    labels: string[];
    uncertain: boolean;
    note: string;
    mixed?: boolean;
    mismatch?: boolean;
  };
  status: string;
  error?: string;
};
export type Observation = {
  id: string;
  visitId: string;
  stopId: string;
  note: string;
  observedAt: string;
  context: string;
};
export type State = {
  routes: Route[];
  visits: Visit[];
  clips: Clip[];
  observations?: Observation[];
};
export type Config = {
  token: string;
  model: { ready: boolean; status: string; revision?: string };
  limits: { maxBytes: number; maxDuration: number };
  version: string;
};
export function stopClips(state: State, visitId: string, stopId: string) {
  return state.clips.filter(
    (c) => c.visitId === visitId && c.stopId === stopId,
  );
}
export function clipSummary(clips: Clip[]) {
  if (!clips.length) return "No recording";
  const reviewed = clips.filter((c) => c.review);
  if (!reviewed.length) return "Not reviewed";
  return reviewed
    .map((c) =>
      c.review!.uncertain
        ? c.review!.mixed === undefined
          ? "Uncertain / mixed"
          : "Uncertain"
        : (c.review!.labels.join(", ") || "No labels") +
          (c.review!.mixed ? " · multiple sounds" : "") +
          (c.review!.mismatch ? " · model did not fit" : ""),
    )
    .join(" · ");
}
