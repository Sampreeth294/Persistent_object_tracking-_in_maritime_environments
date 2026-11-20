import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3, Film, Play, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import NewRunDialog from "../components/NewRunDialog";
import { PAGE, PageHead } from "../components/Shell";
import UploadDrawer from "../components/UploadDrawer";
import { ConfirmDialog, Empty, ErrorLine, Skeleton, toast, TrackerBadge } from "../components/ui";
import { api, type Video } from "../lib/api";
import { fmtBytes, fmtDuration, fmtWhen } from "../lib/format";

export default function Videos() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const videos = useQuery({ queryKey: ["videos"], queryFn: api.videos });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => api.jobs(), refetchInterval: 5000 });
  const [runFor, setRunFor] = useState<Video | null>(null);
  const [deleting, setDeleting] = useState<Video | null>(null);
  const [q, setQ] = useState("");
  const uploading = params.get("upload") === "1";
  const setUploading = (on: boolean) => setParams(on ? { upload: "1" } : {}, { replace: true });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteVideo(id),
    onSuccess: () => {
      toast(`Deleted ${deleting?.filename}`);
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["videos"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["compare-videos"] });
    },
  });

  // Per video: how many runs, which trackers completed, and whether one is active
  const runInfo = useMemo(() => {
    const m = new Map<string, { total: number; done: Set<string>; active: number }>();
    for (const j of jobs.data ?? []) {
      const r = m.get(j.video_id) ?? { total: 0, done: new Set<string>(), active: 0 };
      r.total++;
      if (j.status === "completed") r.done.add(j.tracker);
      if (j.status === "running" || j.status === "queued") r.active++;
      m.set(j.video_id, r);
    }
    return m;
  }, [jobs.data]);

  const list = (videos.data ?? []).filter((v) => v.filename.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHead
        title="Videos"
        sub="Uploaded maritime footage. Start a tracking run, or compare trackers on a video."
        actions={<button className="btn btn-primary" onClick={() => setUploading(true)}><Plus size={16} />Upload video</button>}
      />
      <div className={PAGE}>
        <ErrorLine error={videos.error} />

        {(videos.data?.length ?? 0) > 0 && (
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input className="field pl-9" placeholder="Search videos…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}

        {videos.isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
            {[0, 1, 2].map((i) => <div key={i} className="panel"><Skeleton className="aspect-video rounded-none" /><div className="p-4 flex flex-col gap-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /></div></div>)}
          </div>
        ) : videos.data?.length === 0 ? (
          <div className="panel">
            <Empty title="No videos yet" icon={Film}
              action={<button className="btn btn-primary" onClick={() => setUploading(true)}><Plus size={16} />Upload your first video</button>}>
              Upload an SMD clip such as <span className="mono text-fog">MVI_1469_VIS.avi</span> to get started.
            </Empty>
          </div>
        ) : list.length === 0 ? (
          <div className="panel"><Empty title="No matches" icon={Search}>No video name contains “{q}”.</Empty></div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
            {list.map((v) => {
              const info = runInfo.get(v.id);
              return (
                <article key={v.id} className="panel group flex flex-col hover:border-slate/40 transition-colors">
                  <button className="relative aspect-video bg-deep overflow-hidden block" onClick={() => setRunFor(v)} title="Start a tracking run">
                    {v.has_thumbnail
                      ? <img src={api.thumbnailUrl(v.id)} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                      : <Film size={28} className="absolute inset-0 m-auto text-slate" />}
                    <span className="absolute inset-0 bg-gradient-to-t from-deep/90 via-transparent to-transparent" />
                    <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="h-12 w-12 rounded-full bg-accent text-deep grid place-items-center shadow-lg"><Play size={20} className="ml-0.5" /></span>
                    </span>
                    <span className="absolute left-3 bottom-2.5 mono text-xs text-fog">{fmtDuration(v.duration_s)}</span>
                    <span className="absolute right-3 bottom-2.5 mono text-xs text-fog/80">{v.width}×{v.height}</span>
                    {!!info?.active && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-deep/80 text-accent text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />{info.active} active
                      </span>
                    )}
                  </button>

                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="min-w-0">
                      <h3 className="mono text-sm truncate" title={v.filename}>{v.filename}</h3>
                      <div className="text-xs text-slate mt-1 flex flex-wrap gap-x-2">
                        <span>{v.source ?? "Unknown source"}</span><span>·</span>
                        <span>{v.fps} fps</span><span>·</span>
                        <span>{v.frame_count.toLocaleString("en-IN")} frames</span><span>·</span>
                        <span>{fmtBytes(v.size_bytes)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 min-h-6">
                      {info?.done.size
                        ? [...info.done].sort().map((t) => <TrackerBadge key={t} name={t} />)
                        : <span className="text-xs text-slate">No completed runs yet</span>}
                    </div>
                    <div className="text-2xs text-slate">Uploaded {fmtWhen(v.uploaded_at)}{info?.total ? ` · ${info.total} run${info.total > 1 ? "s" : ""}` : ""}</div>
                    <div className="mt-auto flex items-center gap-2 pt-1">
                      <button className="btn btn-primary btn-sm flex-1" onClick={() => setRunFor(v)}><Play size={13} />Track</button>
                      <Link className="btn btn-sm flex-1" to={`/compare?video=${v.id}`}><Columns3 size={13} />Compare</Link>
                      <button className="btn btn-sm btn-icon btn-danger" aria-label={`Delete ${v.filename}`} title="Delete video"
                        onClick={() => { remove.reset(); setDeleting(v); }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {uploading && <UploadDrawer onClose={() => setUploading(false)} />}
      {runFor && <NewRunDialog video={runFor} onClose={() => setRunFor(null)} />}
      {deleting && (
        <ConfirmDialog title="Delete video?" busy={remove.isPending} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)}>
          <p><span className="mono text-fog">{deleting.filename}</span> and all of its tracking runs, tracks and output videos will be permanently removed.</p>
          {remove.error && <div className="mt-3"><ErrorLine error={remove.error} /></div>}
        </ConfirmDialog>
      )}
    </div>
  );
}
