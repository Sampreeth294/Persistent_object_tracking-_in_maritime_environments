# Horizon detector — measured results

All numbers measured on the Singapore Maritime Dataset, VIS_Onshore, against `HorizonGT`.
Y error = distance between detected and true horizon height at the image centre (1920×1080 frames).

## Development video (MVI_1469_VIS, all 600 frames)

| Version | Method | Median Y error | Mean Y error | Frames < 10 px | Median angle error |
| --- | --- | --- | --- | --- | --- |
| v2 | Canny + Hough + grouping by height | 18.3 px | 18.0 px | 4.5% | 0.89° |
| v3 | Strongest vertical gradient per strip + robust fit | 9.3 px | 9.2 px | 58.7% | 1.42° |
| v4 | Top-3 gradient edges per strip + RANSAC | 4.6 px | 5.8 px | 92.7% | 1.21° |

Why v2 failed: the true sea line was a soft brightness drop (148 → 100 over ~8 px) that Canny
missed; it locked onto a crisper edge ~18 px higher. Why v3 → v4: a band of land/ships above the
sea line often has the strongest edge in a strip, but only the sea line is straight across the image.

## All VIS_Onshore videos (v4, every 5th frame, 37 videos, 3,457 frames)

- Median Y error **3.9 px**, mean 18.7 px (a minority of frames fail badly)
- **70.1%** of frames within 10 px
- Median angle error **0.16°**
- MVI_1469 was the development video; report the other 36 as the fair test.

## Confidence gating

| Signal | Good frames | Bad frames | Verdict |
| --- | --- | --- | --- |
| `support` (strips agreeing) | median 0.81 | median 0.66 (> 30 px error) | Weak: gate ≥ 0.7 only lifts good frames 70.1% → 73.8% |
| Vessel violation (box bottom above line), GT boxes | mean 1.3% | 55.4% when line too low | Strong for too-low errors |

Vessel-violation rule (reject if > 10% of boxes violate the line), GT boxes, 3,262 frames:
catches **100%** of too-low errors, **0%** of too-high errors (expected), wrongly rejects **6.2%** of good frames.

## Tracking runs (counts, not accuracy) — detector smd_v8s_videosplit, CPU

| Video | Camera | Tracker | Vessel IDs | Gaps | FPS |
| --- | --- | --- | --- | --- | --- |
| MVI_1469_VIS | onshore, fixed | ByteTrack | 21 | 111 | 3.74 |
| MVI_1469_VIS | onshore, fixed | BoT-SORT | 20 | 117 | 3.51 |
| MVI_1469_VIS | onshore, fixed | Horizon H-CMC v1 | 21 | 116 | 3.27 |
| MVI_1609_VIS | onshore, fixed | ByteTrack | 76 | ~264 | — |
| MVI_1609_VIS | onshore, fixed | BoT-SORT | 78 | ~270 | — |
| MVI_1609_VIS | onshore, fixed | **Horizon H-CMC v1** | **153** | **~742** | — |

**Finding: naive H-CMC (v1) doubled the vessel IDs on MVI_1609.**
Diagnosis from the stored per-frame horizons of that run:
- vertical horizon change per frame: median 0.3 px, p95 3.5 px, max 4.8 px (not the cause)
- tilt change per frame: median 0.019°, **p95 0.59°**, max 0.78° → worst-case shift at the image edge p95 **14 px**, > 5 px on 6.2% of frames
- the tilt estimate *flips* (line fit gains/loses a strip); a real camera cannot roll 0.6° in 40 ms and back
- distant vessels are 10–20 px tall, so a 14 px push breaks IoU matching → a new ID is started at once

**H-CMC v2** (implemented, to be measured): 5-frame median smoothing, dead-band (1 px / 0.05°), jump
rejection (> 25 px or > 0.3° per frame) with level reset after 5 persistent frames.
Unit tests: the measured jitter pattern produces no correction; a real 3 px/frame pitch is still followed.
v1 is reproducible for the ablation with `smooth_k=1, deadband_px=0, deadband_deg=0, max_dy_px=1e9, max_dtheta_deg=1e9`.

## Open items

- [ ] Re-run MVI_1609 with H-CMC v2 (expect ≈ ByteTrack/BoT-SORT on a fixed camera)
- [ ] Rank videos by camera motion (`rank_motion.py`); run all trackers on VIS_Onboard

- [ ] Gap cue for too-high errors (`consistency_check.py`, end section)
- [ ] Repeat the consistency check with YOLO detections instead of GT boxes
- [ ] Evaluate on VIS_Onboard (moving camera), where H-CMC should matter
- [ ] Verify whether SMD ObjectGT keeps object identity by list position (needed for IDF1/HOTA)
