import { createClient } from '@supabase/supabase-js';

// The local anon key is the public supabase-demo JWT every local stack uses.
// It only ever works against a stack on your own machine.
const LOCAL_URL = 'http://127.0.0.1:55321';
const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export function resolveSupabaseConfig(isDev: boolean): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && anonKey) return { url, anonKey };
  if (isDev) return { url: LOCAL_URL, anonKey: LOCAL_ANON };
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for production builds',
  );
}

const cfg = resolveSupabaseConfig(import.meta.env.DEV);
export const supabase = createClient(cfg.url, cfg.anonKey);
