import { describe, it, expect } from 'vitest';
import { aggregateTripMetrics } from './aggregate';
import type { TripMetrics } from './types';

function trip(distanceKm: number, movingSeconds: number, elevations: number[] = [10]): TripMetrics {
  return {
    stats: {
      distance_km: distanceKm,
      elevation_gain_m: 100,
      elevation_loss_m: 80,
      moving_time_s: movingSeconds,
      stopped_time_s: 60,
      moving_distance_m: distanceKm * 1000,
      max_speed_kmh: 50,
      avg_speed_kmh: (distanceKm * 1000) / movingSeconds * 3.6,
    },
    graph: elevations.map((elevation, i) => ({
      distance: i, elevation, lat: 0, lon: 0,
    })),
  };
}

describe('aggregateTripMetrics', () => {
  it('returns null for an empty selection', () => {
    expect(aggregateTripMetrics([])).toBeNull();
  });

  it('weights average speed by distance and time, not by trip count', () => {
    // 5 km at 10 km/h (1800 s) and 500 km at 40 km/h (45000 s).
    // Unweighted mean of the two averages would be 25 km/h — wrong.
    // Correct: 505000 m / 46800 s = 10.79 m/s = 38.8 km/h.
    const result = aggregateTripMetrics([trip(5, 1800), trip(500, 45000)]);
    expect(result!.stats.avg_speed_kmh).toBeCloseTo(38.8, 1);
    expect(result!.stats.avg_speed_kmh).not.toBeCloseTo(25, 0);
  });

  it('matches the single-trip average when only one trip is selected', () => {
    const result = aggregateTripMetrics([trip(100, 18000)]);
    expect(result!.stats.avg_speed_kmh).toBeCloseTo(20, 1);
  });

  it('reports zero average speed when nothing moved', () => {
    const result = aggregateTripMetrics([trip(0, 0)]);
    expect(result!.stats.avg_speed_kmh).toBe(0);
  });

  it('sums distance and elevation, and maxes peak elevation', () => {
    const result = aggregateTripMetrics([trip(10, 3600, [50, 900]), trip(20, 3600, [120])]);
    expect(result!.stats.distance_km).toBeCloseTo(30, 2);
    expect(result!.stats.elevation_gain_m).toBe(200);
    expect(result!.stats.max_elevation_m).toBe(900);
  });

  it('offsets each trip graph so distance runs continuously', () => {
    const a: TripMetrics = { ...trip(10, 3600), graph: [
      { distance: 0, elevation: 1, lat: 0, lon: 0 },
      { distance: 10, elevation: 2, lat: 0, lon: 0 },
    ] };
    const b: TripMetrics = { ...trip(5, 1800), graph: [
      { distance: 0, elevation: 3, lat: 0, lon: 0 },
      { distance: 5, elevation: 4, lat: 0, lon: 0 },
    ] };
    const graph = aggregateTripMetrics([a, b])!.graph;
    expect(graph.map(p => p.distance)).toEqual([0, 10, 10, 15]);
  });
});
