import { useEffect, useState, useRef } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
// @ts-ignore
import * as togeojson from 'togeojson';
import bbox from '@turf/bbox';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : 'https://gpxplorer-production.up.railway.app';

interface MapViewerProps {
    tripIds: string[];
    hoveredPoint?: { lat: number, lon: number } | null;
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

export function MapViewer({ tripIds, hoveredPoint }: MapViewerProps) {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const mapRef = useRef<MapRef>(null);

    useEffect(() => {
        if (tripIds.length === 0) {
            setGeoJsonData(null);
            return;
        }

        setIsLoading(true);

        const fetchPromises = tripIds.map((id, index) =>
            fetch(`${API_URL}/api/trips/${id}/download`)
                .then(res => res.text())
                .then(gpxText => {
                    const parser = new DOMParser();
                    const gpx = parser.parseFromString(gpxText, "application/xml");
                    const converted = togeojson.gpx(gpx);

                    // Assign color to all features of this trip
                    const color = NEON_COLORS[index % NEON_COLORS.length];
                    if (converted.features) {
                        converted.features.forEach((feature: any) => {
                            feature.properties = {
                                ...feature.properties,
                                color: color,
                                tripId: id
                            };
                        });
                    }
                    return converted;
                })
        );

        Promise.all(fetchPromises)
            .then(results => {
                // Merge all feature collections
                const allFeatures = results.flatMap((fc: any) => fc.features || []);
                const combinedGeoJson = {
                    type: "FeatureCollection" as const,
                    features: allFeatures
                };

                setGeoJsonData(combinedGeoJson);

                // Fit bounds to all trips
                if (allFeatures.length > 0) {
                    // @ts-ignore
                    const box = bbox(combinedGeoJson);
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
            .catch(err => {
                console.error("Error loading trips:", err);
            })
            .finally(() => {
                setIsLoading(false);
            });

    }, [tripIds]);

    if (!MAPBOX_TOKEN) {
        return (
            <div className="flex items-center justify-center h-full bg-[#030712] text-[var(--text-secondary)]">
                <p>Please provide a Mapbox API Token in .env</p>
            </div>
        );
    }

    if (tripIds.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-[#030712] text-[var(--text-secondary)]">
                <p>Select trips from the sidebar to view them on the map.</p>
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
            {/* Custom Zoom Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <button
                    onClick={() => mapRef.current?.zoomIn()}
                    className="w-10 h-10 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-colors flex items-center justify-center backdrop-blur-md shadow-lg"
                    aria-label="Zoom In"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                </button>
                <button
                    onClick={() => mapRef.current?.zoomOut()}
                    className="w-10 h-10 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-colors flex items-center justify-center backdrop-blur-md shadow-lg"
                    aria-label="Zoom Out"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                    </svg>
                </button>
            </div>
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

                {/* Hover Marker */}
                {hoveredPoint && (
                    <Marker longitude={hoveredPoint.lon} latitude={hoveredPoint.lat} anchor="center">

                        <div className="relative z-[9999]">
                            <div className="absolute -inset-4 rounded-full bg-[var(--accent-primary)] opacity-50 animate-ping"></div>
                            <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] border-4 border-white shadow-[0_0_20px_var(--accent-primary)] box-content"></div>
                        </div>
                    </Marker>
                )}
            </Map>
        </div>
    );
}
