"""frame_detections (one document per frame) and vessel_tracks (one per vessel ID)."""
from pymongo import ASCENDING

from app.database.mongo import get_db


def insert_frames(frames: list[dict]) -> None:
    if frames:
        get_db().frame_detections.insert_many(frames, ordered=False)


def iter_frames(job_id: str):
    return get_db().frame_detections.find({"job_id": job_id}, {"_id": 0}).sort("frame_idx", ASCENDING)


def get_frame(job_id: str, frame_idx: int) -> dict | None:
    return get_db().frame_detections.find_one({"job_id": job_id, "frame_idx": frame_idx}, {"_id": 0})


def insert_tracks(tracks: list[dict]) -> None:
    if tracks:
        get_db().vessel_tracks.insert_many(tracks, ordered=False)


def list_tracks(job_id: str, with_history: bool = False) -> list[dict]:
    projection = {"_id": 0}
    if not with_history:
        projection.update(conf_history=0, bbox_history=0, depth_history=0)
    return list(get_db().vessel_tracks.find({"job_id": job_id}, projection).sort("first_frame", ASCENDING))


def get_track(job_id: str, track_id: int) -> dict | None:
    return get_db().vessel_tracks.find_one({"job_id": job_id, "track_id": track_id}, {"_id": 0})


def delete_for_jobs(job_ids: list[str]) -> None:
    if job_ids:
        get_db().frame_detections.delete_many({"job_id": {"$in": job_ids}})
        get_db().vessel_tracks.delete_many({"job_id": {"$in": job_ids}})


def count_tracks() -> int:
    return get_db().vessel_tracks.count_documents({})
