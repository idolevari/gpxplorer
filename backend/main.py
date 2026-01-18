from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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

@app.get("/api/trip/example")
async def get_example_trip():
    # Return metadata and URL for the example trip
    # For now, we'll just mock it or serve a file if we had one.
    return {
        "id": "example-trip",
        "name": "Classic Trek",
        "description": "A beautiful scenic route.",
        "gpx_url": "/api/trip/example/download"
    }

# Placeholder for GPX file serving
# In a real app, this would serve a file from disk or S3
@app.get("/api/trip/example/download")
async def download_example_gpx():
    # We will create a dummy GPX file or read a real one
    file_path = "example.gpx"
    if not os.path.exists(file_path):
         # Create a dummy GPX for demonstration
        with open(file_path, "w") as f:
            f.write("""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPXplorer">
  <trk>
    <name>Example Loop</name>
    <trkseg>
      <trkpt lat="37.7749" lon="-122.4194"><ele>10</ele></trkpt>
      <trkpt lat="37.7750" lon="-122.4195"><ele>12</ele></trkpt>
      <trkpt lat="37.7751" lon="-122.4196"><ele>15</ele></trkpt>
    </trkseg>
  </trk>
</gpx>""")
    return FileResponse(file_path, media_type='application/gpx+xml', filename='example.gpx')
