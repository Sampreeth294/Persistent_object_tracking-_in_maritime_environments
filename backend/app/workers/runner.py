"""Background job runner.

One worker thread takes job ids from a queue and processes them one at a time.
One at a time on purpose: a 4 GB GPU cannot run two YOLO jobs well, and the
API thread stays free to answer requests while a video is processing.
"""
import logging
import queue
import shutil
import subprocess
import threading
import time
from pathlib import Path

import cv2
import numpy as np

from app.core.config import settings
from app.repositories import jobs as jobs_repo
from app.repositories import tracks as tracks_repo
from app.repositories import videos as videos_repo
from app.services.track_builder import TrackBuilder
from app.utils.ids import now
from app.vision import detector
from app.vision.annotate import Annotator
from app.vision.gallery import VesselGallery, save_live_frame
from app.vision.horizon import pseudo_depth
from app.vision.trackers.factory import build_tracker

log = logging.getLogger(__name__)

_queue: "queue.Queue[str]" = queue.Queue()
_thread: threading.Thread | None = None

FRAME_BATCH = 100       # write frame documents to MongoDB in batches
PROGRESS_EVERY = 15     # update progress / check cancel every N frames
LIVE_EVERY = 5          # refresh the live preview image every N frames
CONFIRM_MIN_DETECTIONS = 25  # a vessel ID seen in >= 25 frames (1 s at 25 fps) counts as confirmed


class Cancelled(Exception):
    pass


def start() -> None:
    global _thread
    interrupted = jobs_repo.mark_interrupted()
    if interrupted:
        log.warning("Marked %d interrupted jobs as failed", interrupted)
    for job_id in jobs_repo.queued_ids():
        _queue.put(job_id)
    if _thread is None or not _thread.is_alive():
        _thread = threading.Thread(target=_loop, name="job-worker", daemon=True)
        _thread.start()


def enqueue(job_id: str) -> None:
    _queue.put(job_id)


def _loop() -> None:
    while True:
        job_id = _queue.get()
        try:
            _run(job_id)
        except Exception:  # never let one bad job kill the worker
            log.exception("Worker crashed on job %s", job_id)
        finally:
            _queue.task_done()


def _run(job_id: str) -> None:
    job = jobs_repo.get(job_id)
    if not job or job["status"] != "queued":
        return
    if job.get("cancel_requested"):
        jobs_repo.update(job_id, status="cancelled", finished_at=now())
        return

    jobs_repo.update(job_id, status="running", started_at=now(), device=detector.resolve_device())
    out_dir = settings.outputs_dir / job_id
    try:
        stats = _process(job, job_id, out_dir)
        jobs_repo.update(job_id, status="completed", finished_at=now(), progress=1.0, **stats)
        log.info("Job %s completed: %s", job_id, stats["stats"])
    except Cancelled:
        tracks_repo.delete_for_jobs([job_id])
        shutil.rmtree(out_dir, ignore_errors=True)
        jobs_repo.update(job_id, status="cancelled", finished_at=now())
    except Exception as e:
        log.exception("Job %s failed", job_id)
        jobs_repo.update(job_id, status="failed", finished_at=now(), error=f"{type(e).__name__}: {e}")


