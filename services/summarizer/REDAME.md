The summarizer service provides a RESTful API for backend transcription and summarization for both online and offline sessions.
## Summarizer Service

The summarizer service provides a RESTful API for backend transcription and summarization for both **online** and **offline** sessions.

---

## Warnings & Notices

### 1. SSL Certificate Issue (Whisper Model Download)

When using a virtual environment (`.venv`), the transcriber service may fail to load the Whisper model due to SSL certificate verification errors.

As a temporary workaround, you can bypass SSL verification by uncommenting the following lines at the top of `transcriber.py`:

```python
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
```

### 2. ffmpeg Dependency

This project requires `ffmpeg` for audio processing.

`ffmpeg` is a command-line tool used by Whisper to read and process audio files.

Install it before running the project:

- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt install ffmpeg`
- Windows: Download from https://ffmpeg.org and add it to PATH