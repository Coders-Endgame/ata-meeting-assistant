import os
import json
import logging
import tempfile
from typing import Optional
from pathlib import Path

import httpx
import whisper
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env from project root (two levels up)
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# --- Configuration ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")

if not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning("SUPABASE_SERVICE_ROLE_KEY not set. Database operations will fail.")

# --- Supabase Client ---
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# --- Load Whisper model (lazy) ---
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        logger.info(f"Loading Whisper model: {WHISPER_MODEL}")
        _whisper_model = whisper.load_model(WHISPER_MODEL)
        logger.info("Whisper model loaded successfully")
    return _whisper_model

# --- FastAPI App ---
app = FastAPI(title="Meeting Summarizer Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request / Response Models ---
class SummarizeRequest(BaseModel):
    session_id: str
    model: Optional[str] = None

class TranscribeRequest(BaseModel):
    session_id: str
    model: Optional[str] = None

class ActionItemOut(BaseModel):
    id: str | None = None
    description: str
    status: str = "pending"
    assignee: str | None = None

class SummarizeResponse(BaseModel):
    summary: str
    action_items: list[ActionItemOut]


SYSTEM_PROMPT = """You are a meeting assistant. Given a meeting transcript, produce a JSON object with two keys:

1. "summary": A concise, well-structured meeting summary in paragraph form. Cover the key discussion points, decisions made, and conclusions.

2. "action_items": An array of action items extracted from the meeting. Each item is an object with:
   - "description": A clear, actionable description of what needs to be done.
   - "assignee": The name of the person responsible. ONLY use names that actually appear as speakers in the transcript. Set to null if no specific person was assigned.

IMPORTANT: Do NOT invent or hallucinate assignee names. Only use speaker names that appear in the transcript.

Return ONLY valid JSON, no markdown fences, no extra text. Example format:
{"summary": "The team discussed...", "action_items": [{"description": "Task description here", "assignee": null}]}"""


def _update_processing_status(session_id: str, status: str | None):
    """Update the processing_status of a session."""
    try:
        supabase.table("sessions").update(
            {"processing_status": status}
        ).eq("id", session_id).execute()
        logger.info(f"Session {session_id} processing_status -> {status}")
    except Exception as e:
        logger.error(f"Failed to update processing_status: {e}")


async def _run_summarization(session_id: str, model: Optional[str] = None) -> dict:
    """Internal summarization logic, reusable by both /summarize and /transcribe."""
    # 1. Fetch transcripts from Supabase
    result = supabase.table("transcripts") \
        .select("speaker, transcript, created_at") \
        .eq("session_id", session_id) \
        .order("created_at", desc=False) \
        .execute()

    transcripts = result.data
    if not transcripts:
        raise HTTPException(status_code=404, detail="No transcripts found for this session.")

    # 2. Build the transcript text
    transcript_text = "\n".join(
        f"[{t.get('speaker', 'Unknown')}]: {t['transcript']}" for t in transcripts
    )
    logger.info(f"Built transcript with {len(transcripts)} entries ({len(transcript_text)} chars)")

    # 3. Call Ollama
    use_model = model or OLLAMA_MODEL
    user_prompt = f"Here is the meeting transcript:\n\n{transcript_text}\n\nPlease analyze the transcript and produce the JSON output."

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            ollama_response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": use_model,
                    "prompt": f"{SYSTEM_PROMPT}\n\nUser: {user_prompt}",
                    "stream": False,
                    "format": "json",
                },
            )
            ollama_response.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error(f"Ollama HTTP error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=502, detail=f"Ollama error: {e.response.text}")
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama. Make sure 'ollama serve' is running.",
        )

    # 4. Parse Ollama response
    raw = ollama_response.json().get("response", "")
    logger.info(f"Ollama raw response: {raw[:500]}")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        import re
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group())
            except json.JSONDecodeError:
                raise HTTPException(status_code=500, detail="Failed to parse LLM response as JSON.")
        else:
            raise HTTPException(status_code=500, detail="LLM did not return valid JSON.")

    summary_text = parsed.get("summary", "")
    action_items_raw = parsed.get("action_items", [])

    if not summary_text:
        raise HTTPException(status_code=500, detail="LLM returned empty summary.")

    # 5. Save summary to database (upsert: delete old + insert new)
    supabase.table("summaries").delete().eq("session_id", session_id).execute()
    supabase.table("summaries").insert({
        "session_id": session_id,
        "summary": summary_text,
    }).execute()
    logger.info("Summary saved to database")

    # 6. Delete old action items and their assignees
    old_items = supabase.table("action_items").select("id").eq("session_id", session_id).execute().data
    if old_items:
        old_ids = [item["id"] for item in old_items]
        supabase.table("action_item_assignees").delete().in_("action_item_id", old_ids).execute()
    supabase.table("action_items").delete().eq("session_id", session_id).execute()

    # 7. Insert new action items
    action_items_out: list[ActionItemOut] = []
    for item in action_items_raw:
        description = item.get("description", "")
        assignee = item.get("assignee")
        if not description:
            continue

        # Insert action item and get back the id
        ai_result = supabase.table("action_items").insert({
            "session_id": session_id,
            "description": description,
            "status": "pending",
        }).execute()

        action_item_id = ai_result.data[0]["id"] if ai_result.data else None

        # Insert assignee if present
        if assignee and action_item_id:
            supabase.table("action_item_assignees").insert({
                "action_item_id": action_item_id,
                "assigned_to": assignee,
            }).execute()

        action_items_out.append(ActionItemOut(
            id=action_item_id,
            description=description,
            status="pending",
            assignee=assignee,
        ))

    logger.info(f"Saved {len(action_items_out)} action items to database")

    return {
        "summary": summary_text,
        "action_items": [item.model_dump() for item in action_items_out],
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/models")
async def list_models():
    """List available Ollama models."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{OLLAMA_HOST}/api/tags")
            resp.raise_for_status()
        data = resp.json()
        models = [m["name"] for m in data.get("models", [])]
        return {"models": models, "default": OLLAMA_MODEL}
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot connect to Ollama.")
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail="Failed to list models.")


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest):
    session_id = req.session_id
    logger.info(f"Summarize request for session: {session_id} (model={req.model})")

    result = await _run_summarization(session_id, model=req.model)
    return SummarizeResponse(
        summary=result["summary"],
        action_items=[ActionItemOut(**item) for item in result["action_items"]],
    )


async def _transcribe_and_summarize(session_id: str, model: Optional[str] = None):
    """Background task: transcribe audio, then summarize."""
    try:
        # 1. Update status to transcribing
        _update_processing_status(session_id, "transcribing")

        # 2. Fetch session to get source_ref
        session_result = supabase.table("sessions") \
            .select("source_ref, source_type") \
            .eq("id", session_id) \
            .single() \
            .execute()

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
            model = get_whisper_model()
            result = model.transcribe(tmp_path)
        finally:
            os.unlink(tmp_path)

        segments = result.get("segments", [])
        full_text = result.get("text", "")

        if not segments and not full_text:
            logger.warning(f"Whisper returned empty transcription for session {session_id}")
            _update_processing_status(session_id, "failed")
            return

        logger.info(f"Whisper transcription complete: {len(segments)} segments, {len(full_text)} chars")

        # 5. Save transcript segments to database
        if segments:
            for segment in segments:
                text = segment.get("text", "").strip()
                if not text:
                    continue

                start_ms = int(segment.get("start", 0) * 1000)

                supabase.table("transcripts").insert({
                    "session_id": session_id,
                    "speaker": "Speaker",
                    "transcript": text,
                    "timestamp_ms": start_ms,
                }).execute()
        else:
            # Fallback: save as single transcript entry
            supabase.table("transcripts").insert({
                "session_id": session_id,
                "speaker": "Speaker",
                "transcript": full_text.strip(),
                "timestamp_ms": 0,
            }).execute()

        logger.info(f"Saved transcripts to database for session {session_id}")

        # 6. Now summarize
        _update_processing_status(session_id, "summarizing")

        try:
            await _run_summarization(session_id, model=model)
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


@app.post("/transcribe")
async def transcribe(req: TranscribeRequest, background_tasks: BackgroundTasks):
    """Start transcription + summarization pipeline in the background."""
    session_id = req.session_id
    logger.info(f"Transcribe request for session: {session_id}")

    # Verify session exists
    session_result = supabase.table("sessions") \
        .select("id, source_ref, source_type") \
        .eq("id", session_id) \
        .single() \
        .execute()

    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found.")

    if not session_result.data.get("source_ref"):
        raise HTTPException(status_code=400, detail="Session has no audio file.")

    # Run transcription in background
    background_tasks.add_task(_transcribe_and_summarize, session_id, req.model)

    return {"status": "processing", "message": "Transcription started. Check processing_status for progress."}


# --- Chat Endpoint ---

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: list[ChatMessage] = []
    model: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str


CHAT_SYSTEM_PROMPT = """You are a helpful meeting assistant. You have access to the full transcript of a meeting.
Answer the user's questions based ONLY on the information found in the transcript.
If the answer is not in the transcript, say so clearly. Be concise and specific.
Do NOT make up information that is not in the transcript."""


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session_id = req.session_id
    logger.info(f"Chat request for session: {session_id} — question: {req.message[:100]}")

    # 1. Fetch transcripts
    result = supabase.table("transcripts") \
        .select("speaker, transcript, created_at") \
        .eq("session_id", session_id) \
        .order("created_at", desc=False) \
        .execute()

    transcripts = result.data
    if not transcripts:
        raise HTTPException(status_code=404, detail="No transcripts found for this session.")

    # 2. Build transcript context
    transcript_text = "\n".join(
        f"[{t.get('speaker', 'Unknown')}]: {t['transcript']}" for t in transcripts
    )

    # 3. Build conversation for Ollama
    conversation_parts = [
        f"{CHAT_SYSTEM_PROMPT}\n\nHere is the meeting transcript:\n\n{transcript_text}\n"
    ]

    # Add conversation history
    for msg in req.history:
        prefix = "User" if msg.role == "user" else "Assistant"
        conversation_parts.append(f"{prefix}: {msg.content}")

    # Add current question
    conversation_parts.append(f"User: {req.message}")

    full_prompt = "\n\n".join(conversation_parts)

    # 4. Call Ollama
    use_model = req.model or OLLAMA_MODEL
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            ollama_response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": use_model,
                    "prompt": full_prompt,
                    "stream": False,
                },
            )
            ollama_response.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error(f"Ollama HTTP error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=502, detail=f"Ollama error: {e.response.text}")
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama. Make sure 'ollama serve' is running.",
        )

    reply = ollama_response.json().get("response", "").strip()
    if not reply:
        reply = "I couldn't generate a response. Please try again."

    logger.info(f"Chat reply ({len(reply)} chars): {reply[:200]}")
    return ChatResponse(reply=reply)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
