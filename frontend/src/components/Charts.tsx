import type { MouseEvent } from "react";
import type { CountPoint, HorizonPoint } from "../lib/api";

/** Vessels tracked in each frame. Click to seek; the amber line follows the video. */
export function CountTrace({ points, totalFrames, playhead, onSeek, peak }: {
  points: CountPoint[]; totalFrames: number; playhead: number; onSeek: (f: number) => void; peak: number;
}) {
  const W = 1000, H = 120;
  const top = Math.max(peak, 1);
  const x = (f: number) => (f / Math.max(totalFrames, 1)) * W;
  const y = (n: number) => H - (n / top) * (H - 6);
  let d = "";
  points.forEach((p, i) => {
    d += i === 0 ? `M${x(p.frame)},${y(p.n)}` : `H${x(p.frame)}V${y(p.n)}`;
  });
  if (points.length) d += `H${W}`;
  const area = points.length ? `${d}V${H}H${x(points[0].frame)}Z` : "";
  const current = points.length ? points[Math.min(points.length - 1, Math.max(0, Math.round((playhead / Math.max(totalFrames, 1)) * (points.length - 1))))].n : 0;
  const ticks = Array.from(new Set([0, Math.round(top / 2), top]));

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.round(((e.clientX - r.left) / r.width) * totalFrames));
  };

  return (
    <div className="flex gap-2">
      <div className="relative w-6 mono text-2xs text-slate">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(y(t) / H) * 100}%` }}>{t}</span>
        ))}
      </div>
      <div className="relative flex-1 cursor-crosshair" onClick={seek}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full h-[120px]">
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill="rgb(var(--sky) / 0.12)" />
          <path d={d} fill="none" stroke="rgb(var(--sky))" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="pointer-events-none absolute inset-y-0 w-px bg-signal" style={{ left: `${(playhead / Math.max(totalFrames, 1)) * 100}%` }}>
          <span className="absolute bottom-1 left-1.5 mono text-2xs text-signal bg-deep/90 px-1 whitespace-nowrap">{current} in frame</span>
        </div>
      </div>
    </div>
  );
}

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
