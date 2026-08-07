import { useMemo, useRef } from 'react';
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import type { ExpressionSpecification } from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { TripDayRow } from '../lib/db-types';
import type { ProfilePoint } from '../lib/profile';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export interface TripMapProps {
  days: TripDayRow[];
  hovered: ProfilePoint | null;
  /** Day under the cursor/viewport (day-sync from the trip page's day list).
      Its line renders full coral and wider; every other day drops to 40%
      opacity. null/undefined means no highlight — every day renders the same. */
  highlightDay?: number | null;
}

export function TripMap({ days, hovered, highlightDay = null }: TripMapProps) {
  const mapRef = useRef<MapRef>(null);

  const geojson: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: days
        .filter((d) => d.geom_simplified && d.geom_simplified.length > 1)
        .map((d) => ({
          type: 'Feature',
          properties: { day: d.day_index },
          geometry: {
            type: 'LineString',
            coordinates: d.geom_simplified!.map(([lon, lat]) => [lon, lat]),
          },
        })),
    }),
    [days],
  );

  const bounds = useMemo(() => {
    const boxes = days.map((d) => d.bbox).filter((b): b is NonNullable<typeof b> => b != null);
    if (!boxes.length) return null;
    return {
      minLon: Math.min(...boxes.map((b) => b.min_lon)),
      minLat: Math.min(...boxes.map((b) => b.min_lat)),
      maxLon: Math.max(...boxes.map((b) => b.max_lon)),
      maxLat: Math.max(...boxes.map((b) => b.max_lat)),
    };
  }, [days]);

  // Highlighting is state, not motion — it applies the same whether or not
  // the user prefers reduced motion.
  const glowOpacity = useMemo<number | ExpressionSpecification>(
    () =>
      highlightDay == null
        ? 0.25
        : ['case', ['==', ['get', 'day'], highlightDay], 0.3, 0.08],
    [highlightDay],
  );
  const lineOpacity = useMemo<number | ExpressionSpecification>(
    () =>
      highlightDay == null
        ? 1
        : ['case', ['==', ['get', 'day'], highlightDay], 1, 0.4],
    [highlightDay],
  );
  const lineWidth = useMemo<number | ExpressionSpecification>(
    () =>
      highlightDay == null
        ? 2
        : ['case', ['==', ['get', 'day'], highlightDay], 3, 2],
    [highlightDay],
  );

  if (!TOKEN) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--dim)]">
        Set VITE_MAPBOX_TOKEN to see the map.
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={TOKEN}
      mapStyle="mapbox://styles/mapbox/light-v11"
      initialViewState={
        bounds
          ? { bounds: [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat], fitBoundsOptions: { padding: 60 } }
          : { longitude: 34.8, latitude: 31.5, zoom: 6 }
      }
      attributionControl={false}
    >
      <Source id="route" type="geojson" data={geojson}>
        <Layer
          id="route-glow"
          type="line"
          paint={{ 'line-color': '#c94f32', 'line-width': 8, 'line-opacity': glowOpacity, 'line-blur': 4 }}
        />
        <Layer
          id="route-core"
          type="line"
          paint={{ 'line-color': '#c94f32', 'line-width': lineWidth, 'line-opacity': lineOpacity }}
        />
      </Source>
      {hovered && (
        <Marker longitude={hovered.lon} latitude={hovered.lat}>
          <div
            aria-hidden="true"
            className="w-3 h-3 rounded-full bg-[var(--coral)] ring-4 ring-[rgba(201,79,50,0.3)]"
          />
        </Marker>
      )}
    </Map>
  );
}
