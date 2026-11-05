from pymongo import DESCENDING

from app.database.mongo import get_db
from app.utils.ids import now, to_object_id


def create(doc: dict) -> str:
    doc["uploaded_at"] = now()
    return str(get_db().videos.insert_one(doc).inserted_id)


def get(video_id: str) -> dict | None:
    return get_db().videos.find_one({"_id": to_object_id(video_id)})


def list_all(limit: int = 200) -> list[dict]:
    return list(get_db().videos.find().sort("uploaded_at", DESCENDING).limit(limit))


def delete(video_id: str) -> None:
    get_db().videos.delete_one({"_id": to_object_id(video_id)})


def count() -> int:
    return get_db().videos.count_documents({})
