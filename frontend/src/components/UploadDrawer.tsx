import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileVideo, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import { fmtBytes } from "../lib/format";
import { ErrorLine, Modal, toast } from "./ui";

const SOURCES = ["SMD VIS_Onshore", "SMD VIS_Onboard", "SMD NIR", "SeaDronesSee", "Own footage"];
const EXT = [".mp4", ".avi", ".mov", ".mkv"];

export default function UploadDrawer({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState(SOURCES[0]);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [badType, setBadType] = useState<string | null>(null);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!EXT.includes(ext)) { setBadType(`"${ext}" isn't supported. Use ${EXT.join(", ")}.`); return; }
    setBadType(null);
    setFile(f);
  };

  const upload = useMutation({
    mutationFn: () => api.uploadVideo(file!, source, setProgress),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["videos"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      toast(`Uploaded ${v.filename}`);
      onClose();
    },
  });

  return (
    <Modal title="Upload video" onClose={() => !upload.isPending && onClose()}
      footer={<>
        <button className="btn" onClick={onClose} disabled={upload.isPending}>Cancel</button>
        <button className="btn btn-primary" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
          <UploadCloud size={15} />{upload.isPending ? "Uploading…" : "Upload"}
        </button>
      </>}>
      <div className="p-4 flex flex-col gap-4">
        <div
          role="button" tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
          onClick={() => !upload.isPending && input.current?.click()}
          className={`h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors
            ${drag ? "border-accent bg-accent/5" : "border-line hover:border-slate/60 hover:bg-deck/30"}`}
        >
          {file ? (
            <>
              <FileVideo size={28} className="text-accent" />
              <div className="text-center px-4">
                <div className="mono text-sm break-all">{file.name}</div>
                <div className="text-slate text-xs mt-1">{fmtBytes(file.size)} · click to choose another</div>
              </div>
            </>
          ) : (
            <>
              <span className="h-12 w-12 rounded-full bg-accent/10 text-accent grid place-items-center"><UploadCloud size={22} /></span>
              <div className="text-center">
                <div className="text-fog">Drop a video here, or <span className="text-accent">browse</span></div>
                <div className="text-slate text-xs mt-1">MP4, AVI, MOV or MKV</div>
              </div>
            </>
          )}
          <input ref={input} type="file" accept={EXT.join(",")} hidden onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        {badType && <ErrorLine error={badType} />}

        <label className="flex flex-col gap-1.5">
          <span className="label">Source dataset</span>
          <select className="field" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>

        {upload.isPending && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-slate">
              <span>{progress < 1 ? "Uploading…" : "Reading metadata and making a thumbnail…"}</span>
              <span className="mono">{(progress * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-deck rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}
        {file && !upload.isPending && (
          <button className="self-start text-xs text-slate hover:text-fog flex items-center gap-1" onClick={() => setFile(null)}>
            <X size={12} />Remove file
          </button>
        )}
        <ErrorLine error={upload.error} />
      </div>
    </Modal>
  );
}
