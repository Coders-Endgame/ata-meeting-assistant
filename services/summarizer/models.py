from typing import Optional

from pydantic import BaseModel


# --- Request / Response Models ---
class SummarizeRequest(BaseModel):
    session_id: str
    model: Optional[str] = None
    language: Optional[str] = 'en'


class TranscribeRequest(BaseModel):
    session_id: str
    model: Optional[str] = None
    language: Optional[str] = 'en'


class ActionItemOut(BaseModel):
    id: str | None = None
    description: str
    status: str = "pending"
    assignee: str | None = None


class SummarizeResponse(BaseModel):
    summary: str
    action_items: list[ActionItemOut]


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
