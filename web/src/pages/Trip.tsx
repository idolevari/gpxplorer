import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { TripDayRow, TripRow } from '../lib/db-types';
import { formatDuration, formatKm, formatMetres } from '../lib/format';
import { geomToProfile, metricRows } from '../lib/profile';
import type { ProfilePoint } from '../lib/profile';
import { getTripByShareToken, getTripWithDays, tripTotals } from '../lib/trips';
import { API_URL } from '../lib/config';
import { useAuth } from '../lib/auth-context';
import { activityLabel } from '../lib/activity';
import { TripMap } from '../components/TripMap';
import { ElevationStrip } from '../components/ElevationStrip';
import { OwnerPanel } from '../components/OwnerPanel';

export function Trip({ mode }: { mode: 'id' | 'token' }) {
  const params = useParams();
  const key = mode === 'id' ? params.id : params.token;
  const { user } = useAuth();

  const [data, setData] = useState<{ trip: TripRow; days: TripDayRow[] } | null | 'loading'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<ProfilePoint | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);

  useEffect(() => {
    void import('../lib/supabase').then(({ supabase }) =>
      supabase.auth.getSession().then(({ data }) => setSession(data.session)),
    );
  }, []);

  useEffect(() => {
    if (!key) return;
    setData('loading');
    const fetcher = mode === 'id' ? getTripWithDays(key) : getTripByShareToken(key);
    fetcher
      .then((res) => setData(res))
      .catch((e: Error) => setError(e.message));
  }, [key, mode]);

  const profile = useMemo(
    () => (data !== 'loading' && data ? geomToProfile(data.days) : []),
    [data],
  );

  if (error) {
    return <p role="alert" className="p-10 text-[var(--red)]">Couldn't load this trip: {error}</p>;
  }
  if (data === 'loading') {
    return <p className="p-10 text-[var(--dim)]">Loading…</p>;
  }
  if (data === null) {
    return (
      <div className="p-10">
        <p className="font-display text-2xl mb-2">Nothing here.</p>
        <p className="text-[var(--dim)]">
          This trip doesn't exist, isn't shared, or the link was revoked.
        </p>
      </div>
    );
  }

  const { trip, days } = data;
  const totals = tripTotals(days);
  const isOwner = user != null && user.id === trip.owner_id;

  const downloadDay = (day: TripDayRow) => {
    const tokenParam = mode === 'token' ? `?token=${encodeURIComponent(key ?? '')}` : '';
    void fetch(`${API_URL}/api/v1/trips/${trip.id}/days/${day.day_index}/gpx-url${tokenParam}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<{ url: string }>;
      })
      .then(({ url }) => window.open(url, '_blank'))
      .catch(() => setError('Could not sign a download link for this day.'));
  };

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-0">
      {/* left: the sheet */}
      <div className="lg:w-[420px] shrink-0 overflow-y-auto px-6 py-8 lg:hairline-r">
        <p className="eyebrow mb-2">
          {activityLabel(trip.activity_type)}
          {trip.fidelity === 'reconstructed' && ' · reconstructed'}
          {mode === 'token' && ' · shared link'}
        </p>
        <h1 className="font-display text-4xl leading-tight mb-2">{trip.title}</h1>
        {trip.description && (
          <p className="text-[var(--dim)] leading-relaxed mb-6 max-w-prose">{trip.description}</p>
        )}

        {isOwner && mode === 'id' && (
          <OwnerPanel
            trip={trip}
            onChanged={(t) => setData({ trip: t, days })}
          />
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 my-8">
          {metricRows(trip.activity_type, totals, days.length).map((r) => (
            <div key={r.label}>
              <dt className="eyebrow">{r.label}</dt>
              <dd className="font-display text-2xl m-0 tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>

        <p className="eyebrow hairline-t pt-4 mb-3">Days</p>
        <ol className="list-none m-0 p-0">
          {days.map((d) => (
            <li key={d.id} className="hairline-t flex items-baseline gap-3 py-3">
              <span className="eyebrow w-8 shrink-0">{String(d.day_index).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1 truncate">
                {d.title ?? d.date ?? `Day ${d.day_index}`}
              </span>
              <span className="text-[var(--dim)] tabular-nums">{formatKm(d.distance_m)}</span>
              <span className="text-[var(--dim)] tabular-nums hidden sm:inline">
                {formatMetres(d.elevation_gain_m)}
              </span>
              <span className="text-[var(--dim)] tabular-nums hidden sm:inline">
                {formatDuration(d.moving_time_s)}
              </span>
              {d.gpx_path && (
                <button
                  onClick={() => downloadDay(d)}
                  className="eyebrow hover:text-[var(--amber)]"
                  aria-label={`Download GPX for day ${d.day_index}`}
                >
                  gpx
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* right: map above elevation. The empty band on the far right is the
          phase-4 chat column's slot -- a column gets added, not a restructure. */}
      <div className="flex-1 min-h-[420px] flex flex-col min-w-0">
        <div className="flex-1 min-h-0">
          <TripMap days={days} hovered={hovered} />
        </div>
        <div className="hairline-t">
          <ElevationStrip profile={profile} onHover={setHovered} />
        </div>
      </div>
    </div>
  );
}
