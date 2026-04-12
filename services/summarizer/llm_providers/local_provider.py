# locally loaded ollama model

import httpx
from typing import Optional
from config import OLLAMA_HOST, OLLAMA_MODEL
from .base_provider import BaseLLMProvider

# extend abstract BaseLLMProvider class
class LocalLLMProvider(BaseLLMProvider):

    def __init__(self, model: Optional[str] = None):
        self.model = model or OLLAMA_MODEL # fallback to Ollama if user has not provided any model

    async def summarize(self, transcript_text: str) -> dict:
        from summarizer import SYSTEM_PROMPT, parse_summary_response

        user_prompt = (
            f"Here is the meeting transcript:\n\n{transcript_text}"
            f"\n\nPlease analyze and produce the JSON output."
        )

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": self.model,
                    "prompt": f"{SYSTEM_PROMPT}\n\nUser: {user_prompt}",
                    "stream": False,
                    "format": "json",
                },
            )
            response.raise_for_status()

        raw = response.json().get("response", "")
        return parse_summary_response(raw)