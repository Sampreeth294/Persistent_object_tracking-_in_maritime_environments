import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Play } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type JobConfig, type Video } from "../lib/api";
import { fmtDuration } from "../lib/format";
import { ErrorLine, Modal, toast } from "./ui";

const BLURB: Record<string, string> = {
  bytetrack: "Baseline. Motion + IoU association only.",
  botsort: "Baseline. Adds feature-point camera-motion compensation.",
  horizon: "Proposed. Camera motion from the sea horizon, with a confidence gate.",
};

export interface RunPreset {
  tracker?: string;
  config?: Partial<JobConfig>;
  /** Shown above the form, e.g. "Same settings as run #abc123". */
  note?: string;
}

export default function NewRunDialog({ video, preset, onClose }: { video: Video; preset?: RunPreset; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: trackers = [] } = useQuery({ queryKey: ["trackers"], queryFn: api.trackers });
  const c = preset?.config;
  const [tracker, setTracker] = useState(preset?.tracker ?? "horizon");
  const [conf, setConf] = useState(c?.conf ?? 0.25);
  const [imgsz, setImgsz] = useState(c?.imgsz ?? 960);
  const [buffer, setBuffer] = useState(Number(c?.tracker_params?.track_buffer ?? 30));
  const [maxFrames, setMaxFrames] = useState<string>(c?.max_frames ? String(c.max_frames) : "");

  const invalid = !(conf >= 0.01 && conf <= 0.95) || !(buffer >= 1) || (maxFrames !== "" && !(Number(maxFrames) >= 1));

  const create = useMutation({
    mutationFn: () =>
      api.createJob({
        video_id: video.id,
        tracker,
        config: { conf, imgsz, max_frames: maxFrames ? Number(maxFrames) : null, tracker_params: { track_buffer: buffer } },
      }),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      toast(`Run #${job.id.slice(-6)} started with ${job.tracker}`);
      nav(`/jobs/${job.id}`);
    },
  });

  return (
    <Modal title="New tracking run" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={create.isPending || invalid} onClick={() => create.mutate()}>
          <Play size={14} />{create.isPending ? "Starting…" : "Start run"}
        </button>
      </>}>
      <div className="p-4 flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-deep/50 p-2.5">
          <div className="w-24 aspect-video rounded-md bg-deck overflow-hidden shrink-0">
            {video.has_thumbnail && <img src={api.thumbnailUrl(video.id)} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0">
            <div className="mono text-sm truncate">{video.filename}</div>
            <div className="text-xs text-slate mt-0.5">
              {video.width}×{video.height} · {video.fps} fps · {video.frame_count.toLocaleString("en-IN")} frames · {fmtDuration(video.duration_s)}
            </div>
          </div>
        </div>

        {preset?.note && <div className="text-xs text-accent -mt-2">{preset.note}</div>}

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Tracker</legend>
          {trackers.map((t) => {
            const on = tracker === t.name;
            return (
              <label key={t.name}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${on ? "border-accent/60 bg-accent/5" : "border-line hover:bg-deck/50"}`}>
                <input type="radio" name="tracker" className="sr-only" checked={on} onChange={() => setTracker(t.name)} />
                <span className={`mt-0.5 h-4 w-4 rounded-full border grid place-items-center shrink-0 ${on ? "border-accent bg-accent text-deep" : "border-slate/50"}`}>
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={`mono text-sm ${t.name === "horizon" ? "text-signal" : ""}`}>{t.name}</span>
                  <span className="block text-xs text-slate mt-0.5">{BLURB[t.name] ?? t.label}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">Detection confidence ≥</span>
            <input className="field mono" type="number" step={0.05} min={0.01} max={0.95} value={conf} onChange={(e) => setConf(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Input size (px)</span>
            <select className="field mono" value={imgsz} onChange={(e) => setImgsz(Number(e.target.value))}>
              {[640, 960, 1280].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Track buffer (frames)</span>
            <input className="field mono" type="number" min={1} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Max frames</span>
            <input className="field mono" type="number" min={1} placeholder={`all (${video.frame_count})`} value={maxFrames} onChange={(e) => setMaxFrames(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-slate leading-relaxed">
          For a fair comparison keep these settings identical across trackers — only the tracker should change.
        </p>
        <ErrorLine error={create.error} />
      </div>
    </Modal>
  );
}
