import { useQuery } from "@tanstack/react-query";
import { Columns3, Play, Trophy } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import NewRunDialog, { type RunPreset } from "../components/NewRunDialog";
import { PAGE, PageHead } from "../components/Shell";
import { Empty, ErrorLine, Loading, Notice, Panel, TrackerBadge, VesselTag } from "../components/ui";
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
  const cmp = useQuery({ queryKey: ["compare", videoId], queryFn: () => api.compare(videoId), enabled: !!videoId, refetchInterval: 10000 });
  const video = useQuery({ queryKey: ["video", videoId], queryFn: () => api.video(videoId), enabled: !!videoId });
  const [preset, setPreset] = useState<RunPreset | null>(null);
  const runs = cmp.data?.runs ?? [];
  const done = runs.filter((r) => r.job);
  const missing = runs.filter((r) => !r.job);
  // A video with runs can still be picked from the Videos page before it has any completed run
  const options = videos.data ?? [];
  const inList = options.some((v) => v.id === videoId);

  const runMissing = (tracker: string) => {
    const ref = done[0]?.job;
    setPreset({
      tracker,
      config: ref?.config,
      note: ref ? `Same settings as the ${done[0].tracker} run #${ref.id.slice(-6)}, so the comparison is fair.` : undefined,
    });
  };

  return (
    <div>
      <PageHead title="Compare trackers"
        sub="The latest completed run of each tracker on the same video. Only the tracker should differ between runs."
        actions={options.length > 0 && (
          <select className="field w-full sm:w-80" value={videoId} onChange={(e) => setParams({ video: e.target.value })} aria-label="Video">
            {!inList && videoId && <option value={videoId}>{video.data?.filename ?? "Selected video"} — no runs yet</option>}
            {options.map((v) => (
              <option key={v.id} value={v.id}>{v.filename} — {v.trackers.length}/3 trackers</option>
            ))}
          </select>
        )} />
      <div className={PAGE}>
        <ErrorLine error={videos.error ?? cmp.error} />
        {videos.isLoading && <Loading />}
        {videos.data?.length === 0 && !videoId && (
          <div className="panel"><Empty title="Nothing to compare yet" icon={Columns3}
            action={<Link to="/videos" className="btn btn-primary btn-sm">Go to videos</Link>}>
            Run <span className="mono text-fog">bytetrack</span>, <span className="mono text-fog">botsort</span> and <span className="mono text-fog">horizon</span> on
            the same video, then come back here.
          </Empty></div>
        )}

        {cmp.data && cmp.data.mismatched_settings.length > 0 && (
          <Notice>
            <span className="font-medium">Not a fair comparison.</span> These settings differ between runs:{" "}
            <span className="mono text-signal">{cmp.data.mismatched_settings.join(", ")}</span>. Re-run with identical settings.
          </Notice>
        )}

        {missing.length > 0 && cmp.data && video.data && (
          <div className="panel p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-fog font-medium">{missing.length} tracker{missing.length > 1 ? "s" : ""} not run yet</span>
              <span className="text-slate"> on this video — run {missing.length > 1 ? "them" : "it"} to complete the comparison.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {missing.map((r) => (
                <button key={r.tracker} className="btn btn-sm" onClick={() => runMissing(r.tracker)}>
                  <Play size={12} />Run <span className="mono">{r.tracker}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {cmp.data && (
          <Panel title={<span className="mono">{cmp.data.video.filename}</span>}
            sub={`${cmp.data.video.frame_count.toLocaleString("en-IN")} frames · ${cmp.data.video.fps} fps`}>
            <div className="table-wrap">
              <table className="w-full">
                <thead className="table-head">
                  <tr>
                    <th className="min-w-64">Measure</th>
                    {runs.map((r) => (
                      <th key={r.tracker} className="min-w-40">
                        <div className="flex items-center gap-2 normal-case tracking-normal">
                          <TrackerBadge name={r.tracker} />
                          {r.job && <Link to={`/jobs/${r.job.id}`} className="mono text-slate hover:text-accent">#{r.job.id.slice(-6)}</Link>}
                        </div>
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
                        <td className="!whitespace-normal py-2.5">
                          <div className="text-fog">{row.label}</div>
                          <div className="text-xs text-slate leading-snug mt-0.5">{row.hint}</div>
                        </td>
                        {vals.map((v, i) => (
                          <td key={runs[i].tracker} className="align-middle">
                            {v == null ? <span className="text-slate">—</span> : (
                              <div className="flex flex-col gap-1.5">
                                <span className={`mono text-base flex items-center gap-1.5 ${best === v ? "text-starboard font-semibold" : ""}`}>
                                  {row.fmt ? row.fmt(v) : v}
                                  {best === v && <Trophy size={13} />}
                                </span>
                                {!row.fmt && (
                                  <span className="h-1.5 rounded-full bg-deck w-32 overflow-hidden">
                                    <span className={`block h-full rounded-full ${runs[i].tracker === "horizon" ? "bg-signal" : runs[i].tracker === "botsort" ? "bg-sky" : "bg-slate"}`}
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
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 border-t border-line text-xs text-slate leading-relaxed">
              <Trophy size={12} className="inline text-starboard -mt-0.5" /> marks the best value where “better” is clear. These are counts from each run's own output,
              not accuracy: fewer IDs or gaps can also mean two ships were wrongly merged. HOTA / IDF1 need ground truth.
            </p>
          </Panel>
        )}

        {done.length > 0 && (
          <Panel title="Longest-tracked vessels in each run" sub="Click a vessel to open its run">
            <div className="grid grid-cols-1 md:grid-cols-[repeat(var(--n),minmax(0,1fr))] divide-y md:divide-y-0 md:divide-x divide-line"
              style={{ ["--n" as string]: done.length }}>
              {done.map((r) => <TopVessels key={r.tracker} run={r} />)}
            </div>
          </Panel>
        )}
      </div>
      {preset && video.data && <NewRunDialog video={video.data} preset={preset} onClose={() => setPreset(null)} />}
    </div>
  );
}

function TopVessels({ run }: { run: CompareRun }) {
  const job = run.job!;
  const tracks = useQuery({ queryKey: ["tracks", job.id], queryFn: () => api.tracks(job.id) });
  const top = (tracks.data ?? []).filter((t) => t.has_photo).sort((a, b) => b.n_detections - a.n_detections).slice(0, 6);
  return (
    <div>
      <div className="px-4 h-11 flex items-center border-b border-line"><TrackerBadge name={run.tracker} /></div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {top.map((t) => (
          <Link key={t.track_id} to={`/jobs/${job.id}`} className="rounded-lg border border-line bg-deep/50 hover:border-slate/50 p-2 flex flex-col gap-2 transition-colors">
              <div className="h-24 bg-black/40 rounded flex items-center justify-center overflow-hidden">
                <img src={api.photoUrl(job.id, t.track_id)} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
              </div>
              <div className="flex items-center justify-between">
                <VesselTag id={t.track_id} />
                <span className="mono text-2xs text-slate">{t.n_detections} det</span>
              </div>
            </Link>
        ))}
      </div>
      {tracks.isLoading && <Loading />}
      {!tracks.isLoading && top.length === 0 && <p className="p-4 text-slate text-sm">No vessel photos in this run.</p>}
    </div>
  );
}
