import pytest


def test_missing_env_raises_named_error(monkeypatch):
    import db
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    db.get_admin_client.cache_clear()
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        db.get_admin_client()


def test_client_is_cached(monkeypatch):
    import db
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:55321")
    monkeypatch.setenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.fake",
    )
    db.get_admin_client.cache_clear()
    a = db.get_admin_client()
    b = db.get_admin_client()
    assert a is b
    db.get_admin_client.cache_clear()
