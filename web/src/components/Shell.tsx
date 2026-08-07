import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function Shell() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-full flex flex-col">
      {/* One row at every width: flex-nowrap + tighter mobile gaps keep the
          auth affordance inline at 390px instead of wrapping to its own row.
          h-16 pins the height exactly — the trip page's lg:h-[calc(100vh-64px)]
          depends on it (a font-derived height is fractional and drifts). */}
      <header className="bg-[var(--paper)] hairline-b h-16 flex flex-nowrap items-baseline gap-4 sm:gap-8 px-4 sm:px-6 pt-4">
        <Link
          to="/"
          className="font-display text-xl tracking-wide text-[var(--ink-t)] whitespace-nowrap shrink-0"
        >
          GPXplorer
        </Link>
        <nav className="flex flex-nowrap items-baseline gap-4 sm:gap-6" aria-label="Primary">
          <NavLink
            to="/trips"
            className={({ isActive }) =>
              `eyebrow whitespace-nowrap pb-1 border-b ${isActive ? 'text-[var(--coral-deep)] border-[var(--coral)]' : 'border-transparent hover:text-[var(--ink-t)]'}`
            }
          >
            Explore
          </NavLink>
          {user && (
            <NavLink
              to="/new"
              className={({ isActive }) =>
                `eyebrow whitespace-nowrap pb-1 border-b ${isActive ? 'text-[var(--coral-deep)] border-[var(--coral)]' : 'border-transparent hover:text-[var(--ink-t)]'}`
              }
            >
              New trip
            </NavLink>
          )}
        </nav>
        <div className="ml-auto shrink-0">
          {user ? (
            <button
              onClick={() => void signOut()}
              className="eyebrow whitespace-nowrap hover:text-[var(--coral-deep)]"
            >
              Sign out
            </button>
          ) : (
            <Link to="/signin" className="eyebrow whitespace-nowrap hover:text-[var(--coral-deep)]">
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
