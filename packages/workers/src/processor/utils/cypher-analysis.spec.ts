import { analysisVersion, cleanLines, mergeWindow, shortenLine, translateLines, translationPrompt, type SourceAnalysis } from './cypher-analysis';

const empty: SourceAnalysis = { speakers: [], utterances: [], speech: [], windows: [], windowsDone: 0, complete: false };

describe('mergeWindow', () => {
  it('keeps the first description of a known speaker and adds new ones', () => {
    const first = mergeWindow(empty, [{ id: 'S1', description: 'host' }], [{ speaker: 'S1', start: 1, end: 3, text: 'Hi' }]);
    const second = mergeWindow(
      first,
      [{ id: 'S1', description: 'host again' }, { id: 'S2', description: 'guest' }],
      [{ speaker: 'S2', start: 602, end: 604, text: 'Hello' }, { speaker: 'S1', start: 600.5, end: 601.5, text: 'Welcome' }],
    );
    expect(second.speakers).toEqual([{ id: 'S1', description: 'host' }, { id: 'S2', description: 'guest' }]);
    expect(second.utterances.map((u) => [u.speaker, u.start])).toEqual([['S1', 1], ['S1', 600.5], ['S2', 602]]);
  });

  it('registers a speaker id that only appears on a line', () => {
    const merged = mergeWindow(empty, [], [{ speaker: 'S3', start: 0, end: 1, text: 'Hm' }]);
    expect(merged.speakers).toEqual([{ id: 'S3', description: '' }]);
  });
});

describe('cleanLines', () => {
  it('trims and drops lines without text or speaker', () => {
    expect(
      cleanLines([
        { speaker: ' S1 ', text: ' Hi ' },
        { speaker: 'S1', text: '   ' },
        { speaker: '', text: 'nobody' },
      ]),
    ).toEqual([{ speaker: 'S1', text: 'Hi' }]);
  });
});


/** A Gemini stand-in: answers each call with the next JSON body and records the prompts. */
function fakeGenAI(answers: object[]) {
  const prompts: string[] = [];
  const genAI: any = {
    models: {
      generateContent: jest.fn(async (req: any) => {
        prompts.push(req.contents[0].parts[0].text);
        return { candidates: [{ content: { parts: [{ text: JSON.stringify(answers.shift()) }] }, finishReason: 'STOP' }] };
      }),
    },
  };
  return { genAI, prompts };
}

describe('translateLines', () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `line ${i}`, speaker: i % 2 ? 'S2' : 'S1', seconds: 1.234 + i }));

  it('sends each line with its speaker and time budget, and keeps the keyterms', async () => {
    const { genAI, prompts } = fakeGenAI([{ lines: ['uno', 'dos'] }]);
    const out = await translateLines(genAI, lines(2), 'Spanish', [], async () => undefined, ['Creator AI']);
    expect(out).toEqual(['uno', 'dos']);
    expect(prompts[0]).toContain('[{"speaker":"S1","seconds":1.2,"text":"line 0"},{"speaker":"S2","seconds":2.2,"text":"line 1"}]');
    expect(prompts[0]).toContain('it should take about "seconds" to say');
    expect(prompts[0]).toContain('Keep these exactly as written, untranslated: "Creator AI".');
    expect(prompts[0]).not.toContain('For context');
  });

  it('shows the next batch the last five translated lines of the one before', async () => {
    const all = lines(85);
    const { genAI, prompts } = fakeGenAI([
      { lines: all.slice(0, 80).map((_, i) => `t${i}`) },
      { lines: all.slice(80).map((_, i) => `t${80 + i}`) },
    ]);
    const saved: number[] = [];
    await translateLines(genAI, all, 'German', [], async (soFar) => void saved.push(soFar.length));
    expect(saved).toEqual([80, 85]);
    expect(prompts[1]).toContain('For context');
    expect(prompts[1]).toContain('{"text":"line 75","translation":"t75"}');
    expect(prompts[1]).toContain('{"text":"line 79","translation":"t79"}');
    expect(prompts[1]).not.toContain('"t74"');
  });

  it('resumes after the lines already translated, with them as context', async () => {
    const { genAI, prompts } = fakeGenAI([{ lines: ['c'] }]);
    const out = await translateLines(genAI, lines(3), 'French', ['a', 'b'], async () => undefined);
    expect(out).toEqual(['a', 'b', 'c']);
    expect(prompts[0]).toContain('"text":"line 2"');
    expect(prompts[0]).toContain('{"text":"line 0","translation":"a"}');
  });

  it('retries once, then refuses a translation with the wrong number of lines', async () => {
    const { genAI } = fakeGenAI([{ lines: ['one'] }, { lines: ['one'] }]);
    await expect(translateLines(genAI, lines(2), 'Italian', [], async () => undefined)).rejects.toThrow('wrong number of lines');
  });

  it('keeps an empty translation as an empty line, which the turns then skip', async () => {
    const { genAI } = fakeGenAI([{ lines: ['uno', '  ', 'tres'] }]);
    await expect(translateLines(genAI, lines(3), 'Spanish', [], async () => undefined)).resolves.toEqual(['uno', '', 'tres']);
  });

  it('builds a prompt with no keyterm rule when there are none', () => {
    expect(translationPrompt({ batch: lines(1), languageLabel: 'Hindi', keyterms: [], context: [] })).not.toContain('untranslated');
  });
});

describe('shortenLine', () => {
  it('asks for a shorter line in the same language and takes it', async () => {
    const { genAI, prompts } = fakeGenAI([{ text: 'Más corto.' }]);
    await expect(shortenLine(genAI, { text: 'Una frase bastante más larga.', targetSeconds: 1.5, languageLabel: 'Spanish', keyterms: ['Cypher'] })).resolves.toBe('Más corto.');
    expect(prompts[0]).toContain('about 1.5 seconds');
    expect(prompts[0]).toContain('"Cypher"');
  });

  it('keeps the original when nothing shorter comes back', async () => {
    const { genAI } = fakeGenAI([{ text: 'Una frase todavía mucho más larga que antes.' }]);
    await expect(shortenLine(genAI, { text: 'Una frase.', targetSeconds: 1, languageLabel: 'Spanish' })).resolves.toBe('Una frase.');
  });
});

describe('analysisVersion', () => {
  it('reads an analysis stored before versioning as version 1', () => {
    expect(analysisVersion(empty)).toBe(1);
    expect(analysisVersion({ ...empty, version: 2 })).toBe(2);
    expect(analysisVersion(null)).toBe(1);
  });
});
