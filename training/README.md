# Training the vessel detector

The detector is YOLOv8s trained on the Singapore Maritime Dataset (SMD), with every vessel type merged into one class, `vessel`.
Training runs on **Google Colab (free T4 GPU)**. The dataset is **uploaded from your laptop**: no Google Drive mount.

## Why train again?

Tracking experiments run on whole videos. If any frame of a test video was used in training, the detector has effectively seen the answer and every tracking result is inflated.

`prepare_smd_yolo.py` fixes this by splitting **by video**. `splits.json` records which videos are reserved for testing; the tracking experiments use exactly those videos.

Your earlier model (`smd_yolov8s_vessel_fresh_best.pt`: P 0.775, R 0.702, mAP@50 0.732) stays useful for development. Its numbers can't be compared with the new run unless it used the same video-level split.

## Step 1: build the dataset (laptop)

The SMD folders must look like this:

```
data/smd/VIS_Onshore/Videos/MVI_1469_VIS.avi
data/smd/VIS_Onshore/ObjectGT/MVI_1469_VIS_ObjectGT.mat
```

Then run:

```bash
cd ~/Desktop/martime_tracking_system/training
python3 prepare_smd_yolo.py
# with the onboard videos too:
python3 prepare_smd_yolo.py --subsets VIS_Onshore VIS_Onboard
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--step` | 5 | keep every 5th frame (neighbouring frames are near duplicates) |
| `--width` | 1280 | resize frames, which keeps the zip small |
| `--seed` | 42 | fixed seed for the video split, so it's reproducible |
| `--val`, `--test` | 0.15, 0.15 | share of **videos** in each split |

What you get:
- `data/smd_yolo.zip`, which you upload to Colab. It's not committed to Git.
- `training/splits.json`, the video list per split. **Commit this file.**

**Label mapping:** `Ferry`, `Vessel/ship`, `Speed boat`, `Boat`, `Kayak`, `Sail boat` → `vessel`.
`Buoy`, `Swimming person`, `Flying bird/plane` and `Other` are dropped. Boxes are clipped to the image.

## Step 2: train (Colab)

1. Open [colab.research.google.com](https://colab.research.google.com), then **File → Upload notebook** → `training/train_colab.ipynb`.
2. **Runtime → Change runtime type → T4 GPU**.
3. Run the cells top to bottom. Cell 3 asks for `smd_yolo.zip`.
4. Cell 6 evaluates on the **test videos**. Those are the numbers you report.
5. Cell 7 downloads `results.zip`. Do this before closing the tab, because Colab's disk is wiped.

## Step 3: use the model (laptop)

```bash
cd ~/Desktop/martime_tracking_system
unzip ~/Downloads/results.zip -d training/runs/smd_v8s_videosplit
cp training/runs/smd_v8s_videosplit/weights/best.pt backend/models/best.pt
```

Commit `training/runs/<run>/results.csv`, `args.yaml` and `test_metrics.json`. Don't commit the `.pt` weights; they're too large for Git.

## Results

Fill this in from `test_metrics.json` and `args.yaml`. Only measured numbers go here.

| Run | Data | Split | imgsz | Epochs | Test P | Test R | Test mAP@50 | Test mAP@50–95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fresh_best (old) | SMD | unknown, check | 640? | ? | — | — | — | — |
| smd_v8s_videosplit | SMD VIS_Onshore | by video, seed 42 | 960 | | | | | |

The old model's reported validation numbers were P 0.775, R 0.702, mAP@50 0.732, mAP@50–95 0.385.
Those are validation numbers, not test numbers.
