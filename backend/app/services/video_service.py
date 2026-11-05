import logging
import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.repositories import jobs as jobs_repo
from app.repositories import tracks as tracks_repo
from app.repositories import videos as videos_repo
from app.utils.video_meta import InvalidVideoError, read_metadata, save_thumbnail

log = logging.getLogger(__name__)


def upload(file: UploadFile, source: str | None) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(400, f"Unsupported format '{ext}'. Allowed: {', '.join(settings.allowed_extensions)}")

    settings.ensure_dirs()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = settings.videos_dir / stored_name

    # Stream to disk in chunks so a 2 GB file never sits in memory
    size, limit = 0, settings.max_upload_mb * 1024 * 1024
    with dest.open("wb") as out:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"File larger than {settings.max_upload_mb} MB")
            out.write(chunk)

    try:
        meta = read_metadata(dest)
    except InvalidVideoError as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(e))

    thumb = settings.thumbs_dir / f"{dest.stem}.jpg"
    has_thumb = save_thumbnail(dest, thumb)

    return videos_repo.create({
        "filename": file.filename,
        "stored_path": str(dest),
        "thumbnail_path": str(thumb) if has_thumb else None,
        "size_bytes": size,
        "source": source or None,
        **meta,
    })


def delete(video_id: str) -> None:
    video = videos_repo.get(video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    jobs = jobs_repo.list_all(video_id=video_id)
    if any(j["status"] in jobs_repo.ACTIVE for j in jobs):
        raise HTTPException(409, "Cancel this video's running or queued jobs first")

    job_ids = jobs_repo.delete_for_video(video_id)
    tracks_repo.delete_for_jobs(job_ids)
    for job_id in job_ids:
        shutil.rmtree(settings.outputs_dir / job_id, ignore_errors=True)
    for key in ("stored_path", "thumbnail_path"):
        if video.get(key):
            Path(video[key]).unlink(missing_ok=True)
    videos_repo.delete(video_id)
    log.info("Deleted video %s and %d jobs", video_id, len(job_ids))
