import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function Shell() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-[var(--paper)] hairline-b flex items-baseline gap-8 px-6 py-4 flex-wrap">
        <Link to="/" className="font-display text-xl tracking-wide text-[var(--ink-t)]">
          GPXplorer
        </Link>
        <nav className="flex items-baseline gap-6" aria-label="Primary">
          <NavLink
            to="/trips"
            className={({ isActive }) =>
              `eyebrow pb-1 border-b ${isActive ? 'text-[var(--coral-deep)] border-[var(--coral)]' : 'border-transparent hover:text-[var(--ink-t)]'}`
            }
          >
            Explore
          </NavLink>
          {user && (
            <NavLink
              to="/new"
              className={({ isActive }) =>
                `eyebrow pb-1 border-b ${isActive ? 'text-[var(--coral-deep)] border-[var(--coral)]' : 'border-transparent hover:text-[var(--ink-t)]'}`
              }
            >
              New trip
            </NavLink>
          )}
        </nav>
        <div className="ml-auto">
          {user ? (
            <button onClick={() => void signOut()} className="eyebrow hover:text-[var(--coral-deep)]">
              Sign out
            </button>
          ) : (
            <Link to="/signin" className="eyebrow hover:text-[var(--coral-deep)]">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
