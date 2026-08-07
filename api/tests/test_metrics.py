from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_legacy_endpoints_are_gone():
    assert client.get("/api/trips").status_code == 404
    assert client.get("/api/trips/dan-to-ginosar/metrics").status_code == 404


def test_cors_rejects_unknown_origin():
    res = client.get("/health", headers={"Origin": "https://evil.example"})
    assert res.headers.get("access-control-allow-origin") is None


def test_cors_allows_configured_origin():
    res = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
