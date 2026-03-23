FROM python:3.12-bookworm

# Install system dependencies
# pulseaudio & pavucontrol: For virtual audio
# ffmpeg: For audio processing if needed
# chromium deps: managed by playwright, but good to have basics
RUN apt-get update && apt-get install -y \
    pulseaudio \
    socat \
    alsa-utils \
    libasound2-plugins \
    procps \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
# Update pip first
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Install Playwright browsers (with dependencies)
RUN playwright install --with-deps chromium

# Copy bot code
COPY bot.py .

# Setup PulseAudio environment variables
ENV PULSE_SERVER=unix:/tmp/pulseaudio.socket
ENV PULSE_COOKIE=/tmp/pulseaudio.cookie

# Create a startup script
COPY start.sh .
RUN dos2unix start.sh
RUN chmod +x start.sh

RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

# Entrypoint
ENTRYPOINT ["./start.sh"]
