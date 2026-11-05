"""Build a YOLO-format vessel dataset from the Singapore Maritime Dataset — run on your LAPTOP.

    cd training
    python3 prepare_smd_yolo.py                       # VIS_Onshore only
    python3 prepare_smd_yolo.py --subsets VIS_Onshore VIS_Onboard

What it does:
  1. Splits by VIDEO (never by frame) into train / val / test, with a fixed seed.
     Adjacent frames are near-identical; a frame-level split leaks test data into training.
  2. Takes every Nth frame (default 5) — neighbours add size, not information.
  3. Converts SMD ObjectGT boxes to YOLO labels, one class: 0 = vessel.
  4. Resizes frames to --width (default 1280) to keep the upload small.
  5. Writes splits.json (which video went where) and zips everything to smd_yolo.zip.

Output: data/smd_yolo/ and data/smd_yolo.zip  (upload the zip to Colab).
"""
import argparse
import json
import random
import shutil
from pathlib import Path

import cv2
import numpy as np
from scipy.io import loadmat

ROOT = Path(__file__).resolve().parents[1]

# SMD object types merged into one 'vessel' class. Others (buoy, swimmer, bird, other) are not vessels.
VESSEL_TYPES = {"Ferry", "Vessel/ship", "Speed boat", "Boat", "Kayak", "Sail boat"}


def load_object_gt(path: Path):
    return loadmat(str(path), squeeze_me=True, struct_as_record=False)["structXML"]


def frame_boxes(entry) -> list[tuple[float, float, float, float]]:
    """Vessel boxes for one frame as (x, y, w, h), top-left corner + size, in original pixels."""
    if not np.size(entry.BB):
        return []
    bb = np.atleast_2d(entry.BB).astype(float)
    types = [str(t).strip() for t in np.atleast_1d(entry.ObjectType)]
    return [tuple(b) for b, t in zip(bb, types) if t in VESSEL_TYPES]


def to_yolo(box, scale, img_w, img_h):
    """(x, y, w, h) in original pixels -> 'cx cy w h' normalised, clipped to the resized image."""
    x1, y1 = box[0] * scale, box[1] * scale
    x2, y2 = (box[0] + box[2]) * scale, (box[1] + box[3]) * scale
    x1, x2 = max(0.0, x1), min(float(img_w), x2)
    y1, y2 = max(0.0, y1), min(float(img_h), y2)
    if x2 - x1 < 2 or y2 - y1 < 2:      # box fully outside or tiny after clipping
        return None
    return f"0 {(x1 + x2) / 2 / img_w:.6f} {(y1 + y2) / 2 / img_h:.6f} {(x2 - x1) / img_w:.6f} {(y2 - y1) / img_h:.6f}"


def split_videos(names, seed, val_frac, test_frac):
    names = sorted(names)
    random.Random(seed).shuffle(names)
    n_test = max(1, round(len(names) * test_frac))
    n_val = max(1, round(len(names) * val_frac))
    return {"test": sorted(names[:n_test]),
            "val": sorted(names[n_test:n_test + n_val]),
            "train": sorted(names[n_test + n_val:])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--smd", default=str(ROOT / "data" / "smd"))
    ap.add_argument("--out", default=str(ROOT / "data" / "smd_yolo"))
    ap.add_argument("--subsets", nargs="+", default=["VIS_Onshore"])
    ap.add_argument("--step", type=int, default=5, help="keep every Nth frame")
    ap.add_argument("--width", type=int, default=1280, help="resize frames to this width")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--val", type=float, default=0.15)
    ap.add_argument("--test", type=float, default=0.15)
    args = ap.parse_args()

    smd, out = Path(args.smd), Path(args.out)
    if out.exists():
        shutil.rmtree(out)

    # 1. Find videos that have object ground truth, per subset
    videos = {}
    for subset in args.subsets:
        for gt in sorted((smd / subset / "ObjectGT").glob("*_ObjectGT.mat")):
            name = gt.name.replace("_ObjectGT.mat", "")
            video = smd / subset / "Videos" / f"{name}.avi"
            if video.exists():
                videos[name] = (video, gt, subset)
    if not videos:
        raise SystemExit(f"No videos with ObjectGT found under {smd}. Check --smd and --subsets.")

    # 2. Split by video, separately per subset so each split gets both camera types
    splits = {"train": [], "val": [], "test": []}
    for subset in args.subsets:
        names = [n for n, v in videos.items() if v[2] == subset]
        for k, v in split_videos(names, args.seed, args.val, args.test).items():
            splits[k] += v

    stats = {k: {"videos": len(v), "images": 0, "boxes": 0, "empty": 0} for k, v in splits.items()}
    for split, names in splits.items():
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)
        for name in names:
            video, gt_path, _ = videos[name]
            gt = load_object_gt(gt_path)
            cap = cv2.VideoCapture(str(video))
            idx = 0
            while idx < len(gt):
                ok, frame = cap.read()
                if not ok:
                    break
                if idx % args.step == 0:
                    h, w = frame.shape[:2]
                    scale = args.width / w
                    img = cv2.resize(frame, (args.width, round(h * scale)))
                    ih, iw = img.shape[:2]
                    lines = [l for b in frame_boxes(gt[idx]) if (l := to_yolo(b, scale, iw, ih))]
                    stem = f"{name}_{idx:05d}"
                    cv2.imwrite(str(out / "images" / split / f"{stem}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 92])
                    (out / "labels" / split / f"{stem}.txt").write_text("\n".join(lines) + ("\n" if lines else ""))
                    stats[split]["images"] += 1
                    stats[split]["boxes"] += len(lines)
                    stats[split]["empty"] += int(not lines)
                idx += 1
            cap.release()
            print(f"  {split:5s} {name}: done")

    (out / "data.yaml").write_text(
        "# Paths are rewritten by the Colab notebook\n"
        "path: .\ntrain: images/train\nval: images/val\ntest: images/test\n"
        "names:\n  0: vessel\n"
    )
    meta = {"seed": args.seed, "step": args.step, "width": args.width, "subsets": args.subsets,
            "vessel_types": sorted(VESSEL_TYPES), "splits": splits, "stats": stats}
    (out / "splits.json").write_text(json.dumps(meta, indent=2))
    shutil.copy(out / "splits.json", Path(__file__).parent / "splits.json")

    print("\nSplit summary (by video):")
    for k, s in stats.items():
        print(f"  {k:5s} videos {s['videos']:3d} | images {s['images']:5d} | boxes {s['boxes']:6d} | empty {s['empty']}")

    zip_path = shutil.make_archive(str(out), "zip", root_dir=out.parent, base_dir=out.name)
    size_mb = Path(zip_path).stat().st_size / 1e6
    print(f"\nZipped -> {zip_path} ({size_mb:.0f} MB). Upload this file to Colab.")
    print("training/splits.json updated: commit it, so everyone knows the test videos.")


if __name__ == "__main__":
    main()
