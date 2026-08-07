import gpxpy
import gpxpy.gpx
import pytest

from ingest import compute_day, downsample, slugify, sort_gpx_by_start


def real_gpx():
    with open("trips/dan_to_ginosar.gpx") as f:
        return gpxpy.parse(f)


def synthetic_gpx(n=10, with_times=False, with_ele=False):
    """A tiny straight-line track; ~111m per 0.001 deg of latitude."""
    import datetime
    g = gpxpy.gpx.GPX()
    trk = gpxpy.gpx.GPXTrack(); g.tracks.append(trk)
    seg = gpxpy.gpx.GPXTrackSegment(); trk.segments.append(seg)
    for i in range(n):
        p = gpxpy.gpx.GPXTrackPoint(32.0 + i * 0.001, 34.8)
        if with_ele:
            p.elevation = 100.0 + i
        if with_times:
            p.time = datetime.datetime(
                2021, 3, 12, 9, 0, 0, tzinfo=datetime.timezone.utc
            ) + datetime.timedelta(seconds=i * 30)
        seg.points.append(p)
    return g


def test_real_file_matches_known_values():
    m = compute_day(real_gpx())
    assert m.distance_m == pytest.approx(64_970, abs=100)
    assert m.elevation_gain_m == pytest.approx(547, abs=5)
    assert m.moving_time_s is not None and m.moving_time_s > 0
    assert m.avg_speed_mps == pytest.approx(
        m.moving_distance_m / m.moving_time_s, rel=0.01)
    assert m.start_time is not None
    assert len(m.geom) <= 210
    assert m.bbox is not None and set(m.bbox) == {"min_lat", "min_lon", "max_lat", "max_lon"}


def test_no_timestamps_means_no_time_or_speed_not_zero():
    m = compute_day(synthetic_gpx(with_times=False, with_ele=True))
    assert m.moving_time_s is None
    assert m.stopped_time_s is None
    assert m.avg_speed_mps is None
    assert m.max_speed_mps is None
    assert m.moving_distance_m is None
    assert m.start_time is None
    assert m.distance_m is not None and m.distance_m > 900  # geometry still measurable


def test_no_elevations_means_no_gain_not_zero():
    m = compute_day(synthetic_gpx(with_times=True, with_ele=False))
    assert m.elevation_gain_m is None
    assert m.elevation_loss_m is None
    assert m.min_elevation_m is None
    assert m.max_elevation_m is None


def test_empty_gpx_is_all_none_except_geom():
    m = compute_day(gpxpy.gpx.GPX())
    assert m.distance_m is None
    assert m.geom == []
    assert m.bbox is None


def test_downsample_keeps_ends_and_bounds_count():
    pts = [(34.8, 32.0 + i * 0.001, float(i)) for i in range(1000)]
    out = downsample(pts, target=200)
    assert 150 <= len(out) <= 210
    assert out[0] == [34.8, 32.0, 0.0]
    assert out[-1] == [34.8, pytest.approx(32.999), 999.0]


def test_downsample_short_input_passes_through():
    pts = [(34.8, 32.0, None), (34.9, 32.1, 5.0)]
    assert downsample(pts, target=200) == [[34.8, 32.0, None], [34.9, 32.1, 5.0]]


def test_slugify():
    assert slugify("Dan to Eilat — Cross Israel!") == "dan-to-eilat-cross-israel"
    assert slugify("   ") == "trip"


def test_sort_by_start_time_orders_days():
    a = synthetic_gpx(with_times=True)          # 09:00
    b = real_gpx()                              # 2021-03-12 09:42 UTC
    ordered = sort_gpx_by_start([("b.gpx", b), ("a.gpx", a)])
    assert [name for name, _ in ordered] == ["a.gpx", "b.gpx"]


def test_sort_files_without_times_go_last_in_given_order():
    no_time = synthetic_gpx(with_times=False)
    timed = synthetic_gpx(with_times=True)
    ordered = sort_gpx_by_start([("z.gpx", no_time), ("a.gpx", timed)])
    assert [name for name, _ in ordered] == ["a.gpx", "z.gpx"]
