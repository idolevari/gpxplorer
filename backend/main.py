from fastapi import FastAPI, HTTPException, Response as APIResponse
from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import FileResponse # Removed unused
import os

app = FastAPI(title="GPXplorer API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_root():
    return {"message": "Welcome to GPXplorer API"}

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Trip Configuration
TRIPS = {
    "all-trips": {
        "name": "All Trips (Show Everything)",
        "description": "Visualize all available trips on the map simultaneously.",
        "type": "composite",
        "distinct_tracks": True,
        "files": [
            "dan_to_ginosar.gpx",
            "ginosar_to_aviel.gpx",
            "aviel_to_hod_hasharon.gpx",
            "hod_hasharon_to_tel_aviv.gpx",
            "tel_aviv_to_beer_sheva.gpx",
            "beer_sheva_to_sde_boker.gpx",
            "sde_boker_to_tzofar.gpx",
            "tzofar_to_yahel.gpx",
            "yahel_to_eilat.gpx"
        ]
    },
    "cross-israel": {
        "name": "Cross Israel Trail (Full)",
        "description": "The epic journey across Israel from North to South (Dan to Eilat).",
        "type": "composite",
        "distinct_tracks": True,
        "files": [
            "dan_to_ginosar.gpx",
            "ginosar_to_aviel.gpx",
            "aviel_to_hod_hasharon.gpx",
            "hod_hasharon_to_tel_aviv.gpx",
            "tel_aviv_to_beer_sheva.gpx",
            "beer_sheva_to_sde_boker.gpx",
            "sde_boker_to_tzofar.gpx",
            "tzofar_to_yahel.gpx",
            "yahel_to_eilat.gpx"
        ]
    },
    "dan-to-ginosar": {
        "name": "Dan to Ginosar",
        "description": "Segment 1: Northern Israel, from Dan to the Sea of Galilee.",
        "type": "single",
        "file": "dan_to_ginosar.gpx"
    },
    "ginosar-to-aviel": {
        "name": "Ginosar to Aviel",
        "description": "Segment 2: Lower Galilee to the Coast.",
        "type": "single",
        "file": "ginosar_to_aviel.gpx"
    },
    "aviel-to-hod-hasharon": {
        "name": "Aviel to Hod Hasharon",
        "description": "Segment 3: Along the Sharon plain.",
        "type": "single",
        "file": "aviel_to_hod_hasharon.gpx"
    },
    "hod-hasharon-to-tel-aviv": {
        "name": "Hod Hasharon to Tel Aviv",
        "description": "Segment 4: Urban trail into the Metropolis.",
        "type": "single",
        "file": "hod_hasharon_to_tel_aviv.gpx"
    },
    "tel-aviv-to-beer-sheva": {
        "name": "Tel Aviv to Beer Sheva",
        "description": "Segment 5: Central plains to the Negev capital.",
        "type": "single",
        "file": "tel_aviv_to_beer_sheva.gpx"
    },
    "beer-sheva-to-sde-boker": {
        "name": "Beer Sheva to Sde Boker",
        "description": "Segment 6: Into the Deep Desert.",
        "type": "single",
        "file": "beer_sheva_to_sde_boker.gpx"
    },
    "sde-boker-to-tzofar": {
        "name": "Sde Boker to Tzofar",
        "description": "Segment 7: Craters and Arava.",
        "type": "single",
        "file": "sde_boker_to_tzofar.gpx"
    },
    "tzofar-to-yahel": {
        "name": "Tzofar to Yahel",
        "description": "Segment 8: Southern Arava.",
        "type": "single",
        "file": "tzofar_to_yahel.gpx"
    },
    "yahel-to-eilat": {
        "name": "Yahel to Eilat",
        "description": "Segment 9: Eilat Mountains to the Red Sea.",
        "type": "single",
        "file": "yahel_to_eilat.gpx"
    }
}

@app.get("/api/trips")
async def get_trips():
    return [
        {"id": key, "name": val["name"], "description": val["description"]}
        for key, val in TRIPS.items()
    ]

@app.get("/api/trips/{trip_id}/download")
async def download_trip_gpx(trip_id: str):
    if trip_id not in TRIPS:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    trip = TRIPS[trip_id]
    import gpxpy
    import gpxpy.gpx
    
    base_path = "trips"
    files_to_merge = []
    # Default to merging into one track unless specified otherwise
    distinct_tracks = trip.get("distinct_tracks", False)

    if trip["type"] == "composite":
        files_to_merge = trip["files"]
    else:
        files_to_merge = [trip["file"]]

    merged_gpx = gpxpy.gpx.GPX()
    
    if distinct_tracks:
        # Create separate tracks for each file
        for fname in files_to_merge:
            fpath = os.path.join(base_path, fname)
            if os.path.exists(fpath):
                with open(fpath, 'r') as gpx_file:
                    gpx = gpxpy.parse(gpx_file)
                    # Create a new track for this file to preserve identity
                    # Use the file name or existing track name as the track name
                    for source_track in gpx.tracks:
                        new_track = gpxpy.gpx.GPXTrack(name=source_track.name or fname)
                        new_track.segments.extend(source_track.segments)
                        merged_gpx.tracks.append(new_track)
    else:
        # Merge all into one single track
        merged_track = gpxpy.gpx.GPXTrack(name=trip["name"])
        merged_gpx.tracks.append(merged_track)

        for fname in files_to_merge:
            fpath = os.path.join(base_path, fname)
            if os.path.exists(fpath):
                with open(fpath, 'r') as gpx_file:
                    gpx = gpxpy.parse(gpx_file)
                    for track in gpx.tracks:
                        for segment in track.segments:
                            merged_track.segments.append(segment)
    
    return APIResponse(
        content=merged_gpx.to_xml(), 
        media_type="application/gpx+xml", 
        headers={"Content-Disposition": f"attachment; filename={trip_id}.gpx"}
    )
