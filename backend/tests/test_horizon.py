import math

import numpy as np

from app.vision.horizon import detect_horizon, violation_fraction
from app.vision.trackers.horizon_tracker import _horizon_warp


def synthetic_sea(width=1920, height=1080, y0=520, tilt_deg=2.0):
    """Bright sky above a tilted line, darker sea below, plus a little noise."""
    rng = np.random.default_rng(1)
    img = np.zeros((height, width, 3), np.uint8)
    slope = math.tan(math.radians(tilt_deg))
    ys = np.arange(height)[:, None]
    xs = np.arange(width)[None, :]
    line = y0 + slope * (xs - width / 2)
    img[...] = np.where((ys < line)[..., None], 190, 95).astype(np.uint8)
    noise = rng.integers(-6, 7, img.shape)
    return np.clip(img.astype(int) + noise, 0, 255).astype(np.uint8)


def test_detects_tilted_horizon():
    hz = detect_horizon(synthetic_sea(y0=520, tilt_deg=2.0))
    assert hz is not None
    assert abs(hz["y_center"] - 520) < 6
    assert abs(hz["angle_deg"] - 2.0) < 0.5
    assert hz["support"] > 0.8


def test_violation_fraction():
    hz = {"y_center": 500.0, "slope": 0.0}
    boxes = np.array([[100, 450, 200, 520],   # bottom below the line: fine
                      [300, 300, 400, 400]])  # bottom above the line: in the sky
    assert violation_fraction(hz, boxes, 1920) == 0.5


def test_horizon_warp_maps_old_line_onto_new_line():
    prev = {"y_center": 500.0, "slope": 0.0}
    curr = {"y_center": 530.0, "slope": math.tan(math.radians(1.0))}
    W = _horizon_warp(prev, curr, 1920)
    for x in (0.0, 960.0, 1920.0):
        p = W @ np.array([x, 500.0, 1.0])
        expected_y = 530.0 + curr["slope"] * (p[0] - 960)
        assert abs(p[1] - expected_y) < 1e-6
