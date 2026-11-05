import type { HorizonPoint } from "../lib/api";

/** Confidence over frames for one vessel. Gaps in tracking show as breaks in the line. */
export function ConfidenceTrace({ points, from, to, colour }: {
  points: [number, number][]; from: number; to: number; colour: string;
}) {
  const W = 600, H = 96, pad = 4;
  const span = Math.max(to - from, 1);
  const x = (f: number) => ((f - from) / span) * W;
  const y = (c: number) => pad + (1 - c) * (H - 2 * pad);

  // Split into runs of consecutive frames so lost periods are not bridged by a line
  const runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  points.forEach((p, i) => {
    if (i > 0 && p[0] - points[i - 1][0] > 1) {
      runs.push(cur);
      cur = [];
    }
    cur.push(p);
  });
  if (cur.length) runs.push(cur);

  return (
    <div className="relative pr-8">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full h-24">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={y(g)} y2={y(g)} stroke="rgb(var(--line))" vectorEffect="non-scaling-stroke" />
        ))}
        {runs.map((r) =>
          r.length === 1 ? (
            <circle key={r[0][0]} cx={x(r[0][0])} cy={y(r[0][1])} r={1.5} fill={colour} />
          ) : (
            <polyline key={r[0][0]} fill="none" stroke={colour} strokeWidth={1.5} vectorEffect="non-scaling-stroke"
              points={r.map(([f, c]) => `${x(f)},${y(c)}`).join(" ")} />
          ),
        )}
      </svg>
      <div className="absolute inset-y-0 right-0 flex flex-col justify-between py-0.5 mono text-2xs text-slate pointer-events-none">
        <span>1.0</span>
        <span>0.5</span>
        <span>0.0</span>
      </div>
    </div>
  );
}

/** Detected horizon height per frame. Green = trusted (used for H-CMC), red = rejected by the gate. */
export function HorizonTrace({ points, height, totalFrames }: { points: HorizonPoint[]; height: number; totalFrames: number }) {
  const W = 600, H = 64;
  const ys = points.filter((p) => p.y != null).map((p) => p.y as number);
  if (!ys.length) return <div className="px-3 py-4 text-slate">No horizon found in this video.</div>;
  const lo = Math.max(0, Math.min(...ys) - 20), hi = Math.min(height, Math.max(...ys) + 20);
  const x = (f: number) => (f / Math.max(totalFrames, 1)) * W;
  const y = (v: number) => ((v - lo) / Math.max(hi - lo, 1)) * H; // image y grows downward, so does the chart

  return (
    <div className="flex gap-2 items-stretch">
      <div className="flex flex-col justify-between mono text-2xs text-slate w-10 text-right">
        <span>{Math.round(lo)}</span>
        <span>{Math.round(hi)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block flex-1 h-16">
        {points.map((p) =>
          p.y == null ? null : (
            <rect key={p.frame} x={x(p.frame)} y={y(p.y) - 1} width={Math.max(W / points.length, 1)} height={2}
              fill={p.trusted ? "rgb(var(--starboard))" : "rgb(var(--port))"} />
          ),
        )}
      </svg>
    </div>
  );
}
