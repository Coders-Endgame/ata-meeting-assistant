import logging

from config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from supabase import Client, create_client

logger = logging.getLogger(__name__)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

if not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning("SUPABASE_SERVICE_ROLE_KEY not set. Database operations will fail.")


def _update_processing_status(session_id: str, status: str | None):
    """Update the processing_status of a session."""
    try:
        supabase.table("sessions").update({"processing_status": status}).eq(
            "id", session_id
        ).execute()
        logger.info(f"Session {session_id} processing_status -> {status}")
    except Exception as e:
        logger.error(f"Failed to update processing_status: {e}")
