# Character LoRA One‑Click (MVP)

A concise, hands-on guide for running the stack with Docker on Windows, configuring `.env`, using the launch script, mounting models and `kohya_ss`, and keeping heavyweight dependencies cached.

## What the app does

- **Purpose:** a simplified “one-click” pipeline that trains a character LoRA from your reference images.
- **Features:**
  - Accepts 8+ images, a character name, trigger token, base model, and training parameters.
  - Prepares the dataset (layout/captions) and runs kohya_ss (`accelerate launch train_network.py`).
  - Streams logs, tracks job status, and saves the resulting `.safetensors` artifact.
- **Architecture:**
  - Backend (FastAPI): `/train`, `/jobs/{id}/status`, and kohya_ss integration.
  - Frontend (React + Vite): upload UI, parameter inputs, and status panel.
  - Data locations: `backend/data/jobs/<id>` and `backend/artifacts/ed_lora`.
- **Notes & limitations:**
  - Default settings are CPU-friendly; for GPU training use the base image with CUDA Torch wheels (see below).
  - Base models are not bundled—configure their path via `.env` (`HOST_MODELS_DIR`).
  - The `kohya_ss` repo is mounted from the host so you control its revision.

## Quick start (Windows + Docker)

Docker Desktop is required. Ensure the drive with the project is shared in Docker Desktop: Settings → Resources → File Sharing.

1. Point `.env` to your models directory (Easy Diffusion example):

```
HOST_MODELS_DIR=C:/EasyDiffusion/models/stable-diffusion
```

2. Launch the stack from the repo root (PowerShell):

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\up.ps1
```

The script will:
- build the `charactertrainer-backend-base` image once with a pinned `torch` (defaults to 2.9.0),
- run `docker compose up -d --build`,
- print container status.

3. Open:
- UI: http://localhost:5173
- Backend check: `POST http://localhost:8000/config/test`

## Environment variables (.env)

- `BASE_IMAGE=charactertrainer-backend-base` — backend base image (stores heavy deps so rebuilds stay fast).
- `HOST_MODELS_DIR=...` — host path with your models; mounted into the container as `/srv/models/external`.

If `HOST_MODELS_DIR` is omitted, the project falls back to `./backend/models/external`.

## Launch script (`scripts/up.ps1`)

CPU launch:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\up.ps1
```

Parameters:
- `-CudaIndexUrl <url>` — build the base image with CUDA Torch wheels (e.g. `https://download.pytorch.org/whl/cu124`).
- `-RebuildBase` — force a rebuild of the base image.

The script keeps `.env` in sync with `BASE_IMAGE`, rebuilds the base image when needed, and brings up the stack.

## Models and kohya_ss

- Models should be available in the container under `/srv/models/...` or `/srv/models/external/...`.
  - Example: `backend/config.yaml` expects `dreamshaper_8: "/srv/models/external/dreamshaper_8.safetensors"`.
  - If your filename differs, adjust the config key or rename the file.
- `kohya_ss` is mounted at `/opt/kohya_ss` (see `docker-compose.yml`).
  - If the folder is missing, clone it: `git clone https://github.com/kohya-ss/sd-scripts.git kohya_ss`.
  - Errors referencing `/opt/...` are expected—containers run Linux paths.

## Cache and large dependencies

- Torch and other heavy deps live in the `charactertrainer-backend-base` image. Regular rebuilds skip re-downloading ~900 MB.
- Build uses pip cache; the HuggingFace cache is mounted via the `hf_cache` volume and persists between runs.
- Avoid `--no-cache` or `docker system prune -a` unless necessary—they wipe cached layers/images.

## Common commands

- Build/bring up: `docker compose up -d --build`
- Backend logs: `docker compose logs -f backend`
- Frontend logs: `docker compose logs -f frontend`
- API test: `curl -s -X POST http://localhost:8000/config/test -H "Content-Type: application/json" -d '{}'`

## MLflow (experiment tracking)

- MLflow UI: http://localhost:5000
- The backend logs basic parameters for each training run and uploads artifacts (.safetensors and combined log). If metrics like `loss` appear in training logs, they are parsed and logged as MLflow metrics.
- docker-compose adds a `mlflow` service with a local SQLite backend and a `mlruns` volume for artifacts.
- To disable MLflow, remove `MLFLOW_TRACKING_URI` from the backend service environment.

## ✉️ Contact & Feedback
If you have questions, suggestions, or just want to say hi — feel free to reach out:  
📧 **[wizwiz0107@gmail.com](mailto:wizwiz0107@gmail.com)**

❤️ Support the Project

If this tool saved you time, you can support development here:
👉 [Ko-fi](https://ko-fi.com/wizwiz92838)