"""Import the nine Dan->Eilat GPX files as ONE trip with nine days.

Repeatable: --replace deletes an existing trip with the same slug for the
same owner first (cascade removes its days; storage objects are re-uploaded
with upsert). Run against local or cloud purely via env vars:

  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  uv run python -m scripts.import_cross_israel --owner-email you@example.com --replace
"""
import argparse
import sys
import uuid
from pathlib import Path

import gpxpy

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db import get_admin_client          # noqa: E402
from ingest import compute_day           # noqa: E402

SLUG = "dan-to-eilat-cross-israel"
TITLE = "Dan to Eilat — Cross-Israel"
DAYS = [
    ("dan_to_ginosar.gpx", "Dan to Ginosar"),
    ("ginosar_to_aviel.gpx", "Ginosar to Aviel"),
    ("aviel_to_hod_hasharon.gpx", "Aviel to Hod Hasharon"),
    ("hod_hasharon_to_tel_aviv.gpx", "Hod Hasharon to Tel Aviv"),
    ("tel_aviv_to_beer_sheva.gpx", "Tel Aviv to Beer Sheva"),
    ("beer_sheva_to_sde_boker.gpx", "Beer Sheva to Sde Boker"),
    ("sde_boker_to_tzofar.gpx", "Sde Boker to Tzofar"),
    ("tzofar_to_yahel.gpx", "Tzofar to Yahel"),
    ("yahel_to_eilat.gpx", "Yahel to Eilat"),
]


def find_owner_id(client, email: str) -> str:
    page = 1
    while True:
        users = client.auth.admin.list_users(page=page, per_page=50)
        if not users:
            raise SystemExit(f"no user with email {email!r} — sign up first")
        for u in users:
            if (u.email or "").lower() == email.lower():
                return str(u.id)
        page += 1


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--owner-email", required=True)
    ap.add_argument("--visibility", default="private",
                    choices=["private", "unlisted", "public"])
    ap.add_argument("--replace", action="store_true")
    args = ap.parse_args()

    client = get_admin_client()
    owner_id = find_owner_id(client, args.owner_email)
    print(f"owner: {owner_id}")

    existing = (client.table("trips").select("id")
                .eq("owner_id", owner_id).eq("slug", SLUG).execute().data)
    if existing:
        if not args.replace:
            raise SystemExit(f"trip '{SLUG}' already exists; use --replace")
        client.table("trips").delete().eq("id", existing[0]["id"]).execute()
        print("replaced existing trip")

    trips_dir = Path(__file__).resolve().parent.parent / "trips"
    trip_id = str(uuid.uuid4())
    bucket = client.storage.from_("trip-gpx")

    day_rows, dates = [], []
    for i, (filename, day_title) in enumerate(DAYS, start=1):
        raw = (trips_dir / filename).read_bytes()
        m = compute_day(gpxpy.parse(raw.decode()))
        path = f"{owner_id}/{trip_id}/day-{i:02d}.gpx"
        bucket.upload(path, raw,
                      {"content-type": "application/gpx+xml", "upsert": "true"})
        date = m.start_time.date().isoformat() if m.start_time else None
        if date:
            dates.append(date)
        day_rows.append({
            "trip_id": trip_id, "day_index": i, "date": date, "title": day_title,
            "gpx_path": path,
            "distance_m": m.distance_m, "moving_distance_m": m.moving_distance_m,
            "elevation_gain_m": m.elevation_gain_m,
            "elevation_loss_m": m.elevation_loss_m,
            "moving_time_s": m.moving_time_s, "stopped_time_s": m.stopped_time_s,
            "max_speed_mps": m.max_speed_mps, "avg_speed_mps": m.avg_speed_mps,
            "min_elevation_m": m.min_elevation_m, "max_elevation_m": m.max_elevation_m,
            "start_lat": m.start_lat, "start_lon": m.start_lon,
            "end_lat": m.end_lat, "end_lon": m.end_lon,
            "bbox": m.bbox, "geom_simplified": m.geom,
        })
        print(f"  day {i}: {day_title} — {round((m.distance_m or 0) / 1000, 1)} km")

    client.table("trips").insert({
        "id": trip_id, "owner_id": owner_id, "slug": SLUG, "title": TITLE,
        "description": "Nine days cycling the length of Israel, from the "
                       "Hermon foothills to the Red Sea. March 2021.",
        "activity_type": "cycling", "visibility": args.visibility,
        "fidelity": "recorded",
        "start_date": min(dates) if dates else None,
        "end_date": max(dates) if dates else None,
    }).execute()
    client.table("trip_days").insert(day_rows).execute()

    total_km = sum(d["distance_m"] or 0 for d in day_rows) / 1000
    gain = sum(d["elevation_gain_m"] or 0 for d in day_rows)
    print(f"imported '{TITLE}': {len(day_rows)} days, "
          f"{total_km:.1f} km, {gain:.0f} m up")
    assert 665 < total_km < 675, "distance sanity check failed"
    assert len(day_rows) == 9


if __name__ == "__main__":
    main()
