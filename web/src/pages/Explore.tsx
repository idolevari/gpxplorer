import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TripRow } from '../lib/db-types';
import { listPublicTrips } from '../lib/trips';
import { activityLabel } from '../lib/activity';

export function Explore() {
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPublicTrips()
      .then(setTrips)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <p className="eyebrow mb-2">Public trips</p>
      <h1 className="font-display text-4xl mb-10">Explore</h1>

      {error && (
        <p role="alert" className="text-[var(--red)]">
          Couldn't load trips: {error}
        </p>
      )}
      {!error && trips === null && <p className="text-[var(--dim)]">Loading…</p>}
      {trips !== null && trips.length === 0 && (
        <p className="text-[var(--dim)]">
          Nothing public yet. The first published trip will appear here.
        </p>
      )}

      <ul className="list-none m-0 p-0">
        {trips?.map((t) => (
          <li key={t.id} className="hairline-t">
            <Link
              to={`/trip/${t.id}`}
              className="flex items-baseline gap-6 py-5 group flex-wrap"
            >
              <span className="font-display text-xl group-hover:text-[var(--amber)]">
                {t.title}
              </span>
              <span className="eyebrow">{activityLabel(t.activity_type)}</span>
              {t.start_date && (
                <span className="eyebrow ml-auto">
                  {t.start_date}{t.end_date && t.end_date !== t.start_date ? ` — ${t.end_date}` : ''}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
