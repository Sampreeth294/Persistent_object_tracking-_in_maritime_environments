"""End-to-end worker test with a fake detector and tracker (no YOLO, no GPU).

Checks that a run produces: frame documents, vessel tracks with photos,
a live frame, count statistics, and a comparison entry.
"""
import time
from types import SimpleNamespace

import cv2
import numpy as np
import pytest

pytest.importorskip("mongomock")

from app.vision.trackers.base import FrameState, TrackedBox, Tracker  # noqa: E402
from tests.test_api import client, make_video  # noqa: E402,F401


class FakeTracker(Tracker):
    """Two 'vessels': #1 visible in every frame, #2 only in frames 5-14."""
    config = {"tracker_type": "fake"}

    def __init__(self):
        self.i = 0

    def update(self, boxes, frame):
        out = [TrackedBox(1, (40.0, 100.0, 120.0, 140.0), 0.6 + 0.01 * (self.i % 5))]
        if 5 <= self.i < 15:
            out.append(TrackedBox(2, (200.0, 110.0, 260.0, 135.0), 0.8))
        self.i += 1
        return out

    @property
    def frame_state(self):
        return FrameState(horizon={"y_center": 90.0, "angle_deg": 0.0, "slope": 0.0, "support": 0.9},
                          horizon_trusted=True)


@pytest.fixture()
def fake_vision(monkeypatch):
    from app.workers import runner
    empty = SimpleNamespace(conf=np.zeros(0))
    monkeypatch.setattr(runner.detector, "detect", lambda frame, conf, imgsz=None: empty)
    monkeypatch.setattr(runner.detector, "resolve_device", lambda: "cpu")
    monkeypatch.setattr(runner, "build_tracker", lambda name, frame_rate, params: FakeTracker())


def wait_done(client, job_id):
    for _ in range(100):
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] not in ("queued", "running"):
            return job
        time.sleep(0.05)
    raise AssertionError("job did not finish")


def test_full_run(client, fake_vision, tmp_path):  # noqa: F811
    clip = tmp_path / "clip.avi"
    make_video(clip, frames=30)
    with clip.open("rb") as f:
        vid = client.post("/api/videos", files={"file": ("clip.avi", f, "video/x-msvideo")}).json()["id"]

    job = client.post("/api/jobs", json={"video_id": vid, "tracker": "horizon"}).json()
    job = wait_done(client, job["id"])
    assert job["status"] == "completed", job.get("error")

    s = job["stats"]
    assert s["n_tracks"] == 2
    assert s["peak_in_frame"] == 2
    assert s["confirmed_vessels"] == 1            # vessel 2 was seen in only 10 frames
    assert s["horizon_trusted_ratio"] == 1.0

    tracks = client.get(f"/api/jobs/{job['id']}/tracks").json()
    assert all(t["has_photo"] for t in tracks)
    photo = client.get(f"/api/jobs/{job['id']}/tracks/1/photo")
    assert photo.status_code == 200 and photo.headers["content-type"] == "image/jpeg"
    img = cv2.imdecode(np.frombuffer(photo.content, np.uint8), cv2.IMREAD_COLOR)
    assert img.shape[0] == 160

    assert client.get(f"/api/jobs/{job['id']}/live").status_code == 200
    counts = client.get(f"/api/jobs/{job['id']}/counts").json()
    assert len(counts) == 30 and max(c["n"] for c in counts) == 2

    cmp = client.get(f"/api/compare?video_id={vid}").json()
    by = {r["tracker"]: r["job"] for r in cmp["runs"]}
    assert by["horizon"]["id"] == job["id"] and by["bytetrack"] is None

    summary = client.get("/api/analytics/summary").json()
    assert summary["latest_run"]["vessels"][0]["track_id"] == 1
