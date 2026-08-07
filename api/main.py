import os
from functools import lru_cache

import gpxpy
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="GPXplorer API")

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,https://gpxplorer.netlify.app",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

from trips_api import router as trips_router

app.include_router(trips_router)

TRIPS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trips")


@lru_cache(maxsize=32)
def load_gpx(filename: str):
    """Parse a GPX file once and keep it. The files are static at runtime."""
    path = os.path.join(TRIPS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="GPX file not found")
    with open(path, "r") as f:
        return gpxpy.parse(f)


TRIPS = {
    "dan-to-ginosar": {
        "name": "Dan to Ginosar",
        "description": "Northern segment starting from Dan.",
        "type": "single",
        "file": "dan_to_ginosar.gpx"
    },
    "ginosar-to-aviel": {
        "name": "Ginosar to Aviel",
        "description": "Continuing south through the Galilee.",
        "type": "single",
        "file": "ginosar_to_aviel.gpx"
    },
    "aviel-to-hod-hasharon": {
        "name": "Aviel to Hod Hasharon",
        "description": "Moving towards the center of the country.",
        "type": "single",
        "file": "aviel_to_hod_hasharon.gpx"
    },
    "hod-hasharon-to-tel-aviv": {
        "name": "Hod Hasharon to Tel Aviv",
        "description": "Approaching the metropolitan area.",
        "type": "single",
        "file": "hod_hasharon_to_tel_aviv.gpx"
    },
    "tel-aviv-to-beer-sheva": {
        "name": "Tel Aviv to Beer Sheva",
        "description": "Heading south into the desert gateway.",
        "type": "single",
        "file": "tel_aviv_to_beer_sheva.gpx"
    },
    "beer-sheva-to-sde-boker": {
        "name": "Beer Sheva to Sde Boker",
        "description": "Deep into the Negev desert.",
        "type": "single",
        "file": "beer_sheva_to_sde_boker.gpx"
    },
    "sde-boker-to-tzofar": {
        "name": "Sde Boker to Tzofar",
        "description": "Remote desert trails.",
        "type": "single",
        "file": "sde_boker_to_tzofar.gpx"
    },
    "tzofar-to-yahel": {
        "name": "Tzofar to Yahel",
        "description": "Continuing through the Arava.",
        "type": "single",
        "file": "tzofar_to_yahel.gpx"
    },
    "yahel-to-eilat": {
        "name": "Yahel to Eilat",
        "description": "The final stretch to the Red Sea.",
        "type": "single",
        "file": "yahel_to_eilat.gpx"
    }
}

def calculate_stats(gpx):
    """Calculates statistics for a parsed GPX object."""
    moving_data = gpx.get_moving_data()
    uphill, downhill = gpx.get_uphill_downhill()
    
    # Basic Stats
    stats = {
        "distance_km": round(gpx.length_3d() / 1000, 2),
        "elevation_gain_m": round(uphill),
        "elevation_loss_m": round(downhill),
        "moving_time_s": moving_data.moving_time,
        "stopped_time_s": moving_data.stopped_time,
        "moving_distance_m": round(moving_data.moving_distance, 1),
        "max_speed_kmh": round(moving_data.max_speed * 3.6, 1) if moving_data.max_speed else 0,
        "avg_speed_kmh": round(moving_data.moving_distance / moving_data.moving_time * 3.6, 1) if moving_data.moving_time > 0 else 0
    }
    
    # Graph Data Generation
    # We want a manageable number of points for the frontend (e.g., ~200)
    points = []
    for track in gpx.tracks:
        for segment in track.segments:
            points.extend(segment.points)
            
    total_points = len(points)
    target_points = 200
    step = max(1, total_points // target_points)
    
    graph_data = []
    dist_sum = 0
    prev_p = None
    
    for i, p in enumerate(points):
        if prev_p:
            d = p.distance_3d(prev_p)
            if d:
                dist_sum += d
        
        # Add point if it's a step interval OR the very last point
        if i % step == 0 or i == total_points - 1:
            graph_data.append({
                "distance": round(dist_sum / 1000, 2), # km
                "elevation": round(p.elevation, 1) if p.elevation else 0,
                "lat": p.latitude,
                "lon": p.longitude
            })
        
        prev_p = p
        
    return {
        "stats": stats,
        "graph": graph_data
    }

@app.get("/api/trips")
def get_trips():
    """Returns a list of available trips."""
    trip_list = []
    for trip_id, data in TRIPS.items():
        trip_list.append({
            "id": trip_id,
            "name": data["name"],
            "description": data["description"]
        })
    return trip_list

@app.get("/api/trips/{trip_id}/download")
def download_trip_gpx(trip_id: str):
    """Returns the raw GPX file."""
    if trip_id not in TRIPS:
        raise HTTPException(status_code=404, detail="Trip not found")

    filename = TRIPS[trip_id]["file"]
    path = os.path.join(TRIPS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="GPX file not found")

    return FileResponse(
        path, media_type="application/gpx+xml", filename=f"{trip_id}.gpx"
    )


@app.get("/api/trips/{trip_id}/metrics")
def get_trip_metrics(trip_id: str):
    """Returns statistics and elevation profile data for a trip."""
    if trip_id not in TRIPS:
        raise HTTPException(status_code=404, detail="Trip not found")

    return calculate_stats(load_gpx(TRIPS[trip_id]["file"]))
