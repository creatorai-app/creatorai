import {
  alignToSpeech,
  assignVoices,
  buildTurns,
  cypherTimeline,
  pickReferenceLines,
  placeOnTimeline,
  planWindows,
  speechFromSilenceLog,
  splitIntoSegments,
  TURN_MAX_CHARS,
  TURN_MAX_GAP_SECONDS,
  type Utterance,
} from './dub-segments';

describe('splitIntoSegments', () => {
  it('packs whole sentences up to the limit', () => {
    expect(splitIntoSegments('One two. Three four! Five six?', 20)).toEqual(['One two. Three four!', 'Five six?']);
  });

  it('keeps short text as one segment', () => {
    expect(splitIntoSegments('  Hola mundo.  ')).toEqual(['Hola mundo.']);
  });

  it('defaults to the 300-character turn cap', () => {
    const long = Array.from({ length: 30 }, (_, i) => `Frase número ${i}.`).join(' ');
    const parts = splitIntoSegments(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= TURN_MAX_CHARS)).toBe(true);
  });

  it('splits an overlong CJK sentence after a clause mark, not mid-word', () => {
    expect(splitIntoSegments('我们今天讨论，一个很重要的问题', 8)).toEqual(['我们今天讨论，', '一个很重要的问题']);
    expect(splitIntoSegments('これはテストです、とても長い文章', 9)).toEqual(['これはテストです、', 'とても長い文章']);
  });

  it('splits Thai, which has no sentence marks, at the spaces between its clauses', () => {
    expect(splitIntoSegments('สวัสดีครับ วันนี้อากาศดีมาก เราไปเที่ยวกันไหม', 17)).toEqual(['สวัสดีครับ', 'วันนี้อากาศดีมาก', 'เราไปเที่ยวกันไหม']);
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
  const view = (turns: ReturnType<typeof buildTurns>) => turns.map(({ speaker, start, text }) => ({ speaker, start, text }));

  it('merges consecutive lines of one speaker and splits on a change of speaker', () => {
    const lines = [u('S1', 0, 2), u('S1', 2.5, 4), u('S2', 4.2, 6), u('S1', 6.1, 8)];
    const turns = buildTurns(lines, ['Hola.', 'Qué tal.', 'Bien.', 'Genial.'], 10);
    expect(view(turns)).toEqual([
      { speaker: 'S1', start: 0, text: 'Hola. Qué tal.' },
      { speaker: 'S2', start: 4.2, text: 'Bien.' },
      { speaker: 'S1', start: 6.1, text: 'Genial.' },
    ]);
    expect(turns.map((t) => t.lines)).toEqual([[0, 1], [2], [3]]);
  });

  it('gives each turn its source end and the time until the next one starts', () => {
    const turns = buildTurns([u('S1', 0, 2), u('S2', 3, 5), u('S1', 9, 10)], ['a', 'b', 'c'], 12);
    expect(turns.map((t) => [t.end, t.available])).toEqual([[2, 3], [5, 6], [10, 3]]);
  });

  it('never merges across a pause longer than the gap rule', () => {
    const gap = TURN_MAX_GAP_SECONDS;
    const turns = buildTurns([u('S1', 0, 2), u('S1', 2 + gap + 0.01, 5), u('S1', 5 + gap, 8)], ['Uno.', 'Dos.', 'Tres.'], 10);
    expect(view(turns).map((t) => t.text)).toEqual(['Uno.', 'Dos. Tres.']);
  });

  it('keeps a real pause as its own placement', () => {
    const turns = buildTurns([u('S1', 0, 2), u('S1', 10, 12)], ['Uno.', 'Dos.'], 12);
    expect(turns.map((t) => t.start)).toEqual([0, 10]);
  });

  it('caps a turn at 300 characters, so no call glues several long sentences together', () => {
    const sentence = `${'a'.repeat(140)}.`;
    const lines = [u('S1', 0, 3), u('S1', 3, 6), u('S1', 6, 9)];
    const turns = buildTurns(lines, [sentence, sentence, sentence], 9);
    expect(turns.every((t) => t.text.length <= TURN_MAX_CHARS)).toBe(true);
    expect(turns.map((t) => t.lines)).toEqual([[0, 1], [2]]);
  });

  it('skips lines without a translation and honours a smaller cap', () => {
    const turns = buildTurns([u('S1', 0, 1), u('S1', 1, 2), u('S1', 2, 3)], ['aaaa', '', 'bbbb'], 3, 6);
    expect(view(turns)).toEqual([
      { speaker: 'S1', start: 0, text: 'aaaa' },
      { speaker: 'S1', start: 2, text: 'bbbb' },
    ]);
  });

  it('splits one overlong line into pieces that share its time by length', () => {
    const turns = buildTurns([u('S2', 5, 25)], ['aaaa bbbb cccc dddd'], 30, 9);
    expect(turns.map((t) => [t.text, t.start, t.end])).toEqual([
      ['aaaa bbbb', 5, 15],
      ['cccc dddd', 15, 25],
    ]);
    expect(turns.map((t) => t.lines)).toEqual([[0], [0]]);
    expect(turns[0].available).toBe(10);
  });

  it('never gives a turn less than a sliver of time, even when the next speaker cuts in', () => {
    const turns = buildTurns([u('S1', 0, 2), u('S2', 0.1, 1)], ['uno', 'dos'], 5);
    expect(turns[0].available).toBeGreaterThanOrEqual(0.3);
  });

  // A resume trusts the turn numbers it stored, so turns must not drift.
  it('is deterministic', () => {
    const lines = [u('S1', 0, 2), u('S2', 2.1, 3), u('S1', 3.5, 9)];
    const translation = ['Hola.', 'Sí.', `${'b'.repeat(400)}.`];
    expect(buildTurns(lines, translation, 10)).toEqual(buildTurns(lines, translation, 10));
  });
});

describe('cypherTimeline', () => {
  it('gives every line its source time, translation and where its dub plays', () => {
    const lines = [u('S1', 0, 2, 'Hello.'), u('S1', 2.2, 4, 'How are you?'), u('S2', 5, 6, 'Fine.'), u('S2', 7, 8, 'Hm.')];
    const translation = ['Hola.', 'Qué tal estás?', 'Bien.', ''];
    const turns = buildTurns(lines, translation, 10);
    const timeline = cypherTimeline(lines, translation, turns, [{ start: 0, end: 3.8 }, { start: 5.2, end: 6 }]);
    expect(timeline[0]).toEqual({ id: '0', speaker: 'S1', start: 0, end: 2, sourceText: 'Hello.', translation: 'Hola.', dubStart: 0, dubEnd: 1 });
    expect(timeline[1]).toMatchObject({ dubStart: 1, dubEnd: 3.8 });
    expect(timeline[2]).toMatchObject({ translation: 'Bien.', dubStart: 5.2, dubEnd: 6 });
    // No translation, no dub time.
    expect(timeline[3]).toEqual({ id: '3', speaker: 'S2', start: 7, end: 8, sourceText: 'Hm.', translation: null });
  });

  it('runs a line split over several turns from its first piece to its last', () => {
    const lines = [u('S1', 0, 20, 'long')];
    const translation = ['aaaa bbbb cccc dddd'];
    const turns = buildTurns(lines, translation, 20, 9);
    const timeline = cypherTimeline(lines, translation, turns, [{ start: 0, end: 4 }, { start: 11, end: 15 }]);
    expect(timeline[0]).toMatchObject({ dubStart: 0, dubEnd: 15 });
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
  it('takes that speaker\'s longest lines first, trimmed, best first rather than in time order', () => {
    const lines = [u('S1', 0, 2), u('S2', 5, 30), u('S1', 40, 50), u('S1', 60, 61)];
    const picked = pickReferenceLines(lines, 'S1', 45);
    // Chatterbox builds its prompt from the first seconds of the sample: the best line leads.
    expect(picked.map((p) => p.start)).toEqual([40.15, 0.15]);
    expect(picked[0].duration).toBeCloseTo(9.7);
  });

  it('stops once enough speech is collected', () => {
    const lines = [u('S1', 0, 30), u('S1', 40, 70), u('S1', 80, 110)];
    expect(pickReferenceLines(lines, 'S1', 45)).toHaveLength(2);
  });

  it('skips lines that start or end within 0.3 s of another speaker (likely overlap)', () => {
    const lines = [
      u('S1', 0, 10), // clean
      u('S2', 10.2, 12), // starts 0.2 s after S1 ends
      u('S1', 20, 40), // S2 talks over it
      u('S2', 30, 31),
      u('S1', 50, 55), // clean
    ];
    expect(pickReferenceLines(lines, 'S1', 45).map((p) => p.start)).toEqual([50.15]);
    expect(pickReferenceLines(lines, 'S2', 45)).toEqual([]);
  });
});

describe('assignVoices', () => {
  it('lets a speaker with too little speech borrow the main voice', () => {
    const lines = [u('S1', 0, 20), u('S2', 21, 31), u('S3', 32, 33.5)];
    expect(assignVoices(lines)).toEqual({ S1: 'S1', S2: 'S2', S3: 'S1' });
  });

  it('counts only clean speech, so a speaker who only talks over others borrows a voice', () => {
    const lines = [u('S1', 0, 20), u('S2', 5, 15), u('S1', 25, 35)];
    expect(assignVoices(lines)).toEqual({ S1: 'S1', S2: 'S1' });
  });

  it('returns null when nobody has enough speech to clone', () => {
    expect(assignVoices([u('S1', 0, 1.5), u('S2', 2, 3)])).toBeNull();
  });

  it('handles more than ten speakers, each with or without their own voice', () => {
    const lines = Array.from({ length: 12 }, (_, i) => u(`S${i + 1}`, i * 10, i * 10 + (i < 6 ? 6 : 2)));
    const owners = assignVoices(lines)!;
    expect(Object.keys(owners)).toHaveLength(12);
    expect(new Set(Object.values(owners)).size).toBe(6);
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
