import { useMemo, useRef } from 'react';
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import type { FeatureCollection } from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { TripDayRow } from '../lib/db-types';
import type { ProfilePoint } from '../lib/profile';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export interface TripMapProps {
  days: TripDayRow[];
  hovered: ProfilePoint | null;
}

export function TripMap({ days, hovered }: TripMapProps) {
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
      mapStyle="mapbox://styles/mapbox/dark-v11"
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
          paint={{ 'line-color': '#c94f32', 'line-width': 8, 'line-opacity': 0.25, 'line-blur': 4 }}
        />
        <Layer
          id="route-core"
          type="line"
          paint={{ 'line-color': '#c94f32', 'line-width': 2 }}
        />
      </Source>
      {hovered && (
        <Marker longitude={hovered.lon} latitude={hovered.lat}>
          <div
            aria-hidden="true"
            className="w-3 h-3 rounded-full bg-[var(--amber)] ring-4 ring-[rgba(212,160,74,0.3)]"
          />
        </Marker>
      )}
    </Map>
  );
}
