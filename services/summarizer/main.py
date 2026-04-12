import logging

import httpx
from chat import router as chat_router
from config import OLLAMA_HOST, OLLAMA_MODEL
from database import supabase
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import ActionItemOut, SummarizeRequest, SummarizeResponse, TranscribeRequest
from summarizer import _run_summarization
from transcriber import _transcribe_and_summarize

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# --- FastAPI App ---
app = FastAPI(title="Meeting Summarizer Service")
app.include_router(chat_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.post("/transcribe")
async def transcribe(req: TranscribeRequest, background_tasks: BackgroundTasks):
    """Start transcription + summarization pipeline in the background."""
    session_id = req.session_id
    logger.info(f"Transcribe request for session: {session_id}")

    # Verify session exists
    session_result = (
        supabase.table("sessions")
        .select("id, source_ref, source_type")
        .eq("id", session_id)
        .single()
        .execute()
    )

    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found.")

    if not session_result.data.get("source_ref"):
        raise HTTPException(status_code=400, detail="Session has no audio file.")

    # Run transcription in background
    background_tasks.add_task(_transcribe_and_summarize, session_id, req.model)

    return {
        "status": "processing",
        "message": "Transcription started. Check processing_status for progress.",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
