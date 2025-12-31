"""
Automatic kohya_ss setup script.
Checks if kohya_ss exists and clones it if missing.
"""
import os
import subprocess
import sys
from pathlib import Path

KOHYA_REPO = "https://github.com/kohya-ss/sd-scripts.git"
KOHYA_BRANCH = "main"


def get_default_kohya_path() -> Path:
    """Returns the default kohya_ss path inside the backend folder."""
    return Path(__file__).parent / "kohya_ss"


def setup_kohya(target_path: Path | None = None) -> Path:
    """
    Ensures kohya_ss is available at the target path.
    If not found, clones it from GitHub.
    
    Args:
        target_path: Where to look for/install kohya_ss. 
                     Defaults to backend/kohya_ss.
    
    Returns:
        Path to kohya_ss installation.
    """
    if target_path is None:
        target_path = get_default_kohya_path()
    
    script_path = target_path / "train_network.py"
    
    if script_path.exists():
        print(f"✓ kohya_ss найден: {target_path}")
        return target_path
    
    # Check if path exists but is empty or incomplete
    if target_path.exists():
        print(f"⚠ Папка {target_path} существует, но train_network.py не найден.")
        print("  Попробуйте удалить папку и запустить снова для переустановки.")
        return target_path
    
    print(f"📦 kohya_ss не найден. Клонирование из {KOHYA_REPO}...")
    print(f"   Целевая папка: {target_path}")
    
    try:
        # Clone the repository
        result = subprocess.run(
            ["git", "clone", "--depth=1", "-b", KOHYA_BRANCH, KOHYA_REPO, str(target_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        print("✓ kohya_ss успешно склонирован!")
        
        # Verify the clone
        if not script_path.exists():
            print("⚠ Клонирование завершено, но train_network.py не найден в репозитории.")
            print("  Возможно, структура sd-scripts изменилась.")
        
        return target_path
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка клонирования: {e.stderr}")
        raise RuntimeError(f"Не удалось склонировать kohya_ss: {e.stderr}")
    except FileNotFoundError:
        print("❌ Git не найден. Установите Git и добавьте его в PATH.")
        raise RuntimeError("Git не установлен или не найден в PATH")


if __name__ == "__main__":
    # Allow running directly for testing
    path = setup_kohya()
    print(f"kohya_ss path: {path}")
