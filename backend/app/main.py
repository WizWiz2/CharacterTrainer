from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Dict, List
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .config import AppConfig, load_config
from .constants import (
    API_TITLE,
    API_VERSION,
    CONFIG_TEST_MESSAGE,
    DEFAULT_JOBS_ROOT,
    LOG_PIPELINE_FRAME_COUNT,
    LOG_PIPELINE_MODEL,
    LOG_PIPELINE_STARTED,
    MIN_REFERENCE_IMAGES,
    RAW_SUBDIR_NAME,
)
from .job_manager import job_manager
from .training import bootstrap_job, run_pipeline
from .diagnostics import gpu_diagnostics

app = FastAPI(title=API_TITLE, version=API_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

config: AppConfig = load_config()

JOBS_ROOT = DEFAULT_JOBS_ROOT
JOBS_ROOT.mkdir(parents=True, exist_ok=True)

# Serve artifacts statically for easy access from UI
ARTIFACTS_DIR = (Path(__file__).resolve().parents[1] / "artifacts").resolve()
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/artifacts", StaticFiles(directory=str(ARTIFACTS_DIR), html=True), name="artifacts")


@app.post("/config/test")
async def config_test() -> Dict[str, object]:
    return {
        "ok": True,
        "ed_lora_dir": str(config.ed_lora_dir),
        "docker": config.local_docker,
        "ssh": bool(config.ssh.host),
        "message": CONFIG_TEST_MESSAGE,
    }


@app.post("/train")
async def start_training(
    name: str = Form(...),
    trigger: str = Form(...),
    base_model: str = Form(...),
    resolution: int = Form(...),
    network_dim: int = Form(...),
    steps: int = Form(...),
    unet_only: str = Form(...),
    files: List[UploadFile] = File(...),
) -> Dict[str, str]:
    if not name.strip():
        raise HTTPException(status_code=400, detail="Имя персонажа обязательно")
    if len(files) < MIN_REFERENCE_IMAGES:
        raise HTTPException(status_code=400, detail="Минимум 8 изображений")

    job_id = str(uuid4())
    job_dir = JOBS_ROOT / job_id
    raw_dir = job_dir / RAW_SUBDIR_NAME
    raw_dir.mkdir(parents=True, exist_ok=True)

    stored_files: List[Path] = []
    for idx, file in enumerate(files):
        content = await file.read()
        file_path = raw_dir / f"{idx:03d}_{file.filename or 'image' }"
        file_path.write_bytes(content)
        stored_files.append(file_path)

    params: Dict[str, str] = {
        "job_id": job_id,
        "name": name.strip(),
        "trigger": trigger.strip() or config.trigger_token,
        "base_model": base_model,
        "resolution": str(resolution),
        "network_dim": str(network_dim),
        "steps": str(steps),
        "unet_only": str(unet_only),
    }

    job = bootstrap_job(raw_dir, params)
    job_manager.append_log(job.job_id, LOG_PIPELINE_STARTED)
    job_manager.append_log(job.job_id, LOG_PIPELINE_MODEL.format(base=base_model))
    job_manager.append_log(job.job_id, LOG_PIPELINE_FRAME_COUNT.format(count=len(stored_files)))
    asyncio.create_task(run_pipeline(job, raw_dir, config))

    return {"job_id": job.job_id}


@app.get("/jobs/{job_id}/status")
async def job_status(job_id: str) -> Dict[str, object]:
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job_manager.to_dict(job_id)


@app.get("/gpu/diagnostics")
async def gpu_diag() -> Dict[str, object]:
    return gpu_diagnostics()
