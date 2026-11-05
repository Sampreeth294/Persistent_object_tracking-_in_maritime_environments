from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.repositories import videos as videos_repo
from app.services import video_service
from app.utils.files import range_file_response
from app.utils.ids import serialize

router = APIRouter(prefix="/videos", tags=["videos"])


def _public(doc: dict) -> dict:
    out = serialize(doc)
    out.pop("stored_path", None)
    out["has_thumbnail"] = bool(out.pop("thumbnail_path", None))
    return out


@router.post("", status_code=201)
def upload_video(file: UploadFile = File(...), source: str | None = Form(None)):
    video_id = video_service.upload(file, source)
    return _public(videos_repo.get(video_id))


@router.get("")
def list_videos():
    return [_public(v) for v in videos_repo.list_all()]


@router.get("/{video_id}")
def get_video(video_id: str):
    video = videos_repo.get(video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    return _public(video)


@router.get("/{video_id}/thumbnail")
def thumbnail(video_id: str):
    video = videos_repo.get(video_id)
    if not video or not video.get("thumbnail_path") or not Path(video["thumbnail_path"]).exists():
        raise HTTPException(404, "No thumbnail")
    return FileResponse(video["thumbnail_path"], media_type="image/jpeg")


@router.get("/{video_id}/stream")
def stream(video_id: str, request: Request):
    video = videos_repo.get(video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    return range_file_response(Path(video["stored_path"]), request)


@router.delete("/{video_id}", status_code=204)
def delete_video(video_id: str):
    video_service.delete(video_id)
