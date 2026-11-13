"""H-CMC v2: ignore detector jitter, follow real camera motion."""
import math

import numpy as np
import pytest

from app.vision.trackers import horizon_tracker as ht

IMG = np.zeros((1080, 1920, 3), np.uint8)


def run(monkeypatch, horizons, **params):
    seq = iter(horizons)

    def fake_detect(img):
        y, ang = next(seq)
        return {"y_center": y, "angle_deg": ang, "slope": math.tan(math.radians(ang)), "support": 0.9}

    monkeypatch.setattr(ht, "detect_horizon", fake_detect)
    gmc = ht.HorizonGMC(**params)
    warps, states = [], []
    for _ in horizons:
        warps.append(gmc.apply(IMG, None))
        states.append(gmc.state)
    return warps, states


def test_fixed_camera_with_tilt_flips_gives_no_correction(monkeypatch):
    # Measured pattern on MVI_1609: tiny noise, plus a 0.6 deg flip on some frames
    rng = np.random.default_rng(0)
    seq = [(560 + rng.normal(0, 0.3), 3.4 + (0.6 if i % 16 == 7 else rng.normal(0, 0.01))) for i in range(200)]
    warps, states = run(monkeypatch, seq)
    applied = sum(s.cmc_applied for s in states)
    assert applied <= 2, f"v2 should stay off on a fixed camera, applied {applied}x"
    assert sum(s.extra.get("reason") == "jump rejected" for s in states) >= 10


def test_v1_settings_reproduce_the_problem(monkeypatch):
    seq = [(560.0, 3.4 + (0.6 if i % 16 == 7 else 0.0)) for i in range(64)]
    v1 = dict(smooth_k=1, deadband_px=0, deadband_deg=0, max_dy_px=1e9, max_dtheta_deg=1e9)
    _, states = run(monkeypatch, seq, **v1)
    assert sum(s.cmc_applied for s in states) >= 6     # every flip (and flip-back) moves all tracks


def test_follows_real_pitch_motion(monkeypatch):
    # Camera pitching: horizon moves down 3 px per frame
    seq = [(500 + 3 * i, 2.0) for i in range(40)]
    warps, states = run(monkeypatch, seq)
    later = [w[1, 2] for w, s in zip(warps[10:], states[10:]) if s.cmc_applied]
    assert len(later) >= 25
    assert np.mean(later) == pytest.approx(3.0, abs=0.3)   # vertical shift per frame ~ true motion


def test_persistent_level_change_is_accepted(monkeypatch):
    seq = [(500.0, 2.0)] * 10 + [(560.0, 2.0)] * 12      # camera re-aimed: horizon jumps 60 px and stays
    _, states = run(monkeypatch, seq)
    reasons = [s.extra.get("reason") for s in states]
    assert "level reset" in reasons
    assert states[-1].horizon["y_center"] == pytest.approx(560.0)
