export interface Trip {
  id: string;
  name: string;
  description: string;
}

export interface TripStats {
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  moving_time_s: number;
  stopped_time_s: number;
  moving_distance_m: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
}

export interface ElevationPoint {
  distance: number;
  elevation: number;
  lat: number;
  lon: number;
}

export interface TripMetrics {
  stats: TripStats;
  graph: ElevationPoint[];
}

export interface AggregatedStats {
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  moving_time_s: number;
  stopped_time_s: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  max_elevation_m: number;
}
