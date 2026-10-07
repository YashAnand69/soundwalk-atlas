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
  };
  review: null | { labels: string[]; uncertain: boolean; note: string };
  status: string;
  error?: string;
};
export type State = { routes: Route[]; visits: Visit[]; clips: Clip[] };
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
        ? "Uncertain / mixed"
        : c.review!.labels.join(", ") || "No labels",
    )
    .join(" · ");
}
