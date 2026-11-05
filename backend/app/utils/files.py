"""Serve video files with HTTP Range support, so the browser player can seek."""
import mimetypes
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse

CHUNK = 1024 * 1024


def range_file_response(path: Path, request: Request):
    if not path.exists():
        raise HTTPException(404, "File not found on disk")
    size = path.stat().st_size
    media = mimetypes.guess_type(path.name)[0] or "video/mp4"
    start, end = 0, size - 1

    header = request.headers.get("range")
    if header and header.startswith("bytes="):
        first, _, last = header[6:].partition("-")
        try:
            if first:
                start = int(first)
                end = int(last) if last else size - 1
            else:  # suffix range: last N bytes
                start = max(size - int(last), 0)
        except ValueError:
            raise HTTPException(416, "Bad range")
        end = min(end, size - 1)
        if start > end:
            raise HTTPException(416, "Range not satisfiable")

    def body():
        with path.open("rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                data = f.read(min(CHUNK, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {"Accept-Ranges": "bytes", "Content-Length": str(end - start + 1)}
    status = 200
    if header:
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        status = 206
    return StreamingResponse(body(), status_code=status, media_type=media, headers=headers)
