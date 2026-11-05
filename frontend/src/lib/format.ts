export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN"));

export const fmtPct = (r: number | null | undefined, digits = 1) =>
  r == null ? "—" : `${(r * 100).toFixed(digits)}%`;

export function fmtBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export function fmtDuration(s: number | null | undefined) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** "14:02 · 5 Nov" — compact, unambiguous, local time. */
export function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${time} · ${day}`;
}

export function elapsed(start: string | null, end: string | null) {
  if (!start) return null;
  const a = new Date(start.endsWith("Z") || start.includes("+") ? start : start + "Z").getTime();
  const b = end ? new Date(end.endsWith("Z") || end.includes("+") ? end : end + "Z").getTime() : Date.now();
  return Math.max(0, (b - a) / 1000);
}

export const vesselTag = (id: number) => `V-${id.toString().padStart(3, "0")}`;

// Same order as backend/app/vision/annotate.py, converted from BGR to RGB,
// so a vessel has the same colour on the video overlay and in every table.
const ID_COLOURS = [
  "#F0A33A", "#3DB489", "#E24B4F", "#48A0C4", "#C878B4",
  "#DCC85A", "#F0783C", "#5AC8C8", "#8CD296", "#5A8CE6",
];
export const idColour = (id: number) => ID_COLOURS[id % ID_COLOURS.length];
