import { describe, it, expect } from 'vitest';
import { formatKm, formatMetres, formatDuration, formatSpeedKmh } from './format';

describe('null-aware formatting', () => {
  it('renders unknowable as an em dash, never 0', () => {
    expect(formatKm(null)).toBe('—');
    expect(formatMetres(null)).toBe('—');
    expect(formatDuration(null)).toBe('—');
    expect(formatSpeedKmh(null)).toBe('—');
  });

  it('formats real values', () => {
    expect(formatKm(64_970)).toBe('65.0 km');
    expect(formatMetres(547)).toBe('547 m');
    expect(formatDuration(13_369)).toBe('3h 42m');
    expect(formatSpeedKmh(4.861)).toBe('17.5 km/h');
  });

  it('zero is a real value, not unknowable', () => {
    expect(formatMetres(0)).toBe('0 m');
  });
});
