from fastapi import APIRouter

from app.core.config import settings
from app.database.mongo import ping
from app.vision.detector import resolve_device
from app.vision.trackers.factory import TRACKERS

router = APIRouter(tags=["system"])


@router.get("/health")
def health():
    return {
        "database": "connected" if ping() else "unreachable",
        "device": resolve_device(),
        "model_found": settings.model_path.exists(),
        "model_path": str(settings.model_path),
    }


@router.get("/trackers")
def trackers():
    return [{"name": k, "label": v} for k, v in TRACKERS.items()]
