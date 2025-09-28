# Character LoRA One-Click (MVP)

Прототип для сценария «одной кнопки»: из набора референсов персонажа получаем подготовленный датасет, запускаем полноценную тренировку LoRA через kohya_ss и кладём артефакт в каталог Easy Diffusion.

## Архитектура

- **FastAPI-бэкенд** (папка `backend/app`) поднимает REST API и управляет «работами» на обучение. Конфигурация и пути к артефактам собираются в `config.py`, а общие значения — в `constants.py`.
- **Менеджер задач** (`job_manager.py`) хранит состояние очереди: `prepping → training → copying → done` или `error`.
- **Обработка датасета** (`dataset.py`) нормализует изображения и создаёт подписи.
- **Тренировка** (`training.py`) запускает `accelerate launch train_network.py`, стримит вывод kohya_ss, ждёт завершения и копирует итоговый `.safetensors` в директорию Easy Diffusion.
- **Frontend** (`frontend/src/App.tsx`) реализует форму, загрузку 8–25 изображений, превью, опрос статуса и подсказки, повторяя макет из ТЗ.

Все артефакты складываются в `backend/artifacts/ed_lora`, а временные данные одной работы — в `backend/data/jobs/<job_id>`.

## Состав

- **backend/** — FastAPI, реализующий пайплайн подготовки → обучения → копирования артефакта. Хранит файлы в `backend/data/jobs` и складывает итоговый `.safetensors` в `backend/artifacts/ed_lora`.
- **frontend/** — Vite + React + Tailwind. UI соответствует прототипу из ТЗ: форма параметров, загрузка 8–25 изображений, лог статуса и подсказки по использованию модели.

## Требования

Перед запуском убедитесь, что установлены:

- **Python 3.10+** с активированным `venv`.
- **pip** и возможность собирать Python-зависимости (на Windows этого достаточно; на Linux потребуются `build-essential`, `python3-dev`).
- **Node.js 18+** и `npm` (для фронтенда на Vite).
- **kohya_ss**: клонированный репозиторий с актуальными скриптами обучения LoRA. Путь до `train_network.py` нужно указать в `backend/config.yaml`.
- **Hugging Face accelerate** (ставится командой `pip install accelerate`). Пайплайн запускает `accelerate launch` для работы kohya_ss.
- **CUDA + NVIDIA драйвер** на машине, где будет идти обучение (если используете локальный GPU или удалённый сервер).
- (Опционально) **Docker** — если планируете использовать `local_docker` режим из ТЗ.

Каталог Easy Diffusion с LoRA должен существовать заранее — путь прописывается в `ed_lora_dir`.

## Что такое kohya_ss и как его подготовить

`kohya_ss` — популярный набор скриптов для обучения LoRA/LoCon на базе Stable Diffusion. Наш бэкенд не реализует собственный тренер, а оборачивает `accelerate launch train_network.py`, поэтому репозиторий `kohya_ss` с зависимостями обязателен.

### Локальная установка

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/kohya-ss/sd-scripts.git "%USERPROFILE%\kohya_ss"  # Windows
   # или
   git clone https://github.com/kohya-ss/sd-scripts.git ~/kohya_ss              # Linux/macOS
   ```
2. Перейдите в папку и поставьте зависимости (для Windows активируйте своё `venv`):
   ```bash
   cd ~/kohya_ss
   pip install -r requirements.txt
   ```
3. В `backend/config.yaml` пропишите пути `kohya.script_path` и `kohya.workspace`. Пример для Windows:
   ```yaml
   kohya:
     script_path: "%USERPROFILE%/kohya_ss/train_network.py"
     workspace: "%USERPROFILE%/kohya_ss"
   ```

### Поддержка в Docker

Backend-образ базируется на публичном `ghcr.io/kohya-ss/sd-scripts:latest`, поэтому репозиторий kohya_ss, PyTorch, xformers и все вспомогательные пакеты уже установлены. Во время сборки образ дополнительно прогоняет `accelerate config default`, так что готовый контейнер можно запускать сразу. При желании базовый образ можно заменить аргументом `--build-arg KOHYA_IMAGE=…`, но по умолчанию достаточно одной команды `docker compose up --build`.

Если хотите использовать уже подготовленный `kohya_ss` на хосте, смонтируйте его томом и задайте `KOHYA_ROOT` в `docker-compose.override.yml` — основная конфигурация при этом не меняется.

## Быстрый старт

```bash
# Backend
cd backend
python -m venv .venv

# Активируйте окружение:
#   Linux/macOS: source .venv/bin/activate
#   Windows PowerShell: .\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (в другом терминале)
cd frontend
npm install
npm run dev
```

Фронтенд проксирует API на `http://localhost:8000` (настройка в `vite.config.ts`). В продакшене можно задать `VITE_API_URL`.

### Особенности Windows

- Все пути в `backend/config.yaml` можно задавать в формате `C:\\...`, относительными (`backend/artifacts/ed_lora`) или через переменные окружения: например, `%USERPROFILE%\kohya_ss\train_network.py`.
- Скрипт автоматически разворачивает тильду `~` в домашний каталог и понимает переменные окружения как на Windows, так и на Linux.
- Для активации виртуального окружения используйте PowerShell-команду `.\.venv\Scripts\Activate.ps1` (см. пример выше).
- Убедитесь, что `accelerate.exe` и `python.exe` доступны в PATH PowerShell — иначе укажите полный путь в параметре `kohya.accelerate_bin`.

## Запуск в Docker

В репозитории добавлен `docker-compose.yml`, который поднимает два контейнера:

- `backend` на базе готового kohya-образа `ghcr.io/kohya-ss/sd-scripts:latest` (FastAPI + скрипты тренировки);
- `frontend`, где Vite-сборка отдаётся через `serve` на порту 4173 (пробрасывается наружу как 5173).

Перед запуском подготовьте только каталоги с моделями и артефактами — kohya внутри контейнера уже установлен:

- `./backend/models` — сюда можно положить SD1.5 чекпойнты (`dreamshaper_8.safetensors` и т.д.) или смонтировать внешний диск.
- `backend/config.yaml` — при необходимости скорректируйте пути до моделей и каталога Easy Diffusion. Значения `kohya.script_path` и `kohya.workspace` по умолчанию указывают на встроенный `/opt/kohya_ss`.

Далее запустите стек:

```bash
docker compose up --build
```

Backend поднимется на `http://localhost:8000`, фронтенд — на `http://localhost:5173`. Для доступа к GPU убедитесь, что установлен NVIDIA Container Toolkit и запустите `docker compose` с параметром `--gpus all` (или конкретными устройствами). В файле compose уже добавлена секция `deploy.resources` с требованием GPU. Дополнительных ручных установок (kohya_ss, accelerate, PyTorch) не требуется — всё входит в образ.

### Запуск тренировки end-to-end

1. Отредактируйте `backend/config.yaml`, чтобы указать реальные пути:
   - `ed_lora_dir` — каталог LoRA внутри Easy Diffusion (можно задать относительный путь вроде `backend/artifacts/ed_lora`).
   - `base_model` — локальные пути до dreamshaper_8 или других SD1.5 чекпойнтов.
   - `kohya.script_path` и `kohya.workspace` — расположение скрипта `train_network.py` и рабочая директория kohya_ss (по умолчанию это `${KOHYA_ROOT}` внутри контейнера; поддерживаются переменные окружения вроде `%USERPROFILE%\kohya_ss`).
2. Поднимите бэкенд (`uvicorn app.main:app`) и фронтенд (`npm run dev`). FastAPI-совместимый вебсервер обслуживает API на `localhost:8000`.
3. В браузере откройте `http://localhost:5173` (порт Vite по умолчанию), заполните форму и загрузите 8–25 изображений.
4. После отправки форма вызывает `POST /train`. Пайплайн подготовит датасет, запустит `accelerate launch train_network.py` и по завершении скопирует `.safetensors` в `ed_lora_dir`.
5. Страница автоматически опрашивает `GET /jobs/{id}/status`, чтобы показать состояние (`prepping/training/copying/done`) и логи kohya_ss.

Если тренировка должна идти на другой машине, настройте SSH и Docker согласно расширенному ТЗ — текущая версия ожидает, что kohya_ss доступен локально по указанным путям.

## Основные сценарии

1. **Проверка окружения** — `POST /config/test` возвращает путь к папке LoRA и статус готовности.
2. **Старт обучения** — `POST /train` принимает multipart (параметры + файлы). Минимум 8 изображений.
3. **Мониторинг** — `GET /jobs/{id}/status` выдаёт state/logs/artifact. Состояния: `prepping → training → copying → done` (или `error`).

Бэкенд запускает kohya_ss: готовит датасет (crop+resize, подписи с триггером), формирует команду `accelerate launch train_network.py` и транслирует вывод в логи до получения настоящего `.safetensors`.

## Подробности пайплайна

1. **Приём формы** — `start_training` (см. `main.py`) проверяет имя и число файлов, создаёт папку работы, сохраняет загруженные изображения и формирует структуру параметров.
2. **Создание записи** — `bootstrap_job` регистрирует новую работу в `JobManager`, чтобы фронтенд мог опрашивать состояние.
3. **Подготовка датасета** — `prepare_dataset` конвертирует каждый кадр в RGB, центрирует на квадратном холсте, ресайзит до требуемого разрешения и создаёт `.txt` с подсказкой `<trigger> <name>`.
4. **Запуск kohya_ss** — `run_pipeline` собирает команду `accelerate launch train_network.py`, запускает процесс в рабочей директории kohya_ss и транслирует stdout/stderr в логи задачи.
5. **Сохранение артефакта** — после успешного завершения находит лучший `.safetensors`, копирует его в `ed_lora_dir` и отдаёт путь через `/jobs/{id}/status`.

В случае ошибки любое исключение логируется и помечает работу как `error`, что позволяет фронтенду отобразить сообщение.
