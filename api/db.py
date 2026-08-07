import os
from functools import lru_cache

from supabase import Client, create_client


@lru_cache(maxsize=1)
def get_admin_client() -> Client:
    """Service-role client. Bypasses RLS -- only the API may hold this key."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url:
        raise RuntimeError("SUPABASE_URL is not set")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not set")
    return create_client(url, key)
