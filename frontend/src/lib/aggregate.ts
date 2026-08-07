import type { AggregatedStats, ElevationPoint, TripMetrics } from './types';

/**
 * Combines per-trip metrics into one set of figures.
 *
 * Average speed is weighted: total moving distance over total moving time.
 * Averaging the per-trip averages would let a 5 km ride count as much as a
 * 500 km one.
 */
export function aggregateTripMetrics(
  results: TripMetrics[],
): { stats: AggregatedStats; graph: ElevationPoint[] } | null {
  if (results.length === 0) return null;

  let distanceKm = 0;
  let gain = 0;
  let loss = 0;
  let movingTimeS = 0;
  let stoppedTimeS = 0;
  let movingDistanceM = 0;
  let maxSpeedKmh = 0;
  let maxElevationM = -Infinity;

  for (const { stats, graph } of results) {
    distanceKm += stats.distance_km;
    gain += stats.elevation_gain_m;
    loss += stats.elevation_loss_m;
    movingTimeS += stats.moving_time_s;
    stoppedTimeS += stats.stopped_time_s;
    movingDistanceM += stats.moving_distance_m;
    maxSpeedKmh = Math.max(maxSpeedKmh, stats.max_speed_kmh);
    for (const point of graph) {
      maxElevationM = Math.max(maxElevationM, point.elevation);
    }
  }

  const avgSpeedKmh =
    movingTimeS > 0 ? (movingDistanceM / movingTimeS) * 3.6 : 0;

  let offset = 0;
  const graph: ElevationPoint[] = [];
  for (const result of results) {
    for (const point of result.graph) {
      graph.push({ ...point, distance: round(point.distance + offset, 2) });
    }
    const last = result.graph[result.graph.length - 1];
    if (last) offset += last.distance;
  }

  return {
    stats: {
      distance_km: round(distanceKm, 2),
      elevation_gain_m: Math.round(gain),
      elevation_loss_m: Math.round(loss),
      moving_time_s: movingTimeS,
      stopped_time_s: stoppedTimeS,
      max_speed_kmh: round(maxSpeedKmh, 1),
      avg_speed_kmh: round(avgSpeedKmh, 1),
      max_elevation_m: maxElevationM === -Infinity ? 0 : Math.round(maxElevationM),
    },
    graph,
  };
}

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
