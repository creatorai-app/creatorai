import type { Request } from 'express';
import { allowRequest, getClientIp } from './rate-limit';

/**
 * getClientIp is the key every anonymous limiter meters on, so whatever it
 * returns IS the identity being rate limited. `allowRequest` itself is covered
 * against the free-tools budget in free-tools.controller.spec.ts; what is
 * pinned here is the window's own behaviour and the header handling.
 */

const req = (headers: Record<string, unknown>, ip?: string) =>
  ({ headers, ip }) as unknown as Request;

describe('getClientIp', () => {
  it('prefers the first hop in x-forwarded-for, which is the real client', () => {
    // Caddy appends each proxy, so later entries are our own infrastructure.
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' }))).toBe('203.0.113.7');
  });

  it('trims the whitespace proxies leave after the comma', () => {
    expect(getClientIp(req({ 'x-forwarded-for': ' 203.0.113.7 ,10.0.0.1' }))).toBe('203.0.113.7');
  });

  it('falls back to the socket address when the header is absent', () => {
    expect(getClientIp(req({}, '198.51.100.4'))).toBe('198.51.100.4');
  });

  it('falls back when the header is present but empty', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '' }, '198.51.100.4'))).toBe('198.51.100.4');
  });

  it('returns a stable bucket rather than undefined when nothing identifies the caller', () => {
    // An undefined key would make every anonymous caller share one Map entry
    // silently; "unknown" makes that shared bucket explicit and still limited.
    expect(getClientIp(req({}))).toBe('unknown');
  });
});

describe('allowRequest', () => {
  const WINDOW = 60_000;
  let store: Map<string, number[]>;

  beforeEach(() => {
    store = new Map();
  });

  it('allows exactly `max` requests inside the window', () => {
    for (let i = 0; i < 3; i++) expect(allowRequest(store, 'ip', 1_000 + i, WINDOW, 3)).toBe(true);
    expect(allowRequest(store, 'ip', 1_004, WINDOW, 3)).toBe(false);
  });

  it('slides rather than resetting: one slot frees as the oldest hit ages out', () => {
    allowRequest(store, 'ip', 0, WINDOW, 2);
    allowRequest(store, 'ip', 30_000, WINDOW, 2);
    expect(allowRequest(store, 'ip', 59_000, WINDOW, 2)).toBe(false);

    // The hit at t=0 has now left the window; the one at t=30_000 has not.
    expect(allowRequest(store, 'ip', 60_001, WINDOW, 2)).toBe(true);
    expect(allowRequest(store, 'ip', 60_002, WINDOW, 2)).toBe(false);
  });

  it('does not extend the block when a rejected caller keeps retrying', () => {
    // A blocked request must not be recorded, or a hammering client would never
    // get back in.
    allowRequest(store, 'ip', 0, WINDOW, 1);
    for (let t = 1; t < 50; t++) allowRequest(store, 'ip', t, WINDOW, 1);
    expect(allowRequest(store, 'ip', 60_001, WINDOW, 1)).toBe(true);
  });

  it('meters each caller separately', () => {
    allowRequest(store, 'noisy', 0, WINDOW, 1);
    expect(allowRequest(store, 'noisy', 1, WINDOW, 1)).toBe(false);
    expect(allowRequest(store, 'quiet', 1, WINDOW, 1)).toBe(true);
  });

  it('blocks outright when the budget is zero', () => {
    expect(allowRequest(store, 'ip', 0, WINDOW, 0)).toBe(false);
  });

  it('prunes aged-out timestamps instead of growing the entry forever', () => {
    for (let i = 0; i < 5; i++) allowRequest(store, 'ip', i, WINDOW, 10);
    allowRequest(store, 'ip', 120_000, WINDOW, 10);
    expect(store.get('ip')).toEqual([120_000]);
  });
});
