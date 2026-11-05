import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Video } from "../lib/api";
import { ErrorLine } from "./ui";

export default function NewRunDialog({ video, onClose }: { video: Video; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: trackers = [] } = useQuery({ queryKey: ["trackers"], queryFn: api.trackers });
  const [tracker, setTracker] = useState("horizon");
  const [conf, setConf] = useState(0.25);
  const [imgsz, setImgsz] = useState(960);
  const [buffer, setBuffer] = useState(30);
  const [maxFrames, setMaxFrames] = useState<string>("");

  const create = useMutation({
    mutationFn: () =>
      api.createJob({
        video_id: video.id,
        tracker,
        config: {
          conf,
          imgsz,
          max_frames: maxFrames ? Number(maxFrames) : null,
          tracker_params: { track_buffer: buffer },
        },
      }),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      nav(`/jobs/${job.id}`);
    },
  });

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-deep/70" onClick={onClose}>
      <div className="panel w-[460px]" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head h-11">
          <span>New tracking run</span>
          <button className="text-slate hover:text-fog" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div className="mono text-xs text-slate truncate">{video.filename} · {video.frame_count} frames</div>

          <div className="flex flex-col gap-1.5">
            <span className="label">Tracker</span>
            {trackers.map((t) => (
              <label key={t.name}
                className={`flex items-center gap-2.5 px-2.5 h-8 rounded border cursor-pointer
                  ${tracker === t.name ? "border-signal/60 bg-signal/5" : "border-line hover:bg-deck/60"}`}>
                <input type="radio" name="tracker" className="accent-[rgb(var(--signal))]"
                  checked={tracker === t.name} onChange={() => setTracker(t.name)} />
                <span className="mono text-xs w-20">{t.name}</span>
                <span className="text-slate text-xs truncate">{t.label}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="label">Confidence ≥</span>
              <input className="field" type="number" step={0.05} min={0.05} max={0.9} value={conf} onChange={(e) => setConf(Number(e.target.value))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Input size</span>
              <select className="field" value={imgsz} onChange={(e) => setImgsz(Number(e.target.value))}>
                {[640, 960, 1280].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Track buffer (frames)</span>
              <input className="field" type="number" min={1} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Max frames</span>
              <input className="field" type="number" min={1} placeholder="all" value={maxFrames} onChange={(e) => setMaxFrames(e.target.value)} />
            </label>
          </div>
          <p className="text-2xs text-slate leading-relaxed">
            Use the same settings for every tracker you compare — only the tracker should change between runs.
          </p>
          <ErrorLine error={create.error} />
        </div>
        <div className="p-3 border-t border-line flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>Start run</button>
        </div>
      </div>
    </div>
  );
}
