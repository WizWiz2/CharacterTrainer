from __future__ import annotations

from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()

from .constants import (
    DATASET_CAPTIONS_SUBDIR,
    DATASET_IMAGES_SUBDIR,
    LOG_PIPELINE_DATASET,
    LOG_PIPELINE_DATASET_DONE,
)
from .job_manager import job_manager


def _safe_filename(idx: int, original_name: str | None) -> str:
    suffix = Path(original_name or "image.png").suffix or ".png"
    return f"{idx:03d}{suffix.lower()}"


def prepare_dataset(
    job_id: str,
    raw_files: Iterable[Tuple[Path, str | None]],
    dataset_dir: Path,
    resolution: int,
    trigger: str,
    name: str,
) -> None:
    images_dir = dataset_dir / DATASET_IMAGES_SUBDIR
    subset_name = f"40_{trigger}"
    subset_dir = images_dir / subset_name
    subset_dir.mkdir(parents=True, exist_ok=True)

    job_manager.append_log(job_id, LOG_PIPELINE_DATASET)

    for idx, (path, original_name) in enumerate(raw_files):
        dest_name = _safe_filename(idx, original_name)
        dest_path = subset_dir / dest_name
        image = Image.open(path)
        image = image.convert("RGB")
        w, h = image.size
        side = max(w, h)
        square = Image.new("RGB", (side, side), color=(0, 0, 0))
        square.paste(image, ((side - w) // 2, (side - h) // 2))
        resized = square.resize((resolution, resolution), Image.LANCZOS)
        resized.save(dest_path, format="PNG")
        caption_path = subset_dir / f"{dest_path.stem}.txt"
        caption_path.write_text(f"{trigger} {name}", encoding="utf-8")

    job_manager.append_log(job_id, LOG_PIPELINE_DATASET_DONE)
