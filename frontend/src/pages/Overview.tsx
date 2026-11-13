import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "../components/Shell";
import { Empty, ErrorLine, Panel, ProgressLine, Readout, StatusPill, VesselTag } from "../components/ui";
import { api, type LiveState } from "../lib/api";
import { fmtInt, fmtWhen } from "../lib/format";

/** Live frame of the job that is running right now, refreshed every second. */
function LiveStrip({ jobId, tracker, live, progress }: { jobId: string; tracker: string; live?: LiveState; progress: number }) {
  const [tick, setTick] = useState(0);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Panel title={<span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-port animate-pulse" />Live · run #{jobId.slice(-6)} · {tracker}</span>}
      right={<Link to={`/jobs/${jobId}`} className="normal-case tracking-normal text-slate hover:text-fog">open →</Link>}>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_1fr]">
        <div className="relative aspect-video bg-black flex items-center justify-center">
          <img src={api.liveUrl(jobId, tick)} alt="Live frame" onLoad={() => setOk(true)} onError={() => setOk(false)}
            className={`w-full h-full object-contain ${ok ? "" : "invisible"}`} />
          {!ok && <span className="absolute mono text-xs text-slate">waiting for the first frame…</span>}
        </div>
        <div className="p-4 grid grid-cols-2 gap-4 content-start border-l border-line">
          <Readout label="Vessels in frame" value={live?.in_frame ?? "—"} tone="signal" />
          <Readout label="Peak so far" value={live?.peak ?? "—"} />
          <Readout label="IDs so far" value={live?.ids_so_far ?? "—"} />
          <Readout label="Progress" value={(progress * 100).toFixed(0)} unit="%" />
          <div className="col-span-2"><ProgressLine value={progress} status="running" /></div>
        </div>
      </div>
    </Panel>
  );
}

export default function Overview() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary, refetchInterval: 5000 });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => api.jobs(), refetchInterval: 3000 });
  const s = summary.data;
  const recent = (jobs.data ?? []).slice(0, 8);
  const trackers = s ? Object.entries(s.per_tracker) : [];
  const running = (jobs.data ?? []).find((j) => j.status === "running");

  return (
    <div className="pb-8">
      <PageHead title="Overview" sub="Counts from the database — nothing on this page is estimated." />
      <div className="px-6 flex flex-col gap-4">
        <ErrorLine error={summary.error} />

        <div className="panel grid grid-cols-2 md:grid-cols-6 divide-x divide-line">
          {[
            { label: "Videos", value: fmtInt(s?.videos) },
            { label: "Runs completed", value: fmtInt(s?.jobs.completed), tone: "starboard" as const },
            { label: "Running / queued", value: s ? `${s.jobs.running} / ${s.jobs.queued}` : "—", tone: s?.jobs.running ? ("signal" as const) : undefined },
            { label: "Failed", value: fmtInt(s?.jobs.failed), tone: s?.jobs.failed ? ("port" as const) : undefined },
            { label: "Cancelled", value: fmtInt(s?.jobs.cancelled) },
            { label: "Vessel tracks", value: fmtInt(s?.vessel_tracks) },
          ].map((r) => (
            <div key={r.label} className="px-4 py-3">
              <Readout label={r.label} value={r.value} tone={r.tone} />
            </div>
          ))}
        </div>

        {running && <LiveStrip jobId={running.id} tracker={running.tracker} live={running.live} progress={running.progress} />}

        {s?.latest_run && s.latest_run.vessels.length > 0 && (
          <Panel title={
            <span className="normal-case tracking-normal">
              <span className="uppercase tracking-[0.08em]">Latest vessels</span>
              <span className="mono ml-2 text-slate">{s.latest_run.video} · {s.latest_run.tracker}</span>
            </span>
          } right={<Link to={`/jobs/${s.latest_run.job_id}`} className="normal-case tracking-normal text-slate hover:text-fog">open run →</Link>}>
            <div className="flex gap-px bg-line overflow-x-auto">
              {s.latest_run.vessels.map((v) => (
                <Link key={v.track_id} to={`/jobs/${s.latest_run!.job_id}`} className="shrink-0 w-40 bg-hull hover:bg-deck/70 group">
                  <div className="h-24 bg-deep flex items-center justify-center overflow-hidden">
                    <img src={api.photoUrl(s.latest_run!.job_id, v.track_id)} alt="" loading="lazy"
                      className="max-h-full max-w-full object-contain group-hover:scale-[1.04] transition-transform" />
                  </div>
                  <div className="px-2 py-1.5 flex items-center justify-between">
                    <VesselTag id={v.track_id} />
                    <span className="mono text-2xs text-slate">{v.duration_s ?? "—"} s</span>
                  </div>
                </Link>
              ))}
            </div>
            {s.latest_run.stats && (
              <div className="flex gap-6 px-3 py-2 border-t border-line mono text-2xs text-slate">
                <span>confirmed <span className="text-signal">{s.latest_run.stats.confirmed_vessels ?? "—"}</span></span>
                <span>peak in frame <span className="text-fog">{s.latest_run.stats.peak_in_frame ?? "—"}</span></span>
                <span>vessel IDs <span className="text-fog">{s.latest_run.stats.n_tracks}</span></span>
              </div>
            )}
          </Panel>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
          <Panel title="Recent runs" right={<Link to="/jobs" className="normal-case tracking-normal text-slate hover:text-fog">all runs →</Link>}>
            {recent.length === 0 ? (
              <Empty title="No tracking runs yet">
                Upload a video on the <Link to="/videos" className="text-signal">Videos</Link> page, then start a run.
              </Empty>
            ) : (
              <table className="w-full">
                <thead className="table-head">
                  <tr><th>Run</th><th>Tracker</th><th>Status</th><th className="w-40">Progress</th><th>Vessels</th><th>Started</th></tr>
                </thead>
                <tbody>
                  {recent.map((j) => (
                    <tr key={j.id} className="table-row">
                      <td><Link to={`/jobs/${j.id}`} className="mono text-xs hover:text-signal">#{j.id.slice(-6)}</Link></td>
                      <td className="mono text-xs">{j.tracker}</td>
                      <td><StatusPill status={j.status} /></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <ProgressLine value={j.progress} status={j.status} />
                          <span className="mono text-2xs text-slate w-9 text-right">{(j.progress * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="mono text-xs">{j.stats ? j.stats.n_tracks : "—"}</td>
                      <td className="mono text-2xs text-slate">{fmtWhen(j.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="By tracker (completed runs)">
            {trackers.length === 0 ? (
              <Empty title="Nothing to compare yet">
                Run the same video with <span className="mono">bytetrack</span>, <span className="mono">botsort</span> and{" "}
                <span className="mono">horizon</span> to see them side by side.
              </Empty>
            ) : (
              <table className="w-full">
                <thead className="table-head">
                  <tr><th>Tracker</th><th>Runs</th><th>Tracks</th><th>Gaps</th><th>Recoveries</th><th>FPS</th></tr>
                </thead>
                <tbody>
                  {trackers.map(([name, t]) => (
                    <tr key={name} className="table-row mono text-xs">
                      <td className={name === "horizon" ? "text-signal" : ""}>{name}</td>
                      <td>{t.jobs}</td><td>{t.tracks}</td><td>{t.gaps}</td><td>{t.recoveries}</td>
                      <td>{t.mean_fps ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {s && <p className="px-3 py-2.5 text-2xs text-slate leading-relaxed border-t border-line">{s.note}</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
