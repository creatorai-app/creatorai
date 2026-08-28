import { allowRequest } from '../common/rate-limit';
import {
  IdeaSchema,
  ScriptSchema,
  WINDOW_MS,
  MAX_PER_WINDOW,
} from './free-tools.controller';

describe('free tools rate limit', () => {
  it('allows MAX_PER_WINDOW generations per IP, then blocks until the window rolls', () => {
    const store = new Map<string, number[]>();
    const t = 1_000_000;

    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      expect(allowRequest(store, 'ip', t + i, WINDOW_MS, MAX_PER_WINDOW)).toBe(true);
    }
    expect(allowRequest(store, 'ip', t + MAX_PER_WINDOW, WINDOW_MS, MAX_PER_WINDOW)).toBe(false);

    // Once the oldest hit ages out of the window the visitor is served again,
    // rather than being locked out for good.
    expect(allowRequest(store, 'ip', t + WINDOW_MS + 1, WINDOW_MS, MAX_PER_WINDOW)).toBe(true);
  });

  it('meters each IP separately so one visitor cannot exhaust another', () => {
    const store = new Map<string, number[]>();
    const t = 1_000_000;

    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      allowRequest(store, 'noisy', t + i, WINDOW_MS, MAX_PER_WINDOW);
    }
    expect(allowRequest(store, 'noisy', t + MAX_PER_WINDOW, WINDOW_MS, MAX_PER_WINDOW)).toBe(false);
    expect(allowRequest(store, 'other', t + MAX_PER_WINDOW, WINDOW_MS, MAX_PER_WINDOW)).toBe(true);
  });
});

describe('free tools input validation', () => {
  it('rejects an empty or too-short niche', () => {
    expect(IdeaSchema.safeParse({ niche: '' }).success).toBe(false);
    expect(IdeaSchema.safeParse({ niche: 'ab' }).success).toBe(false);
    expect(IdeaSchema.safeParse({ niche: 'home espresso' }).success).toBe(true);
  });

  it('caps the free script well under the paid feature range', () => {
    expect(ScriptSchema.safeParse({ topic: 'espresso', duration: 1200 }).success).toBe(false);
    expect(ScriptSchema.safeParse({ topic: 'espresso', duration: 30 }).success).toBe(false);

    const ok = ScriptSchema.safeParse({ topic: 'espresso', duration: 300 });
    expect(ok.success).toBe(true);
  });

  it('defaults tone and duration so the form can omit them', () => {
    const parsed = ScriptSchema.parse({ topic: 'why espresso tastes sour' });
    expect(parsed.tone).toBe('conversational');
    expect(parsed.duration).toBe(180);
  });

  it('rejects a tone the prompt does not handle', () => {
    expect(ScriptSchema.safeParse({ topic: 'espresso', tone: 'sarcastic' }).success).toBe(false);
  });
});
