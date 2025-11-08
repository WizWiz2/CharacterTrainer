# syntax=docker/dockerfile:1.5

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_CACHE_DIR=/root/.cache/pip

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 python3-pip python3-venv \
       git \
       libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

# Install CUDA-enabled torch/torchvision (cu124)
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --upgrade pip \
    && python -m pip install --prefer-binary --only-binary=:all: \
         --index-url https://download.pytorch.org/whl/cu124 \
         torch==2.6.0 torchvision==0.21.0

WORKDIR /app/backend

COPY backend/requirements.txt /tmp/backend-requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --prefer-binary --only-binary=:all: -r /tmp/backend-requirements.txt

# Accelerate default config: GPU + fp16
RUN mkdir -p /root/.cache/huggingface/accelerate \
    && printf "%s\n" \
"compute_environment: LOCAL_MACHINE" \
"distributed_type: NO" \
"downcast_bf16: 'no'" \
"dynamo_backend: 'no'" \
"machine_rank: 0" \
"main_process_ip: 127.0.0.1" \
"main_process_port: 29500" \
"mixed_precision: fp16" \
"num_machines: 1" \
"num_processes: 1" \
"rdzv_backend: static" \
"same_network: true" \
"tpu_name: null" \
"use_cpu: false" \
> /root/.cache/huggingface/accelerate/default_config.yaml

ENV PYTHONPATH=/app/backend \
    KOHYA_ROOT=/opt/kohya_ss

COPY backend /app/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

