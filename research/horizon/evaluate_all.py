"""Horizon accuracy on every SMD video that has horizon ground truth.

    python3 evaluate_all.py                      # VIS_Onshore, every 5th frame
    python3 evaluate_all.py --subset VIS_Onboard
    python3 evaluate_all.py | tee results_onshore.txt

Prints per-video error, overall error, and whether `support` predicts errors.
"""
import argparse

import cv2
import numpy as np

from _common import detect_horizon, gt_line, load_mat, video_names, video_path

ap = argparse.ArgumentParser()
ap.add_argument("--subset", default="VIS_Onshore")
ap.add_argument("--step", type=int, default=5, help="evaluate every Nth frame")
args = ap.parse_args()

all_y, all_a, all_s = [], [], []
print(f"{'video':24s} {'frames':>6s} {'found%':>7s} {'medY':>6s} {'<10px%':>7s} {'medAng':>7s}")
for name in video_names(args.subset):
    gt = load_mat("HorizonGT", name, args.subset)
    cap = cv2.VideoCapture(video_path(name, args.subset))
    y_err, a_err, total, idx = [], [], 0, 0
    while True:
        ok, frame = cap.read()
        if not ok or idx >= len(gt):
            break
        if idx % args.step == 0:
            total += 1
            gt_y, gt_a = gt_line(gt[idx], frame.shape[1])
            det = detect_horizon(frame)
            if det is not None:
                e = abs(det["y_center"] - gt_y)
                y_err.append(e)
                a_err.append(abs(det["angle_deg"] - gt_a))
                all_s.append((e, det["support"]))
        idx += 1
    cap.release()
    if not total:
        continue
    ye, ae = np.array(y_err), np.array(a_err)
    all_y += y_err
    all_a += a_err
    found = 100 * len(ye) / total
    if len(ye):
        print(f"{name:24s} {total:6d} {found:6.1f}% {np.median(ye):6.1f} "
              f"{100 * (ye < 10).mean():6.1f}% {np.median(ae):7.2f}")
    else:
        print(f"{name:24s} {total:6d} {found:6.1f}%   (no detections)")

all_y, all_a = np.array(all_y), np.array(all_a)
print("\nALL VIDEOS")
print(f"  Frames with detection: {len(all_y)}")
print(f"  Median Y error: {np.median(all_y):.1f} px | mean {all_y.mean():.1f} px")
print(f"  Frames with Y error < 10 px: {100 * (all_y < 10).mean():.1f}%")
print(f"  Median angle error: {np.median(all_a):.2f} deg")

err, sup = np.array(all_s).T
print("\nSUPPORT vs ERROR")
print(f"  Good frames (error < 10 px): median support {np.median(sup[err < 10]):.2f}")
print(f"  Bad frames  (error > 30 px): median support {np.median(sup[err > 30]):.2f}")
for t in (0.3, 0.4, 0.5, 0.6, 0.7):
    keep = sup >= t
    print(f"  Gate support >= {t:.1f}: keeps {100 * keep.mean():5.1f}% of frames, "
          f"of which {100 * (err[keep] < 10).mean():5.1f}% are good")
