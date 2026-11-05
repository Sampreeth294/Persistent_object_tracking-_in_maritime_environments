"""Read basic facts about a video file with OpenCV."""
from pathlib import Path

import cv2


class InvalidVideoError(ValueError):
    pass


def read_metadata(path: Path) -> dict:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise InvalidVideoError("OpenCV could not open this file as a video")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        fourcc = int(cap.get(cv2.CAP_PROP_FOURCC) or 0)
        codec = "".join(chr((fourcc >> 8 * i) & 0xFF) for i in range(4)).strip("\x00 ")
        ok, _ = cap.read()
    finally:
        cap.release()

    if not ok or width == 0 or height == 0:
        raise InvalidVideoError("The video has no readable frames")
    return {
        "fps": round(fps, 3),
        "frame_count": frames,
        "width": width,
        "height": height,
        "duration_s": round(frames / fps, 2) if fps else None,
        "codec": codec or None,
    }


def save_thumbnail(video_path: Path, out_path: Path, width: int = 480) -> bool:
    cap = cv2.VideoCapture(str(video_path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.set(cv2.CAP_PROP_POS_FRAMES, min(30, max(total - 1, 0)))
    ok, frame = cap.read()
    cap.release()
    if not ok:
        return False
    h, w = frame.shape[:2]
    thumb = cv2.resize(frame, (width, int(h * width / w)))
    return cv2.imwrite(str(out_path), thumb, [cv2.IMWRITE_JPEG_QUALITY, 82])