def _process(job: dict, job_id: str, out_dir: Path) -> dict:
    video = videos_repo.get(job["video_id"])
    if not video:
        raise FileNotFoundError("Video record was deleted")
    cfg = job["config"]

    cap = cv2.VideoCapture(video["stored_path"])
    if not cap.isOpened():
        raise IOError("Could not open the video file")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    max_frames = cfg.get("max_frames") or total

    tracker = build_tracker(job["tracker"], frame_rate=round(fps), params=cfg.get("tracker_params") or {})
    jobs_repo.update(job_id, frames_total=min(total, max_frames), tracker_config=getattr(tracker, "config", {}))

    out_dir.mkdir(parents=True, exist_ok=True)
    raw_path = out_dir / "annotated_raw.mp4"
    writer = cv2.VideoWriter(str(raw_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    annotator = Annotator()
    builder = TrackBuilder()
    gallery = VesselGallery(out_dir)
    live_path = out_dir / "live.jpg"

    batch, idx = [], 0
    det_time = trk_time = 0.0
    trusted_frames = cmc_frames = 0
    counts: list[int] = []          # vessels tracked in each frame
    seen_ids: set[int] = set()
    t_start = time.perf_counter()

    try:
        while idx < max_frames:
            ok, frame = cap.read()
            if not ok:
                break

            t0 = time.perf_counter()
            boxes = detector.detect(frame, conf=cfg["conf"], imgsz=cfg.get("imgsz"))
            t1 = time.perf_counter()
            tracks = tracker.update(boxes, frame)
            t2 = time.perf_counter()
            det_time += t1 - t0
            trk_time += t2 - t1

            state = tracker.frame_state
            trusted_frames += int(state.horizon_trusted)
            cmc_frames += int(state.cmc_applied)

            depths = [None] * len(tracks)
            if state.horizon is not None and tracks:
                xyxy = np.array([t.xyxy for t in tracks])
                depths = pseudo_depth(state.horizon, xyxy, w, h).tolist()

            dets = []
            for t, d in zip(tracks, depths):
                builder.add(idx, t.track_id, t.xyxy, t.conf, d)
                dets.append({"track_id": t.track_id, "bbox": [round(v, 1) for v in t.xyxy],
                             "conf": round(t.conf, 4), "depth": None if d is None else round(d, 4)})
            batch.append({
                "job_id": job_id,
                "frame_idx": idx,
                "n_raw_detections": int(len(boxes.conf)),
                "detections": dets,
                "horizon": state.horizon,
                "horizon_trusted": state.horizon_trusted,
                "cmc_applied": state.cmc_applied,
            })

            gallery.update(frame, idx, tracks)          # crop from the clean frame, before drawing
            counts.append(len(tracks))
            seen_ids.update(t.track_id for t in tracks)

            annotated = annotator.draw(frame, tracks, state.horizon, state.horizon_trusted, idx)
            writer.write(annotated)
            if idx % LIVE_EVERY == 0:
                save_live_frame(live_path, annotated)
            idx += 1

            if len(batch) >= FRAME_BATCH:
                tracks_repo.insert_frames(batch)
                batch = []
            if idx % PROGRESS_EVERY == 0:
                if jobs_repo.cancel_requested(job_id):
                    raise Cancelled()
                elapsed = time.perf_counter() - t_start
                jobs_repo.update(job_id, frames_done=idx,
                                 progress=round(idx / max(1, min(total, max_frames)), 4),
                                 fps_measured=round(idx / elapsed, 2),
                                 live={"in_frame": counts[-1], "ids_so_far": len(seen_ids),
                                       "peak": max(counts), "frame": idx - 1})
    finally:
        cap.release()
        writer.release()

    tracks_repo.insert_frames(batch)
    track_docs = builder.build(job_id, fps)
    best = gallery.best_frames()
    for t in track_docs:
        b = best.get(t["track_id"])
        t["has_photo"] = b is not None
        t["photo_frame"] = b["frame"] if b else None
        t["photo_conf"] = round(b["conf"], 4) if b else None
        t["confirmed"] = t["n_detections"] >= CONFIRM_MIN_DETECTIONS
    tracks_repo.insert_tracks(track_docs)

    output_path = _to_browser_mp4(raw_path, out_dir / "annotated.mp4")
    elapsed = time.perf_counter() - t_start
    return {
        "frames_done": idx,
        "fps_measured": round(idx / elapsed, 2) if elapsed else None,
        "output_path": str(output_path),
        "timing_ms": {
            "detector_per_frame": round(1000 * det_time / max(idx, 1), 2),
            "tracker_per_frame": round(1000 * trk_time / max(idx, 1), 2),
        },
        "stats": {
            "n_tracks": len(track_docs),
            "n_gaps": sum(t["n_gaps"] for t in track_docs),
            "n_recoveries": sum(len(t["recovery_events"]) for t in track_docs),
            "short_tracks": sum(1 for t in track_docs if t["n_detections"] < 10),
            "confirmed_vessels": sum(1 for t in track_docs if t["confirmed"]),
            "confirm_min_detections": CONFIRM_MIN_DETECTIONS,
            "peak_in_frame": max(counts) if counts else 0,
            "mean_in_frame": round(sum(counts) / len(counts), 2) if counts else 0,
            "horizon_trusted_ratio": round(trusted_frames / idx, 4) if idx else 0,
            "cmc_applied_ratio": round(cmc_frames / idx, 4) if idx else 0,
        },
    }


def _to_browser_mp4(raw: Path, final: Path) -> Path:
    """OpenCV writes mp4v, which most browsers cannot play. Re-encode to H.264 if ffmpeg exists."""
    if shutil.which("ffmpeg") is None:
        log.warning("ffmpeg not found: output may not play in the browser (sudo apt install ffmpeg)")
        return raw
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-c:v", "libx264",
           "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(final)]
    if subprocess.run(cmd).returncode == 0:
        raw.unlink(missing_ok=True)
        return final
    return raw
