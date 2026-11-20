import { useQuery } from "@tanstack/react-query";
import { Activity, AlertOctagon, ArrowRight, CheckCircle2, Columns3, Film, Plus, Ship } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PAGE, PageHead } from "../components/Shell";
import { Empty, ErrorLine, Loading, Panel, ProgressLine, Readout, StatCard, StatusPill, TrackerBadge, VesselTag } from "../components/ui";
import { api, type Job } from "../lib/api";
import { fmtDuration, fmtInt, fmtWhen } from "../lib/format";

/** Live frame of the job that is running right now, refreshed every second. */
function LiveStrip({ job }: { job: Job }) {
  const [tick, setTick] = useState(0);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const live = job.live;
  const eta = job.fps_measured && job.frames_total ? (job.frames_total - job.frames_done) / job.fps_measured : null;
  return (
    <Panel
      title={<span className="flex items-center gap-2.5"><span className="h-2 w-2 rounded-full bg-port animate-pulse" />Live now<span className="mono text-xs font-normal text-slate">run #{job.id.slice(-6)}</span><TrackerBadge name={job.tracker} /></span>}
      right={<Link to={`/jobs/${job.id}`} className="btn btn-sm">Open run<ArrowRight size={13} /></Link>}>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.7fr)_1fr]">
        <div className="relative aspect-video bg-black flex items-center justify-center">
          <img src={api.liveUrl(job.id, tick)} alt="Live frame" onLoad={() => setOk(true)} onError={() => setOk(false)}
            className={`w-full h-full object-contain ${ok ? "" : "invisible"}`} />
          {!ok && <span className="absolute"><Loading label="Waiting for the first frame…" /></span>}
        </div>
        <div className="p-5 grid grid-cols-2 gap-5 content-start border-t md:border-t-0 md:border-l border-line">
          <Readout label="Vessels in frame" value={live?.in_frame ?? "—"} tone="accent" />
          <Readout label="Peak so far" value={live?.peak ?? "—"} />
          <Readout label="IDs so far" value={live?.ids_so_far ?? "—"} />
          <Readout label="Remaining" value={eta == null ? "—" : fmtDuration(eta)} />
          <div className="col-span-2 flex flex-col gap-2">
            <div className="flex justify-between text-xs text-slate"><span>Progress</span><span className="mono">{(job.progress * 100).toFixed(0)}%</span></div>
            <ProgressLine value={job.progress} status="running" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

export default function Overview() {
  const nav = useNavigate();
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary, refetchInterval: 5000 });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => api.jobs(), refetchInterval: 3000 });
  const videos = useQuery({ queryKey: ["videos"], queryFn: api.videos });
  const s = summary.data;
  const recent = (jobs.data ?? []).slice(0, 8);
  const trackers = s ? Object.entries(s.per_tracker) : [];
  const running = (jobs.data ?? []).find((j) => j.status === "running");
  const name = (id: string) => videos.data?.find((v) => v.id === id)?.filename ?? "—";

  return (
    <div>
      <PageHead title="Overview" sub="Live counts from the database — nothing on this page is estimated."
        actions={<>
          <Link to="/compare" className="btn"><Columns3 size={15} />Compare</Link>
          <Link to="/videos?upload=1" className="btn btn-primary"><Plus size={16} />Upload video</Link>
        </>} />
      <div className={PAGE}>
        <ErrorLine error={summary.error} />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard label="Videos" value={fmtInt(s?.videos)} icon={Film} />
          <StatCard label="Runs completed" value={fmtInt(s?.jobs.completed)} icon={CheckCircle2} tone="starboard"
            hint={s ? `${s.jobs.cancelled} cancelled` : undefined} />
          <StatCard label="Running / queued" value={s ? `${s.jobs.running} / ${s.jobs.queued}` : "—"} icon={Activity} tone="accent"
            hint={running ? `${(running.progress * 100).toFixed(0)}% · ${running.tracker}` : "worker idle"} />
          <StatCard label="Failed runs" value={fmtInt(s?.jobs.failed)} icon={AlertOctagon} tone={s?.jobs.failed ? "port" : "accent"} />
          <StatCard label="Vessel tracks" value={fmtInt(s?.vessel_tracks)} icon={Ship} tone="signal" hint="across all runs" />
        </div>

        {running && <LiveStrip job={running} />}

        {s?.latest_run && s.latest_run.vessels.length > 0 && (
          <Panel
            title="Latest vessels"
            sub={<span className="mono">{s.latest_run.video} · {s.latest_run.tracker} · confirmed {s.latest_run.stats?.confirmed_vessels ?? "—"} · peak in frame {s.latest_run.stats?.peak_in_frame ?? "—"}</span>}
            right={<Link to={`/jobs/${s.latest_run.job_id}`} className="btn btn-sm">Open run<ArrowRight size={13} /></Link>}>
            <div className="flex gap-3 p-4 overflow-x-auto">
              {s.latest_run.vessels.map((v) => (
                <Link key={v.track_id} to={`/jobs/${s.latest_run!.job_id}`}
                  className="shrink-0 w-44 rounded-lg border border-line bg-deep/60 hover:border-slate/50 overflow-hidden group transition-colors">
                  <div className="h-28 bg-black/40 flex items-center justify-center overflow-hidden">
                    <img src={api.photoUrl(s.latest_run!.job_id, v.track_id)} alt="" loading="lazy"
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="px-2.5 py-2 flex items-center justify-between">
                    <VesselTag id={v.track_id} />
                    <span className="mono text-2xs text-slate">{v.duration_s ?? "—"} s</span>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        )}

        <div className="grid grid-cols-1 2xl:grid-cols-[1.5fr_1fr] gap-5">
          <Panel title="Recent runs" right={<Link to="/jobs" className="btn btn-sm btn-ghost">All runs<ArrowRight size={13} /></Link>}>
            {jobs.isLoading ? <Loading /> : recent.length === 0 ? (
              <Empty title="No tracking runs yet" icon={Activity}
                action={<Link to="/videos" className="btn btn-primary btn-sm">Go to videos</Link>}>
                Upload a video, then start a run.
              </Empty>
            ) : (
              <div className="table-wrap">
                <table className="w-full">
                  <thead className="table-head">
                    <tr><th>Run</th><th>Video</th><th>Tracker</th><th>Status</th><th className="w-40">Progress</th><th className="text-right">Vessels</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {recent.map((j) => (
                      <tr key={j.id} className="table-row clickable" onClick={() => nav(`/jobs/${j.id}`)}>
                        <td><span className="mono text-xs text-accent">#{j.id.slice(-6)}</span></td>
                        <td className="mono text-xs max-w-44 truncate">{name(j.video_id)}</td>
                        <td><TrackerBadge name={j.tracker} /></td>
                        <td><StatusPill status={j.status} /></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <ProgressLine value={j.progress} status={j.status} />
                            <span className="mono text-2xs text-slate w-9 text-right">{(j.progress * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="mono text-sm text-right">{j.stats?.confirmed_vessels ?? j.stats?.n_tracks ?? "—"}</td>
                        <td className="text-xs text-slate">{fmtWhen(j.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="By tracker" sub="Totals over completed runs"
            right={<Link to="/compare" className="btn btn-sm btn-ghost">Compare<ArrowRight size={13} /></Link>}>
            {trackers.length === 0 ? (
              <Empty title="Nothing to compare yet" icon={Columns3}>
                Run the same video with <span className="mono text-fog">bytetrack</span>, <span className="mono text-fog">botsort</span> and{" "}
                <span className="mono text-fog">horizon</span> to see them side by side.
              </Empty>
            ) : (
              <div className="table-wrap">
                <table className="w-full">
                  <thead className="table-head">
                    <tr><th>Tracker</th><th className="text-right">Runs</th><th className="text-right">Tracks</th><th className="text-right">Gaps</th><th className="text-right">Recov.</th><th className="text-right">FPS</th></tr>
                  </thead>
                  <tbody>
                    {trackers.map(([n, t]) => (
                      <tr key={n} className="table-row mono text-sm">
                        <td><TrackerBadge name={n} /></td>
                        <td className="text-right">{t.jobs}</td><td className="text-right">{t.tracks}</td>
                        <td className="text-right">{t.gaps}</td><td className="text-right">{t.recoveries}</td>
                        <td className="text-right">{t.mean_fps ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s && <p className="px-4 py-3 text-xs text-slate leading-relaxed border-t border-line">{s.note}</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
