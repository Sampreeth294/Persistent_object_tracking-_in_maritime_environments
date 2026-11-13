// Typed client for the FastAPI backend. Every screen reads real data through here.

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface Video {
  id: string;
  filename: string;
  size_bytes: number;
  source: string | null;
  fps: number;
  frame_count: number;
  width: number;
  height: number;
  duration_s: number | null;
  codec: string | null;
  uploaded_at: string;
  has_thumbnail: boolean;
}

export interface JobConfig {
  conf: number;
  imgsz: number;
  max_frames: number | null;
  tracker_params: Record<string, number>;
}

export interface JobStats {
  n_tracks: number;
  n_gaps: number;
  n_recoveries: number;
  short_tracks: number;
  horizon_trusted_ratio: number;
  cmc_applied_ratio: number;
  confirmed_vessels?: number;
  confirm_min_detections?: number;
  peak_in_frame?: number;
  mean_in_frame?: number;
}

export interface LiveState {
  in_frame: number;
  ids_so_far: number;
  peak: number;
  frame: number;
}

export interface Job {
  id: string;
  video_id: string;
  detector: string;
  tracker: string;
  config: JobConfig;
  status: JobStatus;
  progress: number;
  frames_done: number;
  frames_total?: number;
  fps_measured?: number;
  device?: string;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  has_output: boolean;
  stats?: JobStats;
  live?: LiveState;
  timing_ms?: { detector_per_frame: number; tracker_per_frame: number };
  tracker_config?: Record<string, unknown>;
}

export interface RecoveryEvent {
  lost_after: number;
  recovered_at: number;
  gap: number;
}

export interface TrackSummary {
  job_id: string;
  track_id: number;
  first_frame: number;
  last_frame: number;
  span_frames: number;
  duration_s: number | null;
  n_detections: number;
  coverage: number;
  mean_conf: number;
  n_gaps: number;
  gap_frames: number;
  longest_gap: number;
  recovery_events: RecoveryEvent[];
  has_photo?: boolean;
  photo_frame?: number | null;
  photo_conf?: number | null;
  confirmed?: boolean;
}

export interface CountPoint {
  frame: number;
  n: number;
}

export interface CompareRun {
  tracker: string;
  job: null | {
    id: string;
    created_at: string;
    fps_measured: number | null;
    frames_done: number;
    stats: JobStats;
    timing_ms?: { detector_per_frame: number; tracker_per_frame: number };
    config: JobConfig;
    device?: string;
  };
}

export interface Comparison {
  video: { id: string; filename: string; frame_count: number; fps: number };
  runs: CompareRun[];
  mismatched_settings: string[];
}

export interface LatestRun {
  job_id: string;
  tracker: string;
  video: string | null;
  finished_at: string | null;
  stats: JobStats | null;
  vessels: { track_id: number; n_detections: number; mean_conf: number; duration_s: number | null; n_gaps: number }[];
}

export interface TrackDetail extends TrackSummary {
  conf_history: [number, number][];
  bbox_history: [number, number, number, number, number][];
  depth_history: [number, number][];
}

export interface HorizonPoint {
  frame: number;
  y: number | null;
  trusted: boolean;
  cmc: boolean;
}

export interface Health {
  database: "connected" | "unreachable";
  device: string;
  model_found: boolean;
  model_path: string;
}

export interface TrackerInfo {
  name: string;
  label: string;
}

export interface Summary {
  latest_run: LatestRun | null;
  videos: number;
  jobs: Record<JobStatus, number>;
  vessel_tracks: number;
  per_tracker: Record<string, { jobs: number; mean_fps: number | null; tracks: number; gaps: number; recoveries: number }>;
  note: string;
}

const BASE = "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<Health>("/health"),
  trackers: () => request<TrackerInfo[]>("/trackers"),
  summary: () => request<Summary>("/analytics/summary"),

  videos: () => request<Video[]>("/videos"),
  video: (id: string) => request<Video>(`/videos/${id}`),
  deleteVideo: (id: string) => request<void>(`/videos/${id}`, { method: "DELETE" }),
  thumbnailUrl: (id: string) => `${BASE}/videos/${id}/thumbnail`,

  /** Upload with progress, which fetch() cannot report. */
  uploadVideo(file: File, source: string, onProgress: (p: number) => void): Promise<Video> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);
      if (source) form.append("source", source);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => {
        let body: any = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new ApiError(xhr.status, body?.detail ?? xhr.statusText));
      };
      xhr.onerror = () => reject(new ApiError(0, "Network error — is the backend running?"));
      xhr.open("POST", `${BASE}/videos`);
      xhr.send(form);
    });
  },

  jobs: (params: { status?: string; video_id?: string } = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return request<Job[]>(`/jobs${q.toString() ? `?${q}` : ""}`);
  },
  job: (id: string) => request<Job>(`/jobs/${id}`),
  createJob: (body: { video_id: string; tracker: string; config: Partial<JobConfig> }) =>
    request<Job>("/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  cancelJob: (id: string) => request<{ ok: boolean }>(`/jobs/${id}/cancel`, { method: "POST" }),
  tracks: (jobId: string) => request<TrackSummary[]>(`/jobs/${jobId}/tracks`),
  track: (jobId: string, trackId: number) => request<TrackDetail>(`/jobs/${jobId}/tracks/${trackId}`),
  horizon: (jobId: string, step = 5) => request<HorizonPoint[]>(`/jobs/${jobId}/horizon?step=${step}`),
  counts: (jobId: string, step = 1) => request<CountPoint[]>(`/jobs/${jobId}/counts?step=${step}`),
  liveUrl: (jobId: string, tick: number) => `${BASE}/jobs/${jobId}/live?t=${tick}`,
  photoUrl: (jobId: string, trackId: number) => `${BASE}/jobs/${jobId}/tracks/${trackId}/photo`,
  compare: (videoId: string) => request<Comparison>(`/compare?video_id=${videoId}`),
  compareVideos: () => request<{ id: string; filename: string; trackers: string[] }[]>("/compare/videos"),
  outputUrl: (jobId: string) => `${BASE}/jobs/${jobId}/output`,
  exportUrl: (jobId: string, format: "csv" | "json" | "mot") => `${BASE}/jobs/${jobId}/export?format=${format}`,
};
