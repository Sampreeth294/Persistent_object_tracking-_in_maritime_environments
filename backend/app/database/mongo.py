"""One MongoDB client for the whole app, plus the indexes our queries rely on."""
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app.core.config import settings

_client: MongoClient | None = None


def get_db() -> Database:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)
    return _client[settings.mongo_db]


def set_db_client(client) -> None:
    """Used by tests to plug in an in-memory client (mongomock)."""
    global _client
    _client = client


def ping() -> bool:
    try:
        get_db().command("ping")
        return True
    except Exception:
        return False


def ensure_indexes() -> None:
    db = get_db()
    db.videos.create_index([("uploaded_at", DESCENDING)])
    db.tracking_jobs.create_index([("video_id", ASCENDING)])
    db.tracking_jobs.create_index([("status", ASCENDING)])
    db.frame_detections.create_index([("job_id", ASCENDING), ("frame_idx", ASCENDING)])
    db.vessel_tracks.create_index([("job_id", ASCENDING), ("track_id", ASCENDING)], unique=True)
    db.experiments.create_index([("created_at", DESCENDING)])
    db.evaluation_results.create_index([("experiment_id", ASCENDING)])
