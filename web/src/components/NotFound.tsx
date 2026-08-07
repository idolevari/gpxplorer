import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="p-10 max-w-xl">
      <p className="eyebrow mb-2">404</p>
      <h1 className="font-display text-3xl mb-4">There's no trail here.</h1>
      <p className="text-[var(--dim)] mb-6">
        The page you're after doesn't exist or has moved.
      </p>
      <Link to="/" className="eyebrow border-b border-[var(--hair)] hover:text-[var(--amber)]">
        Back to the start
      </Link>
    </div>
  );
}
