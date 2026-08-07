import { useState } from 'react';
import type { TripRow, Visibility } from '../lib/db-types';
import { rotateShareToken, setTripVisibility } from '../lib/trips';

const OPTIONS: { v: Visibility; label: string; sub: string }[] = [
  { v: 'private',  label: 'Private',              sub: 'Only you.' },
  { v: 'unlisted', label: 'Anyone with the link', sub: 'Unguessable, revocable.' },
  { v: 'public',   label: 'Public',               sub: 'Listed in Explore.' },
];

export function OwnerPanel({ trip, onChanged }: { trip: TripRow; onChanged: (t: TripRow) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    trip.visibility === 'unlisted' && trip.share_token
      ? `${window.location.origin}/t/${trip.share_token}`
      : null;

  const change = (v: Visibility) => {
    setBusy(true);
    setError(null);
    setTripVisibility(trip.id, v)
      .then(onChanged)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const rotate = () => {
    setBusy(true);
    setError(null);
    rotateShareToken(trip.id)
      .then((token) => onChanged({ ...trip, share_token: token }))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <section className="hairline-t hairline-b py-4 my-6" aria-label="Sharing">
      <p className="eyebrow mb-3 text-[var(--amber)]">Who can see this</p>
      <div role="radiogroup" aria-label="Visibility" className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <label key={o.v} className="flex items-baseline gap-3 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              checked={trip.visibility === o.v}
              onChange={() => change(o.v)}
              disabled={busy}
              className="accent-[#d4a04a]"
            />
            <span className={trip.visibility === o.v ? 'text-[var(--amber)]' : ''}>{o.label}</span>
            <span className="text-[var(--dim)]">{o.sub}</span>
          </label>
        ))}
      </div>

      {shareUrl && (
        <div className="mt-4 flex items-baseline gap-3 flex-wrap">
          <code className="text-[var(--amber)] break-all">{shareUrl}</code>
          <button
            className="eyebrow hover:text-[var(--amber)]"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="eyebrow hover:text-[var(--red)]" onClick={rotate} disabled={busy}>
            Revoke &amp; reissue
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-[var(--red)]">{error}</p>}
    </section>
  );
}
