import os
import pytest
from fastapi.testclient import TestClient

import main
from main import app, calculate_stats

client = TestClient(app)


@pytest.fixture(autouse=True)
def run_from_backend_dir(monkeypatch):
    """main.py resolves GPX paths relative to the working directory."""
    monkeypatch.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_lists_all_nine_trips():
    res = client.get("/api/trips")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 9
    assert body[0]["id"] == "dan-to-ginosar"
    assert body[-1]["id"] == "yahel-to-eilat"
    assert "file" not in body[0]


def test_unknown_trip_is_404():
    assert client.get("/api/trips/nope/metrics").status_code == 404
    assert client.get("/api/trips/nope/download").status_code == 404


def test_metrics_match_known_values():
    """dan-to-ginosar is a fixed recording; these numbers must not drift."""
    res = client.get("/api/trips/dan-to-ginosar/metrics")
    assert res.status_code == 200
    stats = res.json()["stats"]
    assert stats["distance_km"] == pytest.approx(65.0, abs=0.5)
    assert stats["elevation_gain_m"] == pytest.approx(547, abs=5)
    assert stats["elevation_loss_m"] == pytest.approx(892, abs=5)


def test_graph_is_downsampled_and_ordered():
    graph = client.get("/api/trips/dan-to-ginosar/metrics").json()["graph"]
    assert 150 <= len(graph) <= 260
    distances = [p["distance"] for p in graph]
    assert distances == sorted(distances)
    assert distances[0] == 0
    assert all("lat" in p and "lon" in p for p in graph)


def test_download_returns_gpx_not_json():
    res = client.get("/api/trips/dan-to-ginosar/download")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/gpx+xml")
    assert res.text.lstrip().startswith("<?xml")
