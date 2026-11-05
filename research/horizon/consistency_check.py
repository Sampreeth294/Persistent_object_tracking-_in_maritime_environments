"""Can vessel boxes tell us when the detected horizon is wrong?

Cue 1 (violation): a vessel's bottom edge cannot sit above the sea horizon.
    Catches horizons detected TOO LOW.
Cue 2 (gap): on the true horizon, distant (small) vessels touch the line.
    A large empty gap below the line suggests it was detected TOO HIGH.

Uses SMD's ground-truth boxes (a best case). Re-run later with YOLO boxes.
    python3 consistency_check.py | tail -16
"""
import argparse

import cv2
import numpy as np

from _common import detect_horizon, gt_line, horizon_y_at, load_mat, video_names, video_path

ap = argparse.ArgumentParser()
ap.add_argument("--subset", default="VIS_Onshore")
ap.add_argument("--step", type=int, default=5)
ap.add_argument("--margin", type=float, default=5.0, help="px of tolerance above the line")
ap.add_argument("--small_box_px", type=float, default=60.0, help="boxes shorter than this count as distant")
args = ap.parse_args()

rows = []  # signed y error, violation fraction, support, gap
for name in video_names(args.subset):
    hgt = load_mat("HorizonGT", name, args.subset)
    try:
        ogt = load_mat("ObjectGT", name, args.subset)
    except FileNotFoundError:
        continue
    cap = cv2.VideoCapture(video_path(name, args.subset))
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok or idx >= min(len(hgt), len(ogt)):
            break
        if idx % args.step == 0:
            det = detect_horizon(frame)
            bb = np.atleast_2d(ogt[idx].BB) if np.size(ogt[idx].BB) else np.empty((0, 4))
            if det is not None and len(bb):
                w = frame.shape[1]
                gt_y, _ = gt_line(hgt[idx], w)
                cx = bb[:, 0] + bb[:, 2] / 2
                bottom = bb[:, 1] + bb[:, 3]
                line_y = horizon_y_at(det, cx, w)
                viol = float(np.mean(bottom < line_y - args.margin))
                below = bottom - line_y
                cand = below[(bb[:, 3] < args.small_box_px) & (below >= -args.margin)]
                gap = float(cand.min()) if len(cand) else np.nan
                rows.append((det["y_center"] - gt_y, viol, det["support"], gap))
        idx += 1
    cap.release()
    print(f"done {name}")

signed, viol, sup, gap = np.array(rows).T
good = np.abs(signed) < 10
too_low = signed > 30
too_high = signed < -30

print(f"\nFrames: {len(rows)} | good {good.sum()} | too low {too_low.sum()} | too high {too_high.sum()}")
print(f"Mean violation fraction  good: {viol[good].mean():.3f}  "
      f"too low: {viol[too_low].mean():.3f}  too high: {viol[too_high].mean():.3f}")

flag = viol > 0.10
print("\nRule: reject frame if more than 10% of boxes violate the line")
print(f"  catches {100 * flag[too_low].mean():.1f}% of too-low errors")
print(f"  catches {100 * flag[too_high].mean():.1f}% of too-high errors")
print(f"  wrongly rejects {100 * flag[good].mean():.1f}% of good frames")

print("\nGAP CUE (nearest small-box bottom below the line)")
for label, m in (("good", good), ("too high", too_high)):
    g = gap[m & ~np.isnan(gap)]
    med = f"{np.median(g):6.1f}" if len(g) else "   n/a"
    print(f"  {label:9s} frames with a small box: {len(g):4d} | median gap {med} px")
for t in (10, 15, 20, 30):
    flag2 = gap > t
    print(f"  Reject if gap > {t:2d} px: catches {100 * flag2[too_high].mean():5.1f}% of too-high, "
          f"wrongly rejects {100 * flag2[good].mean():5.1f}% of good")
