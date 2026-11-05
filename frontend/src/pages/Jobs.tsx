import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "../components/Shell";
import { Empty, ErrorLine, Panel, ProgressLine, StatusPill } from "../components/ui";
import { api, type JobStatus } from "../lib/api";
import { elapsed, fmtDuration, fmtPct, fmtWhen } from "../lib/format";

const FILTERS: (JobStatus | "all")[] = ["all", "running", "queued", "completed", "failed", "cancelled"];

export default function Jobs() {
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const jobs = useQuery({
    queryKey: ["jobs", filter],
    queryFn: () => api.jobs(filter === "all" ? {} : { status: filter }),
    refetchInterval: 3000,
  });
  const videos = useQuery({ queryKey: ["videos"], queryFn: api.videos });
  const name = (id: string) => videos.data?.find((v) => v.id === id)?.filename ?? id.slice(-6);
  const list = jobs.data ?? [];

  return (
    <div className="pb-8">
      <PageHead title="Tracking runs" sub="Each run = one video × one tracker × one configuration." />
      <div className="px-6 flex flex-col gap-3">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`h-7 px-2.5 rounded mono text-2xs uppercase border ${filter === f ? "border-signal/60 text-signal" : "border-transparent text-slate hover:text-fog"}`}>
              {f}
            </button>
          ))}
        </div>
        <ErrorLine error={jobs.error} />
        <Panel>
          {list.length === 0 ? (
            <Empty title={filter === "all" ? "No runs yet" : `No ${filter} runs`}>
              Start a run from the <Link to="/videos" className="text-signal">Videos</Link> page.
            </Empty>
          ) : (
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  <th>Run</th><th>Video</th><th>Tracker</th><th>Status</th><th className="w-44">Progress</th>
                  <th>FPS</th><th>Vessels</th><th>Gaps</th><th>Horizon trusted</th><th>Time</th><th>Created</th>
                </tr>
              </thead>
              <tbody>
                {list.map((j) => (
                  <tr key={j.id} className="table-row">
                    <td><Link to={`/jobs/${j.id}`} className="mono text-xs hover:text-signal">#{j.id.slice(-6)}</Link></td>
                    <td className="mono text-xs max-w-48 truncate">{name(j.video_id)}</td>
                    <td className={`mono text-xs ${j.tracker === "horizon" ? "text-signal" : ""}`}>{j.tracker}</td>
                    <td><StatusPill status={j.status} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <ProgressLine value={j.progress} status={j.status} />
                        <span className="mono text-2xs text-slate w-16 text-right">{j.frames_done}/{j.frames_total ?? "?"}</span>
                      </div>
                    </td>
                    <td className="mono text-xs">{j.fps_measured ?? "—"}</td>
                    <td className="mono text-xs">{j.stats?.n_tracks ?? "—"}</td>
                    <td className="mono text-xs">{j.stats?.n_gaps ?? "—"}</td>
                    <td className="mono text-xs">{j.tracker === "horizon" ? fmtPct(j.stats?.horizon_trusted_ratio) : "—"}</td>
                    <td className="mono text-xs text-slate">{fmtDuration(elapsed(j.started_at, j.finished_at))}</td>
                    <td className="mono text-2xs text-slate">{fmtWhen(j.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
