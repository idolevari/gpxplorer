import { supabase } from './supabase';
import type { TripDayRow, TripRow, Visibility } from './db-types';

export async function listPublicTrips(): Promise<TripRow[]> {
  const { data, error } = await supabase
    .from('trips').select('*')
    .eq('visibility', 'public')
    .order('start_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TripRow[];
}

export async function listMyTrips(): Promise<TripRow[]> {
  const { data, error } = await supabase
    .from('trips').select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  // RLS already scopes this to public + own rows; filter to owned client-side
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  return ((data ?? []) as TripRow[]).filter((t) => t.owner_id === uid);
}

export async function getTripWithDays(
  id: string,
): Promise<{ trip: TripRow; days: TripDayRow[] } | null> {
  const { data: trip, error } = await supabase
    .from('trips').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!trip) return null;
  const { data: days, error: dayErr } = await supabase
    .from('trip_days').select('*').eq('trip_id', id).order('day_index');
  if (dayErr) throw new Error(dayErr.message);
  return { trip: trip as TripRow, days: (days ?? []) as TripDayRow[] };
}

export async function getTripByShareToken(
  token: string,
): Promise<{ trip: TripRow; days: TripDayRow[] } | null> {
  const { data: trips, error } = await supabase.rpc('get_trip_by_share_token', { token });
  if (error) throw new Error(error.message);
  const trip = (trips as TripRow[] | null)?.[0];
  if (!trip) return null;
  const { data: days, error: dayErr } = await supabase.rpc(
    'get_trip_days_by_share_token', { token });
  if (dayErr) throw new Error(dayErr.message);
  return { trip, days: (days ?? []) as TripDayRow[] };
}

export async function setTripVisibility(id: string, visibility: Visibility): Promise<TripRow> {
  const { data, error } = await supabase
    .from('trips').update({ visibility }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as TripRow;
}

export async function rotateShareToken(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_share_token', { trip: id });
  if (error) throw new Error(error.message);
  return data as string;
}

export interface TripTotals {
  distance_m: number | null;
  moving_distance_m: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  moving_time_s: number | null;
  stopped_time_s: number | null;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  max_elevation_m: number | null;
  min_elevation_m: number | null;
  days_with_unknown_gain: number;
}

function sumKnown(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

function maxKnown(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  return known.length ? Math.max(...known) : null;
}

function minKnown(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  return known.length ? Math.min(...known) : null;
}

export function tripTotals(days: TripDayRow[]): TripTotals {
  const movingDistance = sumKnown(days.map((d) => d.moving_distance_m));
  const movingTime = sumKnown(days.map((d) => d.moving_time_s));
  return {
    distance_m: sumKnown(days.map((d) => d.distance_m)),
    moving_distance_m: movingDistance,
    elevation_gain_m: sumKnown(days.map((d) => d.elevation_gain_m)),
    elevation_loss_m: sumKnown(days.map((d) => d.elevation_loss_m)),
    moving_time_s: movingTime,
    stopped_time_s: sumKnown(days.map((d) => d.stopped_time_s)),
    // Weighted from sums. Never the mean of per-day averages.
    avg_speed_mps:
      movingDistance != null && movingTime != null && movingTime > 0
        ? movingDistance / movingTime
        : null,
    max_speed_mps: maxKnown(days.map((d) => d.max_speed_mps)),
    max_elevation_m: maxKnown(days.map((d) => d.max_elevation_m)),
    min_elevation_m: minKnown(days.map((d) => d.min_elevation_m)),
    days_with_unknown_gain: days.filter((d) => d.elevation_gain_m == null).length,
  };
}
