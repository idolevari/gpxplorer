import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { ContourField } from '../components/ContourField';

export function Landing() {
  const { user } = useAuth();
  return (
    <div className="relative min-h-full overflow-hidden">
      <ContourField />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 42%, rgba(9,13,12,0.2), rgba(9,13,12,0.9) 78%)',
        }}
      />
      <div className="relative max-w-3xl mx-auto px-6 py-24 lg:py-36 text-center">
        <p className="eyebrow mb-6 text-[var(--amber)]">The exploration journal</p>
        <h1 className="font-display text-5xl lg:text-7xl leading-[1.02] mb-8 text-balance">
          Keep the ground you covered.
        </h1>
        <p className="text-[var(--dim)] text-[15px] leading-relaxed max-w-xl mx-auto mb-12">
          Upload a GPX track and GPXplorer draws the journey, day by day — honest numbers
          for how you actually travelled, at one link you decide who can open.
        </p>
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <Link
            to={user ? '/new' : '/signin'}
            className="bg-[var(--amber)] text-[var(--amber-ink)] px-8 py-4 eyebrow on-fill"
          >
            Start a trip
          </Link>
          <Link to="/trips" className="eyebrow pb-1 border-b border-[var(--hair)] hover:text-[var(--amber)] hover:border-[var(--amber)]">
            Explore public trips
          </Link>
        </div>

        <dl className="mt-24 grid grid-cols-3 gap-6 text-left max-w-xl mx-auto hairline-t pt-8">
          <div>
            <dt className="eyebrow mb-1">Cycling</dt>
            <dd className="m-0 text-[var(--dim)]">Climb, moving time, honest averages</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">On foot</dt>
            <dd className="m-0 text-[var(--dim)]">Ascent and high points, no vanity speed</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Campervan</dt>
            <dd className="m-0 text-[var(--dim)]">Distance and nights — never fake climbing</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
