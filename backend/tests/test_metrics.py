import os
import gpxpy
import pytest
from fastapi.testclient import TestClient

import main
from main import app

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
    assert stats["distance_km"] == pytest.approx(64.97, abs=0.05)
    assert stats["elevation_gain_m"] == pytest.approx(547, abs=5)
    assert stats["elevation_loss_m"] == pytest.approx(892, abs=5)


def test_distance_is_3d_not_2d():
    """Guards the length_3d/length_2d choice, which a tolerance cannot.

    Tasks that touch calculate_stats could silently swap these; on this route
    they differ by only ~32 m, well inside any sane distance tolerance.
    """
    with open("trips/dan_to_ginosar.gpx") as f:
        gpx = gpxpy.parse(f)

    three_d = gpx.length_3d() / 1000
    two_d = gpx.length_2d() / 1000
    assert three_d > two_d, "fixture assumption: this route has elevation change"

    stats = client.get("/api/trips/dan-to-ginosar/metrics").json()["stats"]
    assert stats["distance_km"] == pytest.approx(three_d, abs=0.01)
    assert stats["distance_km"] != pytest.approx(two_d, abs=0.01)


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


def test_stats_expose_moving_distance():
    """Needed so clients can compute a weighted average across trips."""
    stats = client.get("/api/trips/dan-to-ginosar/metrics").json()["stats"]
    assert "moving_distance_m" in stats
    assert stats["moving_distance_m"] > 0
    # A ~65 km trip: a value in kilometres rather than metres would fail here.
    assert stats["moving_distance_m"] > 1000
    # moving distance cannot exceed total 3D distance
    assert stats["moving_distance_m"] <= stats["distance_km"] * 1000 + 1


def test_avg_speed_is_consistent_with_moving_distance():
    stats = client.get("/api/trips/dan-to-ginosar/metrics").json()["stats"]
    derived = stats["moving_distance_m"] / stats["moving_time_s"] * 3.6
    assert derived == pytest.approx(stats["avg_speed_kmh"], abs=0.15)
