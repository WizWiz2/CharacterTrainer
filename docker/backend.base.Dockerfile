# syntax=docker/dockerfile:1.5

ARG PYTHON_IMAGE=python:3.10-slim
FROM ${PYTHON_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_CACHE_DIR=/root/.cache/pip

RUN python3 -m pip install --upgrade pip

# Optional: preinstall Torch once to avoid repeated 900MB downloads
# Set via build args when building this base image
ARG TORCH_VERSION=
ARG TORCH_INDEX_URL=
ARG TORCHVISION_VERSION=
RUN --mount=type=cache,target=/root/.cache/pip \
    bash -lc 'set -euo pipefail; \
      if [ -n "${TORCH_VERSION}" ]; then \
        if [ -n "${TORCH_INDEX_URL}" ]; then \
          python3 -m pip install --prefer-binary --only-binary=:all: --index-url "${TORCH_INDEX_URL}" torch=="${TORCH_VERSION}"; \
          if [ -n "${TORCHVISION_VERSION}" ]; then \
            python3 -m pip install --prefer-binary --only-binary=:all: --index-url "${TORCH_INDEX_URL}" torchvision=="${TORCHVISION_VERSION}"; \
          fi; \
        else \
          python3 -m pip install --prefer-binary --only-binary=:all: torch=="${TORCH_VERSION}"; \
          if [ -n "${TORCHVISION_VERSION}" ]; then \
            python3 -m pip install --prefer-binary --only-binary=:all: torchvision=="${TORCHVISION_VERSION}"; \
          fi; \
        fi; \
      fi'

# Preinstall backend Python deps to lock them into this base layer
COPY backend/requirements.txt /tmp/backend-requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    python3 -m pip install --prefer-binary --only-binary=:all: -r /tmp/backend-requirements.txt

# This image is intended to be used as a base for the app image
