# Zoom ASR Bot

A Dockerized Python bot that automatically joins Zoom meetings, captures audio via system loopback, transcribes speech in real-time using `faster-whisper`, and saves the conversation to a JSON file.

## Features

- **Automated Joining**: Uses Playwright to navigate the Zoom Web Client (`/wc/join`), handling dynamic URL construction, name entry, and cookie consents.
- **Audio Capture**: Captures system audio (meeting output) using `pulseaudio` and a virtual null sink in Docker.
- **Real-time Transcription**: Uses `faster-whisper` (on CPU) for efficient, local speech-to-text.
- **Headless Execution**: Runs entirely in the background within a Docker container.
- **Robustness**: Handles various Zoom join flows, popups, and overlays.

## Prerequisites

- **Docker Desktop** (Windows/Mac/Linux)
- **Git**

## Setup

1.  **Clone the repository** (or navigate to the project folder):
    ```bash
    cd path/to/bot
    ```

2.  **Build the Docker image**:
    This might take a while initially as it downloads PyTorch and NVIDIA CUDA libraries.
    ```powershell
    docker compose build
    ```

    > **Note**: An empty `transcripts.json` file is required for the volume mount. If it doesn't exist, create it:
    > ```powershell
    > New-Item -Path "transcripts.json" -ItemType File -Force
    > ```

## Usage

Run the bot by passing the Zoom meeting URL. The `--rm` flag ensures the container is cleaned up after execution.

```powershell
docker compose run --rm zoom-bot --url "YOUR_ZOOM_MEETING_URL"
```

### Arguments

- `--url`: The full Zoom meeting invite link (e.g., `https://zoom.us/j/123...?pwd=...`).
- `--name`: (Optional) Name the bot uses to join. Default: "ATA Smart Meeting Assistant".
- `--headless`: (Optional) Force headless mode (Default: Auto-detected in Docker).

Example with custom name:
```powershell
docker compose run --rm zoom-bot --url "..." --name "My Note Taker"
```

## Output

The transcriptions are saved in real-time to `transcripts.json` in the project directory.

**Format (JSON Lines):**
```json
{"timestamp": "2026-02-04T21:07:08.352...", "speaker": "Unknown", "text": "Hello world."}
{"timestamp": "2026-02-04T21:07:12.951...", "speaker": "Unknown", "text": "This is a test."}
```

## Troubleshooting

- **"Is a directory" error**: If `transcripts.json` appears as a directory, delete it and create an empty file with that name *before* running Docker.
- **No Audio**: Ensure PulseAudio initialized correctly in the logs (`PulseAudio initialized`).
- **Join Failures**: The bot logs detailed info. Check if the meeting requires a password not in the URL or has a Waiting Room (the bot currently waits indefinitely in waiting rooms).
- **Performance**: The `small` Whisper model runs on CPU. If it's too slow, you can try `tiny` in `bot.py` or enable GPU support (requires NVIDIA Container Toolkit).

## Development

- **`bot.py`**: Main logic for Playwright and Audio/ASR.
- **`start.sh`**: Entrypoint script that sets up PulseAudio and virtual sinks.
- **`Dockerfile`**: Environment setup ensuring all system audio dependencies are installed.
