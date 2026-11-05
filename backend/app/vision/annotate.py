"""Draw boxes, vessel IDs, short trails and the horizon on output frames."""
from collections import defaultdict, deque

import cv2
import numpy as np

from app.vision.horizon import horizon_y_at

# Same palette idea as the UI: each vessel ID gets a stable colour
_PALETTE = [(58, 163, 240), (137, 180, 61), (79, 75, 226), (196, 160, 72), (180, 120, 200),
            (90, 200, 220), (60, 120, 240), (200, 200, 90), (150, 210, 140), (230, 140, 90)]


def id_colour(track_id: int):
    return _PALETTE[track_id % len(_PALETTE)]


class Annotator:
    def __init__(self, trail_len: int = 30):
        self.trails = defaultdict(lambda: deque(maxlen=trail_len))

    def draw(self, frame: np.ndarray, tracks, horizon: dict | None, trusted: bool, frame_idx: int):
        h, w = frame.shape[:2]
        if horizon is not None:
            ys = horizon_y_at(horizon, np.array([0, w]), w).astype(int)
            colour = (110, 200, 120) if trusted else (90, 90, 230)
            cv2.line(frame, (0, ys[0]), (w, ys[1]), colour, 1, cv2.LINE_AA)

        for t in tracks:
            x1, y1, x2, y2 = map(int, t.xyxy)
            c = id_colour(t.track_id)
            self.trails[t.track_id].append(((x1 + x2) // 2, y2))
            pts = list(self.trails[t.track_id])
            for a, b in zip(pts, pts[1:]):
                cv2.line(frame, a, b, c, 2, cv2.LINE_AA)
            cv2.rectangle(frame, (x1, y1), (x2, y2), c, 2)
            label = f"V-{t.track_id:03d} {t.conf:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 6, y1), c, -1)
            cv2.putText(frame, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (15, 20, 25), 1, cv2.LINE_AA)

        cv2.putText(frame, f"frame {frame_idx}", (12, h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                    (220, 225, 230), 1, cv2.LINE_AA)
        return frame
