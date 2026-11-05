"""Horizon detection (v4) and the vessel-horizon consistency check.

v4 = top-k vertical-gradient edges per image strip + RANSAC line fit.
Measured on SMD VIS_Onshore (37 videos, every 5th frame): median y error 3.9 px,
70.1% of frames within 10 px, median angle error 0.16 deg.
"""
import math

import cv2
import numpy as np


def _strip_peaks(profile: np.ndarray, k: int, min_gap: int) -> list[int]:
    """Rows of the k strongest edges in one strip, at least min_gap apart."""
    peaks: list[int] = []
    for idx in np.argsort(profile)[::-1]:
        if all(abs(int(idx) - p) >= min_gap for p in peaks):
            peaks.append(int(idx))
            if len(peaks) == k:
                break
    return peaks


def detect_horizon(frame, n_strips=32, work_width=960, k_peaks=3, min_gap=8,
                   inlier_tol_px=5, iters=300, max_tilt_deg=15, margin=0.05, seed=0):
    """Return {y_center, angle_deg, slope, support} in full-resolution pixels, or None."""
    h, w = frame.shape[:2]
    scale = work_width / w
    small = cv2.resize(frame, (work_width, int(h * scale)))
    sh, sw = small.shape[:2]

    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    grad = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3))
    top, bottom = int(margin * sh), int((1 - margin) * sh)

    # 1. Up to k candidate edge rows in every vertical strip
    strip_id, xs, ys = [], [], []
    strip_w = sw // n_strips
    for i in range(n_strips):
        x0 = i * strip_w
        profile = grad[top:bottom, x0:x0 + strip_w].mean(axis=1)
        for p in _strip_peaks(profile, k_peaks, min_gap):
            strip_id.append(i)
            xs.append(x0 + strip_w / 2)
            ys.append(top + p)
    strip_id, X, Y = np.array(strip_id), np.array(xs, float), np.array(ys, float)
    if len(X) < 2:
        return None

    def votes(slope, intercept):
        res = np.abs(Y - (slope * X + intercept))
        best_per_strip = np.full(n_strips, np.inf)
        np.minimum.at(best_per_strip, strip_id, res)
        ok = best_per_strip < inlier_tol_px
        return ok.sum(), best_per_strip[ok].sum()

    # 2. RANSAC: the line that the most strips agree with wins
    rng = np.random.default_rng(seed)
    max_slope = math.tan(math.radians(max_tilt_deg))
    best = None
    for _ in range(iters):
        a, b = rng.choice(len(X), 2, replace=False)
        if strip_id[a] == strip_id[b]:
            continue
        slope = (Y[b] - Y[a]) / (X[b] - X[a])
        if abs(slope) > max_slope:
            continue
        intercept = Y[a] - slope * X[a]
        count, res_sum = votes(slope, intercept)
        cand = (count, -res_sum, slope, intercept)
        if best is None or cand[:2] > best[:2]:
            best = cand
    if best is None or best[0] < 2:
        return None
    _, _, slope, intercept = best

    # 3. Refit on the closest candidate of each agreeing strip
    res = np.abs(Y - (slope * X + intercept))
    fx, fy = [], []
    for i in range(n_strips):
        m = strip_id == i
        if m.any():
            j = int(np.argmin(np.where(m, res, np.inf)))
            if res[j] < inlier_tol_px:
                fx.append(X[j])
                fy.append(Y[j])
    slope, intercept = np.polyfit(fx, fy, 1)

    y_center_small = slope * (sw / 2) + intercept
    return {
        "y_center": float(y_center_small / scale),
        "angle_deg": float(math.degrees(math.atan(slope))),
        "slope": float(slope),
        "support": len(fx) / n_strips,
    }


def horizon_y_at(horizon: dict, x: np.ndarray | float, width: int):
    """Height of the horizon line at column(s) x."""
    return horizon["y_center"] + horizon["slope"] * (np.asarray(x) - width / 2)


def violation_fraction(horizon: dict, boxes_xyxy: np.ndarray, width: int, margin_px: float = 5.0) -> float:
    """Share of boxes whose bottom edge sits above the horizon (a vessel 'in the sky').

    On SMD with ground-truth boxes: 1.3% on good horizons vs 55.4% when the line is too low.
    Returns 0.0 when there are no boxes (no evidence either way).
    """
    if boxes_xyxy is None or len(boxes_xyxy) == 0:
        return 0.0
    cx = (boxes_xyxy[:, 0] + boxes_xyxy[:, 2]) / 2
    bottom = boxes_xyxy[:, 3]
    return float(np.mean(bottom < horizon_y_at(horizon, cx, width) - margin_px))


def pseudo_depth(horizon: dict, boxes_xyxy: np.ndarray, width: int, height: int) -> np.ndarray:
    """H-Depth cue: gap between box bottom and horizon, as a share of frame height.

    Small values = the vessel sits close to the horizon = far away. Negative = above the line.
    """
    if boxes_xyxy is None or len(boxes_xyxy) == 0:
        return np.empty(0)
    cx = (boxes_xyxy[:, 0] + boxes_xyxy[:, 2]) / 2
    gap = boxes_xyxy[:, 3] - horizon_y_at(horizon, cx, width)
    return gap / height
