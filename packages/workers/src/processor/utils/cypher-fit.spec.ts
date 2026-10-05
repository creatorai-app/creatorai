import {
  compressTail,
  DEFAULT_MAX_TEMPO,
  expectedSpeechSeconds,
  isRunaway,
  maxTempoFromEnv,
  planFit,
  SHORTEN_THRESHOLD_SECONDS,
} from './cypher-fit';

describe('planFit', () => {
  const fit = (rawSeconds: number, availableSeconds: number, shortened = false) =>
    planFit({ rawSeconds, availableSeconds, maxTempo: 1.15, shortened });

  it('leaves a turn that fits alone', () => {
    expect(fit(2, 3)).toEqual({ tempo: 1, shorten: false });
    expect(fit(3, 3)).toEqual({ tempo: 1, shorten: false });
  });

  it('speeds up a small overrun, just enough and never over the cap', () => {
    const plan = fit(3.3, 3);
    expect(plan.shorten).toBe(false);
    expect(plan.tempo).toBeGreaterThanOrEqual(1.1);
    expect(plan.tempo).toBeLessThanOrEqual(1.101);
    expect(fit(3.45, 3).tempo).toBeLessThanOrEqual(1.15);
  });

  it('asks for a shorter line when even the cap leaves too much over', () => {
    // 5 s at 1.15x is 4.35 s: 1.35 s over a 3 s slot.
    expect(fit(5, 3)).toEqual({ tempo: 1, shorten: true, targetSeconds: 3 });
  });

  it('only shortens once, then takes the cap and lets the rest spill', () => {
    expect(fit(5, 3, true)).toEqual({ tempo: 1.15, shorten: false });
  });

  it('does not shorten for an overrun under the threshold', () => {
    const raw = (3 + SHORTEN_THRESHOLD_SECONDS - 0.05) * 1.15;
    expect(fit(raw, 3)).toEqual({ tempo: 1.15, shorten: false });
  });
});

describe('runaway clips', () => {
  it('estimates speaking time by script', () => {
    expect(expectedSpeechSeconds('Hello there, how are you today?')).toBeCloseTo(0.3 + 24 * 0.07, 5);
    expect(expectedSpeechSeconds('你好吗')).toBeCloseTo(0.3 + 3 * 0.22, 5);
    expect(expectedSpeechSeconds('')).toBe(0.3);
  });

  it('flags a clip far longer than its text, and not a slow one', () => {
    const text = 'Thanks for watching.';
    expect(isRunaway(2.5, text)).toBe(false);
    expect(isRunaway(4, text)).toBe(false);
    expect(isRunaway(12, text)).toBe(true);
  });
});

describe('compressTail', () => {
  it('leaves a dub that ends inside the source alone', () => {
    const fit = compressTail([{ start: 0, duration: 2, tempo: 1 }, { start: 5, duration: 2, tempo: 1 }], 10, 1.15);
    expect(fit).toEqual({ factors: [1, 1], offsets: [0, 5], truncateAt: null });
  });

  it('speeds up the last turn just enough to end with the source', () => {
    const fit = compressTail([{ start: 0, duration: 2, tempo: 1 }, { start: 8, duration: 2.2, tempo: 1 }], 10, 1.15);
    expect(fit.factors[0]).toBe(1);
    expect(fit.factors[1]).toBeCloseTo(1.1, 2);
    expect(fit.truncateAt).toBeNull();
  });

  it('walks back through pushed turns when the last one alone is not enough', () => {
    // Each turn ran long and pushed the next: 0-4, 4-8, 8-11 against a 10 s source.
    const clips = [
      { start: 0, duration: 4, tempo: 1 },
      { start: 3, duration: 4, tempo: 1 },
      { start: 6, duration: 3, tempo: 1 },
    ];
    const fit = compressTail(clips, 10, 1.15);
    expect(fit.factors[2]).toBe(1.15);
    expect(fit.factors[1]).toBe(1.15);
    expect(fit.factors[0]).toBeGreaterThan(1);
    expect(fit.truncateAt).toBeNull();
    const end = fit.offsets[2] + 3 / fit.factors[2];
    expect(end).toBeLessThanOrEqual(10 + 1e-6);
  });

  it('does not speed up a turn that is not pushing the end back', () => {
    // The last turn starts at its own time; earlier turns cannot pull it forward.
    const clips = [{ start: 0, duration: 4, tempo: 1 }, { start: 8, duration: 3, tempo: 1 }];
    const fit = compressTail(clips, 10, 1.15);
    expect(fit.factors[1]).toBe(1.15);
    expect(fit.truncateAt).toBe(10);
  });

  it('counts a turn\'s own tempo against the cap', () => {
    const fit = compressTail([{ start: 8, duration: 3, tempo: 1.15 }], 10, 1.15);
    expect(fit.factors).toEqual([1]);
    expect(fit.truncateAt).toBe(10);
  });

  it('says where to cut when compressing cannot make it fit', () => {
    const fit = compressTail([{ start: 0, duration: 20, tempo: 1 }], 10, 1.15);
    expect(fit.factors[0]).toBe(1.15);
    expect(fit.truncateAt).toBe(10);
  });
});

describe('maxTempoFromEnv', () => {
  it('reads CYPHER_MAX_TEMPO, clamped to a sane range', () => {
    expect(maxTempoFromEnv({})).toBe(DEFAULT_MAX_TEMPO);
    expect(maxTempoFromEnv({ CYPHER_MAX_TEMPO: '1.2' })).toBe(1.2);
    expect(maxTempoFromEnv({ CYPHER_MAX_TEMPO: '3' })).toBe(1.5);
    expect(maxTempoFromEnv({ CYPHER_MAX_TEMPO: '0.5' })).toBe(1);
    expect(maxTempoFromEnv({ CYPHER_MAX_TEMPO: 'fast' })).toBe(DEFAULT_MAX_TEMPO);
  });
});
