import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('supabase config resolution', () => {
  it('prefers explicit env vars', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key-from-env');
    const { resolveSupabaseConfig } = await import('./supabase');
    expect(resolveSupabaseConfig(true)).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'key-from-env',
    });
  });

  it('falls back to the local stack in dev', async () => {
    const { resolveSupabaseConfig } = await import('./supabase');
    const cfg = resolveSupabaseConfig(true);
    expect(cfg.url).toBe('http://127.0.0.1:55321');
    // The anon key is a JWT; its "supabase-demo" issuer only shows up once
    // the payload segment is base64-decoded, not as a raw substring.
    const payload = cfg.anonKey.split('.')[1];
    expect(atob(payload)).toContain('supabase-demo');
  });

  it('throws in prod when env is missing, rather than shipping local keys', async () => {
    const { resolveSupabaseConfig } = await import('./supabase');
    expect(() => resolveSupabaseConfig(false)).toThrow(/VITE_SUPABASE_URL/);
  });
});
