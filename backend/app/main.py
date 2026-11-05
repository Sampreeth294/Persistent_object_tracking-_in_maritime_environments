"""FastAPI entry point.  Run:  uvicorn app.main:app --reload  (from the backend/ folder)."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, health, jobs, videos
from app.core.config import settings
from app.core.logging import setup_logging
from app.database.mongo import ensure_indexes, ping
from app.workers import runner

setup_logging()
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_dirs()
    if ping():
        ensure_indexes()
        runner.start()
        log.info("MongoDB connected, worker started")
    else:
        log.error("MongoDB unreachable at %s — start it: docker start maritime-mongodb", settings.mongo_uri)
    yield


app = FastAPI(title="Maritime Vessel Tracking API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (health.router, videos.router, jobs.router, analytics.router):
    app.include_router(r, prefix="/api")
