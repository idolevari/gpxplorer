export type ActivityType =
  | 'cycling' | 'hiking' | 'running' | 'campervan' | 'motorcycle' | 'other';
export type Visibility = 'private' | 'unlisted' | 'public';
export type Fidelity = 'recorded' | 'reconstructed' | 'hybrid';

export interface TripRow {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string | null;
  activity_type: ActivityType;
  visibility: Visibility;
  share_token: string | null;
  fidelity: Fidelity;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface TripDayRow {
  id: string;
  trip_id: string;
  day_index: number;
  date: string | null;
  title: string | null;
  notes: string | null;
  gpx_path: string | null;
  distance_m: number | null;
  moving_distance_m: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  moving_time_s: number | null;
  stopped_time_s: number | null;
  max_speed_mps: number | null;
  avg_speed_mps: number | null;
  min_elevation_m: number | null;
  max_elevation_m: number | null;
  start_lat: number | null;
  start_lon: number | null;
  end_lat: number | null;
  end_lon: number | null;
  bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number } | null;
  geom_simplified: [number, number, number | null][] | null;
  created_at: string;
}
