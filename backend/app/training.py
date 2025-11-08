from __future__ import annotations

import asyncio
import shutil
from pathlib import Path
from typing import Dict, List, Tuple
import os

import torch

from .config import AppConfig
from .constants import (
    ARTIFACT_SUFFIX,
    CHECKPOINTS_SUBDIR_NAME,
    DATASET_CAPTIONS_SUBDIR,
    DATASET_IMAGES_SUBDIR,
    DATASET_SUBDIR_NAME,
    LOG_PIPELINE_COPYING,
    LOG_PIPELINE_DONE,
    LOG_PIPELINE_ERROR,
    LOG_PIPELINE_TRAINING_START,
)
from .dataset import prepare_dataset
from .job_manager import JobState, JobRecord, job_manager


async def _stream_process_output(process: asyncio.subprocess.Process, job_id: str) -> None:
    if not process.stdout:
        return
    while True:
        line = await process.stdout.readline()
        if not line:
            break
        job_manager.append_log(job_id, line.decode("utf-8", errors="ignore").rstrip())


def _bool_param(value: str | bool, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    lowered = value.lower()
    if lowered in {"true", "1", "yes", "y"}:
        return True
    if lowered in {"false", "0", "no", "n"}:
        return False
    return default


def _prepare_dataset(job: JobRecord, raw_dir: Path, config: AppConfig) -> Path:
    dataset_dir = raw_dir.parent / DATASET_SUBDIR_NAME
    prepare_dataset(
        job.job_id,
        ((path, path.name) for path in sorted(raw_dir.glob("*"))),
        dataset_dir,
        resolution=int(job.params.get("resolution", config.train.resolution)),
        trigger=job.params.get("trigger", config.trigger_token),
        name=job.params.get("name", "character"),
    )
    return dataset_dir


def _build_training_command(
    job: JobRecord,
    dataset_dir: Path,
    output_dir: Path,
    config: AppConfig,
) -> Tuple[List[str], str, Path]:
    base_key = job.params.get("base_model", config.base_model.use)
    base_path = config.base_model.paths.get(base_key)
    if not base_path:
        raise ValueError(f"Базовая модель '{base_key}' не найдена в конфиге")
    if not base_path.exists():
        raise FileNotFoundError(f"Файл базовой модели не найден: {base_path}")

    if not config.kohya.script_path.exists():
        raise FileNotFoundError(f"Скрипт kohya_ss train_network.py не найден: {config.kohya.script_path}")

    name = job.params.get("name", "character")
    resolution = int(job.params.get("resolution", config.train.resolution))
    steps = int(job.params.get("steps", config.train.steps))
    network_dim = int(job.params.get("network_dim", config.train.network_dim))
    unet_only = _bool_param(job.params.get("unet_only", config.train.unet_only), config.train.unet_only)
    # Adjust mixed precision depending on device availability
    mixed_precision = config.train.mixed_precision
    use_cuda = torch.cuda.is_available()
    if not use_cuda:
        mixed_precision = "no"

    # Ensure Accelerate config matches desired device
    try:
        accel_dir = Path("/root/.cache/huggingface/accelerate")
        accel_dir.mkdir(parents=True, exist_ok=True)
        cfg = (
            "compute_environment: LOCAL_MACHINE\n"
            "distributed_type: NO\n"
            "downcast_bf16: 'no'\n"
            "dynamo_backend: 'no'\n"
            "machine_rank: 0\n"
            "main_process_ip: 127.0.0.1\n"
            "main_process_port: 29500\n"
            f"mixed_precision: {mixed_precision}\n"
            "num_machines: 1\n"
            "num_processes: 1\n"
            "rdzv_backend: static\n"
            "same_network: true\n"
            "tpu_name: null\n"
            f"use_cpu: {'false' if use_cuda else 'true'}\n"
        )
        (accel_dir / "default_config.yaml").write_text(cfg, encoding="utf-8")
    except Exception:
        pass

    artifact_stem = config.kohya.artifact_template.format(name=name, base=base_key)
    expected_artifact = output_dir / f"{artifact_stem}{ARTIFACT_SUFFIX}"

    images_dir = dataset_dir / DATASET_IMAGES_SUBDIR

    command: List[str] = [
        config.kohya.accelerate_bin,
        "launch",
        # If CUDA present, hint to use GPU id 0
        *(["--gpu_ids", "0"] if use_cuda else []),
        str(config.kohya.script_path),
        "--pretrained_model_name_or_path",
        str(base_path),
        "--train_data_dir",
        str(images_dir),
        "--resolution",
        f"{resolution},{resolution}",
        "--network_module",
        config.kohya.network_module,
        "--network_dim",
        str(network_dim),
        "--output_dir",
        str(output_dir),
        "--output_name",
        artifact_stem,
        "--max_train_steps",
        str(steps),
        "--save_every_n_steps",
        str(config.train.save_every),
        "--learning_rate",
        str(config.train.lr_unet),
        "--train_batch_size",
        str(config.train.train_batch_size),
        "--noise_offset",
        str(config.train.noise_offset),
        "--caption_dropout_rate",
        str(config.train.caption_dropout),
        "--min_snr_gamma",
        str(config.train.min_snr_gamma),
        "--mixed_precision",
        mixed_precision,
        "--caption_extension",
        ".txt",
    ]

    if unet_only:
        command.append("--network_train_unet_only")
    elif config.train.lr_text > 0:
        command.extend(["--text_encoder_lr", str(config.train.lr_text)])

    return command, artifact_stem, expected_artifact


async def run_pipeline(job: JobRecord, raw_dir: Path, config: AppConfig) -> None:
    try:
        job_manager.set_state(job.job_id, JobState.PREPPING)
        dataset_dir = _prepare_dataset(job, raw_dir, config)

        output_subdir = config.kohya.output_subdir or CHECKPOINTS_SUBDIR_NAME
        output_dir = raw_dir.parent / output_subdir
        output_dir.mkdir(parents=True, exist_ok=True)

        job_manager.set_state(job.job_id, JobState.TRAINING)
        job_manager.append_log(job.job_id, LOG_PIPELINE_TRAINING_START)

        command, artifact_stem, expected_artifact = _build_training_command(job, dataset_dir, output_dir, config)

        workspace = config.kohya.workspace if config.kohya.workspace else config.kohya.script_path.parent
        if not workspace.exists():
            raise FileNotFoundError(f"Рабочая директория kohya_ss не найдена: {workspace}")

        # Propagate env with CUDA_VISIBLE_DEVICES if GPU available
        env = os.environ.copy()
        use_cuda_runtime = False
        try:
            use_cuda_runtime = bool(torch.cuda.is_available())
        except Exception:
            use_cuda_runtime = False
        if use_cuda_runtime:
            env["CUDA_VISIBLE_DEVICES"] = env.get("CUDA_VISIBLE_DEVICES", "0") or "0"
        process = await asyncio.create_subprocess_exec(
            *command,
            cwd=str(workspace),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        await _stream_process_output(process, job.job_id)
        return_code = await process.wait()
        if return_code != 0:
            raise RuntimeError(f"kohya_ss завершился с кодом {return_code}")

        artifact_source = expected_artifact
        if not artifact_source.exists():
            candidates = sorted(output_dir.glob(f"{artifact_stem}*{ARTIFACT_SUFFIX}"))
            if not candidates:
                raise FileNotFoundError("Артефакт обучения не найден после завершения kohya_ss")
            artifact_source = candidates[-1]

        job_manager.set_state(job.job_id, JobState.COPYING)
        destination_dir = config.ed_lora_dir
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination_path = destination_dir / artifact_source.name
        shutil.copy2(artifact_source, destination_path)
        job_manager.append_log(job.job_id, LOG_PIPELINE_COPYING.format(path=destination_path))

        job_manager.set_artifact(job.job_id, str(destination_path))
        job_manager.append_log(job.job_id, LOG_PIPELINE_DONE)
        job_manager.set_state(job.job_id, JobState.DONE)
    except Exception as exc:  # pragma: no cover - defensive
        job_manager.append_log(job.job_id, LOG_PIPELINE_ERROR.format(error=exc))
        job_manager.set_error(job.job_id, str(exc))


def bootstrap_job(raw_dir: Path, params: Dict[str, str]) -> JobRecord:
    job = JobRecord(job_id=params["job_id"], params=params)
    job_manager.create_job(job)
    return job
