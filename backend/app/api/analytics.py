from fastapi import APIRouter

from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def summary():
    return analytics_service.summary()
