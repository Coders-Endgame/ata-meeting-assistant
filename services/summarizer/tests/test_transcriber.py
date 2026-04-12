import pytest

import transcriber
from conftest import FakeSupabase


class FakeWhisperModel:
    def transcribe(self, _tmp_path):
        return {
            "segments": [
                {
                    "start": 0.0,
                    "text": "We approved the budget.",
                },
                {
                    "start": 4.0,
                    "text": "Alice will send the notes tomorrow.",
                },
            ],
            "text": "We approved the budget. Alice will send the notes tomorrow.",
        }


@pytest.mark.asyncio
async def test_transcribe_and_summarize_updates_status_and_preserves_requested_llm_model(monkeypatch):
    fake_supabase = FakeSupabase(
        {
            "sessions": [
                {
                    "id": "session-1",
                    "source_ref": "user/audio.wav",
                    "source_type": "offline",
                    "processing_status": "transcribing",
                }
            ],
            "transcripts": [],
        },
        files={"user/audio.wav": b"fake audio bytes"},
    )

    statuses = []
    recorded_models = []

    async def fake_run_summarization(session_id, model=None):
        recorded_models.append((session_id, model))
        return {"summary": "done", "action_items": []}

    monkeypatch.setattr(transcriber, "supabase", fake_supabase)
    monkeypatch.setattr(transcriber, "_update_processing_status", lambda session_id, status: statuses.append((session_id, status)))
    monkeypatch.setattr(transcriber, "get_whisper_model", lambda: FakeWhisperModel())
    monkeypatch.setattr(transcriber, "_run_summarization", fake_run_summarization)

    await transcriber._transcribe_and_summarize("session-1", model="llama3.1")

    assert statuses == [
      ("session-1", "transcribing"),
      ("session-1", "summarizing"),
      ("session-1", "completed"),
    ]
    assert len(fake_supabase.tables["transcripts"]) == 2
    assert recorded_models == [("session-1", "llama3.1")]


@pytest.mark.asyncio
async def test_transcribe_and_summarize_marks_session_failed_when_source_ref_is_missing(monkeypatch):
    fake_supabase = FakeSupabase(
        {
            "sessions": [
                {
                    "id": "session-2",
                    "source_ref": None,
                    "source_type": "offline",
                }
            ]
        }
    )
    statuses = []

    monkeypatch.setattr(transcriber, "supabase", fake_supabase)
    monkeypatch.setattr(transcriber, "_update_processing_status", lambda session_id, status: statuses.append((session_id, status)))

    await transcriber._transcribe_and_summarize("session-2", model="llama3.1")

    assert statuses == [
      ("session-2", "transcribing"),
      ("session-2", "failed"),
    ]
