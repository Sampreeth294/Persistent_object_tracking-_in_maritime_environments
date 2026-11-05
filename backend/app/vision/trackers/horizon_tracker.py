"""Proposed method: horizon-guided tracking (H-CMC).

BoT-SORT corrects its Kalman predictions with a 2x3 camera-motion warp that it
estimates by matching feature points between frames. On open water those points
sit on moving waves, so the estimate is noisy. We replace that estimator with
one computed from the sea horizon:

    * camera pitch  -> the horizon moves up/down     -> vertical shift
    * camera roll   -> the horizon tilts             -> rotation

The horizon is used only when it is trusted (confidence gating):
    1. enough image strips agree with the line (support >= min_support), and
    2. the detected vessels are consistent with it: at most `max_violation`
       of box bottoms may sit above the line (a ship cannot float in the sky).
If either check fails, the warp is the identity and the tracker behaves like
plain BoT-SORT without motion compensation — never worse than its fallback.

Known limit: the horizon cannot see horizontal panning (yaw).
"""
import math

import numpy as np

from app.vision.horizon import detect_horizon, violation_fraction
from app.vision.trackers.base import FrameState
from app.vision.trackers.ultralytics_trackers import BotSortTracker


class HorizonGMC:
    """Drop-in replacement for Ultralytics' GMC: apply(img, dets) -> 2x3 warp."""

    method = "horizon"  # Ultralytics skips GMC entirely when method is None

    def __init__(self, min_support=0.5, max_violation=0.10, max_shift_frac=0.10):
        self.min_support = min_support
        self.max_violation = max_violation
        self.max_shift_frac = max_shift_frac
        self.prev: dict | None = None
        self.state = FrameState()

    def reset_params(self):
        self.prev = None

    def apply(self, img, dets=None):
        h, w = img.shape[:2]
        horizon = detect_horizon(img)
        state = FrameState(horizon=horizon)

        trusted = False
        if horizon is not None and horizon["support"] >= self.min_support:
            boxes = _dets_to_xyxy(dets)
            viol = violation_fraction(horizon, boxes, w)
            state.extra["violation"] = round(viol, 3)
            trusted = viol <= self.max_violation
        state.horizon_trusted = trusted

        warp = np.eye(2, 3)
        if trusted and self.prev is not None:
            dy = horizon["y_center"] - self.prev["y_center"]
            if abs(dy) <= self.max_shift_frac * h:
                warp = _horizon_warp(self.prev, horizon, w)
                state.cmc_applied = True
                state.extra["dy"] = round(float(dy), 2)

        if trusted:
            self.prev = horizon
        self.state = state
        return warp


def _dets_to_xyxy(dets) -> np.ndarray:
    """High-score detections as [x1, y1, x2, y2].

    Ultralytics 8.4 passes xyxy (4 columns); 8.3 passes [cx, cy, w, h, idx] (5 columns).
    """
    if dets is None or len(dets) == 0:
        return np.zeros((0, 4))
    d = np.asarray(dets, dtype=float).reshape(len(dets), -1)
    if d.shape[1] == 4:
        return d
    cx, cy, bw, bh = d[:, 0], d[:, 1], d[:, 2], d[:, 3]
    return np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], axis=1)


def _horizon_warp(prev: dict, curr: dict, width: int) -> np.ndarray:
    """Affine warp moving the previous horizon onto the current one.

    Rotate by the change in tilt about the previous centre point, then shift
    that point onto the current centre point:  p' = R (p - P0) + P1
    """
    theta = math.atan(curr["slope"]) - math.atan(prev["slope"])
    c, s = math.cos(theta), math.sin(theta)
    R = np.array([[c, -s], [s, c]])
    p0 = np.array([width / 2, prev["y_center"]])
    p1 = np.array([width / 2, curr["y_center"]])
    t = p1 - R @ p0
    return np.hstack([R, t.reshape(2, 1)])


class HorizonTracker(BotSortTracker):
    name = "horizon"

    def __init__(self, frame_rate: int = 30, min_support=0.5, max_violation=0.10, **overrides):
        super().__init__(frame_rate=frame_rate, gmc_method="none", **overrides)
        self.gmc = HorizonGMC(min_support=min_support, max_violation=max_violation)
        self._impl.gmc = self.gmc  # swap the feature-point estimator for ours
        self.config.update(gmc_method="horizon", min_support=min_support, max_violation=max_violation)

    @property
    def frame_state(self) -> FrameState:
        return self.gmc.state
