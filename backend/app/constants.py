from __future__ import annotations

import os
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _default_models_dir() -> Path:
    return (BACKEND_ROOT / "models").resolve()


def _default_kohya_root() -> Path:
    override = os.environ.get("KOHYA_ROOT")
    if override:
        expanded = os.path.expandvars(override)
        return Path(expanded).expanduser().resolve()
    common_paths = [
        Path("/opt/kohya_ss"),
        Path("/workspace/sd-scripts"),
        Path("/sd-scripts"),
        Path.home() / "kohya_ss",
    ]
    for candidate in common_paths:
        if candidate.exists():
            return candidate.resolve()
    return (Path.home() / "kohya_ss").resolve()

API_TITLE = "Character LoRA One-Click API"
API_VERSION = "0.2.0"

CONFIG_FILENAME = "config.yaml"
DEFAULT_CONFIG_PATH = BACKEND_ROOT / CONFIG_FILENAME

DEFAULT_ED_LORA_DIR = (BACKEND_ROOT / "artifacts" / "ed_lora").resolve()
DEFAULT_JOBS_ROOT = (BACKEND_ROOT / "data" / "jobs").resolve()

RAW_SUBDIR_NAME = "raw"
DATASET_SUBDIR_NAME = "dataset"
CHECKPOINTS_SUBDIR_NAME = "checkpoints"
DATASET_IMAGES_SUBDIR = "images"
DATASET_CAPTIONS_SUBDIR = "captions"

MIN_REFERENCE_IMAGES = 8

CONFIG_TEST_MESSAGE = "Окружение готово к тренировке (kohya_ss)"

LOG_PIPELINE_STARTED = "🚀 Стартуем пайплайн one-click…"
LOG_PIPELINE_MODEL = "Модель базы: {base}"
LOG_PIPELINE_FRAME_COUNT = "Кадров: {count}"
LOG_PIPELINE_DATASET = "📦 Подготовка изображений…"
LOG_PIPELINE_DATASET_DONE = "✅ Датасет подготовлен"
LOG_PIPELINE_TRAINING_START = "🚀 Запускаем kohya_ss…"
LOG_PIPELINE_COPYING = "📁 Копируем в {path}"
LOG_PIPELINE_DONE = "✅ Готово! Используйте вес 0.7–0.85 в Easy Diffusion."
LOG_PIPELINE_ERROR = "❌ Ошибка: {error}"

ARTIFACT_TEMPLATE = "{name}_lora_{base}_v1"
ARTIFACT_SUFFIX = ".safetensors"

DEFAULT_TRIGGER_TOKEN = "svtchar"

DEFAULT_BASE_MODEL_USE = "ds8"
DEFAULT_MODELS_DIR = _default_models_dir()

DEFAULT_BASE_MODEL_PATHS = {
    "ds8": DEFAULT_MODELS_DIR / "dreamshaper_8.safetensors",
    "sd15": DEFAULT_MODELS_DIR / "v1-5-pruned-emaonly.safetensors",
}

DEFAULT_LOCAL_DOCKER = True

DEFAULT_TRAIN_RESOLUTION = 512
DEFAULT_TRAIN_STEPS = 2500
DEFAULT_TRAIN_NETWORK_DIM = 32
DEFAULT_TRAIN_UNET_ONLY = True
DEFAULT_TRAIN_LR_UNET = 1e-4
DEFAULT_TRAIN_LR_TEXT = 5e-5
DEFAULT_TRAIN_NOISE_OFFSET = 0.05
DEFAULT_TRAIN_CAPTION_DROPOUT = 0.1
DEFAULT_TRAIN_SAVE_EVERY = 500
DEFAULT_MIN_SNR_GAMMA = 5.0
DEFAULT_TRAIN_BATCH_SIZE = 1

DEFAULT_ACCELERATE_BIN = os.environ.get("ACCELERATE_BIN", "accelerate")
DEFAULT_KOHYA_ROOT = _default_kohya_root()
DEFAULT_KOHYA_SCRIPT = DEFAULT_KOHYA_ROOT / "train_network.py"
DEFAULT_KOHYA_WORKDIR = DEFAULT_KOHYA_ROOT
DEFAULT_KOHYA_OUTPUT_SUBDIR = "output"
DEFAULT_KOHYA_NETWORK_MODULE = "lycoris.kohya"
DEFAULT_KOHYA_MIXED_PRECISION = "bf16"
