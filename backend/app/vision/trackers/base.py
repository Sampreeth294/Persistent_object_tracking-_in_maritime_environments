"""The tracker plug-in contract.

Every tracker takes the detector's boxes for one frame (plus the frame itself)
and returns the tracked boxes with IDs. Swapping trackers never touches the
upload, job, storage or UI code — which keeps experiments fair.
"""
from dataclasses import dataclass, field

import numpy as np


@dataclass
class TrackedBox:
    track_id: int
    xyxy: tuple[float, float, float, float]
    conf: float


@dataclass
class FrameState:
    """Extra per-frame information a tracker may report (stored with the frame)."""
    horizon: dict | None = None
    horizon_trusted: bool = False
    cmc_applied: bool = False
    extra: dict = field(default_factory=dict)


class Tracker:
    name = "base"

    def update(self, boxes, frame: np.ndarray) -> list[TrackedBox]:
        raise NotImplementedError

    @property
    def frame_state(self) -> FrameState:
        return FrameState()
