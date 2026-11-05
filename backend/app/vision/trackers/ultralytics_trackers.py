"""Baselines: ByteTrack and BoT-SORT from Ultralytics, wrapped in our Tracker contract.

Works with Ultralytics 8.3 (trackers take `frame_rate`) and 8.4 (they do not;
`track_buffer` is then a number of frames). The version used is saved with every job.
"""
import inspect
from types import SimpleNamespace

import numpy as np

from app.vision.trackers.base import TrackedBox, Tracker

# Defaults copied from Ultralytics' bytetrack.yaml / botsort.yaml so runs are reproducible
BYTETRACK_DEFAULTS = dict(
    tracker_type="bytetrack",
    track_high_thresh=0.25,
    track_low_thresh=0.1,
    new_track_thresh=0.25,
    track_buffer=30,
    match_thresh=0.8,
    fuse_score=True,
)
BOTSORT_DEFAULTS = dict(
    BYTETRACK_DEFAULTS,
    tracker_type="botsort",
    gmc_method="sparseOptFlow",
    proximity_thresh=0.5,
    appearance_thresh=0.25,
    with_reid=False,
    model="auto",
)


def _rows_to_boxes(rows: np.ndarray) -> list[TrackedBox]:
    """Ultralytics returns rows of [x1, y1, x2, y2, track_id, score, cls, idx]."""
    if rows is None or len(rows) == 0:
        return []
    return [
        TrackedBox(track_id=int(r[4]), xyxy=(float(r[0]), float(r[1]), float(r[2]), float(r[3])), conf=float(r[5]))
        for r in rows
    ]


def _make(cls, config: dict, frame_rate: int):
    import ultralytics

    config["ultralytics_version"] = ultralytics.__version__
    args = SimpleNamespace(**config)
    if "frame_rate" in inspect.signature(cls.__init__).parameters:
        return cls(args, frame_rate=frame_rate)
    return cls(args)


class ByteTrackTracker(Tracker):
    name = "bytetrack"

    def __init__(self, frame_rate: int = 30, **overrides):
        from ultralytics.trackers.byte_tracker import BYTETracker

        self.config = {**BYTETRACK_DEFAULTS, **overrides}
        self._impl = _make(BYTETracker, self.config, frame_rate)

    def update(self, boxes, frame):
        return _rows_to_boxes(self._impl.update(boxes, frame))


class BotSortTracker(Tracker):
    name = "botsort"

    def __init__(self, frame_rate: int = 30, **overrides):
        from ultralytics.trackers.bot_sort import BOTSORT

        self.config = {**BOTSORT_DEFAULTS, **overrides}
        self._impl = _make(BOTSORT, self.config, frame_rate)

    def update(self, boxes, frame):
        return _rows_to_boxes(self._impl.update(boxes, frame))
