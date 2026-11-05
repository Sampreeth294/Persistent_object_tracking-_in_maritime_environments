from pymongo import DESCENDING

from app.database.mongo import get_db
from app.utils.ids import now, to_object_id

ACTIVE = ("queued", "running")


def create(doc: dict) -> str:
    doc.update(status="queued", progress=0.0, frames_done=0, created_at=now(),
               started_at=None, finished_at=None, error=None, cancel_requested=False)
    return str(get_db().tracking_jobs.insert_one(doc).inserted_id)


def get(job_id: str) -> dict | None:
    return get_db().tracking_jobs.find_one({"_id": to_object_id(job_id)})


def list_all(status: str | None = None, video_id: str | None = None, limit: int = 200) -> list[dict]:
    query = {}
    if status:
        query["status"] = status
    if video_id:
        query["video_id"] = video_id
    return list(get_db().tracking_jobs.find(query).sort("created_at", DESCENDING).limit(limit))


def update(job_id: str, **fields) -> None:
    get_db().tracking_jobs.update_one({"_id": to_object_id(job_id)}, {"$set": fields})


def request_cancel(job_id: str) -> bool:
    res = get_db().tracking_jobs.update_one(
        {"_id": to_object_id(job_id), "status": {"$in": list(ACTIVE)}},
        {"$set": {"cancel_requested": True}},
    )
    return res.modified_count == 1


def cancel_requested(job_id: str) -> bool:
    doc = get_db().tracking_jobs.find_one({"_id": to_object_id(job_id)}, {"cancel_requested": 1})
    return bool(doc and doc.get("cancel_requested"))


def mark_interrupted() -> int:
    """Jobs left 'running' by a crash/restart can never finish: mark them failed."""
    res = get_db().tracking_jobs.update_many(
        {"status": "running"},
        {"$set": {"status": "failed", "error": "Server restarted while the job was running", "finished_at": now()}},
    )
    return res.modified_count


def queued_ids() -> list[str]:
    return [str(d["_id"]) for d in get_db().tracking_jobs.find({"status": "queued"}, {"_id": 1}).sort("created_at", 1)]


def delete_for_video(video_id: str) -> list[str]:
    ids = [str(d["_id"]) for d in get_db().tracking_jobs.find({"video_id": video_id}, {"_id": 1})]
    get_db().tracking_jobs.delete_many({"video_id": video_id})
    return ids


def count_by_status() -> dict:
    out = {s: 0 for s in ("queued", "running", "completed", "failed", "cancelled")}
    for row in get_db().tracking_jobs.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        out[row["_id"]] = row["n"]
    return out
