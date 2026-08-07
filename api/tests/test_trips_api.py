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
    with open("tests/fixtures/day.gpx", "rb") as f:
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
    from tests.test_ingest import synthetic_gpx

    client, fake = app_client
    earlier = synthetic_gpx(with_times=True)          # 2021-03-12
    later = gpx_bytes()                                # 2021-03-15

    # Serialize synthetic_gpx to bytes
    earlier_bytes = io.BytesIO(earlier.to_xml().encode('utf-8'))

    res = client.post(
        "/api/v1/trips", data={"title": "Two Days"},
        files=[
            ("files", ("later.gpx", io.BytesIO(later), "application/gpx+xml")),
            ("files", ("earlier.gpx", earlier_bytes, "application/gpx+xml")),
        ],
        headers=auth(),
    )
    assert res.status_code == 201
    days = fake.sink["trip_days"]
    assert [d["day_index"] for d in days] == [1, 2]
    assert days[0]["date"] == "2021-03-12"
    assert days[1]["date"] == "2021-03-15"


def install_trip(fake, visibility, token=None):
    fake.trip = {
        "id": "aaaaaaaa-0000-0000-0000-000000000001",
        "owner_id": USER_ID,
        "visibility": visibility,
        "share_token": token,
    }
    fake.day = {"gpx_path": f"{USER_ID}/{fake.trip['id']}/day-01.gpx"}


@pytest.fixture()
def url_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    fake = FakeSupabase()
    fake.none_on_empty = False  # Flag to control zero-rows behavior

    class Q:
        def __init__(self, name):
            self.name = name
        def select(self, *_): return self
        def eq(self, *_): return self
        def maybe_single(self): return self
        def execute(self):
            data = fake.trip if self.name == "trips" else fake.day
            # Mirror real supabase-py: return None when data is None and flag is set
            if data is None and fake.none_on_empty:
                return None
            return type("R", (), {"data": data})()

    fake.table = lambda name: Q(name)

    class SignBucket:
        def create_signed_url(self, path, ttl):
            return {"signedURL": f"https://signed.example/{path}?exp={ttl}"}
    fake.storage.from_ = lambda bucket: SignBucket()

    import trips_api
    monkeypatch.setattr(trips_api, "get_admin_client", lambda: fake)
    from main import app
    return TestClient(app), fake


BASE = "/api/v1/trips/aaaaaaaa-0000-0000-0000-000000000001/days/1/gpx-url"


def test_public_trip_url_needs_no_auth(url_client):
    client, fake = url_client
    install_trip(fake, "public")
    res = client.get(BASE)
    assert res.status_code == 200
    assert res.json()["url"].startswith("https://signed.example/")


def test_private_trip_requires_owner(url_client):
    client, fake = url_client
    install_trip(fake, "private")
    assert client.get(BASE).status_code == 404
    assert client.get(BASE, headers=auth()).status_code == 200


def test_private_trip_hidden_from_other_users(url_client):
    client, fake = url_client
    install_trip(fake, "private")
    other = make_token(sub="22222222-2222-2222-2222-222222222222")
    res = client.get(BASE, headers={"Authorization": f"Bearer {other}"})
    assert res.status_code == 404


def test_unlisted_needs_the_right_token(url_client):
    client, fake = url_client
    install_trip(fake, "unlisted", token="cafe" * 8)
    assert client.get(BASE).status_code == 404
    assert client.get(BASE + "?token=wrong").status_code == 404
    assert client.get(BASE + "?token=" + "cafe" * 8).status_code == 200


def test_nonexistent_trip_is_404_not_500(url_client):
    client, fake = url_client
    fake.trip = None
    fake.day = None
    fake.none_on_empty = True
    assert client.get(BASE).status_code == 404


def test_nonexistent_day_is_404_not_500(url_client):
    client, fake = url_client
    install_trip(fake, "public")
    fake.day = None
    fake.none_on_empty = True
    res = client.get(BASE)
    assert res.status_code == 404
