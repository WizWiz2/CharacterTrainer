from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List

try:
    import torch  # type: ignore
except Exception:  # pragma: no cover
    torch = None  # type: ignore


def _run(cmd: List[str], timeout: float = 5.0) -> Dict[str, Any]:
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=timeout)
        return {"ok": True, "code": 0, "out": out.decode("utf-8", errors="ignore")}
    except subprocess.CalledProcessError as e:  # pragma: no cover
        return {"ok": False, "code": e.returncode, "out": e.output.decode("utf-8", errors="ignore")}
    except Exception as e:  # pragma: no cover
        return {"ok": False, "code": -1, "out": str(e)}


def gpu_diagnostics() -> Dict[str, Any]:
    info: Dict[str, Any] = {}

    # Basic environment
    info["in_docker"] = Path("/.dockerenv").exists()
    devs = sorted(str(p) for p in Path("/dev").glob("nvidia*") if p.exists())
    info["nvidia_devices"] = devs
    info["env"] = {
        "CUDA_VISIBLE_DEVICES": os.getenv("CUDA_VISIBLE_DEVICES"),
        "NVIDIA_VISIBLE_DEVICES": os.getenv("NVIDIA_VISIBLE_DEVICES"),
    }

    # nvidia-smi availability
    info["has_nvidia_smi"] = shutil.which("nvidia-smi") is not None
    if info["has_nvidia_smi"]:
        info["nvidia_smi"] = _run(["nvidia-smi", "-L"])  # list GPUs
    else:
        info["nvidia_smi"] = {"ok": False, "code": -1, "out": "nvidia-smi not found"}

    # Torch/CUDA
    torch_info: Dict[str, Any] = {"installed": torch is not None}
    if torch is not None:
        try:
            torch_info.update(
                {
                    "cuda_available": bool(torch.cuda.is_available()),
                    "cuda_version": getattr(torch.version, "cuda", None),
                    "device_count": int(torch.cuda.device_count()) if torch.cuda.is_available() else 0,
                    "devices": [
                        {
                            "index": i,
                            "name": torch.cuda.get_device_name(i),
                        }
                        for i in range(torch.cuda.device_count())
                    ]
                    if torch.cuda.is_available()
                    else [],
                }
            )
        except Exception as e:  # pragma: no cover
            torch_info["error"] = str(e)
    info["torch"] = torch_info

    # Accelerate config
    accel_cfg_path = Path("/root/.cache/huggingface/accelerate/default_config.yaml")
    accel: Dict[str, Any] = {"path": str(accel_cfg_path), "exists": accel_cfg_path.exists()}
    if accel_cfg_path.exists():
        try:
            import yaml  # type: ignore

            accel["content"] = yaml.safe_load(accel_cfg_path.read_text(encoding="utf-8"))
        except Exception as e:  # pragma: no cover
            accel["error"] = str(e)
    info["accelerate"] = accel

    # Suggestions
    suggestions: List[str] = []
    if not devs:
        suggestions.append("GPU devices are not visible in /dev. Recreate container with --gpus and enable GPU support in Docker Desktop.")
    if not info["nvidia_smi"]["ok"]:
        suggestions.append("nvidia-smi not available. Ensure NVIDIA Container Toolkit/runtime is present in the image and GPU is passed through.")
    if torch is not None and not torch_info.get("cuda_available"):
        suggestions.append("PyTorch CUDA not available. Verify CUDA_VISIBLE_DEVICES, driver/runtime compatibility, and container started with GPUs.")
    info["suggestions"] = suggestions

    return info

