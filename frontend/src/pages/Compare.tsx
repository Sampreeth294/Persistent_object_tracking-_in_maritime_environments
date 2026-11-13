import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "../components/Shell";
import { Empty, ErrorLine, Panel, VesselTag } from "../components/ui";
import { api, type CompareRun, type JobStats } from "../lib/api";
import { fmtPct } from "../lib/format";

type Better = "lower" | "higher" | null;

// What each row means, and which direction is better *as a count* (not as accuracy)
const ROWS: { key: keyof JobStats | "fps" | "det_ms" | "trk_ms"; label: string; hint: string; better: Better; fmt?: (v: number) => string }[] = [
  { key: "n_tracks", label: "Vessel IDs", hint: "Distinct IDs created. Far more IDs than real ships suggests ID switches.", better: "lower" },
  { key: "confirmed_vessels", label: "Confirmed vessels", hint: "IDs tracked for at least 25 frames.", better: null },
  { key: "short_tracks", label: "Short tracks (<10)", hint: "Flicker IDs — usually fragments or false detections.", better: "lower" },
  { key: "n_gaps", label: "Gaps", hint: "Times a vessel was lost for at least one frame, then recovered.", better: "lower" },
  { key: "peak_in_frame", label: "Peak in frame", hint: "Most vessels tracked at the same time.", better: null },
  { key: "mean_in_frame", label: "Mean in frame", hint: "Average vessels tracked per frame.", better: null },
  { key: "horizon_trusted_ratio", label: "Horizon trusted", hint: "Frames where the horizon passed the gate (horizon tracker only).", better: null, fmt: (v) => fmtPct(v) },
  { key: "fps", label: "Speed (fps)", hint: "Whole pipeline: decode + detect + track + draw.", better: "higher" },
  { key: "trk_ms", label: "Tracker ms / frame", hint: "Time inside the tracker only.", better: "lower" },
];

