import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHead } from "../components/Shell";
import { Empty, ErrorLine, Panel, ProgressLine, Readout, StatusPill } from "../components/ui";
import { api } from "../lib/api";
import { fmtInt, fmtWhen } from "../lib/format";

export default function Overview() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary, refetchInterval: 5000 });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => api.jobs(), refetchInterval: 3000 });
  const s = summary.data;
  const recent = (jobs.data ?? []).slice(0, 8);
  const trackers = s ? Object.entries(s.per_tracker) : [];

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
