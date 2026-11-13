"""Proposed method: horizon-guided tracking (H-CMC v2).

BoT-SORT corrects its Kalman predictions with a 2x3 camera-motion warp that it
estimates by matching feature points between frames. On open water those points
sit on moving waves. We estimate the warp from the sea horizon instead:

    * camera pitch  -> the horizon moves up/down -> vertical shift
    * camera roll   -> the horizon tilts         -> rotation

v1 (naive) applied the raw frame-to-frame horizon change. Measured on SMD
MVI_1609 (fixed camera) it DOUBLED vessel IDs (153 vs 76 for ByteTrack):
the tilt estimate flipped by up to 0.8 deg on ~6% of frames, shifting
predictions of small distant vessels by ~14 px at the image edge.

v2 adds three rules (each one switchable for the ablation study):
    1. smoothing   - use the median horizon of the last `smooth_k` trusted frames
    2. dead-band   - ignore changes below detection noise (deadband_px / deadband_deg);
                     small real drift accumulates against a fixed reference until it
                     exceeds the dead-band, so it is not lost
    3. jump reject - a change larger than max_dy_px / max_dtheta_deg in one frame is
                     physically implausible -> treated as a detection error. If the new
                     level persists for `reset_after` frames, it is accepted.
Plus the confidence gate from v1:
    * enough image strips agree with the line (support >= min_support), and
    * at most `max_violation` of vessel boxes sit above the line.

If any rule fails the warp is the identity, i.e. BoT-SORT without motion compensation.
Set smooth_k=1, deadband_px=0, deadband_deg=0, max_dy_px=1e9, max_dtheta_deg=1e9 to reproduce v1.

Known limit: the horizon cannot see horizontal panning (yaw).
"""
import math
from collections import deque

import numpy as np

from app.vision.horizon import detect_horizon, violation_fraction
from app.vision.trackers.base import FrameState
from app.vision.trackers.ultralytics_trackers import BotSortTracker

HCMC_DEFAULTS = dict(
    min_support=0.5,
    max_violation=0.10,
    smooth_k=5,
    deadband_px=1.0,
    deadband_deg=0.05,
    max_dy_px=25.0,
    max_dtheta_deg=0.3,
    reset_after=5,
)


class HorizonGMC:
    """Drop-in replacement for Ultralytics' GMC: apply(img, dets) -> 2x3 warp."""

    method = "horizon"  # Ultralytics skips GMC entirely when method is None

    def __init__(self, **params):
        self.p = {**HCMC_DEFAULTS, **params}
        self.state = FrameState()
        self.reset_params()

    def reset_params(self):
        self.buffer: deque = deque(maxlen=int(self.p["smooth_k"]))
        self.ref: dict | None = None        # horizon at the last applied correction
        self.rejected_run: list = []        # consecutive jump-rejected horizons

    def _smoothed(self) -> dict:
        y = float(np.median([b["y_center"] for b in self.buffer]))
        ang = float(np.median([b["angle_deg"] for b in self.buffer]))
        return {"y_center": y, "angle_deg": ang, "slope": math.tan(math.radians(ang))}

    def apply(self, img, dets=None):
        h, w = img.shape[:2]
        raw = detect_horizon(img)
        state = FrameState(horizon=raw)
        state.extra["reason"] = "no horizon"
        warp = np.eye(2, 3)

        # 1. Confidence gate on this frame's raw horizon
        if raw is not None and raw["support"] >= self.p["min_support"]:
            viol = violation_fraction(raw, _dets_to_xyxy(dets), w)
            state.extra["violation"] = round(viol, 3)
            state.horizon_trusted = viol <= self.p["max_violation"]
            state.extra["reason"] = "trusted" if state.horizon_trusted else "vessel above line"
        elif raw is not None:
            state.extra["reason"] = "low support"

        if state.horizon_trusted:
            # 2. Jump rejection against the current smoothed level
            if self.buffer and self._is_jump(raw, self._smoothed()):
                self.rejected_run.append(raw)
                state.extra["reason"] = "jump rejected"
                if len(self.rejected_run) >= self.p["reset_after"]:   # the new level persisted: accept it
                    self.buffer.clear()
                    self.buffer.extend(self.rejected_run[-self.buffer.maxlen:])
                    self.rejected_run = []
                    self.ref = self._smoothed()
                    state.extra["reason"] = "level reset"
            else:
                self.rejected_run = []
                self.buffer.append(raw)
                smooth = self._smoothed()
                state.horizon = {**smooth, "support": raw["support"]}
                if self.ref is None:
                    self.ref = smooth
                else:
                    # 3. Dead-band: correct only once the change exceeds detection noise
                    dy = smooth["y_center"] - self.ref["y_center"]
                    dth = smooth["angle_deg"] - self.ref["angle_deg"]
                    if abs(dy) >= self.p["deadband_px"] or abs(dth) >= self.p["deadband_deg"]:
                        warp = _horizon_warp(self.ref, smooth, w)
                        state.cmc_applied = True
                        state.extra.update(dy=round(dy, 2), dtheta=round(dth, 4))
                        self.ref = smooth
                    else:
                        state.extra["reason"] = "below dead-band"

        self.state = state
        return warp

    def _is_jump(self, raw: dict, smooth: dict) -> bool:
        return (abs(raw["y_center"] - smooth["y_center"]) > self.p["max_dy_px"]
                or abs(raw["angle_deg"] - smooth["angle_deg"]) > self.p["max_dtheta_deg"])


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

    def __init__(self, frame_rate: int = 30, **params):
        hcmc = {k: params.pop(k) for k in list(params) if k in HCMC_DEFAULTS}
        super().__init__(frame_rate=frame_rate, gmc_method="none", **params)
        self.gmc = HorizonGMC(**hcmc)
        self._impl.gmc = self.gmc  # swap the feature-point estimator for ours
        self.config.update(gmc_method="horizon-v2", **self.gmc.p)

    @property
    def frame_state(self) -> FrameState:
        return self.gmc.state
