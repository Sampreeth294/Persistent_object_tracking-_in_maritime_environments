# Horizon-Guided Maritime Vessel Tracking

Detect vessels in maritime video, give each one a persistent ID, and study whether the **sea horizon** can make multi-object tracking more reliable.

MCA project and research prototype: FastAPI, MongoDB, YOLOv8s and a React console.

![status](https://img.shields.io/badge/status-research%20prototype-F0A33A) ![python](https://img.shields.io/badge/python-3.10%2B-3DB489) ![react](https://img.shields.io/badge/react-18-48A0C4)

---

## What it does

1. Upload a maritime video. It's validated, its metadata extracted, and a thumbnail saved.
2. Start a **tracking run**: choose a detector setting and one of three trackers.
3. A background worker detects vessels frame by frame (YOLOv8s trained on the Singapore Maritime Dataset), associates them into tracks, and writes an annotated video.
4. Every detection, every vessel's history, and every gap and recovery is stored in MongoDB.
5. Explore the run in the web console:
   - annotated video;
   - **track ribbon**, one lane per vessel showing where it was tracked, lost and recovered;
   - per-vessel confidence history;
   - horizon gate trace.
6. Export tracks as CSV, JSON or MOTChallenge text, ready for HOTA, IDF1 and MOTA evaluation.

| Tracker | Role |
| --- | --- |
| `bytetrack` | Baseline: ByteTrack, motion and IoU only |
| `botsort` | Baseline: BoT-SORT with feature-point camera-motion compensation |
| `horizon` | **Proposed**: BoT-SORT whose camera-motion compensation comes from the horizon, with a confidence gate |

## The research idea

In shore and shipboard footage, the horizon is the one stable structure in the frame.

- **H-CMC (horizon camera-motion compensation).** When the camera pitches or rolls, the horizon shifts and tilts. We turn that change into the 2×3 warp that corrects the tracker's Kalman predictions. BoT-SORT normally estimates this warp by matching feature points, which sit on moving waves at sea.
- **Confidence gate.** The horizon is used only when it can be trusted: enough image strips agree on the line, and **no detected vessel sits above it** (a ship can't float in the sky). Otherwise the tracker falls back to no compensation.
- **H-Depth cue (stored, next step).** How far a vessel's box sits below the horizon is a rough distance cue. It's saved for every detection, to be used for scale-aware association.

Camera-motion compensation, ReID-based recovery and adaptive tracking already exist for maritime MOT, and this project doesn't claim them. The candidate gap is **using an image-detected horizon inside the tracker's motion compensation and association, gated by vessel–horizon consistency**. The literature review must confirm that before any novelty claim.

### Measured so far (horizon detector, SMD VIS_Onshore)

| Metric | Value |
| --- | --- |
| Median horizon-height error | **3.9 px** (1080-px frames) |
| Frames within 10 px | **70.1%** |
| Median angle error | **0.16°** |
| Vessel-violation gate: too-low horizons caught | **100%** (ground-truth boxes) |
| Vessel-violation gate: good frames wrongly rejected | **6.2%** |

The full history, failures included, is in [`research/horizon/RESULTS.md`](research/horizon/RESULTS.md).
**Tracking accuracy (HOTA, IDF1, MOTA) has not been measured yet.** That's the next milestone.

## Architecture

```
React console ──► FastAPI routers ──► services ──► repositories ──► MongoDB
                                          │
                                          └─► job worker (1 thread)
                                                YOLOv8s ─► tracker plug-in ─► annotate ─► H.264 video
                                                              ├─ bytetrack
                                                              ├─ botsort
                                                              └─ horizon  (H-CMC + gate)
```

- **Layer rule:** routers only call services; only repositories touch MongoDB.
- **Tracker plug-ins:** every tracker gets the same detections and returns the same output, so comparisons are fair.
- **One job at a time:** a 4 GB GPU can't run two YOLO jobs well. The API stays responsive meanwhile.

**MongoDB collections:**

| Collection | One document per | Purpose |
| --- | --- | --- |
| `videos` | uploaded video | metadata and file path |
| `tracking_jobs` | run | status, progress, configuration, statistics, timing |
| `frame_detections` | frame of a run | tracked boxes, horizon, gate state |
| `vessel_tracks` | vessel ID in a run | first and last frame, gaps, recoveries, confidence and box history |
| `experiments`, `evaluation_results` | (reserved) | evaluation module |

## Project structure

```
backend/      FastAPI app (app/), tests, requirements
  app/vision/        horizon.py, detector.py, annotate.py, trackers/
  app/workers/       background job runner
research/     horizon experiments + measured results
training/     SMD → YOLO dataset builder, Colab notebook, training guide
frontend/     React + TypeScript + Vite + Tailwind console
data/         SMD dataset (not in Git)
docs/         commit guide
```

## Setup (Ubuntu)

### 1. MongoDB

```bash
docker start maritime-mongodb || docker run -d --name maritime-mongodb -p 27017:27017 mongo:7
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
# CPU-only PyTorch avoids downloading large NVIDIA CUDA packages.
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python -c "import torch; print(torch.__version__, 'CUDA:', torch.cuda.is_available())"
cp .env.example .env
cp ~/Downloads/smd_yolov8s_vessel_fresh_best.pt models/best.pt   # or your newly trained best.pt
sudo apt install -y ffmpeg        # so annotated videos play in the browser
uvicorn app.main:app --reload
```

For GPU inference, install the PyTorch build matching your CUDA setup instead of the CPU-only command above, then install `requirements.txt`.

Then open http://localhost:8000/docs for the interactive API and http://localhost:8000/api/health for a status check.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server forwards `/api` to the backend.

### 4. Tests

```bash
cd backend && python -m pytest -q
```

The tests use an in-memory MongoDB, so they need neither Docker nor a GPU.

## Research scripts

The SMD data must be in `data/smd/VIS_Onshore/` (`Videos/`, `HorizonGT/`, `ObjectGT/`).

```bash
cd research/horizon
python3 horizon.py frame.jpg              # one image
python3 evaluate_all.py | tee results.txt # all videos vs ground truth
python3 consistency_check.py | tail -16   # vessel–horizon gate analysis
```

They import the same detector the backend uses (`backend/app/vision/horizon.py`), so the research numbers describe the running system.

## Training

See [`training/README.md`](training/README.md):
- the dataset is built on the laptop with a **video-level split**;
- training runs on Colab without a Drive mount;
- results are downloaded back to the laptop.

## Roadmap

- [x] Upload, background jobs, three trackers, track storage, exports, console
- [x] Horizon detector v4 measured on SMD; vessel-violation gate validated with ground-truth boxes
- [ ] Retrain detector on a video-level split, then report test-split metrics
- [ ] Evaluation module: SMD ground truth → MOT format → TrackEval (HOTA, IDF1, MOTA, ID switches)
- [ ] Baselines vs H-CMC on VIS_Onboard (moving camera) and VIS_Onshore
- [ ] H-Depth scale-aware association + ablation
- [ ] Research paper

## Acknowledgements

- Singapore Maritime Dataset: D. K. Prasad et al., "Video Processing from Electro-optical Sensors for Object Detection and Tracking in Maritime Environment: A Survey", *IEEE T-ITS*, 2017.
- [Ultralytics](https://github.com/ultralytics/ultralytics) YOLOv8, ByteTrack and BoT-SORT implementations.
