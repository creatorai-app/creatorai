import { calculateDubbingCreditsByDuration, paidDubbingMultiplier } from '@repo/validation';
import { DubbingProcessor } from './dubbing.processor';
import * as elevenlabs from './utils/elevenlabs-dubbing';

// The processor against an in-memory database and mocked vendors: what is created on
// ElevenLabs, what is stored before what, and what is charged or refunded, on fresh runs
// and on every kind of resume.

jest.mock('@repo/supabase', () => ({
  createSupabaseClient: () => fakeDb.client,
  getSupabaseServiceEnv: () => ({ url: 'u', key: 'k' }),
  reportError: jest.fn(),
}));
jest.mock('./utils/genai', () => ({ getGenAI: () => ({}) }));
jest.mock('./utils/gcs', () => ({
  parseGsUri: (uri: string) => {
    const [, bucket, ...rest] = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri)!;
    return { bucket, objectName: rest.join('/') };
  },
  gcsPublicUrl: (bucket: string, object: string) => `https://storage.googleapis.com/${bucket}/${object}`,
  gcsObjectExists: jest.fn(async () => false),
  saveGcsBuffer: jest.fn(async () => undefined),
  uploadGcsFile: jest.fn(async () => undefined),
  downloadGcsFile: jest.fn(async () => undefined),
}));
jest.mock('./utils/ffmpeg', () => ({
  ...jest.requireActual('./utils/ffmpeg'),
  probeDurationSeconds: jest.fn(async () => 30),
  toMp3: jest.fn(async () => undefined),
  muxDubbedAudio: jest.fn(async () => undefined),
}));
jest.mock('./utils/elevenlabs-dubbing', () => {
  const actual = jest.requireActual('./utils/elevenlabs-dubbing');
  return {
    ...actual,
    getElevenLabsKey: () => 'key',
    createProject: jest.fn(),
    createLanguageTarget: jest.fn(),
    waitForProjectReady: jest.fn(),
    waitForDub: jest.fn(),
    downloadDub: jest.fn(async () => undefined),
    getSourceTranscript: jest.fn(),
    getTargetTranscript: jest.fn(),
    findProjectByReference: jest.fn(),
    findLanguageTarget: jest.fn(),
  };
});

const el = elevenlabs as jest.Mocked<typeof elevenlabs>;

type Row = Record<string, any>;

/** Just enough of supabase-js for the processor: eq/in filters, select, update, single, rpc. */
const fakeDb = {
  tables: {} as Record<string, Row[]>,
  writes: [] as { table: string; fields: Row }[],
  rpc: jest.fn(async (_name: string, _args: Row) => ({ error: null })),
  client: null as any,
};
fakeDb.client = {
  rpc: (name: string, args: Row) => fakeDb.rpc(name, args),
  from(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let update: Row | null = null;
    const run = () => {
      const rows = (fakeDb.tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      if (update) {
        fakeDb.writes.push({ table, fields: update });
        for (const r of rows) Object.assign(r, structuredClone(update));
      }
      return rows.map((r) => ({ ...r }));
    };
    const q: any = {
      select: () => q,
      order: () => q,
      eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), q),
      in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), q),
      update: (fields: Row) => ((update = fields), q),
      single: async () => {
        const rows = run();
        return rows.length ? { data: rows[0], error: null } : { data: null, error: { message: 'no rows' } };
      },
      then: (res: any, rej: any) => Promise.resolve({ data: run(), error: null }).then(res, rej),
    };
    return q;
  },
};

const RATE = paidDubbingMultiplier('elevenlabs', {});
const PER_LANGUAGE = calculateDubbingCreditsByDuration(30, RATE);

