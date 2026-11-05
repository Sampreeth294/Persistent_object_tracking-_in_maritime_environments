from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException


def now() -> datetime:
    return datetime.now(timezone.utc)


def to_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid id: {value}")
    return ObjectId(value)


def serialize(doc: dict | None) -> dict | None:
    """Mongo document -> JSON-friendly dict ('_id' becomes 'id', ObjectIds become strings)."""
    if doc is None:
        return None
    out = {}
    for key, value in doc.items():
        if key == "_id":
            out["id"] = str(value)
        elif isinstance(value, ObjectId):
            out[key] = str(value)
        else:
            out[key] = value
    return out
