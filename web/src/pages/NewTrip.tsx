import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ActivityType, Visibility } from '../lib/db-types';
import { API_URL } from '../lib/config';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { activityLabel } from '../lib/activity';

const ACTIVITIES: ActivityType[] = ['cycling', 'hiking', 'running', 'campervan', 'motorcycle', 'other'];

export function NewTrip() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [activity, setActivity] = useState<ActivityType>('cycling');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="p-10 text-[var(--dim)]">Loading…</p>;
  if (!user) {
    return (
      <p className="p-10 text-[var(--dim)]">
        <Link className="text-[var(--coral-deep)] underline" to="/signin">Sign in</Link> to create a trip.
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!files.length) { setError('Add at least one GPX file.'); return; }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Session expired — sign in again.');

      const form = new FormData();
      form.set('title', title);
      form.set('activity_type', activity);
      form.set('visibility', visibility);
      for (const f of files) form.append('files', f);

      const res = await fetch(`${API_URL}/api/v1/trips`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const detail = await res.json().then((b: { detail?: string }) => b.detail).catch(() => null);
        throw new Error(detail ?? `Upload failed (${res.status})`);
      }
      const body = (await res.json()) as { id: string };
      void navigate(`/trip/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="eyebrow mb-2">New trip</p>
      <h1 className="font-display text-4xl mb-10">A journey, day by day.</h1>

      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-8">
        <label className="flex flex-col gap-2">
          <span className="eyebrow">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dan to Eilat — Cross-Israel"
            className="bg-transparent border-0 border-b border-[var(--hair)] focus:border-[var(--coral)] py-2 font-display text-2xl text-[var(--ink-t)] outline-none"
          />
        </label>

        <fieldset className="border-0 p-0 m-0">
          <legend className="eyebrow mb-3">How you travelled</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {ACTIVITIES.map((a) => (
              <label key={a} className="flex items-baseline gap-2 cursor-pointer">
                <input
                  type="radio" name="activity" checked={activity === a}
                  onChange={() => setActivity(a)} className="accent-[#c94f32]"
                />
                <span className={activity === a ? 'text-[var(--coral-deep)]' : ''}>{activityLabel(a)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="eyebrow">GPX files — one per day, ordered by their timestamps</span>
          <input
            type="file" accept=".gpx,application/gpx+xml" multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-[var(--dim)] file:bg-[var(--coral)] file:text-white file:border-0 file:rounded-full file:px-4 file:py-2 file:mr-4 file:text-xs file:font-semibold file:uppercase file:tracking-widest"
          />
          {files.length > 0 && (
            <span className="text-[var(--dim)]">{files.length} file{files.length > 1 ? 's' : ''} — becomes {files.length} day{files.length > 1 ? 's' : ''}</span>
          )}
        </label>

        <fieldset className="border-0 p-0 m-0">
          <legend className="eyebrow mb-3">Who can see it</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(['private', 'unlisted', 'public'] as Visibility[]).map((v) => (
              <label key={v} className="flex items-baseline gap-2 cursor-pointer">
                <input
                  type="radio" name="vis" checked={visibility === v}
                  onChange={() => setVisibility(v)} className="accent-[#c94f32]"
                />
                <span className={visibility === v ? 'text-[var(--coral-deep)]' : ''}>{v}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p role="alert" className="text-[var(--coral-deep)]">{error}</p>}

        <button
          type="submit" disabled={busy}
          className="self-start bg-[var(--coral)] text-white px-8 py-3 eyebrow on-fill pill disabled:opacity-50"
        >
          {busy ? 'Reading your days…' : 'Create trip'}
        </button>
      </form>
    </div>
  );
}
