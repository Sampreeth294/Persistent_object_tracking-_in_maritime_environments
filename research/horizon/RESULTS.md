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

## Open items

- [ ] Gap cue for too-high errors (`consistency_check.py`, end section)
- [ ] Repeat the consistency check with YOLO detections instead of GT boxes
- [ ] Evaluate on VIS_Onboard (moving camera), where H-CMC should matter
- [ ] Verify whether SMD ObjectGT keeps object identity by list position (needed for IDF1/HOTA)
