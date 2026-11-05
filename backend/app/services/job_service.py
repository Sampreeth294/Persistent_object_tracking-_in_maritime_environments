from fastapi import HTTPException

from app.repositories import jobs as jobs_repo
from app.repositories import videos as videos_repo
from app.schemas.jobs import JobCreate
from app.vision.trackers.factory import TRACKERS
from app.workers import runner


def create(req: JobCreate) -> str:
    if not videos_repo.get(req.video_id):
        raise HTTPException(404, "Video not found")
    if req.tracker not in TRACKERS:
        raise HTTPException(400, f"Unknown tracker. Choose one of {list(TRACKERS)}")
    job_id = jobs_repo.create({
        "video_id": req.video_id,
        "detector": "yolov8s-smd",
        "tracker": req.tracker,
        "config": req.config.model_dump(),
    })
    runner.enqueue(job_id)
    return job_id


def cancel(job_id: str) -> None:
    job = jobs_repo.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if not jobs_repo.request_cancel(job_id):
        raise HTTPException(409, f"Job is already {job['status']}")
