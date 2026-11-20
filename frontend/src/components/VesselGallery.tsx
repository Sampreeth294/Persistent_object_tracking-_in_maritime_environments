import { useMemo, useState } from "react";
import { api, type TrackSummary } from "../lib/api";
import { idColour } from "../lib/format";
import { VesselTag } from "./ui";

/** One card per vessel: its clearest photo (highest-confidence crop) and key numbers. */
export default function VesselGallery({ jobId, tracks, selected, onSelect, confirmMin }: {
  jobId: string;
  tracks: TrackSummary[];
  selected: number | null;
  onSelect: (id: number) => void;
  confirmMin: number;
}) {
  const [onlyConfirmed, setOnlyConfirmed] = useState(true);
  const shown = useMemo(
    () => tracks
      .filter((t) => !onlyConfirmed || (t.confirmed ?? t.n_detections >= confirmMin))
      .sort((a, b) => b.n_detections - a.n_detections),
    [tracks, onlyConfirmed, confirmMin],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-line">
        <span className="text-xs text-slate">
          Clearest frame of each vessel · sorted by how long it was tracked
        </span>
        <label className="flex items-center gap-2 text-xs text-slate cursor-pointer select-none">
          <input type="checkbox" className="accent-[rgb(var(--accent))] h-4 w-4" checked={onlyConfirmed}
            onChange={(e) => setOnlyConfirmed(e.target.checked)} />
          confirmed only (≥ {confirmMin} frames)
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-slate">No vessels match this filter. Untick “confirmed only” to see every ID.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 p-4">
          {shown.map((t) => {
            const sel = selected === t.track_id;
            const c = idColour(t.track_id);
            return (
              <button key={t.track_id} onClick={() => onSelect(t.track_id)}
                className={`group text-left rounded-lg overflow-hidden border bg-deep/50 hover:border-slate/50 transition-colors ${sel ? "border-transparent bg-deck" : "border-line"}`}
                style={sel ? { boxShadow: `0 0 0 2px ${c}` } : undefined}>
                <div className="relative h-28 bg-black/40 flex items-center justify-center overflow-hidden">
                  {t.has_photo ? (
                    <img src={api.photoUrl(jobId, t.track_id)} alt={`Vessel ${t.track_id}`} loading="lazy"
                      className="max-h-full max-w-full object-contain group-hover:scale-[1.03] transition-transform" />
                  ) : (
                    <span className="text-2xs text-slate mono">no photo</span>
                  )}
                  <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: c }} />
                  {t.photo_conf != null && (
                    <span className="absolute right-1.5 bottom-1.5 mono text-2xs bg-deep/85 px-1 rounded-sm text-fog">
                      {t.photo_conf.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="px-2.5 py-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <VesselTag id={t.track_id} active={sel} />
                    <span className="mono text-2xs text-slate">{t.duration_s ?? "—"} s</span>
                  </div>
                  <div className="flex justify-between mono text-2xs text-slate">
                    <span>{t.n_detections} det</span>
                    <span className={t.n_gaps ? "text-port" : ""}>{t.n_gaps} gaps</span>
                    <span>c̄ {t.mean_conf.toFixed(2)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
