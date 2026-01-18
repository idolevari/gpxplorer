import { useEffect, useState, useRef } from 'react';
import Map, { Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
// @ts-ignore
import * as togeojson from 'togeojson';
import bbox from '@turf/bbox';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const API_URL = import.meta.env.VITE_API_URL || 'https://gpxplorer-production.up.railway.app';

interface MapViewerProps {
    tripId: string | null;
}

const NEON_COLORS = [
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#f43f5e', // rose-500
    '#10b981', // emerald-500
    '#eab308', // yellow-500
    '#06b6d4', // cyan-500
];

export function MapViewer({ tripId }: MapViewerProps) {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const mapRef = useRef<MapRef>(null);

    useEffect(() => {
        if (!tripId) return;

        setIsLoading(true);
        // Fetch the selected trip GPX
        fetch(`${API_URL}/api/trips/${tripId}/download`)
            .then(response => response.text())
            .then(gpxText => {
                const parser = new DOMParser();
                const gpx = parser.parseFromString(gpxText, "application/xml");
                const converted = togeojson.gpx(gpx);

                // Assign distinct colors to features
                if (converted.features) {
                    converted.features.forEach((feature: any, index: number) => {
                        feature.properties = {
                            ...feature.properties,
                            color: NEON_COLORS[index % NEON_COLORS.length]
                        };
                    });
                }

                setGeoJsonData(converted);

                // Calculate bbox and fit bounds
                if (converted && converted.features.length > 0) {
                    const box = bbox(converted);
                    if (mapRef.current) {
                        mapRef.current.fitBounds(
                            [
                                [box[0], box[1]], // minLng, minLat
                                [box[2], box[3]]  // maxLng, maxLat
                            ],
                            { padding: 50, duration: 1000 }
                        );
                    }
                }
            })
            .catch(err => console.error("Error loading GPX:", err))
            .finally(() => setIsLoading(false));
    }, [tripId]);

    if (!MAPBOX_TOKEN) {
        return (
            <div className="flex items-center justify-center h-full bg-[#030712] text-[var(--text-secondary)]">
                <p>Please provide a Mapbox API Token in .env</p>
            </div>
        );
    }

    if (!tripId) {
        return (
            <div className="flex items-center justify-center h-full bg-[#030712] text-[var(--text-secondary)]">
                <p>Select a trip from the sidebar to view it on the map.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative group bg-[#030712]">
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#030712]/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 shadow-[0_0_15px_#3b82f6]"></div>
                        <span className="text-blue-400 text-xs font-mono uppercase tracking-widest">Loading Route Data</span>
                    </div>
                </div>
            )}
            <Map
                ref={mapRef}
                initialViewState={{
                    longitude: 34.8,
                    latitude: 31.5,
                    zoom: 7
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
            >
                {geoJsonData && (
                    <Source id="my-data" type="geojson" data={geoJsonData}>
                        {/* Glow Layer */}
                        <Layer
                            id="line-layer-glow"
                            type="line"
                            layout={{
                                "line-join": "round",
                                "line-cap": "round"
                            }}
                            paint={{
                                "line-color": ['get', 'color'],
                                "line-width": 12,
                                "line-opacity": 0.4,
                                "line-blur": 8
                            }}
                        />
                        {/* Core Line Layer */}
                        <Layer
                            id="line-layer-core"
                            type="line"
                            layout={{
                                "line-join": "round",
                                "line-cap": "round"
                            }}
                            paint={{
                                "line-color": ['get', 'color'],
                                "line-width": 3
                            }}
                        />
                    </Source>
                )}
            </Map>
        </div>
    );
}