function value(run: CompareRun, key: string): number | null {
  const j = run.job;
  if (!j) return null;
  if (key === "fps") return j.fps_measured ?? null;
  if (key === "det_ms") return j.timing_ms?.detector_per_frame ?? null;
  if (key === "trk_ms") return j.timing_ms?.tracker_per_frame ?? null;
  if (key === "horizon_trusted_ratio" && run.tracker !== "horizon") return null;
  const v = (j.stats as unknown as Record<string, number | undefined>)[key];
  return v == null ? null : v;
}

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const videos = useQuery({ queryKey: ["compare-videos"], queryFn: api.compareVideos });
  const videoId = params.get("video") ?? videos.data?.[0]?.id ?? "";
  const cmp = useQuery({ queryKey: ["compare", videoId], queryFn: () => api.compare(videoId), enabled: !!videoId });
  const runs = cmp.data?.runs ?? [];
  const done = runs.filter((r) => r.job);

  return (
    <div className="pb-10">
      <PageHead title="Compare trackers"
        sub="Latest completed run of each tracker on the same video. Only the tracker should differ between runs."
        actions={
          <select className="field font-sans w-72" value={videoId} onChange={(e) => setParams({ video: e.target.value })}>
            {(videos.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.filename} — {v.trackers.length} tracker{v.trackers.length > 1 ? "s" : ""}</option>
            ))}
          </select>
        } />
      <div className="px-6 flex flex-col gap-4">
        <ErrorLine error={videos.error ?? cmp.error} />
        {videos.data?.length === 0 && (
          <Panel><Empty title="Nothing to compare yet">
            Run <span className="mono">bytetrack</span>, <span className="mono">botsort</span> and <span className="mono">horizon</span> on
            the same video from the <Link to="/videos" className="text-signal">Videos</Link> page.
          </Empty></Panel>
        )}

        {cmp.data && cmp.data.mismatched_settings.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 border border-signal/40 bg-signal/5 rounded text-xs">
            <AlertTriangle size={14} className="text-signal mt-0.5 shrink-0" />
            <span>
              Not a fair comparison: these settings differ between runs —{" "}
              <span className="mono text-signal">{cmp.data.mismatched_settings.join(", ")}</span>. Re-run with identical settings.
            </span>
          </div>
        )}

        {cmp.data && (
          <Panel title={<span className="normal-case tracking-normal mono text-fog">{cmp.data.video.filename}</span>}>
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  <th className="w-64">Measure</th>
                  {runs.map((r) => (
                    <th key={r.tracker} className={r.tracker === "horizon" ? "!text-signal" : ""}>
                      {r.tracker}
                      {r.job && <Link to={`/jobs/${r.job.id}`} className="ml-2 normal-case tracking-normal text-slate hover:text-fog">#{r.job.id.slice(-6)}</Link>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const vals = runs.map((r) => value(r, row.key));
                  const present = vals.filter((v): v is number => v != null);
                  const allEqual = present.every((v) => v === present[0]);
                  const best = row.better && present.length > 1 && !allEqual
                    ? (row.better === "lower" ? Math.min(...present) : Math.max(...present)) : null;
                  const max = Math.max(...present, 0) || 1;
                  return (
                    <tr key={row.key} className="table-row">
                      <td title={row.hint}>
                        <div className="text-fog">{row.label}</div>
                        <div className="text-2xs text-slate leading-snug">{row.hint}</div>
                      </td>
                      {vals.map((v, i) => (
                        <td key={runs[i].tracker} className="align-middle">
                          {v == null ? <span className="text-slate">—</span> : (
                            <div className="flex flex-col gap-1">
                              <span className={`mono text-sm ${best === v ? "text-starboard" : ""}`}>
                                {row.fmt ? row.fmt(v) : v}
                              </span>
                              {!row.fmt && (
                                <span className="h-[3px] rounded-full bg-line w-32 overflow-hidden">
                                  <span className={`block h-full ${runs[i].tracker === "horizon" ? "bg-signal" : "bg-slate"}`}
                                    style={{ width: `${(v / max) * 100}%` }} />
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {runs.some((r) => !r.job) && (
                  <tr className="table-row">
                    <td className="text-slate text-xs">Missing runs</td>
                    {runs.map((r) => (
                      <td key={r.tracker} className="text-2xs text-slate">
                        {r.job ? "" : <Link to="/videos" className="text-signal">run {r.tracker} →</Link>}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
            <p className="px-3 py-2.5 border-t border-line text-2xs text-slate leading-relaxed">
              <span className="text-starboard">Green</span> marks the best value where "better" is clear. These are counts from each run's own output,
              not accuracy: fewer IDs or gaps can also mean two ships were wrongly merged. The HOTA / IDF1 comparison needs ground truth (TrackGT).
            </p>
          </Panel>
        )}

        {done.length > 0 && (
          <Panel title="Same vessels, side by side — longest-tracked IDs of each run">
            <div className="grid divide-x divide-line" style={{ gridTemplateColumns: `repeat(${done.length}, minmax(0, 1fr))` }}>
              {done.map((r) => <TopVessels key={r.tracker} run={r} />)}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function TopVessels({ run }: { run: CompareRun }) {
  const job = run.job!;
  const tracks = useQuery({ queryKey: ["tracks", job.id], queryFn: () => api.tracks(job.id) });
  const top = (tracks.data ?? []).filter((t) => t.has_photo).sort((a, b) => b.n_detections - a.n_detections).slice(0, 6);
  return (
    <div>
      <div className={`px-3 h-8 flex items-center border-b border-line mono text-xs ${run.tracker === "horizon" ? "text-signal" : ""}`}>{run.tracker}</div>
      <div className="grid grid-cols-2 gap-px bg-line">
        {top.map((t) => (
          <Link key={t.track_id} to={`/jobs/${job.id}`} className="bg-hull hover:bg-deck/70 p-2 flex flex-col gap-1.5">
              <div className="h-20 bg-deep flex items-center justify-center overflow-hidden">
                <img src={api.photoUrl(job.id, t.track_id)} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
              </div>
              <div className="flex items-center justify-between">
                <VesselTag id={t.track_id} />
                <span className="mono text-2xs text-slate">{t.n_detections} det</span>
              </div>
            </Link>
        ))}
      </div>
      {top.length === 0 && <p className="p-3 text-slate text-xs">No vessel photos in this run.</p>}
    </div>
  );
}
