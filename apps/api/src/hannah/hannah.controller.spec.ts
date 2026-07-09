import { allowRequest } from './hannah.controller';

describe('allowRequest (Hannah rate limiter)', () => {
  it('allows up to max, blocks the next, then recovers after the window', () => {
    const store = new Map<string, number[]>();
    const t = 1_000_000;

    // 3 allowed within window
    expect(allowRequest(store, 'ip', t, 1000, 3)).toBe(true);
    expect(allowRequest(store, 'ip', t + 1, 1000, 3)).toBe(true);
    expect(allowRequest(store, 'ip', t + 2, 1000, 3)).toBe(true);
    // 4th blocked
    expect(allowRequest(store, 'ip', t + 3, 1000, 3)).toBe(false);
    // after the window elapses, old hits expire -> allowed again
    expect(allowRequest(store, 'ip', t + 1001, 1000, 3)).toBe(true);
    // separate IP is independent
    expect(allowRequest(store, 'other', t + 3, 1000, 3)).toBe(true);
  });
});
