FROM nvidia/cuda:12.6.0-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install system dependencies
# pulseaudio: virtual audio
# chromium deps: playwright will install the browser and OS deps
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python-is-python3 \
    pulseaudio \
    socat \
    alsa-utils \
    libasound2-plugins \
    procps \
    dos2unix \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create an isolated Python environment to avoid Ubuntu 24.04 PEP 668 issues
RUN python -m venv "$VIRTUAL_ENV"

# Set working directory
WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt .

# Install Python dependencies inside the venv
RUN python -m pip install --upgrade pip
RUN python -m pip install -r requirements.txt

# Install Playwright browser and required OS packages
RUN python -m playwright install --with-deps chromium

# Copy app files
COPY bot.py .
COPY config.json .
COPY start.sh .

# Setup PulseAudio environment variables
ENV PULSE_SERVER=unix:/tmp/pulseaudio.socket
ENV PULSE_COOKIE=/tmp/pulseaudio.cookie

# Normalize script line endings and make it executable
RUN dos2unix start.sh
RUN chmod +x start.sh

# Prewarm the model cache without forcing build-time CUDA
RUN python - <<'PY'
import json

import torch
from faster_whisper import WhisperModel

config_path = "/app/config.json"
model_size = "medium"

try:
    with open(config_path, "r", encoding="utf-8") as config_file:
        config = json.load(config_file)
        model_size = config.get("model_size", model_size)
except FileNotFoundError:
    print(f"[whisper-prewarm] Config not found at {config_path}; defaulting to {model_size}")
except Exception as exc:
    print(f"[whisper-prewarm] Failed to read {config_path}: {exc}; defaulting to {model_size}")

if torch.cuda.is_available():
    device = "cuda"
    compute_type = "float16"
else:
    device = "cpu"
    compute_type = "int8"

print(
    f"[whisper-prewarm] Prewarming model='{model_size}' on device='{device}' with compute_type='{compute_type}'"
)
WhisperModel(model_size, device=device, compute_type=compute_type)
print("[whisper-prewarm] Model cache warmup complete")
PY

ENTRYPOINT ["./start.sh"]
