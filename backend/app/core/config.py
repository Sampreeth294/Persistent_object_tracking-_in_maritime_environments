"""Application settings, read once from environment variables (or backend/.env)."""
import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _load_dotenv() -> None:
    """Tiny .env loader: KEY=value lines, no extra dependency needed."""
    env_file = BACKEND_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()


def _path(env: str, default: Path) -> Path:
    """Relative paths in .env are relative to the backend/ folder."""
    p = Path(os.getenv(env, str(default)))
    return p if p.is_absolute() else BACKEND_DIR / p


@dataclass(frozen=True)
class Settings:
    mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    mongo_db: str = os.getenv("MONGO_DB", "maritime_tracking")

    model_path: Path = _path("MODEL_PATH", BACKEND_DIR / "models" / "best.pt")
    device: str = os.getenv("DEVICE", "auto")          # auto | cpu | cuda
    default_imgsz: int = int(os.getenv("IMGSZ", "960"))

    storage_dir: Path = _path("STORAGE_DIR", BACKEND_DIR / "storage")
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "2048"))
    allowed_extensions: tuple = (".mp4", ".avi", ".mov", ".mkv")

    cors_origins: list = field(
        default_factory=lambda: os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
    )

    @property
    def videos_dir(self) -> Path:
        return self.storage_dir / "videos"

    @property
    def outputs_dir(self) -> Path:
        return self.storage_dir / "outputs"

    @property
    def thumbs_dir(self) -> Path:
        return self.storage_dir / "thumbnails"

    def ensure_dirs(self) -> None:
        for d in (self.videos_dir, self.outputs_dir, self.thumbs_dir):
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
