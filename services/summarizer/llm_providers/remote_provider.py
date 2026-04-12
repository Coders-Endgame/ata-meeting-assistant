# remote LLM via API access
import httpx
from typing import Optional
from config import REMOTE_LLM_PROVIDER, REMOTE_LLM_API_KEY, REMOTE_LLM_MODEL
from .base_provider import BaseLLMProvider


class RemoteLLMProvider(BaseLLMProvider):

    # model parameter is for the local llm provider (used if user specifies model from ui)
    def __init__(self, model: Optional[str] = None):
        self.model = REMOTE_LLM_MODEL 

    async def summarize(self, transcript_text: str) -> dict:
        from summarizer import SYSTEM_PROMPT, parse_summary_response

        user_prompt = (
            f"Here is the meeting transcript:\n\n{transcript_text}"
            f"\n\nPlease analyze and produce the JSON output."
        )

        if REMOTE_LLM_PROVIDER == "groq":
            raw = await self._call_groq(user_prompt=user_prompt, system_prompt=SYSTEM_PROMPT)
        else:
            raise ValueError(f"Unknown remote provider: {REMOTE_LLM_PROVIDER}")

        return parse_summary_response(raw)

    async def _call_groq(self, user_prompt: str, system_prompt:str) -> str:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=REMOTE_LLM_API_KEY)

        # groq allows roles so feed user and system prompts separately
        messages = [
            {"role": "system", "content": system_prompt}, # system prompt
            {"role": "user", "content": user_prompt}, # actual user prompt
        ]

        # blocking call ! 
        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"} # tell explicitly to return json 
        )
        
        choices = response.choices

        if not choices or not choices[0].message.content:
            raise ValueError("Groq returned empty response")
        return choices[0].message.content
