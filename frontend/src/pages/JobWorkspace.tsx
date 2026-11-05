import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Square } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfidenceTrace, HorizonTrace } from "../components/Charts";
import TrackRibbon from "../components/TrackRibbon";
import { Empty, ErrorLine, Panel, ProgressLine, Readout, StatusPill, VesselTag } from "../components/ui";
import { api, type Job, type Video } from "../lib/api";
import { elapsed, fmtDuration, fmtPct, idColour } from "../lib/format";

export default function JobWorkspace() {
  const { id = "" } = useParams();
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.job(id),
    refetchInterval: (q) => (q.state.data && ["queued", "running"].includes(q.state.data.status) ? 1500 : false),
  });
  const video = useQuery({
    queryKey: ["video", job.data?.video_id],
    queryFn: () => api.video(job.data!.video_id),
    enabled: !!job.data,
  });

  if (job.error) return <div className="p-6"><ErrorLine error={job.error} /></div>;
  if (!job.data || !video.data) return <div className="p-6 text-slate mono text-xs">loading…</div>;

  return <Workspace job={job.data} video={video.data} />;
}

function Workspace({ job, video }: { job: Job; video: Video }) {
  const qc = useQueryClient();
  const done = job.status === "completed";
  const active = job.status === "queued" || job.status === "running";

  const cancel = useMutation({
    mutationFn: () => api.cancelJob(job.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", job.id] }),
  });

  return (
    <div className="pb-10">
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/jobs" className="text-slate hover:text-fog" aria-label="Back to runs"><ArrowLeft size={16} /></Link>
          <h1 className="text-lg font-medium mono">#{job.id.slice(-6)}</h1>
          <StatusPill status={job.status} />
          <span className={`mono text-xs ${job.tracker === "horizon" ? "text-signal" : "text-slate"}`}>{job.tracker}</span>
          <span className="text-slate truncate mono text-xs">· {video.filename}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {active && (
            <button className="btn btn-danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              <Square size={12} />Cancel
            </button>
          )}
          {done && (["csv", "json", "mot"] as const).map((f) => (
            <a key={f} className="btn" href={api.exportUrl(job.id, f)}><Download size={13} />{f.toUpperCase()}</a>
          ))}
          {done && job.has_output && (
            <a className="btn" href={api.outputUrl(job.id)} download><Download size={13} />Video</a>
          )}
        </div>
      </div>

      <div className="px-6 flex flex-col gap-4">
        <ErrorLine error={cancel.error} />
        {job.status === "failed" && <ErrorLine error={job.error ?? "Run failed"} />}
        {active && <LiveProgress job={job} />}
        {job.status === "cancelled" && <Panel><Empty title="This run was cancelled">Its partial results were removed.</Empty></Panel>}
        {done && <Results job={job} video={video} />}
      </div>
    </div>
  );
}

function LiveProgress({ job }: { job: Job }) {
  const total = job.frames_total ?? 0;
  const eta = job.fps_measured && total ? (total - job.frames_done) / job.fps_measured : null;
  return (
    <Panel title={job.status === "queued" ? "Waiting in queue" : "Processing"}>
      <div className="p-4 flex flex-col gap-4">
        <ProgressLine value={job.progress} status={job.status} />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Readout label="Frame" value={`${job.frames_done.toLocaleString("en-IN")} / ${total ? total.toLocaleString("en-IN") : "?"}`} />
          <Readout label="Progress" value={(job.progress * 100).toFixed(1)} unit="%" tone="signal" />
          <Readout label="Speed" value={job.fps_measured ?? "—"} unit="fps" />
          <Readout label="Remaining" value={eta == null ? "—" : fmtDuration(eta)} />
          <Readout label="Device" value={(job.device ?? "—").toUpperCase()} />
        </div>
      </div>
    </Panel>
  );
}

function Results({ job, video }: { job: Job; video: Video }) {
  const tracks = useQuery({ queryKey: ["tracks", job.id], queryFn: () => api.tracks(job.id) });
  const horizon = useQuery({ queryKey: ["horizon", job.id], queryFn: () => api.horizon(job.id), enabled: job.tracker === "horizon" });
  const [selected, setSelected] = useState<number | null>(null);
  const [frame, setFrame] = useState(0);
  const player = useRef<HTMLVideoElement>(null);
  const fps = video.fps || 25;
  const total = job.frames_done || video.frame_count;
  const s = job.stats;

  // Follow the video: playhead in frames, updated every animation frame while playing
  useEffect(() => {
    const v = player.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      setFrame(Math.min(total - 1, Math.floor(v.currentTime * fps)));
      if (!v.paused) raf = requestAnimationFrame(tick);
    };
    const start = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
    v.addEventListener("play", start);
    v.addEventListener("seeked", tick);
    v.addEventListener("timeupdate", tick);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", start);
      v.removeEventListener("seeked", tick);
      v.removeEventListener("timeupdate", tick);
    };
  }, [fps, total]);

  const seek = (f: number) => {
    if (player.current) player.current.currentTime = (Math.max(0, Math.min(f, total - 1)) + 0.5) / fps;
    setFrame(f);
  };

  const visibleNow = (tracks.data ?? []).filter((t) => t.first_frame <= frame && frame <= t.last_frame &&
    !t.recovery_events.some((r) => r.lost_after < frame && frame < r.recovered_at));

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] gap-4">
        <Panel className="self-start" title="Annotated output" right={<span className="mono normal-case tracking-normal">frame <span className="text-fog">{frame}</span> · {(frame / fps).toFixed(2)} s</span>}>
          {job.has_output ? (
            <video ref={player} src={api.outputUrl(job.id)} controls preload="metadata" className="block w-full bg-black aspect-video" />
          ) : (
            <Empty title="No output video" />
          )}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-line min-h-10 flex-wrap">
            <span className="label mr-1">In frame</span>
            {visibleNow.length === 0 ? <span className="text-slate text-xs">none</span> :
              visibleNow.map((t) => (
                <button key={t.track_id} onClick={() => setSelected(t.track_id)}>
                  <VesselTag id={t.track_id} active={selected === t.track_id} />
                </button>
              ))}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Run summary">
            <div className="grid grid-cols-3 gap-x-4 gap-y-4 p-4">
              <Readout label="Vessel IDs" value={s?.n_tracks ?? "—"} />
              <Readout label="Gaps" value={s?.n_gaps ?? "—"} tone={s?.n_gaps ? "port" : undefined} />
              <Readout label="Recovered" value={s?.n_recoveries ?? "—"} tone="signal" />
              <Readout label="Short (<10)" value={s?.short_tracks ?? "—"} />
              <Readout label="Speed" value={job.fps_measured ?? "—"} unit="fps" />
              <Readout label="Run time" value={fmtDuration(elapsed(job.started_at, job.finished_at))} />
              <Readout label="Detector" value={job.timing_ms?.detector_per_frame ?? "—"} unit="ms" />
              <Readout label="Tracker" value={job.timing_ms?.tracker_per_frame ?? "—"} unit="ms" />
              <Readout label="Device" value={(job.device ?? "—").toUpperCase()} />
            </div>
            <p className="px-4 pb-3 text-2xs text-slate leading-relaxed">
              Counts describe this run's output. They are not accuracy — a tracker can score fewer gaps by merging two vessels into one ID.
              Compare HOTA / IDF1 against ground truth for that.
            </p>
          </Panel>
          <Panel title="Configuration">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 p-4 mono text-xs">
              <dt className="text-slate">confidence</dt><dd>{job.config.conf}</dd>
              <dt className="text-slate">imgsz</dt><dd>{job.config.imgsz}</dd>
              <dt className="text-slate">max frames</dt><dd>{job.config.max_frames ?? "all"}</dd>
              {Object.entries(job.tracker_config ?? {}).filter(([k]) => k !== "tracker_type").map(([k, v]) => (
                <Fragment key={k}><dt className="text-slate">{k}</dt><dd>{String(v)}</dd></Fragment>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      {job.tracker === "horizon" && (
        <Panel title="Horizon gate" right={<span className="mono normal-case tracking-normal">
          trusted <span className="text-starboard">{fmtPct(s?.horizon_trusted_ratio)}</span> · H-CMC applied <span className="text-signal">{fmtPct(s?.cmc_applied_ratio)}</span>
        </span>}>
          <div className="p-3">
            {horizon.data ? <HorizonTrace points={horizon.data} height={video.height} totalFrames={total} /> : <span className="text-slate text-xs">loading…</span>}
            <p className="mt-2 text-2xs text-slate leading-relaxed">
              Detected horizon height (px) per frame. <span className="text-starboard">Green</span> frames passed the gate (enough strips agree and no vessel sits above the line) and drive H-CMC;
              <span className="text-port"> red</span> frames fall back to no motion compensation.
            </p>
          </div>
        </Panel>
      )}

      <Panel title={`Track ribbon · ${tracks.data?.length ?? 0} vessel IDs`}>
        {tracks.data && tracks.data.length > 0 ? (
          <div className="max-h-[420px] overflow-auto">
            <TrackRibbon tracks={tracks.data} totalFrames={total} playhead={frame} selected={selected}
              onSelect={setSelected} onSeek={seek} />
          </div>
        ) : (
          <Empty title="No vessels were tracked in this run" />
        )}
      </Panel>

      {selected != null && <VesselDetail jobId={job.id} trackId={selected} fps={fps} onSeek={seek} />}
    </>
  );
}

function VesselDetail({ jobId, trackId, fps, onSeek }: { jobId: string; trackId: number; fps: number; onSeek: (f: number) => void }) {
  const q = useQuery({ queryKey: ["track", jobId, trackId], queryFn: () => api.track(jobId, trackId) });
  const t = q.data;
  if (!t) return <Panel title="Vessel"><div className="p-4 text-slate mono text-xs">loading…</div></Panel>;
  const c = idColour(t.track_id);

  return (
    <Panel title={<span className="flex items-center gap-2 normal-case tracking-normal"><VesselTag id={t.track_id} active /> history</span>}
      right={<button className="normal-case tracking-normal hover:text-fog" onClick={() => onSeek(t.first_frame)}>jump to first sighting →</button>}>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 p-4 border-b border-line">
        <Readout label="First frame" value={t.first_frame} />
        <Readout label="Last frame" value={t.last_frame} />
        <Readout label="Duration" value={t.duration_s ?? "—"} unit="s" />
        <Readout label="Detections" value={t.n_detections} />
        <Readout label="Coverage" value={fmtPct(t.coverage)} />
        <Readout label="Mean conf" value={t.mean_conf.toFixed(3)} />
        <Readout label="Gaps" value={t.n_gaps} tone={t.n_gaps ? "port" : undefined} />
        <Readout label="Longest gap" value={t.longest_gap} unit="fr" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-line">
        <div className="p-4">
          <div className="label mb-2">Detection confidence by frame</div>
          <ConfidenceTrace points={t.conf_history} from={t.first_frame} to={t.last_frame} colour={c} />
          <div className="flex justify-between mono text-2xs text-slate mt-1 pr-8">
            <span>{t.first_frame}</span><span>{t.last_frame}</span>
          </div>
        </div>
        <div className="p-4">
          <div className="label mb-2">Lost and recovered</div>
          {t.recovery_events.length === 0 ? (
            <p className="text-slate text-xs">Tracked without interruption.</p>
          ) : (
            <table className="w-full mono text-xs">
              <thead><tr className="text-slate text-2xs"><th className="text-left font-normal pb-1">lost after</th><th className="text-left font-normal">back at</th><th className="text-right font-normal">gap</th></tr></thead>
              <tbody>
                {t.recovery_events.map((r) => (
                  <tr key={r.recovered_at} className="hover:bg-deck/60 cursor-pointer" onClick={() => onSeek(r.lost_after)}>
                    <td className="py-0.5">{r.lost_after}</td>
                    <td className="text-signal">{r.recovered_at}</td>
                    <td className="text-right text-slate">{r.gap} fr · {(r.gap / fps).toFixed(1)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Panel>
  );
}
