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
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-[#e6e0d2] bg-[#090d0c]">
        <p>Signed in as {user.email}</p>
        <button className="underline" onClick={() => void signOut()}>Sign out</button>
        <Link className="underline" to="/">Back to the map</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#090d0c] text-[#e6e0d2]">
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
          <h1 className="text-xl">Sign in to GPXplorer</h1>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            className="border border-[#e6e0d2]/30 bg-transparent px-3 py-2"
          />
          <button type="submit" className="bg-[#d4a04a] text-[#100c06] py-2">
            Send magic link
          </button>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        </form>
      )}
    </main>
  );
}
