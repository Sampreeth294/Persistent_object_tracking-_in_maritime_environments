import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import { fmtBytes } from "../lib/format";
import { ErrorLine } from "./ui";

const SOURCES = ["SMD VIS_Onshore", "SMD VIS_Onboard", "SMD NIR", "SeaDronesSee", "Own footage"];

export default function UploadDrawer({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState(SOURCES[0]);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);

  const upload = useMutation({
    mutationFn: () => api.uploadVideo(file!, source, setProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videos"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-deep/70" onClick={onClose}>
      <div className="w-[420px] h-full bg-hull border-l border-line flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head h-12">
          <span>Upload video</span>
          <button className="text-slate hover:text-fog" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0] ?? null); }}
            onClick={() => input.current?.click()}
            className={`h-36 rounded border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors
              ${drag ? "border-signal bg-signal/5" : "border-line hover:border-slate"}`}
          >
            <Upload size={18} className="text-slate" />
            {file ? (
              <div className="text-center">
                <div className="mono text-xs">{file.name}</div>
                <div className="text-slate text-2xs mono">{fmtBytes(file.size)}</div>
              </div>
            ) : (
              <span className="text-slate">Drop a video, or click to choose · mp4 avi mov mkv</span>
            )}
            <input ref={input} type="file" accept=".mp4,.avi,.mov,.mkv" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="label">Source</span>
            <select className="field font-sans" value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>

          {upload.isPending && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between mono text-2xs text-slate">
                <span>{progress < 1 ? "uploading" : "reading metadata"}</span>
                <span>{(progress * 100).toFixed(0)}%</span>
              </div>
              <div className="h-[3px] bg-line rounded-full overflow-hidden">
                <div className="h-full bg-signal transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          )}
          <ErrorLine error={upload.error} />
        </div>

        <div className="mt-auto p-4 border-t border-line flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
