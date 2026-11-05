"""API tests against an in-memory MongoDB (mongomock) — no Docker, no GPU needed.

    pip install mongomock
    python -m pytest -q
"""
import time

import cv2
import numpy as np
import pytest

mongomock = pytest.importorskip("mongomock")

from fastapi.testclient import TestClient  # noqa: E402

from app.core import config  # noqa: E402
from app.database import mongo  # noqa: E402


def _override(name, value):
    """Settings is a frozen dataclass; tests change it on purpose."""
    object.__setattr__(config.settings, name, value)


@pytest.fixture()
def client(tmp_path):
    original = {k: getattr(config.settings, k) for k in ("storage_dir", "model_path")}
    mongo.set_db_client(mongomock.MongoClient())
    _override("storage_dir", tmp_path / "storage")
    from app.main import app
    with TestClient(app) as c:
        yield c
    mongo.set_db_client(None)
    for k, v in original.items():
        _override(k, v)


def make_video(path, frames=20, size=(320, 180)):
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 25, size)
    for i in range(frames):
        img = np.full((size[1], size[0], 3), 90, np.uint8)
        img[: size[1] // 2] = 190
        w.write(img)
    w.release()


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["database"] == "connected"


def test_upload_list_delete(client, tmp_path):
    clip = tmp_path / "clip.avi"
    make_video(clip)
    with clip.open("rb") as f:
        r = client.post("/api/videos", files={"file": ("clip.avi", f, "video/x-msvideo")}, data={"source": "test"})
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["width"] == 320 and v["height"] == 180 and v["frame_count"] == 20
    assert "stored_path" not in v

    assert len(client.get("/api/videos").json()) == 1
    assert client.delete(f"/api/videos/{v['id']}").status_code == 204
    assert client.get("/api/videos").json() == []


def test_rejects_non_video(client):
    r = client.post("/api/videos", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_job_without_model_fails_cleanly(client, tmp_path):
    _override("model_path", tmp_path / "missing.pt")
    clip = tmp_path / "clip.avi"
    make_video(clip)
    with clip.open("rb") as f:
        vid = client.post("/api/videos", files={"file": ("clip.avi", f, "video/x-msvideo")}).json()["id"]

    job = client.post("/api/jobs", json={"video_id": vid, "tracker": "bytetrack"}).json()
    for _ in range(50):
        status = client.get(f"/api/jobs/{job['id']}").json()
        if status["status"] not in ("queued", "running"):
            break
        time.sleep(0.1)
    assert status["status"] == "failed"
    assert status["error"]


def test_unknown_tracker(client, tmp_path):
    clip = tmp_path / "clip.avi"
    make_video(clip)
    with clip.open("rb") as f:
        vid = client.post("/api/videos", files={"file": ("clip.avi", f, "video/x-msvideo")}).json()["id"]
    assert client.post("/api/jobs", json={"video_id": vid, "tracker": "magic"}).status_code == 400
