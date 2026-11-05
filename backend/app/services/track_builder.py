"""Turns per-frame tracker output into one summary per vessel.

Pure Python (no database), so it is easy to unit-test and explain:
  * gaps       = frames between first and last sighting where the vessel was not seen
  * recoveries = times the same ID came back after being lost (a gap ended)
"""
from dataclasses import dataclass, field

HISTORY_EVERY = 5  # keep every 5th bbox so documents stay small


@dataclass
class _Acc:
    track_id: int
    first_frame: int
    last_frame: int
    n: int = 0
    conf_sum: float = 0.0
    n_gaps: int = 0
    gap_frames: int = 0
    longest_gap: int = 0
    recoveries: list = field(default_factory=list)
    conf_history: list = field(default_factory=list)
    bbox_history: list = field(default_factory=list)
    depth_history: list = field(default_factory=list)


class TrackBuilder:
    def __init__(self):
        self._acc: dict[int, _Acc] = {}

    def add(self, frame_idx: int, track_id: int, xyxy, conf: float, depth: float | None = None):
        a = self._acc.get(track_id)
        if a is None:
            a = self._acc[track_id] = _Acc(track_id, frame_idx, frame_idx)
        else:
            gap = frame_idx - a.last_frame - 1
            if gap > 0:
                a.n_gaps += 1
                a.gap_frames += gap
                a.longest_gap = max(a.longest_gap, gap)
                a.recoveries.append({"lost_after": a.last_frame, "recovered_at": frame_idx, "gap": gap})
            a.last_frame = frame_idx
        a.n += 1
        a.conf_sum += conf
        a.conf_history.append([frame_idx, round(conf, 3)])
        if (a.n - 1) % HISTORY_EVERY == 0:
            a.bbox_history.append([frame_idx, *[round(v, 1) for v in xyxy]])
            if depth is not None:
                a.depth_history.append([frame_idx, round(depth, 4)])

    def build(self, job_id: str, fps: float) -> list[dict]:
        out = []
        for a in sorted(self._acc.values(), key=lambda x: x.first_frame):
            span = a.last_frame - a.first_frame + 1
            out.append({
                "job_id": job_id,
                "track_id": a.track_id,
                "first_frame": a.first_frame,
                "last_frame": a.last_frame,
                "span_frames": span,
                "duration_s": round(span / fps, 2) if fps else None,
                "n_detections": a.n,
                "coverage": round(a.n / span, 4),
                "mean_conf": round(a.conf_sum / a.n, 4),
                "n_gaps": a.n_gaps,
                "gap_frames": a.gap_frames,
                "longest_gap": a.longest_gap,
                "recovery_events": a.recoveries,
                "conf_history": a.conf_history,
                "bbox_history": a.bbox_history,
                "depth_history": a.depth_history,
            })
        return out
