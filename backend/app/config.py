from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

from .constants import (
    ARTIFACT_TEMPLATE,
    DEFAULT_ACCELERATE_BIN,
    DEFAULT_BASE_MODEL_PATHS,
    DEFAULT_BASE_MODEL_USE,
    DEFAULT_CONFIG_PATH,
    DEFAULT_ED_LORA_DIR,
    DEFAULT_KOHYA_MIXED_PRECISION,
    DEFAULT_KOHYA_NETWORK_MODULE,
    DEFAULT_KOHYA_OUTPUT_SUBDIR,
    DEFAULT_KOHYA_SCRIPT,
    DEFAULT_KOHYA_WORKDIR,
    DEFAULT_LOCAL_DOCKER,
    DEFAULT_MIN_SNR_GAMMA,
    DEFAULT_TRAIN_BATCH_SIZE,
    DEFAULT_TRAIN_CAPTION_DROPOUT,
    DEFAULT_TRAIN_LR_TEXT,
    DEFAULT_TRAIN_LR_UNET,
    DEFAULT_TRAIN_NETWORK_DIM,
    DEFAULT_TRAIN_NOISE_OFFSET,
    DEFAULT_TRAIN_RESOLUTION,
    DEFAULT_TRAIN_SAVE_EVERY,
    DEFAULT_TRAIN_STEPS,
    DEFAULT_TRAIN_UNET_ONLY,
    DEFAULT_TRIGGER_TOKEN,
)


def _normalize_path(value: Any) -> Path:
    if isinstance(value, Path):
        path = value
    else:
        expanded = os.path.expandvars(str(value))
        path = Path(expanded)
    return path.expanduser().resolve()


@dataclass
class SSHConfig:
    host: Optional[str] = None
    user: Optional[str] = None
    workdir: Optional[Path] = None


@dataclass
class BaseModelPaths:
    use: str = "ds8"
    paths: Dict[str, Path] = field(default_factory=lambda: DEFAULT_BASE_MODEL_PATHS.copy())


@dataclass
class TrainConfig:
    resolution: int = DEFAULT_TRAIN_RESOLUTION
    steps: int = DEFAULT_TRAIN_STEPS
    network_dim: int = DEFAULT_TRAIN_NETWORK_DIM
    unet_only: bool = DEFAULT_TRAIN_UNET_ONLY
    lr_unet: float = DEFAULT_TRAIN_LR_UNET
    lr_text: float = DEFAULT_TRAIN_LR_TEXT
    noise_offset: float = DEFAULT_TRAIN_NOISE_OFFSET
    caption_dropout: float = DEFAULT_TRAIN_CAPTION_DROPOUT
    save_every: int = DEFAULT_TRAIN_SAVE_EVERY
    min_snr_gamma: float = DEFAULT_MIN_SNR_GAMMA
    train_batch_size: int = DEFAULT_TRAIN_BATCH_SIZE
    mixed_precision: str = DEFAULT_KOHYA_MIXED_PRECISION


@dataclass
class KohyaConfig:
    accelerate_bin: str = DEFAULT_ACCELERATE_BIN
    script_path: Path = DEFAULT_KOHYA_SCRIPT
    workspace: Path = DEFAULT_KOHYA_WORKDIR
    output_subdir: str = DEFAULT_KOHYA_OUTPUT_SUBDIR
    network_module: str = DEFAULT_KOHYA_NETWORK_MODULE
    artifact_template: str = ARTIFACT_TEMPLATE


@dataclass
class AppConfig:
    ed_lora_dir: Path = DEFAULT_ED_LORA_DIR
    base_model: BaseModelPaths = BaseModelPaths()
    trigger_token: str = DEFAULT_TRIGGER_TOKEN
    local_docker: bool = DEFAULT_LOCAL_DOCKER
    ssh: SSHConfig = SSHConfig()
    train: TrainConfig = TrainConfig()
    kohya: KohyaConfig = KohyaConfig()

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AppConfig":
        base_model = data.get("base_model", {})
        train = data.get("train", {})
        ssh = data.get("ssh", {})
        ed_lora_dir = _normalize_path(data.get("ed_lora_dir", cls.ed_lora_dir))
        base_use = base_model.get("use", DEFAULT_BASE_MODEL_USE)
        base_paths = {k: _normalize_path(v) for k, v in base_model.items() if k != "use"}
        base_paths = base_paths or {k: v for k, v in DEFAULT_BASE_MODEL_PATHS.items()}
        train_cfg = TrainConfig(**{**TrainConfig().__dict__, **train})
        ssh_cfg = SSHConfig(
            host=ssh.get("host"),
            user=ssh.get("user"),
            workdir=_normalize_path(ssh["workdir"]) if ssh.get("workdir") else None,
        )
        kohya_cfg_raw = data.get("kohya", {})
        kohya_cfg = KohyaConfig(
            accelerate_bin=kohya_cfg_raw.get("accelerate_bin", KohyaConfig().accelerate_bin),
            script_path=_normalize_path(kohya_cfg_raw.get("script_path", KohyaConfig().script_path)),
            workspace=_normalize_path(kohya_cfg_raw.get("workspace", KohyaConfig().workspace)),
            output_subdir=kohya_cfg_raw.get("output_subdir", KohyaConfig().output_subdir),
            network_module=kohya_cfg_raw.get("network_module", KohyaConfig().network_module),
            artifact_template=kohya_cfg_raw.get("artifact_template", KohyaConfig().artifact_template),
        )
        return cls(
            ed_lora_dir=ed_lora_dir,
            base_model=BaseModelPaths(use=base_use, paths=base_paths),
            trigger_token=data.get("trigger_token", DEFAULT_TRIGGER_TOKEN),
            local_docker=data.get("local_docker", DEFAULT_LOCAL_DOCKER),
            ssh=ssh_cfg,
            train=train_cfg,
            kohya=kohya_cfg,
        )


def load_config(path: Path | None = None) -> AppConfig:
    cfg_path = path or DEFAULT_CONFIG_PATH
    if cfg_path.exists():
        with cfg_path.open("r", encoding="utf-8") as fh:
            raw = yaml.safe_load(fh) or {}
        config = AppConfig.from_dict(raw)
    else:
        config = AppConfig()
    config.ed_lora_dir.mkdir(parents=True, exist_ok=True)
    return config
