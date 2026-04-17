import logging
import os
import tempfile
from typing import Optional

# workaround for SSL self signed certificate error (only bypasses problem)
"""import ssl
ssl._create_default_https_context = ssl._create_unverified_context"""

import whisper
from config import WHISPER_MODEL
from database import _update_processing_status, supabase
from summarizer import _run_summarization

logger = logging.getLogger(__name__)
# --- Load Whisper model (lazy) ---
_whisper_model = None


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        logger.info(f"Loading Whisper model: {WHISPER_MODEL}")
        _whisper_model = whisper.load_model(WHISPER_MODEL)
        logger.info("Whisper model loaded successfully")
    return _whisper_model


async def _transcribe_and_summarize(session_id: str, model: Optional[str] = None, language: Optional[str] = 'en'):
    """Background task: transcribe audio, then summarize."""
    try:
        # 1. Update status to transcribing
        _update_processing_status(session_id, "transcribing")

        # 2. Fetch session to get source_ref
        session_result = (
            supabase.table("sessions")
            .select("source_ref, source_type")
            .eq("id", session_id)
            .single()
            .execute()
        )

        session_data = session_result.data
        if not session_data or not session_data.get("source_ref"):
            logger.error(f"Session {session_id} has no source_ref")
            _update_processing_status(session_id, "failed")
            return

        source_ref = session_data["source_ref"]
        logger.info(f"Downloading audio from storage: {source_ref}")

        # 3. Download audio file from Supabase Storage
        file_bytes = supabase.storage.from_("audio-uploads").download(source_ref)

        if not file_bytes:
            logger.error(f"Failed to download audio file: {source_ref}")
            _update_processing_status(session_id, "failed")
            return

        # 4. Write to temp file and run Whisper
        file_ext = source_ref.rsplit(".", 1)[-1] if "." in source_ref else "wav"
        with tempfile.NamedTemporaryFile(suffix=f".{file_ext}", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        try:
            logger.info(f"Running Whisper transcription on {tmp_path}")
            whisper_model = get_whisper_model()
            result = whisper_model.transcribe(tmp_path)
        finally:
            os.unlink(tmp_path)

        segments = result.get("segments", [])
        full_text = result.get("text", "")

        if not segments and not full_text:
            logger.warning(
                f"Whisper returned empty transcription for session {session_id}"
            )
            _update_processing_status(session_id, "failed")
            return

        logger.info(
            f"Whisper transcription complete: {len(segments)} segments, {len(full_text)} chars"
        )

        # 5. Save transcript segments to database
        if segments:
            for segment in segments:
                text = segment.get("text", "").strip()
                if not text:
                    continue

                start_ms = int(segment.get("start", 0) * 1000)

                supabase.table("transcripts").insert(
                    {
                        "session_id": session_id,
                        "speaker": "Speaker",
                        "transcript": text,
                        "timestamp_ms": start_ms,
                    }
                ).execute()
        else:
            # Fallback: save as single transcript entry
            supabase.table("transcripts").insert(
                {
                    "session_id": session_id,
                    "speaker": "Speaker",
                    "transcript": full_text.strip(),
                    "timestamp_ms": 0,
                }
            ).execute()

        logger.info(f"Saved transcripts to database for session {session_id}")

        # 6. Now summarize
        _update_processing_status(session_id, "summarizing")

        try:
            await _run_summarization(session_id, model=model, language=language)
            logger.info(f"Summarization complete for session {session_id}")
        except Exception as e:
            logger.error(f"Summarization failed for session {session_id}: {e}")
            # Still mark as completed since transcription succeeded
            _update_processing_status(session_id, "completed")
            return

        # 7. Mark as completed
        _update_processing_status(session_id, "completed")

    except Exception as e:
        logger.error(f"Transcription pipeline failed for session {session_id}: {e}")
        _update_processing_status(session_id, "failed")
