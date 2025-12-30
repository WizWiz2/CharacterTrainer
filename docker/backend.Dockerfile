# syntax=docker/dockerfile:1.5

ARG KOHYA_IMAGE=ghcr.io/kohya-ss/sd-scripts:latest
FROM ${KOHYA_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       python3-pip \
       python3-venv \
       git \
       tini \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf python3 /usr/bin/python

RUN set -eux; \
    if [ -d /workspace/sd-scripts ]; then \
        ln -sf /workspace/sd-scripts /opt/kohya_ss; \
    elif [ -d /sd-scripts ]; then \
        ln -sf /sd-scripts /opt/kohya_ss; \
    elif [ ! -d /opt/kohya_ss ]; then \
        git clone --depth 1 https://github.com/kohya-ss/sd-scripts.git /opt/kohya_ss; \
    fi

RUN python3 -m pip install --upgrade pip \
    && python3 -m pip install --no-cache-dir -r /opt/kohya_ss/requirements.txt

WORKDIR /app/backend

COPY backend/requirements.txt /tmp/backend-requirements.txt
RUN python3 -m pip install --no-cache-dir -r /tmp/backend-requirements.txt

RUN mkdir -p /root/.cache/huggingface/accelerate \
    && cat <<'EOF' > /root/.cache/huggingface/accelerate/default_config.yaml
compute_environment: LOCAL_MACHINE
distributed_type: NO
downcast_bf16: 'no'
dynamo_backend: 'no'
machine_rank: 0
main_process_ip: 127.0.0.1
main_process_port: 29500
mixed_precision: bf16
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

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
