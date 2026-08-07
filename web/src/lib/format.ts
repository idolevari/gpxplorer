const DASH = '—';

export function formatKm(metres: number | null): string {
  if (metres == null) return DASH;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function formatMetres(metres: number | null): string {
  if (metres == null) return DASH;
  return `${Math.round(metres)} m`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return DASH;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatSpeedKmh(mps: number | null): string {
  if (mps == null) return DASH;
  return `${(mps * 3.6).toFixed(1)} km/h`;
}
