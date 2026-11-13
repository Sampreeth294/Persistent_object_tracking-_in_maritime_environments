# Update 02: vessel photos, live view, counting, compare page, H-CMC v2

## 1. Copy the files in

```bash
cd ~/Desktop/martime_tracking_system
git status                                   # commit or stash anything of yours first
unzip -o ~/Downloads/update_02.zip -d /tmp/update_02
cp -r /tmp/update_02/martime_tracking_system/. .
git status                                   # you should see only the files listed below
```

The zip contains only changed and new files. It doesn't touch `README.md`, `training/` or your data.

## 2. Check that it works

```bash
cd backend && source .venv/bin/activate && python -m pytest -q && cd ..
cd frontend && npm run build && cd ..
```

You should see `14 passed` and `✓ built`. Restart `uvicorn` and `npm run dev` afterwards.

## 3. Commit, in this order

**1. Vessel photos and live frame**
```bash
git add backend/app/vision/gallery.py backend/app/workers/runner.py
git commit -m "feat(backend): save best photo of each vessel, live preview frame and vessel-count stats"
```

**2. New API endpoints**
```bash
git add backend/app/api/jobs.py backend/app/api/compare.py backend/app/main.py backend/app/services/analytics_service.py
git commit -m "feat(api): live frame, vessel photo, per-frame counts and tracker comparison endpoints"
```

**3. H-CMC v2 (the research fix)**
```bash
git add backend/app/vision/trackers/horizon_tracker.py backend/tests/test_hcmc.py
git commit -m "fix(tracking): H-CMC v2 — smoothing, dead-band and jump rejection (v1 doubled IDs on MVI_1609)"
```

**4. Pipeline test**
```bash
git add backend/tests/test_pipeline.py
git commit -m "test(backend): end-to-end worker test with fake detector"
```

**5. Research notes**
```bash
git add research/horizon/rank_motion.py research/horizon/RESULTS.md
git commit -m "research: rank videos by camera motion; log naive H-CMC failure and diagnosis"
```

**6. Frontend: counting, gallery, live view**
```bash
git add frontend/src/lib/api.ts frontend/src/components/Charts.tsx frontend/src/components/VesselGallery.tsx \
        frontend/src/pages/JobWorkspace.tsx frontend/src/pages/Overview.tsx
git commit -m "feat(frontend): live view, vessel photo gallery and vessels-over-time chart"
```

**7. Frontend: compare page**
```bash
git add frontend/src/pages/Compare.tsx frontend/src/components/Shell.tsx frontend/src/main.tsx frontend/src/pages/Videos.tsx
git commit -m "feat(frontend): tracker comparison page"
```

**8. This guide**
```bash
git add docs/UPDATE_02.md
git commit -m "docs: update 02 guide"
git push
```

## 4. The experiment to run next

The old runs were made with H-CMC v1. Re-run **MVI_1609_VIS** with `horizon` (now v2), with exactly the same settings as before, then open **Compare**.

**Expected:** on a fixed camera, v2 should land close to ByteTrack and BoT-SORT (about 76–78 IDs), because there's no real motion to correct.

- If it does, the fix worked. Record the numbers in `research/horizon/RESULTS.md`.
- If it doesn't, send me the run's numbers.

**Note:** photos, live view and the count chart appear only for **new** runs. Older runs didn't save them.
