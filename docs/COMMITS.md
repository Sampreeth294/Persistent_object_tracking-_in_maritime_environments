# Pushing to GitHub, one commit at a time

18 small commits, in an order that tells the story of the project. Each message says **what** changed, so the GitHub history reads like a build log.

Before each commit, open the files it adds and make sure you can explain them. That is the point of committing one by one.

---

## Step 0: put the files in your project folder (once)

Your folder already has `data/smd` (dataset) and `research/horizon` (your experiments).

**1. Back up your old backend**, if you have one. It goes outside the project, so nothing is lost:

```bash
cd ~/Desktop/martime_tracking_system
[ -d backend ] && mv backend ~/Desktop/backend_old_backup
```

**2. Unzip the new project next to it and copy it in.** `data/` is untouched:

```bash
cd ~/Desktop
unzip ~/Downloads/martime_tracking_system.zip -d /tmp/mts_new
cp -r /tmp/mts_new/martime_tracking_system/. ~/Desktop/martime_tracking_system/
cd ~/Desktop/martime_tracking_system
ls
```

You should see: `backend data docs frontend research training README.md .gitignore`.

**3. Your old research scripts.** `debug_horizon.py`, `debug_groups.py`, `debug_strips.py`, `profile.py`, `inspect_gt.py` and `evaluate_horizon.py` in `research/horizon/` were one-off debugging steps.
- Option A: keep them in an `archive/` subfolder. They show how v2 → v4 developed, which is useful at the viva.

  ```bash
  mkdir -p research/horizon/archive
  mv research/horizon/{debug_horizon,debug_groups,debug_strips,profile,inspect_gt,evaluate_horizon}.py research/horizon/archive/ 2>/dev/null
  ```

- Option B: delete them.

The `.venv` inside `research/horizon` is ignored by Git. You can delete it later and use `backend/.venv` for everything.

## Step 1: Git and GitHub setup (once)

```bash
cd ~/Desktop/martime_tracking_system
git init
git config user.name  "Your Name"
git config user.email "you@example.com"     # the email on your GitHub account
git branch -M main
git status                                   # data/, .venv, *.pt must NOT appear
```

On github.com: **New repository** → name `maritime-vessel-tracking` → **Private** (you can make it public after the viva). **Don't** tick "Add a README", because we have one.

## Step 2: the commits

Run each block, then `git log --oneline` to see the history grow.

**1. Project basics**
```bash
git add .gitignore README.md
git commit -m "chore: add project README and .gitignore"
```

**2. Backend configuration and database**
```bash
git add backend/requirements.txt backend/.env.example backend/models/.gitkeep backend/storage/.gitkeep \
        backend/app/__init__.py backend/app/core backend/app/database \
        backend/app/utils/__init__.py backend/app/utils/ids.py
git commit -m "feat(backend): settings, logging and MongoDB connection"
```

**3. Horizon detector (the core of the research)**
```bash
git add backend/app/vision/__init__.py backend/app/vision/horizon.py
git commit -m "feat(vision): horizon detector v4 (gradient strips + RANSAC) and vessel-horizon consistency check"
```

**4. Research scripts and measured results**
```bash
git add research/horizon/_common.py research/horizon/horizon.py research/horizon/evaluate_all.py \
        research/horizon/consistency_check.py research/horizon/RESULTS.md
[ -d research/horizon/archive ] && git add research/horizon/archive     # only if you kept option A
git commit -m "research: horizon evaluation on SMD — 3.9 px median error, vessel gate catches all too-low lines"
```

**5. Detector and annotation**
```bash
git add backend/app/vision/detector.py backend/app/vision/annotate.py
git commit -m "feat(vision): YOLOv8 detector wrapper and frame annotator"
```

**6. Tracker plug-ins and baselines**
```bash
git add backend/app/vision/trackers/__init__.py backend/app/vision/trackers/base.py \
        backend/app/vision/trackers/factory.py backend/app/vision/trackers/ultralytics_trackers.py
git commit -m "feat(tracking): tracker plug-in interface with ByteTrack and BoT-SORT baselines"
```

**7. The proposed tracker**
```bash
git add backend/app/vision/trackers/horizon_tracker.py
git commit -m "feat(tracking): horizon-guided BoT-SORT (H-CMC) with confidence gate"
```

**8. Data access and track summaries**
```bash
git add backend/app/repositories backend/app/services/__init__.py backend/app/services/track_builder.py
git commit -m "feat(backend): repositories and per-vessel track summary builder (gaps, recoveries)"
```

**9. Background worker**
```bash
git add backend/app/workers
git commit -m "feat(backend): background job worker with progress, cancel and H.264 output"
```

**10. Services**
```bash
git add backend/app/schemas backend/app/services/video_service.py backend/app/services/job_service.py \
        backend/app/services/export_service.py backend/app/services/analytics_service.py \
        backend/app/utils/video_meta.py backend/app/utils/files.py
git commit -m "feat(backend): video upload, jobs, CSV/JSON/MOT export and analytics services"
```

**11. API and app entry point**
```bash
git add backend/app/api backend/app/main.py
git commit -m "feat(api): REST endpoints for videos, jobs, tracks, exports and health"
```

Check it runs before going on: `cd backend && uvicorn app.main:app --reload`, open http://localhost:8000/docs, then `cd ..`.

**12. Tests**
```bash
git add backend/tests
git commit -m "test(backend): horizon, track builder and API tests (in-memory MongoDB)"
```

**13. Dataset builder**
```bash
git add training/prepare_smd_yolo.py training/README.md
git commit -m "feat(training): SMD to YOLO dataset builder with video-level split"
```

**14. Colab notebook**
```bash
git add training/train_colab.ipynb
git commit -m "feat(training): Colab notebook — upload from laptop, no Drive mount"
```

**15. Frontend setup and theme**
```bash
git add frontend/package.json frontend/package-lock.json frontend/index.html frontend/vite.config.ts \
        frontend/tsconfig.json frontend/tailwind.config.js frontend/postcss.config.js \
        frontend/public frontend/src/index.css
git commit -m "feat(frontend): Vite + React + Tailwind setup with bridge-console theme"
```

**16. API client and components**
```bash
git add frontend/src/lib frontend/src/components
git commit -m "feat(frontend): typed API client, track ribbon, charts and shared components"
```

**17. Pages**
```bash
git add frontend/src/pages frontend/src/main.tsx
git commit -m "feat(frontend): overview, videos, runs and run workspace pages"
```

Check it runs: `cd frontend && npm install && npm run dev`, then `cd ..`.

**18. This guide**
```bash
git add docs/COMMITS.md
git commit -m "docs: add step-by-step commit guide"
```

Finally, confirm nothing was missed. This should print `nothing to commit, working tree clean`:

```bash
git status
```

## Step 3: push

```bash
git remote add origin https://github.com/<your-username>/maritime-vessel-tracking.git
git push -u origin main
```

GitHub no longer accepts your account password here. When asked for the password, paste a **personal access token**:
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → access to this repo with **Contents: Read and write**.

## Later commits

From now on, commit each small working change as you go:

```bash
git add <files>
git commit -m "feat(tracking): ..."
git push
```

Commit message prefixes:

| Prefix | Use for |
| --- | --- |
| `feat:` | new feature |
| `fix:` | bug fix |
| `research:` | experiment or result |
| `test:` | tests |
| `docs:` | documentation |
| `chore:` | setup or cleanup |
