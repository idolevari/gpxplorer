import { useEffect, useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
// @ts-ignore
import { parse } from 'togeojson';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const API_URL = 'http://localhost:8000'; // In dev

export function MapViewer() {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);

    useEffect(() => {
        // Fetch the example GPX file
        fetch(`${API_URL}/api/trip/example/download`)
            .then(response => response.text())
            .then(gpxText => {
                const parser = new DOMParser();
                const gpx = parser.parseFromString(gpxText, "application/xml");
                const converted = parse(gpx);
                setGeoJsonData(converted);
            })
            .catch(err => console.error("Error loading GPX:", err));
    }, []);

    if (!MAPBOX_TOKEN) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
                <p>Please provide a Mapbox API Token in .env</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            <Map
                initialViewState={{
                    longitude: -122.4194,
                    latitude: 37.7749,
                    zoom: 12
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/outdoors-v12"
                mapboxAccessToken={MAPBOX_TOKEN}
            >
                {geoJsonData && (
                    <Source id="my-data" type="geojson" data={geoJsonData}>
                        <Layer
                            id="line-layer"
                            type="line"
                            layout={{
                                "line-join": "round",
                                "line-cap": "round"
                            }}
                            paint={{
                                "line-color": "#2563eb",
                                "line-width": 4
                            }}
                        />
                    </Source>
                )}
            </Map>
        </div>
    );
}
