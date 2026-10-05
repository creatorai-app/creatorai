import fs from 'fs/promises';
import { calculateDubbingCreditsByDuration, paidDubbingMultiplier } from '@repo/validation';
import { DubbingProcessor } from './dubbing.processor';

// Cypher end to end against an in-memory database and bucket, with ffmpeg, Gemini, the
// TTS host and ElevenLabs' audio tools mocked: which stages run, what each falls back to,
// what a resume reuses, and what is refunded.

jest.mock('@repo/supabase', () => ({
  createSupabaseClient: () => db.client,
  getSupabaseServiceEnv: () => ({ url: 'u', key: 'k' }),
  reportError: jest.fn(),
}));
jest.mock('./utils/genai', () => ({ getGenAI: () => ({}) }));

// ── in-memory bucket ──
const bucket = new Map<string, Buffer>();
jest.mock('./utils/gcs', () => ({
  parseGsUri: (uri: string) => {
    const [, b, rest] = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri)!;
    return { bucket: b, objectName: rest };
  },
  gcsPublicUrl: (b: string, object: string) => `https://storage.googleapis.com/${b}/${object}`,
  gcsObjectExists: jest.fn(async (_b: string, o: string) => bucket.has(o)),
  saveGcsBuffer: jest.fn(async (_b: string, o: string, data: Buffer) => void bucket.set(o, Buffer.from(data))),
  uploadGcsFile: jest.fn(async (_b: string, o: string, local: string) => void bucket.set(o, await fs.readFile(local))),
  downloadGcsFile: jest.fn(async (_b: string, o: string, local: string) => {
    if (!bucket.has(o)) throw new Error(`no object ${o}`);
    await fs.writeFile(local, bucket.get(o)!);
  }),
  readGcsBuffer: jest.fn(async (_b: string, o: string) => bucket.get(o) ?? null),
}));

// ── ffmpeg: files are stand-ins; PCM is 48,000 bytes per second as in the real code ──
const BPS = 48_000;
const speechByPreset: Record<string, { start: number; end: number }[]> = {};
jest.mock('./utils/ffmpeg', () => {
  const write = (p: string, data: Buffer | string = 'x') => require('fs/promises').writeFile(p, data);
  const copyScaled = async (input: string, output: string, factor: number) => {
    const data: Buffer = await require('fs/promises').readFile(input);
    const bytes = Math.floor(data.length / factor / 2) * 2;
    await require('fs/promises').writeFile(output, data.subarray(0, bytes));
  };
  return {
    ...jest.requireActual('./utils/ffmpeg'),
    probeDurationSeconds: jest.fn(async () => 30),
    detectSpeech: jest.fn(async (_i: string, _t: number, preset = 'mix') => speechByPreset[preset] ?? []),
    cutAnalysisWindow: jest.fn(async (_i: string, _s: number, _d: number, out: string) => write(out)),
    cutStemInput: jest.fn(async (_i: string, _s: number, _d: number, out: string) => write(out)),
    cutAudioClip: jest.fn(async (_i: string, _s: number, _d: number, out: string) => write(out)),
    extractVoiceReference: jest.fn(async (_i: string, out: string) => write(out)),
    concatWavs: jest.fn(async (_i: string[], _l: string, out: string) => write(out)),
    concatFlac: jest.fn(async (_i: string[], _l: string, out: string) => write(out)),
    stemToFlac: jest.fn(async ({ output }: { output: string }) => write(output)),
    hasAudioHeader: jest.fn(async () => true),
    rawChannels: jest.fn(async () => 1),
    // The "WAV" the TTS mock returns is already PCM-sized.
    toDubPcm: jest.fn(async (input: string, output: string) => copyScaled(input, output, 1)),
    fitTurn: jest.fn(async ({ input, output, tempo }: { input: string; output: string; tempo: number }) => copyScaled(input, output, tempo)),
    measureLoudness: jest.fn(async (_i: string, raw = false) => (raw ? -26 : -20)),
    mixDub: jest.fn(async ({ output }: { output: string }) => write(output, 'MP3')),
    toMp3: jest.fn(async (_i: string, out: string) => write(out, 'MP3')),
    muxDubbedAudio: jest.fn(async () => undefined),
  };
});
const ffmpeg = jest.requireMock('./utils/ffmpeg');

