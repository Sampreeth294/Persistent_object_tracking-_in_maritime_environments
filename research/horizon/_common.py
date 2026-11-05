"""Shared helpers for the horizon research scripts.

The detector itself lives in backend/app/vision/horizon.py so the research
numbers and the running system always use exactly the same code.
"""
import glob
import math
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from scipy.io import loadmat  # noqa: E402

from app.vision.horizon import detect_horizon, horizon_y_at, violation_fraction  # noqa: E402,F401

SMD = Path(os.getenv("SMD_DIR", ROOT / "data" / "smd"))


def load_mat(kind: str, name: str, subset: str = "VIS_Onshore"):
    """kind = 'HorizonGT' or 'ObjectGT'. Returns one entry per frame."""
    path = SMD / subset / kind / f"{name}_{kind}.mat"
    return loadmat(str(path), squeeze_me=True, struct_as_record=False)["structXML"]


def gt_line(g, width: int):
    """True horizon height at the image centre and its angle (degrees).

    SMD stores a point (X, Y) on the line and the line's normal (Nx, Ny):
    slope = -Nx / Ny.
    """
    slope = -g.Nx / g.Ny
    y_center = g.Y + slope * (width / 2 - g.X)
    return y_center, math.degrees(math.atan(slope))


def video_names(subset: str = "VIS_Onshore") -> list[str]:
    names = []
    for p in sorted(glob.glob(str(SMD / subset / "HorizonGT" / "*_HorizonGT.mat"))):
        name = os.path.basename(p).replace("_HorizonGT.mat", "")
        if (SMD / subset / "Videos" / f"{name}.avi").exists():
            names.append(name)
    return names


def video_path(name: str, subset: str = "VIS_Onshore") -> str:
    return str(SMD / subset / "Videos" / f"{name}.avi")
