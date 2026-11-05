import { useMemo, useState, type MouseEvent } from "react";
import type { TrackSummary } from "../lib/api";
import { idColour } from "../lib/format";
import { VesselTag } from "./ui";

/**
 * One lane per vessel across the whole video timeline:
 *   solid   = vessel tracked
 *   faint   = lost (gap) between sightings
 *   tick    = recovered with the same ID after a gap
 * Click anywhere on the lanes to seek the video to that frame.
 */
interface Props {
  tracks: TrackSummary[];
  totalFrames: number;
  playhead: number;
  selected: number | null;
  onSelect: (id: number) => void;
  onSeek: (frame: number) => void;
}

const LANE = 22;

/** Round tick spacing (1, 2, 5, 10, 20, 50 …) close to `raw`. */
function niceStep(raw: number) {
  if (raw <= 1) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function segments(t: TrackSummary): [number, number][] {
  const segs: [number, number][] = [];
  let start = t.first_frame;
  for (const r of t.recovery_events) {
    segs.push([start, r.lost_after]);
    start = r.recovered_at;
  }
  segs.push([start, t.last_frame]);
  return segs;
}

export default function TrackRibbon({ tracks, totalFrames, playhead, selected, onSelect, onSeek }: Props) {
  const [minDets, setMinDets] = useState(10);
  const shown = useMemo(() => tracks.filter((t) => t.n_detections >= minDets), [tracks, minDets]);
  const hidden = tracks.length - shown.length;
  const W = 1000;
  const x = (f: number) => (f / Math.max(totalFrames, 1)) * W;

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.round(((e.clientX - r.left) / r.width) * totalFrames));
  };

  const step = niceStep(totalFrames / 6);
  const ticks: number[] = [];
  for (let f = 0; f <= totalFrames; f += step) ticks.push(f);

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 border-b border-line">
        <div className="flex items-center gap-4 text-2xs text-slate">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 bg-fog/80 rounded-sm" />tracked</span>
          <span className="flex items-center gap-1.5"><span className="h-px w-4 bg-slate/60" />lost</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-[2px] bg-signal" />recovered (same ID)</span>
        </div>
        <label className="flex items-center gap-2 text-2xs text-slate">
          hide tracks under
          <input
            type="number" min={1} value={minDets}
            onChange={(e) => setMinDets(Math.max(1, Number(e.target.value) || 1))}
            className="field w-14 h-6"
          />
          detections {hidden > 0 && <span className="mono">({hidden} hidden)</span>}
        </label>
      </div>

      <div className="flex">
        <div className="w-24 shrink-0 border-r border-line">
          <div className="h-6" />
          {shown.map((t) => (
            <button
              key={t.track_id}
              onClick={() => onSelect(t.track_id)}
              className={`flex items-center w-full px-2 hover:bg-deck/60 ${selected === t.track_id ? "bg-deck" : ""}`}
              style={{ height: LANE }}
            >
              <VesselTag id={t.track_id} active={selected === t.track_id} />
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-0 cursor-crosshair" onClick={seek}>
          <div className="relative h-6 border-b border-line">
            {ticks.map((f) => (
              <span key={f}
                className={`absolute top-1 mono text-2xs text-slate ${f === 0 ? "pl-1" : f / totalFrames > 0.95 ? "-translate-x-full pr-1" : "-translate-x-1/2"}`}
                style={{ left: `${(f / totalFrames) * 100}%` }}>
                {f}
              </span>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${Math.max(shown.length, 1) * LANE}`} preserveAspectRatio="none" className="block w-full" style={{ height: Math.max(shown.length, 1) * LANE }}>
            {ticks.map((f) => (
              <line key={f} x1={x(f)} x2={x(f)} y1={0} y2={shown.length * LANE} stroke="rgb(var(--line))" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {shown.map((t, i) => {
              const cy = i * LANE + LANE / 2;
              const c = idColour(t.track_id);
              const sel = selected === t.track_id;
              return (
                <g key={t.track_id} opacity={selected == null || sel ? 1 : 0.6} onClick={(e) => { e.stopPropagation(); onSelect(t.track_id); onSeek(t.first_frame); }} className="cursor-pointer">
                  {sel && <rect x={0} y={i * LANE} width={W} height={LANE} fill="rgb(var(--deck))" />}
                  <line x1={x(t.first_frame)} x2={x(t.last_frame)} y1={cy} y2={cy} stroke="rgb(var(--slate))" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                  {segments(t).map(([a, b]) => (
                    <rect key={a} x={x(a)} y={cy - 4} width={Math.max(x(b + 1) - x(a), 1.5)} height={8} rx={1} fill={c} />
                  ))}
                  {t.recovery_events.map((r) => (
                    <line key={r.recovered_at} x1={x(r.recovered_at)} x2={x(r.recovered_at)} y1={cy - 8} y2={cy + 8} stroke="rgb(var(--signal))" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  ))}
                </g>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-signal" style={{ left: `${(playhead / Math.max(totalFrames, 1)) * 100}%` }}>
            <span className="absolute bottom-0 left-1 mono text-2xs text-signal bg-deep/90 px-1">{playhead}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
