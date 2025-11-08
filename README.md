# Character LoRA One‑Click (MVP)

Короткая и практичная инструкция по запуску через Docker на Windows, настройке `.env`, скрипту запуска, монтированию моделей и `kohya_ss`, а также про кэш, чтобы тяжёлые зависимости не перекачивались заново.

## О чём приложение

- Назначение: упрощённый «one‑click» пайплайн обучения LoRA персонажа на ваших референс‑изображениях.
- Что делает:
  - Принимает 8+ изображений, имя персонажа, триггер‑токен, базовую модель и параметры тренировки.
  - Готовит датасет (раскладка кадров, подписи), запускает kohya_ss (`accelerate launch train_network.py`).
  - Ведёт логи, отслеживает статус задачи и сохраняет артефакт `.safetensors`.
- Архитектура:
  - Backend (FastAPI): эндпоинты `/train`, `/jobs/{id}/status`, интеграция с kohya_ss.
  - Frontend (React + Vite): UI для загрузки изображений, ввода параметров и мониторинга.
  - Файлы и артефакты: `backend/data/jobs/<id>` и `backend/artifacts/ed_lora`.
- Заметки и ограничения:
  - По умолчанию конфигурация дружелюбна к CPU; для GPU используйте base‑образ с CUDA колёсами Torch (см. ниже).
  - Базовые модели не поставляются; путь к ним задаётся через `.env` (`HOST_MODELS_DIR`).
  - Репозиторий `kohya_ss` монтируется извне; версию контролируете вы.

## Быстрый запуск (Windows + Docker)

Требуется Docker Desktop. Убедитесь, что диск с проектом расшарен в Docker Desktop: Settings → Resources → File Sharing.

1) Укажите путь к вашим моделям в `.env` (пример для EasyDiffusion):

```
HOST_MODELS_DIR=C:/EasyDiffusion/models/stable-diffusion
```

2) Запустите стек одной командой (PowerShell из корня репозитория):

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\up.ps1
```

Скрипт:
- один раз собирает базовый образ `charactertrainer-backend-base` с зафиксированным `torch` (по умолчанию 2.9.0),
- запускает `docker compose up -d --build`,
- показывает статус контейнеров.

3) Откройте:
- UI: http://localhost:5173
- Проверка backend: `POST http://localhost:8000/config/test`

## Переменные окружения (.env)

- `BASE_IMAGE=charactertrainer-backend-base` — базовый образ для backend (содержит тяжёлые зависимости, чтобы не качались при каждом билде).
- `HOST_MODELS_DIR=...` — путь на хосте к папке с моделями. Она монтируется в контейнер по пути `/srv/models/external`.

Если `HOST_MODELS_DIR` не задан, используется локальная папка `./backend/models/external`.

## Скрипт запуска (scripts/up.ps1)

Запуск (CPU):

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\up.ps1
```

Параметры:
- `-CudaIndexUrl <url>` — собирать base‑образ с CUDA колёсами Torch (например, `https://download.pytorch.org/whl/cu124`).
- `-RebuildBase` — принудительно пересобрать base‑образ.

Скрипт автоматически создаёт/обновляет `.env` с `BASE_IMAGE`, собирает (при необходимости) базовый образ и поднимает стек.

## Модели и kohya_ss

- Модели: в контейнере ожидаются по путям `/srv/models/...` или `/srv/models/external/...`.
  - Пример: `backend/config.yaml` содержит ключ `dreamshaper_8: "/srv/models/external/dreamshaper_8.safetensors"`.
  - Если имя файла другое — измените ключ в `backend/config.yaml` или переименуйте файл.
- kohya_ss: репозиторий монтируется в контейнер по пути `/opt/kohya_ss` (см. `docker-compose.yml`).
  - Если папки нет, выполните в корне: `git clone https://github.com/kohya-ss/sd-scripts.git kohya_ss`.
  - Сообщение об ошибке с путём вида `/opt/...` — нормально: контейнер линуксовый.

## Кэш и большие зависимости

- Torch и прочие тяжёлые зависимости устанавливаются в базовый образ `charactertrainer-backend-base` один раз. Обычные пересборки приложения не перекачивают 900+ МБ.
- Кэш pip в сборке включён; кэш HuggingFace смонтирован томом `hf_cache` и сохраняется между перезапусками.
- Не используйте без надобности `--no-cache` и не запускайте `docker system prune -a`, чтобы не терять кэш слоёв/образов.

## Частые команды

- Поднять/пересобрать: `docker compose up -d --build`
- Логи backend: `docker compose logs -f backend`
- Логи frontend: `docker compose logs -f frontend`
- Проверка API: `curl -s -X POST http://localhost:8000/config/test -H "Content-Type: application/json" -d '{}'`

