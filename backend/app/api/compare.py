"""Side-by-side comparison: the latest completed run of each tracker on one video."""
from fastapi import APIRouter, HTTPException

from app.repositories import jobs as jobs_repo
from app.repositories import videos as videos_repo
from app.utils.ids import serialize
from app.vision.trackers.factory import TRACKERS

router = APIRouter(prefix="/compare", tags=["compare"])

# Settings that must be equal for a fair comparison (the tracker is the only thing that should change)
SHARED_SETTINGS = ("conf", "imgsz", "max_frames")


@router.get("")
def compare(video_id: str):
    video = videos_repo.get(video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    runs = {}
    for job in jobs_repo.list_all(status="completed", video_id=video_id):  # newest first
        if job["tracker"] not in runs:
            runs[job["tracker"]] = job

    out = []
    for name in TRACKERS:
        job = runs.get(name)
        if job is None:
            out.append({"tracker": name, "job": None})
            continue
        j = serialize(job)
        out.append({
            "tracker": name,
            "job": {k: j.get(k) for k in ("id", "created_at", "fps_measured", "frames_done", "stats",
                                          "timing_ms", "config", "device")},
        })

    configs = [r["job"]["config"] for r in out if r["job"]]
    mismatched = [k for k in SHARED_SETTINGS if len({str(c.get(k)) for c in configs}) > 1]
    return {
        "video": {"id": str(video["_id"]), "filename": video["filename"], "frame_count": video["frame_count"],
                  "fps": video["fps"]},
        "runs": out,
        "mismatched_settings": mismatched,
    }


@router.get("/videos")
def videos_with_runs():
    """Videos that have at least one completed run, with which trackers have run on them."""
    by_video: dict[str, set] = {}
    for job in jobs_repo.list_all(status="completed", limit=1000):
        by_video.setdefault(job["video_id"], set()).add(job["tracker"])
    out = []
    for vid, trackers in by_video.items():
        v = videos_repo.get(vid)
        if v:
            out.append({"id": vid, "filename": v["filename"], "trackers": sorted(trackers)})
    return out
