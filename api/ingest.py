"""GPX -> per-day metrics for the trip_days table.

Every metric is Optional. None means UNKNOWABLE -- a file with no
timestamps has no moving time, and writing 0 there would poison every
average computed downstream. This mirrors the nullable columns in the
schema (supabase/migrations/20260725123515_init_schema.sql).
"""
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone

import gpxpy.gpx


@dataclass
class DayMetrics:
    distance_m: float | None = None
    moving_distance_m: float | None = None
    elevation_gain_m: float | None = None
    elevation_loss_m: float | None = None
    moving_time_s: float | None = None
    stopped_time_s: float | None = None
    max_speed_mps: float | None = None
    avg_speed_mps: float | None = None
    min_elevation_m: float | None = None
    max_elevation_m: float | None = None
    start_lat: float | None = None
    start_lon: float | None = None
    end_lat: float | None = None
    end_lon: float | None = None
    start_time: datetime | None = None
    bbox: dict | None = None
    geom: list[list[float]] = field(default_factory=list)


def _points(gpx: gpxpy.gpx.GPX):
    return [p for t in gpx.tracks for s in t.segments for p in s.points]


def compute_day(gpx: gpxpy.gpx.GPX) -> DayMetrics:
    pts = _points(gpx)
    if not pts:
        return DayMetrics()

    m = DayMetrics()
    m.start_lat, m.start_lon = pts[0].latitude, pts[0].longitude
    m.end_lat, m.end_lon = pts[-1].latitude, pts[-1].longitude

    lats = [p.latitude for p in pts]
    lons = [p.longitude for p in pts]
    m.bbox = {"min_lat": min(lats), "min_lon": min(lons),
              "max_lat": max(lats), "max_lon": max(lons)}

    has_ele = any(p.elevation is not None for p in pts)
    m.distance_m = gpx.length_3d() if has_ele else gpx.length_2d()
    if m.distance_m == 0 and len(pts) < 2:
        m.distance_m = None

    if has_ele:
        uphill, downhill = gpx.get_uphill_downhill()
        m.elevation_gain_m = uphill
        m.elevation_loss_m = downhill
        eles = [p.elevation for p in pts if p.elevation is not None]
        m.min_elevation_m = min(eles)
        m.max_elevation_m = max(eles)

    has_times = any(p.time is not None for p in pts)
    if has_times:
        m.start_time = next(p.time for p in pts if p.time is not None)
        moving = gpx.get_moving_data()
        if moving is not None and moving.moving_time > 0:
            m.moving_time_s = moving.moving_time
            m.stopped_time_s = moving.stopped_time
            m.moving_distance_m = moving.moving_distance
            m.max_speed_mps = moving.max_speed if moving.max_speed else None
            m.avg_speed_mps = moving.moving_distance / moving.moving_time

    m.geom = downsample(
        [(p.longitude, p.latitude, p.elevation) for p in pts]
    )
    return m


def downsample(points, target: int = 200) -> list[list[float]]:
    """Thin to ~target points, always keeping the first and last."""
    n = len(points)
    if n <= target:
        return [list(p) for p in points]
    step = max(1, n // target)
    kept = [list(points[i]) for i in range(0, n, step)]
    if kept[-1] != list(points[-1]):
        kept.append(list(points[-1]))
    return kept


def slugify(title: str) -> str:
    ascii_title = (
        unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    )
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_title.lower()).strip("-")
    return slug or "trip"


def _first_time(gpx: gpxpy.gpx.GPX) -> datetime | None:
    for p in _points(gpx):
        if p.time is not None:
            return p.time
    return None


def sort_gpx_by_start(parsed):
    """Order (name, gpx) pairs by first timestamp; undated files keep their
    given order, after all dated ones."""
    far_future = datetime.max.replace(tzinfo=timezone.utc)

    def key(item):
        idx, (_, gpx) = item
        t = _first_time(gpx)
        return (1, far_future, idx) if t is None else (0, t, idx)

    return [pair for _, pair in sorted(enumerate(parsed), key=key)]
