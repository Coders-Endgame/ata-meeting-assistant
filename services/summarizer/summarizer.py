import json
import logging
from typing import Optional

import httpx
from config import OLLAMA_HOST, OLLAMA_MODEL
from database import supabase
from fastapi import HTTPException
from models import ActionItemOut

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are a meeting assistant. Given a meeting transcript, produce a JSON object with two keys:

1. "summary": A concise, well-structured meeting summary in paragraph form. Cover the key discussion points, decisions made, and conclusions.

2. "action_items": An array of action items extracted from the meeting. Each item is an object with:
   - "description": A clear, actionable description of what needs to be done.
   - "assignee": The name of the person responsible. ONLY use names that actually appear as speakers in the transcript. Set to null if no specific person was assigned.

IMPORTANT: Do NOT invent or hallucinate assignee names. Only use speaker names that appear in the transcript.

Return ONLY valid JSON, no markdown fences, no extra text. Example format:
{"summary": "The team discussed...", "action_items": [{"description": "Task description here", "assignee": null}]}"""


def parse_summary_response(raw: str) -> dict:
    """Parse Ollama JSON output, allowing a JSON object embedded in plain text."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        import re

        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            raise HTTPException(status_code=500, detail="LLM did not return valid JSON.")

        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError as error:
            raise HTTPException(
                status_code=500, detail="Failed to parse LLM response as JSON."
            ) from error


async def _run_summarization(session_id: str, model: Optional[str] = None) -> dict:
    """Internal summarization logic, reusable by both /summarize and /transcribe."""
    # 1. Fetch transcripts from Supabase
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

    # 2. Build the transcript text
    transcript_text = "\n".join(
        f"[{t.get('speaker', 'Unknown')}]: {t['transcript']}" for t in transcripts
    )
    logger.info(
        f"Built transcript with {len(transcripts)} entries ({len(transcript_text)} chars)"
    )

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
    parsed = parse_summary_response(raw)

    summary_text = parsed.get("summary", "")
    action_items_raw = parsed.get("action_items", [])

    if not summary_text:
        raise HTTPException(status_code=500, detail="LLM returned empty summary.")

    # 5. Save summary to database (upsert: delete old + insert new)
    supabase.table("summaries").delete().eq("session_id", session_id).execute()
    supabase.table("summaries").insert(
        {
            "session_id": session_id,
            "summary": summary_text,
        }
    ).execute()
    logger.info("Summary saved to database")

    # 6. Delete old action items and their assignees
    old_items = (
        supabase.table("action_items")
        .select("id")
        .eq("session_id", session_id)
        .execute()
        .data
    )
    if old_items:
        old_ids = [item["id"] for item in old_items]
        supabase.table("action_item_assignees").delete().in_(
            "action_item_id", old_ids
        ).execute()
    supabase.table("action_items").delete().eq("session_id", session_id).execute()

    # 7. Insert new action items
    action_items_out: list[ActionItemOut] = []
    for item in action_items_raw:
        description = item.get("description", "")
        assignee = item.get("assignee")
        if not description:
            continue

        # Insert action item and get back the id
        ai_result = (
            supabase.table("action_items")
            .insert(
                {
                    "session_id": session_id,
                    "description": description,
                    "status": "pending",
                }
            )
            .execute()
        )

        action_item_id = ai_result.data[0]["id"] if ai_result.data else None

        # Insert assignee if present
        if assignee and action_item_id:
            supabase.table("action_item_assignees").insert(
                {
                    "action_item_id": action_item_id,
                    "assigned_to": assignee,
                }
            ).execute()

        action_items_out.append(
            ActionItemOut(
                id=action_item_id,
                description=description,
                status="pending",
                assignee=assignee,
            )
        )

    logger.info(f"Saved {len(action_items_out)} action items to database")

    return {
        "summary": summary_text,
        "action_items": [item.model_dump() for item in action_items_out],
    }
