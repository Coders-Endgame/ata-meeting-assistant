import logging

import httpx
from config import OLLAMA_HOST, OLLAMA_MODEL
from database import supabase
from fastapi import HTTPException
from models import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)
from fastapi import APIRouter

router = APIRouter()


CHAT_SYSTEM_PROMPT = """You are a helpful meeting assistant. You have access to the full transcript of a meeting.
Answer the user's questions based ONLY on the information found in the transcript.
If the answer is not in the transcript, say so clearly. Be concise and specific.
Do NOT make up information that is not in the transcript."""


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session_id = req.session_id
    logger.info(
        f"Chat request for session: {session_id} — question: {req.message[:100]}"
    )

    # 1. Fetch transcripts
    result = (
        supabase.table("transcripts")
        .select("speaker, transcript, created_at")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
    )

    transcripts = result.data
    if not transcripts:
        raise HTTPException(
            status_code=404, detail="No transcripts found for this session."
        )

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
