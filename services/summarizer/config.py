import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (two levels up)
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


# --- Configuration ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")


# --- LLM provider credentials for offline summarization ---
REMOTE_LLM_PROVIDER = os.getenv("REMOTE_LLM_PROVIDER", "groq")  # google or groq (only groq supported currently)
REMOTE_LLM_API_KEY  = os.getenv("REMOTE_LLM_API_KEY", "")
REMOTE_LLM_MODEL    = os.getenv("REMOTE_LLM_MODEL", "llama-3.1-8b-instant")