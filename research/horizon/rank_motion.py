"""Rank SMD videos by camera motion, measured from the ground-truth horizon.

Big frame-to-frame horizon movement = the camera pitches/rolls = where H-CMC should help.
    SMD_DIR=~/Downloads python3 rank_motion.py
    SMD_DIR=~/Downloads python3 rank_motion.py --subset VIS_Onboard
"""
import argparse
import json

import numpy as np

from _common import ROOT, load_mat, video_names

ap = argparse.ArgumentParser()
ap.add_argument("--subset", default="VIS_Onshore")
args = ap.parse_args()

# Which videos the detector trained on (testing on those would be unfair)
split_of = {}
splits_file = ROOT / "training" / "splits.json"
if splits_file.exists():
    for split, names in json.loads(splits_file.read_text())["splits"].items():
        for n in names:
            split_of[n] = split

rows = []
for name in video_names(args.subset):
    gt = load_mat("HorizonGT", name, args.subset)
    y = np.array([g.Y + (-g.Nx / g.Ny) * (960 - g.X) for g in gt])        # horizon height at centre
    ang = np.degrees(np.arctan(np.array([-g.Nx / g.Ny for g in gt])))     # horizon tilt
    dy = np.abs(np.diff(y))
    rows.append((name, np.mean(dy), np.percentile(dy, 95), y.max() - y.min(), ang.max() - ang.min(),
                 split_of.get(name, "?")))

rows.sort(key=lambda r: r[1], reverse=True)
print(f"{'video':24s} {'mean|dy|':>9s} {'p95|dy|':>8s} {'y range':>8s} {'tilt rng':>9s}  split")
for r in rows:
    print(f"{r[0]:24s} {r[1]:8.2f}px {r[2]:7.1f}px {r[3]:7.0f}px {r[4]:8.2f}°  {r[5]}")