// ── Gemini ──
jest.mock('./utils/cypher-analysis', () => ({
  ...jest.requireActual('./utils/cypher-analysis'),
  analyzeWindow: jest.fn(),
  translateLines: jest.fn(async (_g: unknown, lines: { text: string }[], _l: string, done: string[], onBatch: (s: string[]) => Promise<void>) => {
    const out = [...done, ...lines.slice(done.length).map((l) => `ES ${l.text}`)];
    await onBatch(out);
    return out;
  }),
  shortenLine: jest.fn(async (_g: unknown, { text }: { text: string }) => text.slice(0, Math.ceil(text.length / 3))),
}));
const analysis = jest.requireMock('./utils/cypher-analysis');

// ── TTS: 0.1 s of speech per character, unless a test says otherwise ──
const synthesize = jest.fn(async ({ text }: { text: string }) => Buffer.alloc(Math.round(text.length * 0.1 * BPS / 2) * 2));
jest.mock('./utils/cypher-tts', () => ({ cypherTtsFromEnv: () => ({ host: 'frozen', synthesize }) }));

// ── ElevenLabs audio tools ──
jest.mock('./utils/elevenlabs-audio', () => ({
  elevenLabsAudioKey: jest.fn(() => 'key'),
  separateStems: jest.fn(async ({ outDir }: { outDir: string }) => {
    await require('fs/promises').mkdir(outDir, { recursive: true });
    await require('fs/promises').writeFile(`${outDir}/vocals.wav`, 'v');
    await require('fs/promises').writeFile(`${outDir}/instrumental.wav`, 'i');
    return { vocals: `${outDir}/vocals.wav`, background: `${outDir}/instrumental.wav`, format: 'pcm_44100', names: ['vocals.wav', 'instrumental.wav'] };
  }),
  forcedAlign: jest.fn(async ({ text }: { text: string }) => {
    // Every word half a second long, back to back, starting at 0.5 s into the window.
    let t = 0.5;
    const words = text.split(/\s+/).filter(Boolean).map((w) => ({ text: w, start: t, end: (t += 0.5) }));
    return { words, characters: [], loss: 0.4 };
  }),
}));
const audio = jest.requireMock('./utils/elevenlabs-audio');

// ── database ──
type Row = Record<string, any>;
const db = { tables: {} as Record<string, Row[]>, rpc: jest.fn(async (_n: string, _a: Row) => ({ error: null })), client: null as any };
db.client = {
  rpc: (n: string, a: Row) => db.rpc(n, a),
  from(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let update: Row | null = null;
    const run = () => {
      const rows = (db.tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      if (update) for (const r of rows) Object.assign(r, structuredClone(update));
      return rows.map((r) => structuredClone(r));
    };
    const q: any = {
      select: () => q,
      order: () => q,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), q),
      update: (f: Row) => ((update = f), q),
      single: async () => {
        const rows = run();
        return rows.length ? { data: rows[0], error: null } : { data: null, error: { message: 'none' } };
      },
      then: (res: any, rej: any) => Promise.resolve({ data: run(), error: null }).then(res, rej),
    };
    return q;
  },
};

const RATE = paidDubbingMultiplier('cypher', {});
const PER_LANGUAGE = calculateDubbingCreditsByDuration(30, RATE);
const PREFIX = 'u1/dubbing/p1/';

const LINES = [
  { speaker: 'S1', text: 'Hello there and welcome to the show today.' },
  { speaker: 'S2', text: 'Thanks for having me here.' },
];

