import uuid

import gpxpy
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from auth import get_current_user_id, get_optional_user_id
from db import get_admin_client
from ingest import compute_day, slugify, sort_gpx_by_start

router = APIRouter(prefix="/api/v1")

ACTIVITY_TYPES = {"cycling", "hiking", "running", "campervan", "motorcycle", "other"}
VISIBILITIES = {"private", "unlisted", "public"}
MAX_FILES = 31
MAX_FILE_BYTES = 15 * 1024 * 1024


@router.post("/trips", status_code=201)
def create_trip(
    title: str = Form(...),
    activity_type: str = Form("other"),
    visibility: str = Form("private"),
    files: list[UploadFile] = File(...),
    user_id: str = Depends(get_current_user_id),
):
    if activity_type not in ACTIVITY_TYPES:
        raise HTTPException(422, f"unknown activity_type '{activity_type}'")
    if visibility not in VISIBILITIES:
        raise HTTPException(422, f"unknown visibility '{visibility}'")
    if not title.strip():
        raise HTTPException(422, "title is required")
    if not 1 <= len(files) <= MAX_FILES:
        raise HTTPException(422, f"between 1 and {MAX_FILES} GPX files")

    parsed = []
    for f in files:
        raw = f.file.read()
        if len(raw) > MAX_FILE_BYTES:
            raise HTTPException(422, f"{f.filename} exceeds 15 MB")
        try:
            parsed.append((f.filename or "day.gpx", gpxpy.parse(raw.decode("utf-8", errors="replace")), raw))
        except Exception:
            raise HTTPException(422, f"{f.filename} is not parseable GPX")

    ordered = sort_gpx_by_start([(name, g) for name, g, _ in parsed])
    raw_by_name = {name: raw for name, _, raw in parsed}

    trip_id = str(uuid.uuid4())
    slug = f"{slugify(title)}-{trip_id[:6]}"
    client = get_admin_client()

    day_rows, object_paths = [], []
    for i, (name, gpx) in enumerate(ordered, start=1):
        m = compute_day(gpx)
        path = f"{user_id}/{trip_id}/day-{i:02d}.gpx"
        object_paths.append((path, raw_by_name[name]))
        day_rows.append({
            "trip_id": trip_id,
            "day_index": i,
            "date": m.start_time.date().isoformat() if m.start_time else None,
            "gpx_path": path,
            "distance_m": m.distance_m,
            "moving_distance_m": m.moving_distance_m,
            "elevation_gain_m": m.elevation_gain_m,
            "elevation_loss_m": m.elevation_loss_m,
            "moving_time_s": m.moving_time_s,
            "stopped_time_s": m.stopped_time_s,
            "max_speed_mps": m.max_speed_mps,
            "avg_speed_mps": m.avg_speed_mps,
            "min_elevation_m": m.min_elevation_m,
            "max_elevation_m": m.max_elevation_m,
            "start_lat": m.start_lat, "start_lon": m.start_lon,
            "end_lat": m.end_lat, "end_lon": m.end_lon,
            "bbox": m.bbox,
            "geom_simplified": m.geom,
        })

    dates = [d["date"] for d in day_rows if d["date"]]
    trip_row = {
        "id": trip_id,
        "owner_id": user_id,
        "slug": slug,
        "title": title.strip(),
        "activity_type": activity_type,
        "visibility": visibility,
        "fidelity": "recorded",
        "start_date": min(dates) if dates else None,
        "end_date": max(dates) if dates else None,
    }

    uploaded = []
    try:
        bucket = client.storage.from_("trip-gpx")
        for path, raw in object_paths:
            bucket.upload(path, raw, {"content-type": "application/gpx+xml"})
            uploaded.append(path)
        client.table("trips").insert(trip_row).execute()
        client.table("trip_days").insert(day_rows).execute()
    except HTTPException:
        raise
    except Exception:
        # Best-effort rollback: cascade removes any day rows with the trip.
        try:
            client.table("trips").delete().eq("id", trip_id).execute()
        finally:
            if uploaded:
                client.storage.from_("trip-gpx").remove(uploaded)
        raise HTTPException(502, "failed to store trip")

    return {"id": trip_id, "slug": slug, "days": len(day_rows)}


@router.get("/trips/{trip_id}/days/{day_index}/gpx-url")
def signed_gpx_url(
    trip_id: str,
    day_index: int,
    token: str | None = None,
    user_id: str | None = Depends(get_optional_user_id),
):
    client = get_admin_client()
    trip = (
        client.table("trips").select("id, owner_id, visibility, share_token")
        .eq("id", trip_id).maybe_single().execute().data
    )
    # 404 for both "does not exist" and "not allowed" -- a 403 would confirm
    # the trip exists, which is exactly what private should not leak.
    if trip is None:
        raise HTTPException(404, "Trip not found")

    allowed = (
        trip["visibility"] == "public"
        or (user_id is not None and trip["owner_id"] == user_id)
        or (
            trip["visibility"] == "unlisted"
            and token is not None
            and trip.get("share_token") == token
        )
    )
    if not allowed:
        raise HTTPException(404, "Trip not found")

    day = (
        client.table("trip_days").select("gpx_path")
        .eq("trip_id", trip_id).eq("day_index", day_index)
        .maybe_single().execute().data
    )
    if day is None or not day.get("gpx_path"):
        raise HTTPException(404, "Day not found")

    signed = client.storage.from_("trip-gpx").create_signed_url(day["gpx_path"], 3600)
    url = signed.get("signedURL") or signed.get("signedUrl")
    if not url:
        raise HTTPException(502, "could not sign URL")
    return {"url": url, "expires_in": 3600}
