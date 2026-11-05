"""Pick a tracker by name. Add new trackers here and nowhere else."""
from app.vision.trackers.base import Tracker

TRACKERS = {
    "bytetrack": "ByteTrack (baseline)",
    "botsort": "BoT-SORT with feature-point CMC (baseline)",
    "horizon": "Horizon-guided BoT-SORT, H-CMC (proposed)",
}


def build_tracker(name: str, frame_rate: int, params: dict | None = None) -> Tracker:
    params = params or {}
    if name == "bytetrack":
        from app.vision.trackers.ultralytics_trackers import ByteTrackTracker
        return ByteTrackTracker(frame_rate=frame_rate, **params)
    if name == "botsort":
        from app.vision.trackers.ultralytics_trackers import BotSortTracker
        return BotSortTracker(frame_rate=frame_rate, **params)
    if name == "horizon":
        from app.vision.trackers.horizon_tracker import HorizonTracker
        return HorizonTracker(frame_rate=frame_rate, **params)
    raise ValueError(f"Unknown tracker '{name}'. Choose one of {list(TRACKERS)}")
