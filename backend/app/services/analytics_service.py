"""Dashboard numbers. Everything is counted from the database, never hardcoded."""
from app.database.mongo import get_db
from app.repositories import jobs as jobs_repo
from app.repositories import tracks as tracks_repo
from app.repositories import videos as videos_repo


def summary() -> dict:
    db = get_db()
    jobs = jobs_repo.count_by_status()

    per_tracker = {}
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": "$tracker",
            "jobs": {"$sum": 1},
            "fps": {"$avg": "$fps_measured"},
            "tracks": {"$sum": "$stats.n_tracks"},
            "gaps": {"$sum": "$stats.n_gaps"},
            "recoveries": {"$sum": "$stats.n_recoveries"},
        }},
    ]
    for row in db.tracking_jobs.aggregate(pipeline):
        per_tracker[row["_id"]] = {
            "jobs": row["jobs"],
            "mean_fps": round(row["fps"], 2) if row.get("fps") else None,
            "tracks": row["tracks"],
            "gaps": row["gaps"],
            "recoveries": row["recoveries"],
        }

    return {
        "videos": videos_repo.count(),
        "jobs": jobs,
        "vessel_tracks": tracks_repo.count_tracks(),
        "per_tracker": per_tracker,
        "note": "Tracker statistics are counts from your own runs, not accuracy metrics. "
                "Accuracy (HOTA/IDF1/MOTA) needs ground truth and the evaluation module.",
    }
