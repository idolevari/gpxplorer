import io

import pytest
from fastapi.testclient import TestClient

from tests.test_auth import TEST_SECRET, USER_ID, make_token


class FakeTable:
    def __init__(self, sink, name):
        self.sink, self.name = sink, name
        self._rows = None

    def insert(self, rows):
        self._rows = rows if isinstance(rows, list) else [rows]
        return self

    def delete(self):
        self.sink.setdefault("deleted", []).append(self.name)
        return self

    def eq(self, *_):
        return self

    def execute(self):
        if self._rows is not None:
            self.sink.setdefault(self.name, []).extend(self._rows)
        return type("R", (), {"data": self._rows or []})()


class FakeBucket:
    def __init__(self, sink):
        self.sink = sink

    def upload(self, path, content, opts=None):
        self.sink.setdefault("objects", []).append(path)

    def remove(self, paths):
        self.sink.setdefault("removed", []).extend(paths)


class FakeStorage:
    def __init__(self, sink):
        self.sink = sink

    def from_(self, bucket):
        assert bucket == "trip-gpx"
        return FakeBucket(self.sink)


class FakeSupabase:
    def __init__(self):
        self.sink = {}
        self.storage = FakeStorage(self.sink)

    def table(self, name):
        return FakeTable(self.sink, name)


@pytest.fixture()
def app_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    fake = FakeSupabase()
    import trips_api
    monkeypatch.setattr(trips_api, "get_admin_client", lambda: fake)
    from main import app
    return TestClient(app), fake


def gpx_bytes():
    with open("trips/hod_hasharon_to_tel_aviv.gpx", "rb") as f:
        return f.read()


def auth():
    return {"Authorization": f"Bearer {make_token()}"}


def test_upload_requires_auth(app_client):
    client, _ = app_client
    res = client.post("/api/v1/trips", data={"title": "X"},
                      files=[("files", ("d1.gpx", io.BytesIO(gpx_bytes()), "application/gpx+xml"))])
    assert res.status_code == 401


def test_upload_creates_trip_day_and_object(app_client):
    client, fake = app_client
    res = client.post(
        "/api/v1/trips",
        data={"title": "Tel Aviv Spin", "activity_type": "cycling", "visibility": "private"},
        files=[("files", ("d1.gpx", io.BytesIO(gpx_bytes()), "application/gpx+xml"))],
        headers=auth(),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["days"] == 1
    assert body["slug"].startswith("tel-aviv-spin-")

    trip = fake.sink["trips"][0]
    assert trip["owner_id"] == USER_ID
    assert trip["activity_type"] == "cycling"

    day = fake.sink["trip_days"][0]
    assert day["day_index"] == 1
    assert day["distance_m"] is not None
    assert day["gpx_path"] == f"{USER_ID}/{body['id']}/day-01.gpx"
    assert day["geom_simplified"] is not None

    assert fake.sink["objects"] == [f"{USER_ID}/{body['id']}/day-01.gpx"]


def test_unparseable_gpx_is_422_and_nothing_written(app_client):
    client, fake = app_client
    res = client.post(
        "/api/v1/trips", data={"title": "Broken"},
        files=[("files", ("bad.gpx", io.BytesIO(b"<not-gpx>"), "application/gpx+xml"))],
        headers=auth(),
    )
    assert res.status_code == 422
    assert "trips" not in fake.sink
    assert "objects" not in fake.sink


def test_bad_activity_type_is_422(app_client):
    client, _ = app_client
    res = client.post(
        "/api/v1/trips", data={"title": "X", "activity_type": "submarine"},
        files=[("files", ("d1.gpx", io.BytesIO(gpx_bytes()), "application/gpx+xml"))],
        headers=auth(),
    )
    assert res.status_code == 422


def test_multi_file_days_are_ordered_by_time(app_client):
    client, fake = app_client
    with open("trips/dan_to_ginosar.gpx", "rb") as f:  # 2021-03-12
        earlier = f.read()
    later = gpx_bytes()                                # 2021-03-15
    res = client.post(
        "/api/v1/trips", data={"title": "Two Days"},
        files=[
            ("files", ("later.gpx", io.BytesIO(later), "application/gpx+xml")),
            ("files", ("earlier.gpx", io.BytesIO(earlier), "application/gpx+xml")),
        ],
        headers=auth(),
    )
    assert res.status_code == 201
    days = fake.sink["trip_days"]
    assert [d["day_index"] for d in days] == [1, 2]
    assert days[0]["date"] == "2021-03-12"
    assert days[1]["date"] == "2021-03-15"
