import pytest
from fastapi import HTTPException

import summarizer
from conftest import FakeSupabase


class DummyResponse:
    def __init__(self, payload):
        self.payload = payload
        self.text = str(payload)
        self.status_code = 200

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class DummyAsyncClient:
    def __init__(self, payload):
        self.payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, _url, **_kwargs):
        return DummyResponse(self.payload)


def test_parse_summary_response_parses_valid_json():
    parsed = summarizer.parse_summary_response(
        '{"summary": "Budget approved", "action_items": [{"description": "Send notes", "assignee": "Alice"}]}'
    )

    assert parsed["summary"] == "Budget approved"
    assert parsed["action_items"][0]["description"] == "Send notes"


def test_parse_summary_response_extracts_embedded_json():
    parsed = summarizer.parse_summary_response(
        'Here you go: {"summary": "Decision made", "action_items": []}'
    )

    assert parsed["summary"] == "Decision made"
    assert parsed["action_items"] == []


def test_parse_summary_response_rejects_invalid_payload():
    with pytest.raises(HTTPException) as exc_info:
        summarizer.parse_summary_response("not json")

    assert exc_info.value.detail == "LLM did not return valid JSON."


@pytest.mark.asyncio
async def test_run_summarization_persists_summary_and_action_items(monkeypatch):
    fake_supabase = FakeSupabase(
        {
            "transcripts": [
                {
                    "session_id": "session-1",
                    "speaker": "Alice",
                    "transcript": "We approved the budget.",
                    "created_at": "2026-01-01T10:00:00Z",
                },
                {
                    "session_id": "session-1",
                    "speaker": "Bob",
                    "transcript": "Alice will send the notes tomorrow.",
                    "created_at": "2026-01-01T10:01:00Z",
                },
            ],
            "summaries": [],
            "action_items": [],
            "action_item_assignees": [],
        }
    )
    monkeypatch.setattr(summarizer, "supabase", fake_supabase)
    monkeypatch.setattr(
        summarizer.httpx,
        "AsyncClient",
        lambda timeout=120.0: DummyAsyncClient(
            {
                "response": '{"summary": "Budget approved and notes assigned.", "action_items": [{"description": "Send the meeting notes", "assignee": "Alice"}]}'
            }
        ),
    )

    result = await summarizer._run_summarization("session-1", model="llama3.1")

    assert result["summary"] == "Budget approved and notes assigned."
    assert result["action_items"][0]["description"] == "Send the meeting notes"
    assert fake_supabase.tables["summaries"][0]["summary"] == result["summary"]
    assert fake_supabase.tables["action_items"][0]["description"] == "Send the meeting notes"
    assert fake_supabase.tables["action_item_assignees"][0]["assigned_to"] == "Alice"


@pytest.mark.asyncio
async def test_run_summarization_raises_404_when_session_has_no_transcripts():
    fake_supabase = FakeSupabase({"transcripts": []})
    summarizer.supabase = fake_supabase

    with pytest.raises(HTTPException) as exc_info:
        await summarizer._run_summarization("missing-session")

    assert exc_info.value.detail == "No transcripts found for this session."
