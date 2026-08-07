import { describe, it, expect } from 'vitest';
import { TRIP_SELECT, rotateShareToken, setTripVisibility, tripTotals } from './trips';
import type { TripDayRow } from './db-types';

function day(over: Partial<TripDayRow>): TripDayRow {
  return {
    id: 'd', trip_id: 't', day_index: 1, date: null, title: null, notes: null,
    gpx_path: null, distance_m: null, moving_distance_m: null,
    elevation_gain_m: null, elevation_loss_m: null, moving_time_s: null,
    stopped_time_s: null, max_speed_mps: null, avg_speed_mps: null,
    min_elevation_m: null, max_elevation_m: null, start_lat: null,
    start_lon: null, end_lat: null, end_lon: null, bbox: null,
    geom_simplified: null, created_at: '', ...over,
  };
}

describe('tripTotals', () => {
  it('weights average speed by distance and time, never averaging averages', () => {
    const totals = tripTotals([
      day({ moving_distance_m: 5_000, moving_time_s: 1_800 }),
      day({ moving_distance_m: 500_000, moving_time_s: 45_000 }),
    ]);
    // 505000/46800 m/s = 38.85 km/h — not (10+40)/2
    expect(totals.avg_speed_mps! * 3.6).toBeCloseTo(38.8, 1);
  });

  it('null days are excluded from sums, not counted as zero', () => {
    const totals = tripTotals([
      day({ distance_m: 10_000, elevation_gain_m: 100 }),
      day({ distance_m: 20_000, elevation_gain_m: null }),
    ]);
    expect(totals.distance_m).toBe(30_000);
    expect(totals.elevation_gain_m).toBe(100);
    expect(totals.days_with_unknown_gain).toBe(1);
  });

  it('a trip with no knowable speed reports null, not 0', () => {
    const totals = tripTotals([day({ distance_m: 10_000 })]);
    expect(totals.avg_speed_mps).toBeNull();
    expect(totals.moving_time_s).toBeNull();
  });

  it('max elevation is a max across knowable days', () => {
    const totals = tripTotals([
      day({ max_elevation_m: 803 }),
      day({ max_elevation_m: 148 }),
      day({}),
    ]);
    expect(totals.max_elevation_m).toBe(803);
  });
});

describe('sharing mutations', () => {
  it('exposes the expected signatures', () => {
    expect(typeof setTripVisibility).toBe('function');
    expect(setTripVisibility.length).toBe(2);
    expect(typeof rotateShareToken).toBe('function');
    expect(rotateShareToken.length).toBe(1);
  });
});

describe('trip queries', () => {
  it('TRIP_SELECT embeds the profiles relation', () => {
    expect(TRIP_SELECT).toContain('profiles(handle, display_name)');
  });
});
