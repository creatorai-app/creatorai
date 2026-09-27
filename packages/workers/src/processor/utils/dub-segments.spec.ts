import { alignToSpeech, assignVoices, buildTurns, pickReferenceLines, placeOnTimeline, planWindows, speechFromSilenceLog, splitIntoSegments, type Utterance } from './dub-segments';

describe('splitIntoSegments', () => {
  it('packs whole sentences up to the limit', () => {
    expect(splitIntoSegments('One two. Three four! Five six?', 20)).toEqual(['One two. Three four!', 'Five six?']);
  });

  it('keeps short text as one segment', () => {
    expect(splitIntoSegments('  Hola mundo.  ')).toEqual(['Hola mundo.']);
  });

  it('breaks after CJK and Devanagari sentence ends', () => {
    expect(splitIntoSegments('你好。再见。', 3)).toEqual(['你好。', '再见。']);
    expect(splitIntoSegments('नमस्ते। धन्यवाद।', 8)).toEqual(['नमस्ते।', 'धन्यवाद।']);
  });

  it('hard-splits a sentence longer than a segment, on spaces when it has them', () => {
    expect(splitIntoSegments('aaaa bbbb cccc dddd', 9)).toEqual(['aaaa bbbb', 'cccc dddd']);
    expect(splitIntoSegments('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('never exceeds the limit and loses no words', () => {
    const text = Array.from({ length: 200 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const segments = splitIntoSegments(text, 300);
    expect(segments.every((s) => s.length <= 300)).toBe(true);
    expect(segments.join(' ')).toBe(text);
  });

  // A resume trusts the segment numbers it stored, so the split must not drift.
  it('is deterministic', () => {
    const text = 'A. B. C. D. E. F. G.';
    expect(splitIntoSegments(text, 5)).toEqual(splitIntoSegments(text, 5));
  });
});

const u = (speaker: string, start: number, end: number, text = 'x'): Utterance => ({ speaker, start, end, text });

describe('buildTurns', () => {
  it('merges consecutive lines of one speaker and splits on a change of speaker', () => {
    const lines = [u('S1', 0, 2), u('S1', 2.5, 4), u('S2', 4.2, 6), u('S1', 6.1, 8)];
    const turns = buildTurns(lines, ['Hola.', 'Qué tal.', 'Bien.', 'Genial.']);
    expect(turns).toEqual([
      { speaker: 'S1', start: 0, text: 'Hola. Qué tal.' },
      { speaker: 'S2', start: 4.2, text: 'Bien.' },
      { speaker: 'S1', start: 6.1, text: 'Genial.' },
    ]);
  });

  it('keeps a real pause as its own placement', () => {
    const turns = buildTurns([u('S1', 0, 2), u('S1', 10, 12)], ['Uno.', 'Dos.']);
    expect(turns.map((t) => t.start)).toEqual([0, 10]);
  });

  it('skips lines without a translation and caps turn length', () => {
    const turns = buildTurns([u('S1', 0, 1), u('S1', 1, 2), u('S1', 2, 3)], ['aaaa', '', 'bbbb'], 6);
    expect(turns).toEqual([
      { speaker: 'S1', start: 0, text: 'aaaa' },
      { speaker: 'S1', start: 2, text: 'bbbb' },
    ]);
  });

  it('splits one overlong line into pieces that share its start', () => {
    const turns = buildTurns([u('S2', 5, 30)], ['aaaa bbbb cccc'], 9);
    expect(turns).toEqual([
      { speaker: 'S2', start: 5, text: 'aaaa bbbb' },
      { speaker: 'S2', start: 5, text: 'cccc' },
    ]);
  });
});

describe('placeOnTimeline', () => {
  it('keeps original start times when clips fit', () => {
    expect(placeOnTimeline([{ start: 0, duration: 2 }, { start: 5, duration: 1 }])).toEqual([0, 5]);
  });

  // A translation that runs long must push the next line later, never overlap it.
  it('pushes a clip back when the one before it ran long', () => {
    expect(placeOnTimeline([{ start: 0, duration: 7 }, { start: 5, duration: 1 }, { start: 20, duration: 1 }])).toEqual([0, 7, 20]);
  });
});

describe('pickReferenceLines', () => {
  it('takes the longest lines of that speaker only, trimmed, in time order', () => {
    const lines = [u('S1', 0, 2), u('S2', 2, 30), u('S1', 40, 50), u('S1', 60, 61)];
    const picked = pickReferenceLines(lines, 'S1', 45);
    expect(picked.map((p) => p.start)).toEqual([0.15, 40.15]);
    expect(picked[1].duration).toBeCloseTo(9.7);
  });

  it('stops once enough speech is collected', () => {
    const lines = [u('S1', 0, 30), u('S1', 40, 70), u('S1', 80, 110)];
    expect(pickReferenceLines(lines, 'S1', 45)).toHaveLength(2);
  });
});

describe('assignVoices', () => {
  it('lets a speaker with too little speech borrow the main voice', () => {
    const lines = [u('S1', 0, 20), u('S2', 20, 30), u('S3', 30, 31.5)];
    expect(assignVoices(lines)).toEqual({ S1: 'S1', S2: 'S2', S3: 'S1' });
  });

  it('returns null when nobody has enough speech to clone', () => {
    expect(assignVoices([u('S1', 0, 1.5), u('S2', 2, 3)])).toBeNull();
  });
});

describe('speechFromSilenceLog', () => {
  it('returns the stretches between silences, including an open silence at the end', () => {
    const log = [
      '[silencedetect @ 0x1] silence_start: 5.4',
      '[silencedetect @ 0x1] silence_end: 6.2 | silence_duration: 0.8',
      '[silencedetect @ 0x1] silence_start: 12.2',
    ].join('\n');
    expect(speechFromSilenceLog(log, 20)).toEqual([{ start: 0, end: 5.4 }, { start: 6.2, end: 12.2 }]);
  });

  it('handles leading silence and drops clicks', () => {
    const log = 'silence_start: 0\nsilence_end: 2 | x\nsilence_start: 2.05\nsilence_end: 3 | x';
    expect(speechFromSilenceLog(log, 4)).toEqual([{ start: 3, end: 4 }]);
  });
});

describe('planWindows', () => {
  const speech = [{ start: 0, end: 590 }, { start: 598, end: 1190 }, { start: 1195, end: 1500 }];

  it('cuts at the longest pause near each target', () => {
    expect(planWindows(speech, 1500, 600, 60)).toEqual([{ start: 0, end: 594 }, { start: 594, end: 1192.5 }, { start: 1192.5, end: 1500 }]);
  });

  it('keeps a short source as one window', () => {
    expect(planWindows(speech, 500, 600, 60)).toEqual([{ start: 0, end: 500 }]);
  });
});

describe('alignToSpeech', () => {
  const l = (speaker: string, text: string) => ({ speaker, text });

  it('puts each turn on its own stretch of speech when the text shares match', () => {
    const placed = alignToSpeech([l('S1', 'aaaa'), l('S2', 'bb'), l('S1', 'aaaa')], [
      { start: 0, end: 4 }, { start: 5, end: 7 }, { start: 8, end: 12 },
    ]);
    expect(placed.map((u) => [u.speaker, u.start, u.end])).toEqual([['S1', 0, 4], ['S2', 5, 7], ['S1', 8, 12]]);
  });

  it('gives a long turn several stretches, cutting only at pauses', () => {
    const placed = alignToSpeech([l('S1', 'a'.repeat(10)), l('S2', 'b'.repeat(30))], [
      { start: 0, end: 1 }, { start: 2, end: 3 }, { start: 4, end: 5 }, { start: 6, end: 7 },
    ]);
    expect(placed.map((u) => [u.start, u.end])).toEqual([[0, 1], [2, 7]]);
  });

  // Sentences of one turn with no pause between them share that turn's speech.
  it('spreads a turn\'s sentences over the turn by their share of the text', () => {
    const placed = alignToSpeech([l('S1', 'aaaa'), l('S1', 'aaaa'), l('S2', 'bb')], [{ start: 0, end: 8 }, { start: 9, end: 11 }]);
    expect(placed.map((u) => [u.speaker, u.start, u.end])).toEqual([['S1', 0, 4], ['S1', 4, 8], ['S2', 9, 11]]);
  });

  it('never starts a line inside a pause', () => {
    const placed = alignToSpeech([l('S1', 'aa'), l('S1', 'aa')], [{ start: 0, end: 2 }, { start: 5, end: 7 }]);
    expect(placed.map((u) => u.start)).toEqual([0, 5]);
  });

  it('spreads every line over the speech time when there are more turns than pauses', () => {
    const placed = alignToSpeech([l('S1', 'aa'), l('S2', 'aa'), l('S1', 'aa'), l('S2', 'aa')], [{ start: 0, end: 4 }, { start: 10, end: 14 }]);
    expect(placed.map((u) => u.start)).toEqual([0, 2, 10, 12]);
  });
});
