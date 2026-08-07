import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TripRow, Visibility } from '../lib/db-types';
import { deleteTrip, listMyTrips, setTripVisibility } from '../lib/trips';
import { activityLabel } from '../lib/activity';
import { useAuth } from '../lib/auth-context';

const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: 'Private',
  unlisted: 'Link',
  public: 'Public',
};

// Distinct treatment per tier: private is quiet (outline only), unlisted is
// a soft coral tint (something is out there, unindexed), public is a solid
// coral fill (the loudest — it's on Explore).
const VISIBILITY_CLASS: Record<Visibility, string> = {
  private: 'border border-[var(--hair)] text-[var(--dim)]',
  unlisted: 'bg-[var(--coral-soft)] text-[var(--coral-deep)]',
  public: 'bg-[var(--coral)] text-white',
};

function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return (
    <span className={`eyebrow pill px-2.5 py-1 shrink-0 ${VISIBILITY_CLASS[visibility]}`}>
      {VISIBILITY_LABEL[visibility]}
    </span>
  );
}

function TripCard({
  trip,
  onChanged,
  onDeleted,
}: {
  trip: TripRow;
  onChanged: (t: TripRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    trip.visibility === 'unlisted' && trip.share_token
      ? `${window.location.origin}/t/${trip.share_token}`
      : null;

  const changeVisibility = (v: Visibility) => {
    setBusy(true);
    setError(null);
    setTripVisibility(trip.id, v)
      .then(onChanged)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const remove = () => {
    if (!window.confirm(`Delete "${trip.title}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    deleteTrip(trip.id)
      .then(() => onDeleted(trip.id))
      .catch((e: Error) => {
        setError(e.message);
        setBusy(false);
      });
  };

  return (
    <li className="card">
      <div className="flex items-baseline gap-4 px-6 py-5 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <Link
            to={`/trip/${trip.id}`}
            className="font-display text-xl hover:text-[var(--coral-deep)] break-words"
          >
            {trip.title}
          </Link>
          <span className="eyebrow">
            {activityLabel(trip.activity_type)}
            {trip.start_date &&
              ` · ${trip.start_date}${
                trip.end_date && trip.end_date !== trip.start_date ? ` — ${trip.end_date}` : ''
              }`}
          </span>
        </div>

        <VisibilityBadge visibility={trip.visibility} />

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2">
            <span className="eyebrow">Visibility</span>
            <select
              aria-label={`Visibility for ${trip.title}`}
              value={trip.visibility}
              disabled={busy}
              onChange={(e) => changeVisibility(e.target.value as Visibility)}
              className="bg-transparent border border-[var(--hair)] rounded pill px-3 py-2 min-h-11 text-sm disabled:opacity-50"
            >
              <option value="private">Private</option>
              <option value="unlisted">Link</option>
              <option value="public">Public</option>
            </select>
          </label>

          {shareUrl && (
            <button
              className="eyebrow hover:text-[var(--coral-deep)] min-h-11 px-2"
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          )}

          <button
            className="eyebrow text-[var(--coral-deep)] hover:opacity-70 min-h-11 px-2 disabled:opacity-50"
            onClick={remove}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="px-6 pb-4 -mt-2 text-[var(--coral-deep)]">
          {error}
        </p>
      )}
    </li>
  );
}

export function MyTrips() {
  const { user, loading } = useAuth();
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listMyTrips()
      .then(setTrips)
      .catch((e: Error) => setError(e.message));
  }, [user]);

  if (loading) return <p className="p-10 text-[var(--dim)]">Loading…</p>;
  if (!user) {
    return (
      <p className="p-10 text-[var(--dim)]">
        <Link className="text-[var(--coral-deep)] underline" to="/signin">
          Sign in
        </Link>{' '}
        to see your trips.
      </p>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <p className="eyebrow mb-2">Your trips</p>
      <h1 className="font-display text-4xl mb-10">My trips</h1>

      {error && (
        <p role="alert" className="text-[var(--coral-deep)]">
          Couldn't load trips: {error}
        </p>
      )}
      {!error && trips === null && <p className="text-[var(--dim)]">Loading…</p>}
      {trips !== null && trips.length === 0 && (
        <p className="text-[var(--dim)]">
          Nothing yet.{' '}
          <Link className="text-[var(--coral-deep)] underline" to="/new">
            Create your first trip
          </Link>
          .
        </p>
      )}

      <ul className="list-none m-0 p-0 flex flex-col gap-4">
        {trips?.map((t) => (
          <TripCard
            key={t.id}
            trip={t}
            onChanged={(updated) =>
              setTrips((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null)
            }
            onDeleted={(id) => setTrips((prev) => prev?.filter((x) => x.id !== id) ?? null)}
          />
        ))}
      </ul>
    </div>
  );
}
