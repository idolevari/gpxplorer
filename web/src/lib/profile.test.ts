import { describe, it, expect } from 'vitest';
import { geomToProfile, METRIC_PROFILES, metricRows } from './profile';
import { tripTotals } from './trips';
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

describe('geomToProfile', () => {
  it('accumulates distance across points and days', () => {
    // 0.01 deg latitude ≈ 1.11 km
    const d1 = day({ day_index: 1, geom_simplified: [[34.8, 32.0, 10], [34.8, 32.01, 20]] });
    const d2 = day({ day_index: 2, geom_simplified: [[34.8, 32.01, 20], [34.8, 32.02, 5]] });
    const prof = geomToProfile([d1, d2]);
    expect(prof).toHaveLength(4);
    expect(prof[0].distance).toBe(0);
    expect(prof[1].distance).toBeCloseTo(1.11, 1);
    // day 2 continues the axis instead of restarting at zero
    expect(prof[3].distance).toBeCloseTo(2.22, 1);
    expect(prof[3].dayIndex).toBe(2);
    expect(prof[3].elevation).toBe(5);
  });

  it('carries null elevations through rather than inventing zeros', () => {
    const d = day({ geom_simplified: [[34.8, 32.0, null], [34.8, 32.01, null]] });
    const prof = geomToProfile([d]);
    expect(prof[0].elevation).toBeNull();
  });

  it('skips days without geometry', () => {
    expect(geomToProfile([day({ geom_simplified: null })])).toEqual([]);
  });
});

describe('metric registry', () => {
  it('campervan hides climbing and speed, shows nights', () => {
    const keys = METRIC_PROFILES.campervan;
    expect(keys).not.toContain('climb');
    expect(keys).not.toContain('avg_speed');
    expect(keys).toContain('nights');
  });

  it('cycling shows climbing and weighted average speed', () => {
    const totals = tripTotals([
      day({ distance_m: 65_000, moving_distance_m: 64_000, moving_time_s: 13_369, elevation_gain_m: 547 }),
    ]);
    const rows = metricRows('cycling', totals, 1);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel['Distance']).toBe('65.0 km');
    expect(byLabel['Climb']).toBe('547 m');
    expect(byLabel['Avg speed']).toMatch(/km\/h$/);
  });

  it('unknowable metrics render as an em dash', () => {
    const totals = tripTotals([day({ distance_m: 65_000 })]);
    const rows = metricRows('cycling', totals, 1);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel['Avg speed']).toBe('—');
    expect(byLabel['Climb']).toBe('—');
  });
});
