import { allowRequest } from '../common/rate-limit';
import {
  IdeaSchema,
  ScriptSchema,
  StorySchema,
  ClaimSchema,
  WINDOW_MS,
  MAX_PER_WINDOW,
} from './free-tools.controller';

// Every free generation now carries the visitor's localStorage session id, so
// the run can be handed to the account they create afterwards.
const SESSION = '11111111-2222-4333-8444-555555555555';

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
    expect(IdeaSchema.safeParse({ sessionId: SESSION, niche: '' }).success).toBe(false);
    expect(IdeaSchema.safeParse({ sessionId: SESSION, niche: 'ab' }).success).toBe(false);
    expect(IdeaSchema.safeParse({ sessionId: SESSION, niche: 'home espresso' }).success).toBe(true);
  });

  it('caps the free script well under the paid feature range', () => {
    expect(ScriptSchema.safeParse({ sessionId: SESSION, topic: 'espresso', duration: 1200 }).success).toBe(false);
    expect(ScriptSchema.safeParse({ sessionId: SESSION, topic: 'espresso', duration: 30 }).success).toBe(false);

    const ok = ScriptSchema.safeParse({ sessionId: SESSION, topic: 'espresso', duration: 300 });
    expect(ok.success).toBe(true);
  });

  it('defaults tone and duration so the form can omit them', () => {
    const parsed = ScriptSchema.parse({ sessionId: SESSION, topic: 'why espresso tastes sour' });
    expect(parsed.tone).toBe('conversational');
    expect(parsed.duration).toBe(180);
  });

  it('rejects a tone the prompt does not handle', () => {
    expect(ScriptSchema.safeParse({ sessionId: SESSION, topic: 'espresso', tone: 'sarcastic' }).success).toBe(false);
  });
});

describe('free tools session and claim', () => {
  it('requires a session id, since a run with no session can never be claimed', () => {
    expect(IdeaSchema.safeParse({ niche: 'home espresso' }).success).toBe(false);
    expect(ScriptSchema.safeParse({ topic: 'why espresso tastes sour' }).success).toBe(false);
    expect(StorySchema.safeParse({ videoTopic: 'why espresso tastes sour' }).success).toBe(false);
  });

  it('rejects a session id that is not a uuid, so it cannot be a guessable string', () => {
    expect(IdeaSchema.safeParse({ sessionId: 'me', niche: 'home espresso' }).success).toBe(false);
  });

  it('needs BOTH ids to claim: a run id alone travels in a URL', () => {
    expect(ClaimSchema.safeParse({ runId: SESSION }).success).toBe(false);
    expect(ClaimSchema.safeParse({ sessionId: SESSION }).success).toBe(false);
    expect(ClaimSchema.safeParse({ runId: SESSION, sessionId: SESSION }).success).toBe(true);
  });
});

describe('free story blueprint input', () => {
  it('defaults every structural choice so the form can submit a topic alone', () => {
    const parsed = StorySchema.parse({ sessionId: SESSION, videoTopic: 'why espresso tastes sour' });
    expect(parsed.audienceLevel).toBe('general');
    expect(parsed.videoDuration).toBe('medium');
    expect(parsed.contentType).toBe('tutorial');
    expect(parsed.storyMode).toBe('conversational');
  });

  it('rejects values outside the paid feature enums, so a claimed row stays valid', () => {
    const base = { sessionId: SESSION, videoTopic: 'why espresso tastes sour' };
    expect(StorySchema.safeParse({ ...base, videoDuration: 'epic' }).success).toBe(false);
    expect(StorySchema.safeParse({ ...base, contentType: 'vlog' }).success).toBe(false);
    expect(StorySchema.safeParse({ ...base, storyMode: 'chaotic' }).success).toBe(false);
  });
});
