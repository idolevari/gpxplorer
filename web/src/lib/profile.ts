import type { ActivityType, TripDayRow } from './db-types';
import { formatDuration, formatKm, formatMetres, formatSpeedKmh } from './format';
import type { TripTotals } from './trips';

export interface ProfilePoint {
  distance: number;
  elevation: number | null;
  lat: number;
  lon: number;
  dayIndex: number;
}

const EARTH_R = 6_371_000;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

/** Flattens day geometries into one profile with a continuous km axis. */
export function geomToProfile(days: TripDayRow[]): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  let cumKm = 0;
  for (const dayRow of days) {
    const geom = dayRow.geom_simplified;
    if (!geom || geom.length === 0) continue;
    let prev: [number, number] | null = null;
    for (const [lon, lat, ele] of geom) {
      if (prev) cumKm += haversineM(prev[1], prev[0], lat, lon) / 1000;
      out.push({
        distance: Math.round(cumKm * 100) / 100,
        elevation: ele ?? null,
        lat,
        lon,
        dayIndex: dayRow.day_index,
      });
      prev = [lon, lat];
    }
  }
  return out;
}

export type MetricKey =
  | 'distance' | 'climb' | 'descent' | 'moving_time'
  | 'avg_speed' | 'max_elevation' | 'nights';

/** Which metrics MEAN anything per activity — spec §6. A van is not a bike. */
export const METRIC_PROFILES: Record<ActivityType, MetricKey[]> = {
  cycling:    ['distance', 'climb', 'descent', 'moving_time', 'avg_speed', 'max_elevation'],
  running:    ['distance', 'climb', 'moving_time', 'avg_speed'],
  hiking:     ['distance', 'climb', 'descent', 'moving_time', 'max_elevation'],
  campervan:  ['distance', 'moving_time', 'nights'],
  motorcycle: ['distance', 'moving_time', 'nights'],
  other:      ['distance', 'moving_time'],
};

export function metricRows(
  activity: ActivityType,
  totals: TripTotals,
  dayCount: number,
): { label: string; value: string }[] {
  const all: Record<MetricKey, { label: string; value: string }> = {
    distance:      { label: 'Distance',      value: formatKm(totals.distance_m) },
    climb:         { label: 'Climb',         value: formatMetres(totals.elevation_gain_m) },
    descent:       { label: 'Descent',       value: formatMetres(totals.elevation_loss_m) },
    moving_time:   { label: 'Moving',        value: formatDuration(totals.moving_time_s) },
    avg_speed:     { label: 'Avg speed',     value: formatSpeedKmh(totals.avg_speed_mps) },
    max_elevation: { label: 'High point',    value: formatMetres(totals.max_elevation_m) },
    nights:        { label: 'Nights',        value: dayCount > 1 ? String(dayCount - 1) : '—' },
  };
  return METRIC_PROFILES[activity].map((k) => all[k]);
}