function seed({ project = {}, output = {} }: { project?: Row; output?: Row } = {}) {
  bucket.clear();
  db.tables = {
    dubbing_projects: [{
      project_id: 'p1', engine: 'cypher', video_object: null, analysis: null, status: 'queued',
      source_language: 'en', voice_mode: 'balanced', keyterms: [], vendor_projects: null, ...project,
    }],
    dubbing_outputs: [{
      id: 'o1', project_id: 'p1', language: 'es', accent: null, status: 'pending', translation: null, segment_count: null,
      segments_done: 0, vendor_dub_id: null, dubbed_audio_url: null, dubbed_url: null, credits_consumed: PER_LANGUAGE,
      error_message: null, timeline: null, warnings: null, ...output,
    }],
  };
}
const projectRow = () => db.tables.dubbing_projects[0];
const out = () => db.tables.dubbing_outputs[0];
const refunds = () => db.rpc.mock.calls.filter(([, a]) => a.credit_change > 0).map(([, a]) => a.credit_change);

let cancelFlag: string | null = null;
const job = () =>
  ({
    id: 'job-1',
    data: {
      userId: 'u1', projectId: 'p1', inputGsUri: `gs://dub-bucket/${PREFIX}audio.m4a`,
      inputUrl: `https://storage.googleapis.com/dub-bucket/${PREFIX}audio.m4a`, isVideo: false,
      durationSeconds: 30, planName: 'Creator',
    },
    updateProgress: jest.fn(async () => undefined),
    log: jest.fn(async () => undefined),
  }) as any;
const processor = () => new DubbingProcessor({ client: Promise.resolve({ get: jest.fn(async () => cancelFlag) }) } as any);

beforeEach(() => {
  jest.clearAllMocks();
  cancelFlag = null;
  process.env.MODAL_API_URL = 'https://modal';
  speechByPreset.mix = [{ start: 1, end: 5 }, { start: 6, end: 9 }];
  speechByPreset.vocals = [{ start: 1.2, end: 4.8 }, { start: 6.1, end: 8.9 }];
  analysis.analyzeWindow.mockResolvedValue({ speakers: [{ id: 'S1', description: 'host' }, { id: 'S2', description: 'guest' }], lines: LINES });
});

