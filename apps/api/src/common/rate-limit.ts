import type { Request } from 'express';

/**
 * ponytail: in-memory sliding-window limiter — fine for a single API instance.
 * Move to Redis (redis.ts is already wired) if the API scales horizontally.
 *
 * Shared by every anonymous public route (Hannah, the free /tools generators),
 * each passing its own store so one feature's traffic never exhausts another's
 * budget.
 */

/** Pure sliding-window check. Returns true if the request is allowed (and records it). */
export function allowRequest(
  store: Map<string, number[]>,
  ip: string,
  now: number,
  windowMs: number,
  max: number,
): boolean {
  const recent = (store.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    store.set(ip, recent);
    return false;
  }
  recent.push(now);
  store.set(ip, recent);
  return true;
}

/** Caller IP, honouring the proxy header Caddy sets in front of the API. */
export function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
  );
}
