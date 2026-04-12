import httpx
import pytest
import pytest_asyncio

import chat
import main
from conftest import FakeSupabase


class DummyResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class AsyncClientFactory:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error

    async def __aenter__(self):
        if self.error:
            raise self.error
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, _url):
        return DummyResponse(self.payload)

    async def post(self, _url, **_kwargs):
        return DummyResponse(self.payload)


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as test_client:
        yield test_client


@pytest.mark.asyncio
async def test_health_endpoint_returns_ok(client):
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_models_endpoint_returns_live_shape(client, monkeypatch):
    monkeypatch.setattr(
        main.httpx,
        "AsyncClient",
        lambda timeout=10.0: AsyncClientFactory(
            payload={"models": [{"name": "llama3.1"}, {"name": "mistral"}]}
        ),
    )

    response = await client.get("/models")

    assert response.status_code == 200
    assert response.json()["models"] == ["llama3.1", "mistral"]


@pytest.mark.asyncio
async def test_models_endpoint_returns_503_when_ollama_is_unreachable(
    client, monkeypatch
):
    monkeypatch.setattr(
        main.httpx,
        "AsyncClient",
        lambda timeout=10.0: AsyncClientFactory(error=httpx.ConnectError("offline")),
    )

    response = await client.get("/models")

    assert response.status_code == 503
    assert response.json()["detail"] == "Cannot connect to Ollama."


@pytest.mark.asyncio
async def test_summarize_endpoint_uses_run_summarization(client, monkeypatch):
    async def fake_run(session_id, model=None):
        assert session_id == "session-1"
        assert model == "llama3.1"
        return {
            "summary": "Budget approved",
            "action_items": [{"description": "Send notes", "assignee": "Alice"}],
        }

    monkeypatch.setattr(main, "_run_summarization", fake_run)

    response = await client.post(
        "/summarize", json={"session_id": "session-1", "model": "llama3.1"}
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == "Budget approved"
    assert payload["action_items"][0]["description"] == "Send notes"


@pytest.mark.asyncio
async def test_transcribe_endpoint_returns_404_when_session_is_missing(
    client, monkeypatch
):
    fake_supabase = FakeSupabase({"sessions": []})
    monkeypatch.setattr(main, "supabase", fake_supabase)

    response = await client.post("/transcribe", json={"session_id": "missing"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Session not found."


@pytest.mark.asyncio
async def test_transcribe_endpoint_returns_400_when_session_has_no_audio_file(
    client, monkeypatch
):
    fake_supabase = FakeSupabase(
        {
            "sessions": [
                {
                    "id": "session-no-audio",
                    "source_ref": None,
                    "source_type": "offline",
                }
            ]
        }
    )
    monkeypatch.setattr(main, "supabase", fake_supabase)

    response = await client.post("/transcribe", json={"session_id": "session-no-audio"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Session has no audio file."


@pytest.mark.asyncio
async def test_transcribe_endpoint_schedules_background_work(client, monkeypatch):
    fake_supabase = FakeSupabase(
        {
            "sessions": [
                {
                    "id": "session-2",
                    "source_ref": "user/audio.wav",
                    "source_type": "offline",
                }
            ]
        }
    )
    scheduled = []

    async def fake_pipeline(session_id, model=None):
        scheduled.append((session_id, model))

    monkeypatch.setattr(main, "supabase", fake_supabase)
    monkeypatch.setattr(main, "_transcribe_and_summarize", fake_pipeline)

    response = await client.post(
        "/transcribe", json={"session_id": "session-2", "model": "llama3.1"}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "processing"
    assert scheduled == [("session-2", "llama3.1")]


@pytest.mark.asyncio
async def test_chat_endpoint_uses_transcript_context(client, monkeypatch):
    fake_supabase = FakeSupabase(
        {
            "transcripts": [
                {
                    "session_id": "session-3",
                    "speaker": "Alice",
                    "transcript": "Deployment is on Thursday.",
                    "created_at": "2026-01-01T10:00:00Z",
                }
            ]
        }
    )

    monkeypatch.setattr(chat, "supabase", fake_supabase)
    monkeypatch.setattr(
        chat.httpx,
        "AsyncClient",
        lambda timeout=120.0: AsyncClientFactory(payload={"response": "Deployment is on Thursday."}),
    )

    response = await client.post(
        "/chat",
        json={"session_id": "session-3", "message": "When is deployment?", "history": []},
    )

    assert response.status_code == 200
    assert response.json()["reply"] == "Deployment is on Thursday."
