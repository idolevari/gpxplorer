/**
 * Base URL for the GPXplorer API.
 * Override with VITE_API_URL; otherwise localhost in dev, Railway in prod.
 */
export const API_URL: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV
    ? 'http://localhost:8000'
    : 'https://gpxplorer-production.up.railway.app');
