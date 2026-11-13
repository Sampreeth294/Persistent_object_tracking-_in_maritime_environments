import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import NewRunDialog from "../components/NewRunDialog";
import { PageHead } from "../components/Shell";
import UploadDrawer from "../components/UploadDrawer";
import { Empty, ErrorLine, Panel } from "../components/ui";
import { api, type Video } from "../lib/api";
import { fmtBytes, fmtDuration, fmtWhen } from "../lib/format";

export default function Videos() {
  const qc = useQueryClient();
  const videos = useQuery({ queryKey: ["videos"], queryFn: api.videos });
  const [uploading, setUploading] = useState(false);
  const [runFor, setRunFor] = useState<Video | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteVideo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videos"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const list = videos.data ?? [];

  return (
    <div className="pb-8">
      <PageHead
        title="Videos"
        sub="Uploaded footage. Files stay on disk; MongoDB stores their metadata."
        actions={<button className="btn btn-primary" onClick={() => setUploading(true)}><Plus size={14} />Upload</button>}
      />
      <div className="px-6 flex flex-col gap-3">
        <ErrorLine error={videos.error ?? remove.error} />
        <Panel>
          {list.length === 0 && !videos.isLoading ? (
            <Empty title="No videos yet">
              Upload an SMD clip such as <span className="mono">MVI_1469_VIS.avi</span> to get started.
            </Empty>
          ) : (
            <table className="w-full">
              <thead className="table-head">
                <tr>
                  <th className="w-36" /> <th>File</th><th>Source</th><th>Resolution</th><th>FPS</th>
                  <th>Frames</th><th>Length</th><th>Size</th><th>Uploaded</th><th />
                </tr>
              </thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id} className="table-row">
                    <td className="py-1.5">
                      <div className="w-28 aspect-video rounded-sm bg-deep border border-line overflow-hidden">
                        {v.has_thumbnail && <img src={api.thumbnailUrl(v.id)} alt="" className="w-full h-full object-cover" loading="lazy" />}
                      </div>
                    </td>
                    <td className="mono text-xs max-w-56 truncate" title={v.filename}>{v.filename}</td>
                    <td className="text-slate text-xs">{v.source ?? "—"}</td>
                    <td className="mono text-xs">{v.width}×{v.height}</td>
                    <td className="mono text-xs">{v.fps}</td>
                    <td className="mono text-xs">{v.frame_count.toLocaleString("en-IN")}</td>
                    <td className="mono text-xs">{fmtDuration(v.duration_s)}</td>
                    <td className="mono text-xs text-slate">{fmtBytes(v.size_bytes)}</td>
                    <td className="mono text-2xs text-slate">{fmtWhen(v.uploaded_at)}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button className="btn btn-primary" onClick={() => setRunFor(v)}><Play size={13} />Track</button>
                        <Link className="btn" to={`/compare?video=${v.id}`}><Columns3 size={13} />Compare</Link>
                        <button
                          className="btn btn-danger" aria-label="Delete video"
                          disabled={remove.isPending}
                          onClick={() => confirm(`Delete ${v.filename} and all its tracking runs?`) && remove.mutate(v.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
      {uploading && <UploadDrawer onClose={() => setUploading(false)} />}
      {runFor && <NewRunDialog video={runFor} onClose={() => setRunFor(null)} />}
    </div>
  );
}
