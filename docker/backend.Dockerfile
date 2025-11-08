# syntax=docker/dockerfile:1.5

ARG BASE_IMAGE=python:3.10-slim
FROM ${BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_CACHE_DIR=/root/.cache/pip

# Minimal runtime libs for some deps (e.g., OpenCV)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libgl1 \
       libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Skip cloning kohya sd-scripts during build to keep image lean
# The training pipeline can fetch or mount it at runtime if needed

# Keep pip as-is to avoid cache invalidation on every upstream release

WORKDIR /app/backend

COPY backend/requirements.txt /tmp/backend-requirements.txt
# Use BuildKit cache for pip to speed up subsequent installs
RUN --mount=type=cache,target=/root/.cache/pip,id=pip-cache \
    python3 -m pip install --prefer-binary --only-binary=:all: -r /tmp/backend-requirements.txt

RUN mkdir -p /root/.cache/huggingface/accelerate \
    && cat <<'EOF' > /root/.cache/huggingface/accelerate/default_config.yaml
compute_environment: LOCAL_MACHINE
distributed_type: NO
downcast_bf16: 'no'
dynamo_backend: 'no'
machine_rank: 0
main_process_ip: 127.0.0.1
main_process_port: 29500
mixed_precision: 'fp16'
num_machines: 1
num_processes: 1
rdzv_backend: static
same_network: true
tpu_name: null
use_cpu: false
EOF

ENV PYTHONPATH=/app/backend \
    KOHYA_ROOT=/opt/kohya_ss

COPY backend /app/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

