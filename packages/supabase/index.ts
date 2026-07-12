import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CookieOptions, createServerClient } from '@supabase/ssr';
import type IORedis from 'ioredis';

// Server-side client for API & workers (service_role key, no session management)
export const createSupabaseClient = (supabaseUrl: string, supabaseKey: string): SupabaseClient => {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// SSR client for frontend (with cookies)
export const createSupabaseServerClient = (
  supabaseUrl: string,
  supabaseKey: string,
  cookies: {
    getAll: () => Array<{ name: string; value: string; options?: CookieOptions }>;
    setAll: (cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) => void;
  }
) => {
  return createServerClient(supabaseUrl, supabaseKey, { cookies });
};

// Shared env vars
export const getSupabaseEnv = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
});
export const getSupabaseServiceEnv = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  key: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
});

export type { SupabaseClient };

// Single shared ioredis connection for BullMQ across the API and workers (was
// duplicated in apps/api/src/redis.ts + packages/workers/src/redis.ts).
//
// ioredis is imported dynamically (repo idiom, see genai.ts/gcs.ts) so this
// browser-consumed package never pulls a Node-only lib into a client bundle.
// keepAlive + retryStrategy stop hosted-Redis proxies from idle-culling the
// socket (the ECONNRESET churn), and the error handler downgrades the expected
// reconnect noise to a single line instead of a bare stack per reset.
let sharedRedis: IORedis | null = null;

export async function getRedisConnection(): Promise<IORedis> {
  if (sharedRedis) return sharedRedis;

  const mod = await (Function('return import("ioredis")')() as Promise<{
    default: new (url: string, opts?: Record<string, unknown>) => IORedis;
  }>);
  const Redis = mod.default;

  const conn = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    keepAlive: 30000,
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  });

  conn.on('error', (err: NodeJS.ErrnoException) => {
    // Expected churn on hosted Redis — ioredis reconnects on its own.
    if (err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT') return;
    console.error('[redis]', err?.message ?? err);
  });

  sharedRedis = conn;
  return conn;
}