function seed({
  project = {},
  outputs,
}: {
  project?: Row;
  outputs: Row[];
}) {
  fakeDb.writes = [];
  fakeDb.tables = {
    dubbing_projects: [{
      project_id: 'p1', engine: 'elevenlabs', video_object: null, analysis: null, status: 'queued',
      source_language: 'en', voice_mode: 'balanced', keyterms: ['Creator AI'], vendor_projects: null, ...project,
    }],
    dubbing_outputs: outputs.map((o, i) => ({
      id: `o${i}`, project_id: 'p1', accent: null, status: 'pending', translation: null, segment_count: null,
      segments_done: 0, vendor_dub_id: null, dubbed_audio_url: null, dubbed_url: null, credits_consumed: PER_LANGUAGE,
      error_message: null, timeline: null, warnings: null, ...o,
    })),
  };
}

const output = (language: string) => fakeDb.tables.dubbing_outputs.find((o) => o.language === language)!;
const projectRow = () => fakeDb.tables.dubbing_projects[0];
const refunds = () => fakeDb.rpc.mock.calls.filter(([, a]) => a.credit_change > 0).map(([, a]) => a.credit_change);

let cancelFlag: string | null;
function makeJob() {
  return {
    id: 'job-1',
    data: {
      userId: 'u1', projectId: 'p1', bullJobId: 'job-1', inputGsUri: 'gs://dub-bucket/u1/dubbing/p1/audio.m4a',
      inputUrl: 'https://storage.googleapis.com/dub-bucket/u1/dubbing/p1/audio.m4a', mimeType: 'audio/mp4',
      isVideo: false, durationSeconds: 30, planName: 'Creator', reservedCredits: 0,
    },
    updateProgress: jest.fn(async () => undefined),
    log: jest.fn(async () => undefined),
  } as any;
}
function makeProcessor() {
  const queue = { client: Promise.resolve({ get: jest.fn(async () => cancelFlag) }) } as any;
  return new DubbingProcessor(queue);
}

let targetSeq: number;
beforeEach(() => {
  jest.clearAllMocks();
  cancelFlag = null;
  targetSeq = 0;
  el.createProject.mockImplementation(async (o: any) => `proj_${o.modelId}`);
  el.createLanguageTarget.mockImplementation(async (o: any) => `lang_${o.targetLanguage}_${++targetSeq}`);
  el.waitForProjectReady.mockResolvedValue({ project_id: 'x', status: 'ready' } as any);
  el.findProjectByReference.mockResolvedValue(null);
  el.findLanguageTarget.mockResolvedValue(null);
  el.waitForDub.mockResolvedValue({ status: 'completed', warnings: [] });
  el.getSourceTranscript.mockResolvedValue({ language: 'en', segments: [{ id: 's1', text: 'Hi', speaker_id: 'speaker_0', start_s: 0, end_s: 1 }] });
  el.getTargetTranscript.mockResolvedValue({
    target_language: 'es',
    segments: [{ id: 's1', speaker_id: 'speaker_0', start_s: 0, end_s: 1, source_text: 'Hi', translation: 'Hola' }],
  });
});

