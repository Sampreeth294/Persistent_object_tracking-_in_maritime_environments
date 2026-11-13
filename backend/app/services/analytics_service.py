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

    latest = None
    last_job = next(iter(jobs_repo.list_all(status="completed", limit=1)), None)
    if last_job:
        job_id = str(last_job["_id"])
        video = videos_repo.get(last_job["video_id"])
        vessels = [t for t in tracks_repo.list_tracks(job_id) if t.get("has_photo") and t.get("confirmed")]
        vessels.sort(key=lambda t: t["n_detections"], reverse=True)
        latest = {
            "job_id": job_id,
            "tracker": last_job["tracker"],
            "video": video["filename"] if video else None,
            "finished_at": last_job.get("finished_at"),
            "stats": last_job.get("stats"),
            "vessels": [{k: t[k] for k in ("track_id", "n_detections", "mean_conf", "duration_s", "n_gaps")}
                        for t in vessels[:12]],
        }

    return {
        "latest_run": latest,
        "videos": videos_repo.count(),
        "jobs": jobs,
        "vessel_tracks": tracks_repo.count_tracks(),
        "per_tracker": per_tracker,
        "note": "Tracker statistics are counts from your own runs, not accuracy metrics. "
                "Accuracy (HOTA/IDF1/MOTA) needs ground truth and the evaluation module.",
    }
