import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function SignIn() {
  const { user, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p>Signed in as {user.email}</p>
          <button className="underline" onClick={() => void signOut()}>Sign out</button>
          <Link className="underline" to="/">Back to the map</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full flex items-center justify-center">
      {sent ? (
        <p role="status">Check your email for the sign-in link.</p>
      ) : (
        <form
          className="flex flex-col gap-3 w-72"
          onSubmit={(e) => {
            e.preventDefault();
            void signInWithEmail(email).then(({ error }) => {
              if (error) setError(error);
              else setSent(true);
            });
          }}
        >
          <h1 className="font-display text-3xl mb-4">Sign in</h1>
          <p className="eyebrow mb-8">Magic link — no password</p>
          <input
            type="email"
            id="signin-email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            className="bg-transparent border-0 border-b border-[var(--hair)] focus:border-[var(--coral)] px-0 py-2 text-[var(--ink-t)] outline-none w-72"
          />
          <button type="submit" className="mt-6 bg-[var(--coral)] text-white px-6 py-3 eyebrow on-fill pill">
            Send link
          </button>
          {error && <p role="alert" className="text-[var(--coral-deep)] text-sm">{error}</p>}
        </form>
      )}
    </main>
  );
}
