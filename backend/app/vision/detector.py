"""YOLOv8 vessel detector. The model is loaded once and reused for every job."""
import logging
from pathlib import Path

import numpy as np

from app.core.config import settings

log = logging.getLogger(__name__)
_model = None
_device = None


def resolve_device() -> str:
    if settings.device != "auto":
        return settings.device
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def get_model():
    global _model, _device
    if _model is None:
        path = Path(settings.model_path)
        if not path.exists():
            raise FileNotFoundError(
                f"Model not found at {path}. Copy your best.pt there or set MODEL_PATH in backend/.env"
            )
        from ultralytics import YOLO  # imported lazily: the API starts even without torch

        _device = resolve_device()
        _model = YOLO(str(path))
        log.info("Loaded detector %s on %s", path.name, _device)
    return _model


def detect(frame: np.ndarray, conf: float = 0.25, imgsz: int | None = None):
    """Run YOLO on one BGR frame.

    Returns a boxes object with numpy fields .xyxy .xywh .conf .cls — the exact
    shape Ultralytics' ByteTrack / BoT-SORT expect in their update() method.
    """
    model = get_model()
    result = model.predict(
        frame,
        conf=conf,
        imgsz=imgsz or settings.default_imgsz,
        device=_device,
        half=_device == "cuda",
        verbose=False,
    )[0]
    return result.boxes.cpu().numpy()
