import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronRight, Search, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PAGE, PageHead } from "../components/Shell";
import { ConfirmDialog, Empty, ErrorLine, Loading, ProgressLine, StatusPill, toast, TrackerBadge } from "../components/ui";
import { api, type Job, type JobStatus } from "../lib/api";
import { elapsed, fmtDuration, fmtPct, fmtWhen } from "../lib/format";

const FILTERS: (JobStatus | "all")[] = ["all", "running", "queued", "completed", "failed", "cancelled"];

export default function Jobs() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState<Job | null>(null);
  const jobs = useQuery({
    queryKey: ["jobs", filter],
    queryFn: () => api.jobs(filter === "all" ? {} : { status: filter }),
    refetchInterval: 3000,
  });
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary, refetchInterval: 5000 });
  const videos = useQuery({ queryKey: ["videos"], queryFn: api.videos });
  const name = (id: string) => videos.data?.find((v) => v.id === id)?.filename ?? "deleted video";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
    qc.invalidateQueries({ queryKey: ["compare-videos"] });
  };
  const cancel = useMutation({ mutationFn: api.cancelJob, onSuccess: () => { toast("Run cancelled"); refresh(); }, onError: (e) => toast(String((e as Error).message), "error") });
  const remove = useMutation({
    mutationFn: api.deleteJob,
    onSuccess: () => { toast("Run deleted"); setDeleting(null); refresh(); },
  });

  const counts = summary.data?.jobs;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  const list = (jobs.data ?? []).filter((j) => {
    const s = q.toLowerCase();
    return !s || name(j.video_id).toLowerCase().includes(s) || j.tracker.includes(s) || j.id.endsWith(s);
  });

  return (
    <div>
      <PageHead title="Tracking runs" sub="Each run is one video × one tracker × one configuration." />
      <div className={PAGE}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 p-1 rounded-lg bg-hull border border-line overflow-x-auto max-w-full">
            {FILTERS.map((f) => {
              const n = f === "all" ? total : counts?.[f];
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`h-8 px-3 rounded-md text-sm capitalize whitespace-nowrap flex items-center gap-2 transition-colors
                    ${filter === f ? "bg-deck text-fog shadow" : "text-slate hover:text-fog"}`}>
                  {f}
                  {n != null && <span className={`mono text-2xs px-1.5 rounded ${filter === f ? "bg-accent/15 text-accent" : "bg-deck/70"}`}>{n}</span>}
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input className="field pl-9" placeholder="Filter by video, tracker or id…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <ErrorLine error={jobs.error} />
        <div className="panel">
          {jobs.isLoading ? <Loading /> : list.length === 0 ? (
            <Empty title={q ? "No runs match" : filter === "all" ? "No runs yet" : `No ${filter} runs`} icon={Activity}>
              {q ? "Try a different filter." : <>Start a run from the <Link to="/videos" className="link">Videos</Link> page.</>}
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="w-full">
                <thead className="table-head">
                  <tr>
                    <th>Run</th><th>Video</th><th>Tracker</th><th>Status</th><th className="w-48">Progress</th>
                    <th className="text-right">Vessels</th><th className="text-right">Gaps</th><th className="text-right">Horizon</th>
                    <th className="text-right">FPS</th><th>Duration</th><th>Created</th><th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((j) => {
                    const active = j.status === "running" || j.status === "queued";
                    return (
                      <tr key={j.id} className="table-row clickable" onClick={() => nav(`/jobs/${j.id}`)}>
                        <td><span className="mono text-xs text-accent">#{j.id.slice(-6)}</span></td>
                        <td className="mono text-xs max-w-56 truncate" title={name(j.video_id)}>{name(j.video_id)}</td>
                        <td><TrackerBadge name={j.tracker} /></td>
                        <td><StatusPill status={j.status} /></td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <ProgressLine value={j.progress} status={j.status} />
                            <span className="mono text-2xs text-slate w-20 text-right">{j.frames_done}/{j.frames_total ?? "?"}</span>
                          </div>
                        </td>
                        <td className="mono text-sm text-right">{j.stats?.confirmed_vessels ?? j.stats?.n_tracks ?? "—"}</td>
                        <td className="mono text-sm text-right">{j.stats?.n_gaps ?? "—"}</td>
                        <td className="mono text-sm text-right">{j.tracker === "horizon" ? fmtPct(j.stats?.horizon_trusted_ratio, 0) : "—"}</td>
                        <td className="mono text-sm text-right">{j.fps_measured ?? "—"}</td>
                        <td className="mono text-xs text-slate">{fmtDuration(elapsed(j.started_at, j.finished_at))}</td>
                        <td className="text-xs text-slate">{fmtWhen(j.created_at)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end items-center gap-1">
                            {active ? (
                              <button className="btn btn-sm btn-danger" disabled={cancel.isPending} onClick={() => cancel.mutate(j.id)}>
                                <Square size={11} />Cancel
                              </button>
                            ) : (
                              <button className="btn btn-sm btn-icon btn-ghost hover:!text-port" title="Delete run" aria-label="Delete run"
                                onClick={() => { remove.reset(); setDeleting(j); }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                            <ChevronRight size={16} className="text-slate" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-slate">“Vessels” = confirmed vessel IDs (tracked in ≥ 25 frames).</p>
      </div>

      {deleting && (
        <ConfirmDialog title="Delete run?" busy={remove.isPending} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)}>
          <p>Run <span className="mono text-fog">#{deleting.id.slice(-6)}</span> ({deleting.tracker} on {name(deleting.video_id)}) and its tracks, photos and output video will be removed. The source video is kept.</p>
          {remove.error && <div className="mt-3"><ErrorLine error={remove.error} /></div>}
        </ConfirmDialog>
      )}
    </div>
  );
}