describe('DubbingProcessor on ElevenLabs', () => {
  it('creates one v2 project, stores it before any target, then one target per language', async () => {
    seed({ outputs: [{ language: 'es', accent: 'latin american' }, { language: 'fr' }] });
    const order: string[] = [];
    el.createProject.mockImplementation(async () => (order.push('project'), 'proj_A'));
    el.createLanguageTarget.mockImplementation(async (o: any) => {
      order.push(`target:${o.targetLanguage}:stored=${projectRow().vendor_projects?.dubbing_v2 ?? 'none'}`);
      return `lang_${o.targetLanguage}`;
    });

    await makeProcessor().process(makeJob());

    expect(el.createProject).toHaveBeenCalledTimes(1);
    expect(el.createProject.mock.calls[0][0]).toMatchObject({
      modelId: 'dubbing_v2',
      sourceLanguage: 'en',
      keyterms: ['Creator AI'],
      reference: 'p1',
      sourceUrl: 'https://storage.googleapis.com/dub-bucket/u1/dubbing/p1/audio.m4a',
    });
    expect(order).toEqual(['project', 'target:es-MX:stored=proj_A', 'target:fr:stored=proj_A']);
    expect(el.createLanguageTarget.mock.calls.map(([o]: any) => [o.targetLanguage, o.cloningStrength])).toEqual([
      ['es-MX', 7],
      ['fr', 7],
    ]);
    expect(output('es').vendor_dub_id).toBe('project:proj_A:lang_es-MX');
    expect(output('es').status).toBe('completed');
    expect(output('es').timeline).toEqual([{ id: 's1', speaker: 'speaker_0', start: 0, end: 1, sourceText: 'Hi', translation: 'Hola' }]);
    expect(projectRow().status).toBe('completed');
    expect(refunds()).toEqual([]);
  });

  it('waits for detection before creating targets when no source language was given', async () => {
    seed({ project: { source_language: null, voice_mode: 'like_me' }, outputs: [{ language: 'ja' }] });
    el.getSourceTranscript.mockResolvedValue({ language: 'en', segments: [] });
    await makeProcessor().process(makeJob());
    expect(el.waitForProjectReady).toHaveBeenCalled();
    expect(el.createProject.mock.calls[0][0].sourceLanguage).toBeNull();
    // like_me 9, minus one for English to Japanese.
    expect(el.createLanguageTarget.mock.calls[0][0].cloningStrength).toBe(8);
  });

  it('reuses the stored project on a resume after it was created and before any target', async () => {
    seed({ project: { vendor_projects: { dubbing_v2: 'proj_OLD' } }, outputs: [{ language: 'es' }, { language: 'de' }] });
    await makeProcessor().process(makeJob());
    expect(el.createProject).not.toHaveBeenCalled();
    expect(el.createLanguageTarget.mock.calls.map(([o]: any) => o.projectId)).toEqual(['proj_OLD', 'proj_OLD']);
  });

  it('creates only the missing targets on a resume after one of several', async () => {
    seed({
      project: { vendor_projects: { dubbing_v2: 'proj_OLD' } },
      outputs: [{ language: 'es', vendor_dub_id: 'project:proj_OLD:lang_es' }, { language: 'de' }],
    });
    await makeProcessor().process(makeJob());
    expect(el.createProject).not.toHaveBeenCalled();
    expect(el.createLanguageTarget).toHaveBeenCalledTimes(1);
    expect(el.createLanguageTarget.mock.calls[0][0].targetLanguage).toBe('de');
    expect(el.waitForDub.mock.calls.map(([, dub]: any) => dub.languageId).sort()).toEqual(['lang_de_1', 'lang_es']);
  });

  it('puts Bengali on its own dubbing_v1 project, with no cloning strength or dialect', async () => {
    seed({ outputs: [{ language: 'bn' }, { language: 'es', accent: 'castilian' }] });
    await makeProcessor().process(makeJob());
    expect(el.createProject.mock.calls.map(([o]: any) => o.modelId).sort()).toEqual(['dubbing_v1', 'dubbing_v2']);
    const bn = el.createLanguageTarget.mock.calls.find(([o]: any) => o.targetLanguage === 'bn')![0];
    expect(bn).toMatchObject({ projectId: 'proj_dubbing_v1', cloningStrength: null });
    const es = el.createLanguageTarget.mock.calls.find(([o]: any) => o.targetLanguage === 'es-ES')![0];
    expect(es).toMatchObject({ projectId: 'proj_dubbing_v2', cloningStrength: 7 });
    // Both projects stored, neither overwriting the other.
    expect(projectRow().vendor_projects).toEqual({ dubbing_v1: 'proj_dubbing_v1', dubbing_v2: 'proj_dubbing_v2' });
  });

  it('finds a project whose create answer was lost instead of paying for a second one', async () => {
    seed({ outputs: [{ language: 'es' }] });
    el.findProjectByReference.mockResolvedValue('proj_LOST');
    await makeProcessor().process(makeJob());
    expect(el.findProjectByReference).toHaveBeenCalledWith(expect.anything(), 'p1', 'dubbing_v2');
    expect(el.createProject).not.toHaveBeenCalled();
    expect(projectRow().vendor_projects).toEqual({ dubbing_v2: 'proj_LOST' });
    expect(el.createLanguageTarget.mock.calls[0][0].projectId).toBe('proj_LOST');
  });

  it('finds a target whose create answer was lost instead of paying for a second one', async () => {
    seed({ project: { vendor_projects: { dubbing_v2: 'proj_A' } }, outputs: [{ language: 'es', accent: 'castilian' }] });
    el.findLanguageTarget.mockResolvedValue('lang_LOST');
    await makeProcessor().process(makeJob());
    expect(el.findLanguageTarget).toHaveBeenCalledWith(expect.anything(), 'proj_A', 'es-ES');
    expect(el.createLanguageTarget).not.toHaveBeenCalled();
    expect(output('es').vendor_dub_id).toBe('project:proj_A:lang_LOST');
  });

  it('gives a regenerated dub its own reference, so the old project is not found', async () => {
    seed({ project: { vendor_projects: { generation: 2 } }, outputs: [{ language: 'es' }] });
    await makeProcessor().process(makeJob());
    expect(el.findProjectByReference).toHaveBeenCalledWith(expect.anything(), 'p1#2', 'dubbing_v2');
    expect(el.createProject.mock.calls[0][0].reference).toBe('p1#2');
    expect(projectRow().vendor_projects).toEqual({ generation: 2, dubbing_v2: 'proj_dubbing_v2' });
  });

  it('does not start a project for a dub cancelled before it got there', async () => {
    seed({ outputs: [{ language: 'es' }] });
    let calls = 0;
    const processor = new DubbingProcessor({
      client: Promise.resolve({ get: jest.fn(async () => (++calls > 1 ? '1' : null)) }),
    } as any);
    await expect(processor.process(makeJob())).rejects.toThrow('cancelled');
    expect(el.createProject).not.toHaveBeenCalled();
    expect(refunds()).toEqual([PER_LANGUAGE]);
  });

  it('waits out a concurrency limit instead of failing or refunding the language', async () => {
    seed({ outputs: [{ language: 'es' }] });
    const actual = jest.requireActual('./utils/elevenlabs-dubbing');
    actual.elevenLabsClock.sleep = async () => undefined;
    const replies = [
      new Response(JSON.stringify({ detail: { status: 'too_many_concurrent_requests' } }), { status: 429 }),
      new Response(JSON.stringify({ language_id: 'lang_after_wait' }), { status: 201 }),
    ];
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => replies.shift()!);
    el.createLanguageTarget.mockImplementation(actual.createLanguageTarget);

    const job = makeJob();
    await makeProcessor().process(job);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(output('es').vendor_dub_id).toBe('project:proj_dubbing_v2:lang_after_wait');
    expect(output('es').status).toBe('completed');
    expect(refunds()).toEqual([]);
    expect(job.log).toHaveBeenCalledWith(expect.stringContaining('ElevenLabs is busy'));
    fetchSpy.mockRestore();
  });

  it('keeps a delivered dub when its transcripts cannot be read', async () => {
    seed({ outputs: [{ language: 'es' }] });
    el.getSourceTranscript.mockRejectedValue(new Error('ElevenLabs source transcript failed (500)'));
    await makeProcessor().process(makeJob());
    expect(output('es').status).toBe('completed');
    expect(output('es').timeline).toBeNull();
    expect(output('es').dubbed_audio_url).toContain('dubbed/p1/es.mp3');
    expect(refunds()).toEqual([]);
  });

  it('stores voices_not_permitted warnings on the output', async () => {
    seed({ outputs: [{ language: 'es' }] });
    el.waitForDub.mockResolvedValue({ status: 'completed', warnings: [{ type: 'voices_not_permitted', speakerIds: ['speaker_1'] }] });
    await makeProcessor().process(makeJob());
    expect(output('es').warnings).toEqual([{ type: 'voices_not_permitted', speakerIds: ['speaker_1'] }]);
  });

  it('refunds one failed target once and delivers the rest', async () => {
    seed({ outputs: [{ language: 'es' }, { language: 'fr' }] });
    el.waitForDub.mockImplementation(async (_o: any, dub: any) => {
      if (dub.languageId.startsWith('lang_es')) throw new elevenlabs.ElevenLabsDubFailedError('ElevenLabs dubbing failed: bad audio');
      return { status: 'completed', warnings: [] };
    });
    const result = await makeProcessor().process(makeJob());
    expect(result.dubbedUrl).toContain('fr.mp3');
    expect(output('es')).toMatchObject({ status: 'failed', credits_consumed: 0, vendor_dub_id: null });
    expect(output('fr').status).toBe('completed');
    expect(refunds()).toEqual([PER_LANGUAGE]);
    // The project is kept: a retry adds a new target to it rather than paying for a new one.
    expect(projectRow().vendor_projects).toEqual({ dubbing_v2: 'proj_dubbing_v2' });
  });

  it('forgets a project that failed after its targets existed, and refunds every language', async () => {
    seed({ outputs: [{ language: 'es' }, { language: 'fr' }] });
    el.waitForDub.mockRejectedValue(new elevenlabs.ElevenLabsDubFailedError('ElevenLabs could not prepare the source: 403', 'project'));
    await expect(makeProcessor().process(makeJob())).rejects.toThrow();
    expect(refunds()).toEqual([PER_LANGUAGE, PER_LANGUAGE]);
    expect(output('es')).toMatchObject({ status: 'failed', vendor_dub_id: null });
    expect(projectRow().vendor_projects).toBeNull();
    expect(projectRow().status).toBe('failed');
  });

  it('fails cleanly with a refund when the project is refused before any target', async () => {
    seed({ outputs: [{ language: 'es' }] });
    el.createProject.mockRejectedValue(new Error('ElevenLabs project create failed (400): unsupported file'));
    await expect(makeProcessor().process(makeJob())).rejects.toThrow();
    expect(output('es')).toMatchObject({ status: 'failed', credits_consumed: 0 });
    expect(refunds()).toEqual([PER_LANGUAGE]);
    expect(el.createLanguageTarget).not.toHaveBeenCalled();
  });

  it('refunds every language exactly once on a cancel during the wait', async () => {
    seed({ outputs: [{ language: 'es' }, { language: 'fr' }] });
    // The user presses cancel while ElevenLabs is dubbing; the wait sees it at its next check.
    el.waitForDub.mockImplementation(async (opts: any) => {
      cancelFlag = '1';
      await opts.checkCancelled();
      return { status: 'completed', warnings: [] };
    });
    await expect(makeProcessor().process(makeJob())).rejects.toThrow('cancelled');
    expect(refunds()).toEqual([PER_LANGUAGE, PER_LANGUAGE]);
    // The targets stay stored, so a retry follows them rather than paying again.
    expect(output('es').vendor_dub_id).toMatch(/^project:proj_dubbing_v2:/);
  });

  it('still follows and downloads a dub from the legacy route', async () => {
    seed({ outputs: [{ language: 'es', vendor_dub_id: 'dub:legacy1' }] });
    await makeProcessor().process(makeJob());
    expect(el.createProject).not.toHaveBeenCalled();
    expect(el.waitForDub.mock.calls[0][1]).toEqual({ kind: 'dub', dubbingId: 'legacy1' });
    expect(el.downloadDub.mock.calls[0][1]).toEqual({ kind: 'dub', dubbingId: 'legacy1' });
    expect(output('es').status).toBe('completed');
    expect(output('es').timeline).toBeNull();
  });

  it('settles the charge against the measured length, once', async () => {
    const ffmpeg = jest.requireMock('./utils/ffmpeg');
    ffmpeg.probeDurationSeconds.mockResolvedValueOnce(60);
    seed({ outputs: [{ language: 'es' }] });
    await makeProcessor().process(makeJob());
    const owed = calculateDubbingCreditsByDuration(60, RATE);
    const charges = fakeDb.rpc.mock.calls.filter(([, a]) => a.credit_change < 0).map(([, a]) => a.credit_change);
    expect(charges).toEqual([-(owed - PER_LANGUAGE)]);
    expect(output('es').credits_consumed).toBe(owed);
  });
});
