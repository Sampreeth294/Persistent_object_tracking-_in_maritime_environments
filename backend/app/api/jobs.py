from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response

from app.core.config import settings
from app.repositories import jobs as jobs_repo
from app.repositories import tracks as tracks_repo
from app.schemas.jobs import JobCreate
from app.services import export_service, job_service
from app.utils.files import range_file_response
from app.utils.ids import serialize

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _public(doc: dict) -> dict:
    out = serialize(doc)
    out["has_output"] = bool(out.pop("output_path", None))
    return out


def _require(job_id: str) -> dict:
    job = jobs_repo.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.post("", status_code=201)
def create_job(req: JobCreate):
    return _public(jobs_repo.get(job_service.create(req)))


@router.get("")
def list_jobs(status: str | None = None, video_id: str | None = None):
    return [_public(j) for j in jobs_repo.list_all(status=status, video_id=video_id)]


@router.get("/{job_id}")
def get_job(job_id: str):
    return _public(_require(job_id))


@router.post("/{job_id}/cancel")
def cancel_job(job_id: str):
    job_service.cancel(job_id)
    return {"ok": True}


@router.get("/{job_id}/tracks")
def list_tracks(job_id: str):
    _require(job_id)
    return tracks_repo.list_tracks(job_id)


@router.get("/{job_id}/tracks/{track_id}")
def get_track(job_id: str, track_id: int):
    track = tracks_repo.get_track(job_id, track_id)
    if not track:
        raise HTTPException(404, "Track not found")
    return track


@router.get("/{job_id}/frames/{frame_idx}")
def get_frame(job_id: str, frame_idx: int):
    frame = tracks_repo.get_frame(job_id, frame_idx)
    if not frame:
        raise HTTPException(404, "Frame not found")
    return frame


@router.get("/{job_id}/horizon")
def horizon_series(job_id: str, step: int = Query(5, ge=1, le=100)):
    """Horizon height and trust flag per frame, sampled every `step` frames."""
    _require(job_id)
    out = []
    for f in tracks_repo.iter_frames(job_id):
        if f["frame_idx"] % step:
            continue
        hz = f.get("horizon")
        out.append({
            "frame": f["frame_idx"],
            "y": None if hz is None else round(hz["y_center"], 1),
            "trusted": f.get("horizon_trusted", False),
            "cmc": f.get("cmc_applied", False),
        })
    return out


NO_CACHE = {"Cache-Control": "no-store, max-age=0"}


@router.get("/{job_id}/live")
def live_frame(job_id: str):
    """Latest annotated frame while the job runs (refreshed every few frames)."""
    _require(job_id)
    path = settings.outputs_dir / job_id / "live.jpg"
    if not path.exists():
        raise HTTPException(404, "No live frame yet")
    return FileResponse(path, media_type="image/jpeg", headers=NO_CACHE)


@router.get("/{job_id}/tracks/{track_id}/photo")
def vessel_photo(job_id: str, track_id: int):
    """Clearest crop of one vessel (its highest-confidence detection)."""
    _require(job_id)
    path = settings.outputs_dir / job_id / "crops" / f"{track_id}.jpg"
    if not path.exists():
        raise HTTPException(404, "No photo for this vessel")
    return FileResponse(path, media_type="image/jpeg", headers=NO_CACHE)


@router.get("/{job_id}/counts")
def counts(job_id: str, step: int = Query(1, ge=1, le=100)):
    """Vessels tracked in each frame — the 'how many ships' chart."""
    _require(job_id)
    out = []
    for f in tracks_repo.iter_frames(job_id):
        if f["frame_idx"] % step == 0:
            out.append({"frame": f["frame_idx"], "n": len(f.get("detections", []))})
    return out


@router.get("/{job_id}/output")
def output_video(job_id: str, request: Request):
    job = _require(job_id)
    if not job.get("output_path"):
        raise HTTPException(404, "No output yet")
    return range_file_response(Path(job["output_path"]), request)


@router.get("/{job_id}/export")
def export(job_id: str, format: str = Query("csv", pattern="^(csv|json|mot)$")):
    job = _require(job_id)
    if job["status"] != "completed":
        raise HTTPException(409, "Export is available after the job completes")
    body, media, ext = {
        "csv": (export_service.to_csv, "text/csv", "csv"),
        "json": (export_service.to_json, "application/json", "json"),
        "mot": (export_service.to_mot, "text/plain", "txt"),
    }[format]
    name = f"tracks_{job['tracker']}_{job_id[-6:]}.{ext}"
    return Response(body(job_id), media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})
