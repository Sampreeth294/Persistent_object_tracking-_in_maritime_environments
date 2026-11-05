"""Export a job's tracks as CSV, JSON or MOTChallenge text."""
import csv
import io
import json

from app.repositories import tracks as tracks_repo


def frame_rows(job_id: str):
    """(frame_idx, track_id, x1, y1, x2, y2, conf) for every tracked box."""
    for f in tracks_repo.iter_frames(job_id):
        for d in f.get("detections", []):
            x1, y1, x2, y2 = d["bbox"]
            yield f["frame_idx"], d["track_id"], x1, y1, x2, y2, d["conf"]


def to_csv(job_id: str) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["frame", "track_id", "x1", "y1", "x2", "y2", "conf"])
    for row in frame_rows(job_id):
        w.writerow(row)
    return buf.getvalue()


def to_mot(job_id: str) -> str:
    """MOTChallenge format: frame,id,left,top,width,height,conf,-1,-1,-1 (frames start at 1).

    This is the format TrackEval reads to compute HOTA, IDF1 and MOTA.
    """
    lines = []
    for frame, tid, x1, y1, x2, y2, conf in frame_rows(job_id):
        lines.append(f"{frame + 1},{tid},{x1:.2f},{y1:.2f},{x2 - x1:.2f},{y2 - y1:.2f},{conf:.4f},-1,-1,-1")
    return "\n".join(lines) + ("\n" if lines else "")


def to_json(job_id: str) -> str:
    return json.dumps({
        "job_id": job_id,
        "tracks": tracks_repo.list_tracks(job_id, with_history=True),
    }, default=str, indent=2)