describe('Cypher', () => {
  it('separates stems, detects speech on the vocals, aligns words, and mixes the dub over the music', async () => {
    seed();
    await processor().process(job());

    const stored = projectRow().analysis;
    expect(stored.version).toBe(2);
    expect(stored.stems).toMatchObject({ status: 'done', format: 'pcm_44100', vocals: `${PREFIX}work/stems/vocals.flac`, background: `${PREFIX}work/stems/background.flac` });
    expect(stored.speechSource).toBe('vocals');
    expect(ffmpeg.detectSpeech.mock.calls.map((c: any[]) => c[2])).toEqual(['mix', 'vocals']);
    // Gemini listens to the vocal stem, not the mix.
    expect(ffmpeg.cutAnalysisWindow.mock.calls[0][0]).toContain('work/stems/vocals.flac');
    expect(stored.alignment.windows[0]).toEqual({ timingSource: 'forced_alignment', loss: 0.4 });
    expect(stored.utterances[0].start).toBeCloseTo(0.5);

    // Voice samples are cut from the vocal stem into voices/v2.
    expect(ffmpeg.cutAudioClip.mock.calls.every((c: any[]) => c[0].includes('work/stems/vocals.flac'))).toBe(true);
    expect([...bucket.keys()].some((k) => k.startsWith(`${PREFIX}work/voices/v2/`))).toBe(true);

    const mix = ffmpeg.mixDub.mock.calls[0][0];
    expect(mix.background).toBe(`https://storage.googleapis.com/dub-bucket/${PREFIX}work/stems/background.flac`);
    expect(mix.gainDb).toBe(6); // vocals at -20 LUFS, dubbed speech at -26
    expect(mix.totalSeconds).toBe(30);

    expect(out().status).toBe('completed');
    expect(out().timeline).toHaveLength(2);
    expect(out().timeline[0]).toMatchObject({ id: '0', speaker: 'S1', translation: `ES ${LINES[0].text}` });
    expect(out().timeline[0].dubStart).toBeCloseTo(0.5);
    expect(refunds()).toEqual([]);
  });

  it('carries on without stems when separation fails, and never fails the dub for it', async () => {
    seed();
    audio.separateStems.mockRejectedValueOnce(new Error('stem separation failed (500)'));
    await processor().process(job());
    const stored = projectRow().analysis;
    expect(stored.stems).toMatchObject({ status: 'failed', reason: expect.stringContaining('500') });
    expect(stored.speechSource).toBe('mix');
    expect(ffmpeg.mixDub.mock.calls[0][0].background).toBeNull();
    expect(out().status).toBe('completed');
    expect(refunds()).toEqual([]);
  });

  it('carries on without stems when their names cannot be told apart', async () => {
    seed();
    audio.separateStems.mockResolvedValueOnce(null);
    await processor().process(job());
    expect(projectRow().analysis.stems.status).toBe('failed');
    expect(out().status).toBe('completed');
  });

  it('skips stems and alignment without an ElevenLabs key', async () => {
    seed();
    audio.elevenLabsAudioKey.mockReturnValue(null);
    await processor().process(job());
    audio.elevenLabsAudioKey.mockReturnValue('key');
    const stored = projectRow().analysis;
    expect(stored.stems.status).toBe('skipped');
    expect(stored.alignment.windows.every((w: any) => w.timingSource === 'pauses')).toBe(true);
    expect(audio.separateStems).not.toHaveBeenCalled();
    expect(audio.forcedAlign).not.toHaveBeenCalled();
    expect(out().status).toBe('completed');
  });

  it('keeps pause timing for a window whose alignment loss is over the limit', async () => {
    seed();
    audio.forcedAlign.mockResolvedValueOnce({ words: [], characters: [], loss: 9 });
    await processor().process(job());
    expect(projectRow().analysis.alignment.windows[0]).toMatchObject({ timingSource: 'pauses', loss: 9 });
  });

  it('upgrades an older analysis without paying for its Gemini windows again', async () => {
    const old = {
      speakers: [{ id: 'S1', description: 'host' }, { id: 'S2', description: 'guest' }],
      utterances: [
        { speaker: 'S1', start: 1, end: 5, text: LINES[0].text },
        { speaker: 'S2', start: 6, end: 9, text: LINES[1].text },
      ],
      speech: speechByPreset.mix,
      windows: [{ start: 0, end: 30 }],
      windowsDone: 1,
      complete: true,
    };
    seed({ project: { analysis: old } });
    await processor().process(job());
    expect(analysis.analyzeWindow).not.toHaveBeenCalled();
    const stored = projectRow().analysis;
    expect(stored.version).toBe(2);
    expect(stored.stems.status).toBe('done');
    expect(stored.speechSource ?? 'mix').toBe('mix'); // its lines were placed on the mix
    expect(stored.alignment.windowsDone).toBe(1);
    expect(stored.utterances.map((u: any) => u.text)).toEqual(LINES.map((l) => l.text));
  });

  it('fails a music-only file cleanly, with a refund', async () => {
    seed();
    speechByPreset.vocals = [];
    await expect(processor().process(job())).rejects.toThrow('No speech was found');
    expect(out()).toMatchObject({ status: 'failed', credits_consumed: 0 });
    expect(refunds()).toEqual([PER_LANGUAGE]);
  });

  it('fails cleanly with a refund when the file is silent', async () => {
    seed();
    speechByPreset.mix = [];
    await expect(processor().process(job())).rejects.toThrow('No speech was found');
    expect(refunds()).toEqual([PER_LANGUAGE]);
  });

  it('dubs a 2-second clip whose one speaker has too little speech to clone, from the start of the audio', async () => {
    seed();
    ffmpeg.probeDurationSeconds.mockResolvedValueOnce(2);
    speechByPreset.mix = [{ start: 0.2, end: 1.8 }];
    speechByPreset.vocals = [{ start: 0.25, end: 1.75 }];
    analysis.analyzeWindow.mockResolvedValueOnce({ speakers: [{ id: 'S1', description: 'host' }], lines: [{ speaker: 'S1', text: 'Hi all.' }] });
    await processor().process(job());
    // Under 3 s of clean speech: the voice comes from the start of the (vocal) audio.
    expect(ffmpeg.extractVoiceReference).toHaveBeenCalledWith(expect.stringContaining('work/stems/vocals.flac'), expect.any(String), 120);
    expect(ffmpeg.mixDub.mock.calls[0][0].totalSeconds).toBe(2);
    expect(out().status).toBe('completed');
  });

  it('fails a video with no audio track cleanly, with a refund', async () => {
    seed();
    ffmpeg.detectSpeech.mockRejectedValueOnce(new Error('ffmpeg failed while processing the dub: Output file #0 does not contain any stream'));
    await expect(processor().process(job())).rejects.toThrow('This file has no audio track to dub.');
    expect(refunds()).toEqual([PER_LANGUAGE]);
  });

  it('synthesizes a runaway clip once more, then keeps the good take', async () => {
    seed();
    synthesize.mockResolvedValueOnce(Buffer.alloc(60 * BPS)); // a minute for one sentence
    await processor().process(job());
    expect(synthesize).toHaveBeenCalledTimes(3); // two turns, one retried
    expect(job().log).toBeDefined();
    const meta = JSON.parse(bucket.get(`${PREFIX}work/es/turn-0000.json`)!.toString());
    expect(meta.rawSeconds).toBeLessThan(10);
  });

  it('cuts a clip that runs away twice to its slot plus a little spill', async () => {
    seed();
    synthesize.mockResolvedValueOnce(Buffer.alloc(60 * BPS)).mockResolvedValueOnce(Buffer.alloc(60 * BPS));
    await processor().process(job());
    const meta = JSON.parse(bucket.get(`${PREFIX}work/es/turn-0000.json`)!.toString());
    expect(meta.rawSeconds).toBeLessThanOrEqual(6);
  });

  it('shortens a line that overruns even at the speed-up cap, and records it', async () => {
    seed();
    // The first turn has 4 s; a 7.5 s take is too long for the tempo cap, yet not a runaway.
    synthesize.mockImplementationOnce(async () => Buffer.alloc(7.5 * BPS));
    await processor().process(job());
    expect(analysis.shortenLine).toHaveBeenCalledTimes(1);
    const meta = JSON.parse(bucket.get(`${PREFIX}work/es/turn-0000.json`)!.toString());
    expect(meta).toMatchObject({ shortened: true, turnText: `ES ${LINES[0].text}` });
    expect(meta.text.length).toBeLessThan(meta.turnText.length);
  });

  it('reuses the turns a resume can trust and makes the rest', async () => {
    seed();
    await processor().process(job());
    const firstRun = synthesize.mock.calls.length;
    // Worker died after turn 1 of 2: the second is re-made, the first reused.
    out().status = 'pending';
    out().segments_done = 1;
    out().dubbed_audio_url = null;
    synthesize.mockClear();
    await processor().process(job());
    expect(firstRun).toBe(2);
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(synthesize.mock.calls[0][0].text).toBe(`ES ${LINES[1].text}`);
  });

  it('re-makes turns stored by the older code, which have no record', async () => {
    seed({ output: { segments_done: 2, segment_count: 2, translation: LINES.map((l) => `ES ${l.text}`) } });
    bucket.set(`${PREFIX}work/es/turn-0000.pcm`, Buffer.alloc(BPS));
    bucket.set(`${PREFIX}work/es/turn-0001.pcm`, Buffer.alloc(BPS));
    await processor().process(job());
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it('refunds once when cancelled between turns, keeping the turns already made', async () => {
    seed();
    synthesize.mockImplementationOnce(async ({ text }) => {
      cancelFlag = '1';
      return Buffer.alloc(Math.round(text.length * 0.1 * BPS / 2) * 2);
    });
    await expect(processor().process(job())).rejects.toThrow('cancelled');
    expect(refunds()).toEqual([PER_LANGUAGE]);
    expect(out().segments_done).toBe(1);
  });
});
