from abc import ABC, abstractmethod
from typing import Optional

class BaseLLMProvider(ABC):

    @abstractmethod
    async def summarize(self, transcript_text: str) -> dict:
        """
        Input:  full transcript as a single string
        Output: { "summary": str, "action_items": [{ "description": str, "assignee": str|None }] }
        """
        pass