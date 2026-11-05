from pydantic import BaseModel, Field


class JobConfig(BaseModel):
    conf: float = Field(0.25, ge=0.01, le=0.95, description="Detector confidence threshold")
    imgsz: int = Field(960, ge=320, le=1920, description="YOLO input size (multiple of 32)")
    max_frames: int | None = Field(None, ge=1, description="Process only the first N frames")
    tracker_params: dict = Field(default_factory=dict, description="Overrides, e.g. {'track_buffer': 60}")


class JobCreate(BaseModel):
    video_id: str
    tracker: str = "bytetrack"
    config: JobConfig = Field(default_factory=JobConfig)
