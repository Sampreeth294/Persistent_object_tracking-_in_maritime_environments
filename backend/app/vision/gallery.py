"""Vessel photos: the best-confidence crop of every tracked vessel, plus a live preview frame.

Crops are cut from the raw frame (before boxes are drawn) and saved as small JPEGs:
    storage/outputs/<job_id>/crops/<track_id>.jpg
A crop is replaced only when the detector is clearly more confident (+0.02),
so the gallery shows each vessel at its clearest moment without rewriting files every frame.
"""
import os
from pathlib import Path

import cv2
import numpy as np

MIN_SIDE_PX = 8        # ignore crops of boxes smaller than this
CROP_HEIGHT = 160      # saved crop height in pixels
PAD = 0.15             # context around the box, as a share of its size
IMPROVE_BY = 0.02


class VesselGallery:
    def __init__(self, out_dir: Path):
        self.dir = out_dir / "crops"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.best: dict[int, dict] = {}

    def update(self, frame: np.ndarray, frame_idx: int, tracks) -> None:
        h, w = frame.shape[:2]
        for t in tracks:
            x1, y1, x2, y2 = t.xyxy
            bw, bh = x2 - x1, y2 - y1
            if bw < MIN_SIDE_PX or bh < MIN_SIDE_PX:
                continue
            prev = self.best.get(t.track_id)
            if prev is not None and t.conf < prev["conf"] + IMPROVE_BY:
                continue
            px, py = bw * PAD, bh * PAD
            ix1, iy1 = max(0, int(x1 - px)), max(0, int(y1 - py))
            ix2, iy2 = min(w, int(x2 + px)), min(h, int(y2 + py))
            crop = frame[iy1:iy2, ix1:ix2]
            if crop.size == 0:
                continue
            scale = CROP_HEIGHT / crop.shape[0]
            crop = cv2.resize(crop, (max(1, int(crop.shape[1] * scale)), CROP_HEIGHT),
                              interpolation=cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA)
            _atomic_jpg(self.dir / f"{t.track_id}.jpg", crop, quality=88)
            self.best[t.track_id] = {"conf": t.conf, "frame": frame_idx}

    def best_frames(self) -> dict[int, dict]:
        return self.best


def save_live_frame(path: Path, frame: np.ndarray, width: int = 960) -> None:
    h, w = frame.shape[:2]
    small = cv2.resize(frame, (width, int(h * width / w)), interpolation=cv2.INTER_AREA)
    _atomic_jpg(path, small, quality=80)


def _atomic_jpg(path: Path, img: np.ndarray, quality: int) -> None:
    """Write to a temp file then rename, so the browser never reads a half-written image."""
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        return
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(buf.tobytes())
    os.replace(tmp, path)
