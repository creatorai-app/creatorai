import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  createLanguageTarget,
  createProject,
  downloadDub,
  findLanguageTarget,
  findProjectByReference,
  elevenLabsClock,
  elevenLabsDeadlineMs,
  ElevenLabsDubFailedError,
  errorReason,
  getTargetTranscript,
  isBusyResponse,
  mergeWarnings,
  parseDub,
  serializeDub,
  toWarnings,
  transcriptTimeline,
  waitForDub,
  waitForProjectReady,
  type CallOptions,
} from './elevenlabs-dubbing';

const API = 'https://api.elevenlabs.io/v1';

type Call = { url: string; method: string; body: any; headers: Record<string, string> };
type Reply = Response | Error | ((call: Call) => Response | Error);

/** A fetch that answers from a script, in order, and records every request. */
function scriptFetch(replies: Reply[]) {
  const calls: Call[] = [];
  const spy = jest.spyOn(global, 'fetch').mockImplementation(async (input: any, init: any = {}) => {
    const call: Call = { url: String(input), method: init.method ?? 'GET', body: init.body, headers: init.headers ?? {} };
    calls.push(call);
    const next = replies.shift();
    if (!next) throw new Error(`unexpected request ${call.method} ${call.url}`);
    const reply = typeof next === 'function' ? next(call) : next;
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return { calls, spy };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const text = (body: string, status: number) => new Response(body, { status });

let slept: number[];
let now: number;
const cancel = jest.fn(async () => undefined);
const opts = (over: Partial<CallOptions> = {}): CallOptions => ({
  apiKey: 'key-1',
  checkCancelled: cancel,
  deadline: now + 60 * 60 * 1000,
  ...over,
});

beforeEach(() => {
  jest.restoreAllMocks();
  cancel.mockReset();
  cancel.mockResolvedValue(undefined);
  slept = [];
  now = 1_000_000;
  elevenLabsClock.now = () => now;
  elevenLabsClock.sleep = async (ms) => {
    slept.push(ms);
    now += ms;
  };
  elevenLabsClock.random = () => 0.5;
});

describe('createProject', () => {
  it('sends the project form with the model, reference, source language and one keyterms field per term', async () => {
    const { calls } = scriptFetch([json({ project_id: 'proj_1', status: 'queued' }, 201)]);
    const id = await createProject({
      ...opts(),
      sourceUrl: 'https://storage.googleapis.com/b/audio.m4a',
      modelId: 'dubbing_v2',
      sourceLanguage: 'en',
      keyterms: ['Creator AI', 'Cypher'],
      reference: 'our-project-1',
    });
    expect(id).toBe('proj_1');
    expect(calls[0].url).toBe(`${API}/dubbing/project`);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers['xi-api-key']).toBe('key-1');
    const form = calls[0].body as FormData;
    expect([...form.keys()].sort()).toEqual(['keyterms', 'keyterms', 'model_id', 'reference', 'source_language', 'source_url']);
    expect(form.get('source_url')).toBe('https://storage.googleapis.com/b/audio.m4a');
    expect(form.get('model_id')).toBe('dubbing_v2');
    expect(form.get('reference')).toBe('our-project-1');
    expect(form.get('source_language')).toBe('en');
    expect(form.getAll('keyterms')).toEqual(['Creator AI', 'Cypher']);
    // Never the target_language shortcut: targets are added one by one.
    expect(form.has('target_language')).toBe(false);
    expect(form.has('file')).toBe(false);
  });

  it('leaves out the source language (auto-detect) and keyterms when there are none', async () => {
    const { calls } = scriptFetch([json({ project_id: 'proj_2' }, 201)]);
    await createProject({ ...opts(), sourceUrl: 'u', modelId: 'dubbing_v1', reference: 'r' });
    const form = calls[0].body as FormData;
    expect(form.get('model_id')).toBe('dubbing_v1');
    expect(form.has('source_language')).toBe(false);
    expect(form.has('keyterms')).toBe(false);
  });

  it('uploads a local file instead of a URL, never both', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'el-proj-'));
    const clip = path.join(dir, 'clip.mp4');
    await fs.writeFile(clip, 'MP4');
    const { calls } = scriptFetch([json({ project_id: 'proj_f' }, 201)]);
    await createProject({ ...opts(), filePath: clip, modelId: 'dubbing_v2', reference: 'smoke' });
    const form = calls[0].body as FormData;
    expect(form.get('file')).toBeInstanceOf(Blob);
    expect(form.has('source_url')).toBe(false);
    await fs.rm(dir, { recursive: true, force: true });
    await expect(createProject({ ...opts(), modelId: 'dubbing_v2', reference: 'r' })).rejects.toThrow('needs a source URL or a file');
  });

  it('never sends a create twice after a dropped connection, since it may have gone through', async () => {
    const { calls } = scriptFetch([new TypeError('fetch failed')]);
    await expect(createProject({ ...opts(), sourceUrl: 'u', modelId: 'dubbing_v2', reference: 'r' })).rejects.toThrow('fetch failed');
    expect(calls).toHaveLength(1);
  });

  it('reads the reason from the error body', async () => {
    scriptFetch([json({ detail: { status: 'invalid_source', message: 'Could not fetch the source' } }, 400)]);
    await expect(createProject({ ...opts(), sourceUrl: 'u', modelId: 'dubbing_v2', reference: 'r' })).rejects.toThrow(
      'ElevenLabs project create failed (400): Could not fetch the source',
    );
  });
});

describe('busy and concurrency limits', () => {
  it('waits out a concurrency 429 with backoff and jitter, then goes through', async () => {
    const { calls } = scriptFetch([
      json({ detail: { status: 'too_many_concurrent_requests', message: 'Too many' } }, 429),
      json({ detail: { status: 'too_many_concurrent_requests' } }, 429),
      json({ project_id: 'proj_3' }, 201),
    ]);
    const onBusy = jest.fn();
    await expect(createProject({ ...opts({ onBusy }), sourceUrl: 'u', modelId: 'dubbing_v2', reference: 'r' })).resolves.toBe('proj_3');
    expect(calls).toHaveLength(3);
    expect(slept).toEqual([5_000, 10_000]); // random() 0.5 -> exactly the base
    expect(onBusy).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalled();
  });

  it('treats a body naming concurrency as busy whatever the status', () => {
    expect(isBusyResponse(429, '')).toBe(true);
    expect(isBusyResponse(400, '{"detail":{"status":"too_many_concurrent_requests"}}')).toBe(true);
    expect(isBusyResponse(503, '{"detail":{"status":"system_busy"}}')).toBe(true);
    expect(isBusyResponse(400, '{"detail":"bad language"}')).toBe(false);
  });

  it('stops a backoff the moment the dub is cancelled', async () => {
    scriptFetch([json({}, 429), json({ project_id: 'never' }, 201)]);
    cancel.mockRejectedValueOnce(new Error('Dubbing cancelled by user'));
    await expect(createProject({ ...opts(), sourceUrl: 'u', modelId: 'dubbing_v2', reference: 'r' })).rejects.toThrow('cancelled');
    expect(slept).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up once the deadline passes', async () => {
    scriptFetch([json({}, 429), json({}, 429), json({}, 429)]);
    await expect(
      createProject({ ...opts({ deadline: now + 12_000 }), sourceUrl: 'u', modelId: 'dubbing_v2', reference: 'r' }),
    ).rejects.toThrow('stayed busy');
  });

  it('retries a read after a 5xx or a dropped connection', async () => {
    const { calls } = scriptFetch([
      text('upstream', 502),
      new TypeError('socket hang up'),
      json({ project_id: 'p', status: 'ready' }),
    ]);
    await expect(waitForProjectReady(opts(), 'p')).resolves.toMatchObject({ status: 'ready' });
    expect(calls).toHaveLength(3);
  });
});

describe('createLanguageTarget', () => {
  it('sends the target tag and cloning strength as JSON on a v2 project', async () => {
    const { calls } = scriptFetch([json({ language_id: 'lang_1', status: 'queued' }, 201)]);
    const id = await createLanguageTarget({ ...opts(), projectId: 'proj_1', targetLanguage: 'es-MX', cloningStrength: 6 });
    expect(id).toBe('lang_1');
    expect(calls[0].url).toBe(`${API}/dubbing/project/proj_1/language`);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0].body)).toEqual({ target_language: 'es-MX', voice_settings: { cloning_strength: 6 } });
  });

  it('sends no voice settings when there is no cloning strength (a v1 project)', async () => {
    const { calls } = scriptFetch([json({ language_id: 'lang_2' }, 201)]);
    await createLanguageTarget({ ...opts(), projectId: 'proj_1', targetLanguage: 'bn', cloningStrength: null });
    expect(JSON.parse(calls[0].body)).toEqual({ target_language: 'bn' });
  });

  it('creates the target without voice settings when ElevenLabs refuses them', async () => {
    const { calls } = scriptFetch([
      json({ detail: [{ loc: ['body', 'voice_settings', 'cloning_strength'], msg: 'extra fields not permitted' }] }, 422),
      json({ language_id: 'lang_3' }, 201),
    ]);
    const refused = jest.fn();
    await expect(
      createLanguageTarget({ ...opts(), projectId: 'p', targetLanguage: 'fr', cloningStrength: 7, onVoiceSettingsRefused: refused }),
    ).resolves.toBe('lang_3');
    expect(JSON.parse(calls[1].body)).toEqual({ target_language: 'fr' });
    expect(refused).toHaveBeenCalled();
  });

  it('does not retry a 422 about something else', async () => {
    const { calls } = scriptFetch([json({ detail: [{ loc: ['body', 'target_language'], msg: 'unsupported language' }] }, 422)]);
    await expect(createLanguageTarget({ ...opts(), projectId: 'p', targetLanguage: 'xx', cloningStrength: 7 })).rejects.toThrow(
      'unsupported language',
    );
    expect(calls).toHaveLength(1);
  });
});

describe('waiting', () => {
  const dub = { kind: 'project' as const, projectId: 'proj_1', languageId: 'lang_1' };
  const target = (status: string, extra: object = {}) =>
    json({ language_id: 'lang_1', project_id: 'proj_1', target_language: 'es', status, ...extra });

  it('polls a project through queued and preparing to ready', async () => {
    scriptFetch([json({ status: 'queued' }), json({ status: 'preparing' }), json({ project_id: 'p', status: 'ready' })]);
    await expect(waitForProjectReady(opts(), 'p')).resolves.toMatchObject({ status: 'ready' });
    expect(slept).toEqual([5_000, 5_000]);
  });

  it('fails a project with the reason from error.error', async () => {
    scriptFetch([json({ status: 'failed', error: { message_type: 'error', error: 'Source could not be decoded' } })]);
    const error = await waitForProjectReady(opts(), 'p').catch((e) => e);
    expect(error).toBeInstanceOf(ElevenLabsDubFailedError);
    expect(error.scope).toBe('project');
    expect(error.message).toBe('ElevenLabs could not prepare the source: Source could not be decoded');
  });

  it.each([
    ['completed', 'completed'],
    ['stale', 'stale'],
  ])('treats a %s target as done', async (status, expected) => {
    scriptFetch([target('queued'), target('processing'), target(status)]);
    await expect(waitForDub(opts(), dub)).resolves.toMatchObject({ status: expected });
  });

  it('returns the target warnings, keyed on type', async () => {
    scriptFetch([
      target('completed', { warnings: [{ type: 'voices_not_permitted', speaker_ids: ['speaker_2'], message: 'Replaced' }] }),
    ]);
    await expect(waitForDub(opts(), dub)).resolves.toEqual({
      status: 'completed',
      warnings: [{ type: 'voices_not_permitted', speakerIds: ['speaker_2'], message: 'Replaced' }],
    });
  });

  it('fails a target with the reason from error.error, not a missing error.message', async () => {
    scriptFetch([target('failed', { error: { message_type: 'error', error: 'Speech could not be synthesized' } })]);
    const error = await waitForDub(opts(), dub).catch((e) => e);
    expect(error).toBeInstanceOf(ElevenLabsDubFailedError);
    expect(error.message).toBe('ElevenLabs dubbing failed: Speech could not be synthesized');
    expect(error.scope).toBe('target');
  });

  it('reads the project when a target failed because its project did', async () => {
    const { calls } = scriptFetch([
      target('failed', { error: { message_type: 'error', error: 'project_failed' } }),
      json({ status: 'failed', error: { message_type: 'error', error: 'Source URL returned 403' } }),
    ]);
    const error = await waitForDub(opts(), dub).catch((e) => e);
    expect(error.scope).toBe('project');
    expect(error.message).toContain('Source URL returned 403');
    expect(calls[1].url).toBe(`${API}/dubbing/project/proj_1`);
  });

  it('reads the reason from the OpenAPI shape too: { code, message, retryable }', async () => {
    scriptFetch([target('failed', { error: { code: 'synthesis_failed', message: 'Speech could not be synthesized', retryable: true } })]);
    await expect(waitForDub(opts(), dub)).rejects.toThrow('ElevenLabs dubbing failed: Speech could not be synthesized');
  });

  it('spots project_failed as a code, and reads the project for the cause', async () => {
    scriptFetch([
      target('failed', { error: { code: 'project_failed', message: 'The project failed', retryable: false } }),
      json({ status: 'failed', error: { code: 'source_unreadable', message: 'Source could not be decoded', retryable: false } }),
    ]);
    const error = await waitForDub(opts(), dub).catch((e) => e);
    expect(error.scope).toBe('project');
    expect(error.message).toBe('ElevenLabs could not prepare the source: Source could not be decoded');
  });

  it('falls back to the code when there is no message', async () => {
    scriptFetch([target('failed', { error: { code: 'internal_error', retryable: true } })]);
    await expect(waitForDub(opts(), dub)).rejects.toThrow('ElevenLabs dubbing failed: internal_error');
  });

  it('says so when no reason was given', async () => {
    scriptFetch([target('failed', { error: null })]);
    await expect(waitForDub(opts(), dub)).rejects.toThrow('no reason given');
  });

  it('stops polling when the dub is cancelled', async () => {
    scriptFetch([target('processing')]);
    cancel.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Dubbing cancelled by user'));
    await expect(waitForDub(opts(), dub)).rejects.toThrow('cancelled');
  });

  it('times out at the deadline', async () => {
    scriptFetch([target('processing'), target('processing')]);
    await expect(waitForDub(opts({ deadline: now + 8_000 }), dub)).rejects.toThrow('timed out');
  });

  it('still follows a dub started on the legacy route', async () => {
    const { calls } = scriptFetch([json({ status: 'dubbing' }), json({ status: 'dubbed' })]);
    await expect(waitForDub(opts(), { kind: 'dub', dubbingId: 'd1' })).resolves.toMatchObject({ status: 'completed' });
    expect(calls.map((c) => c.url)).toEqual([`${API}/dubbing/d1`, `${API}/dubbing/d1`]);
  });

  it('reads a legacy failure reason from its plain error string', async () => {
    scriptFetch([json({ status: 'failed', error: 'Unsupported file' })]);
    await expect(waitForDub(opts(), { kind: 'dub', dubbingId: 'd1' })).rejects.toThrow('ElevenLabs dubbing failed: Unsupported file');
  });
});

describe('downloadDub', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'el-dl-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const dub = { kind: 'project' as const, projectId: 'proj_1', languageId: 'lang_1' };
  const withUrl = (url: string) => json({ status: 'completed', outputs: { lossless_audio: url } });

  it('re-reads the target for a fresh signed URL and downloads it without the API key', async () => {
    const { calls } = scriptFetch([withUrl('https://signed.example/a.flac?sig=1'), new Response('FLACDATA')]);
    const out = path.join(dir, 'out');
    await downloadDub(opts(), dub, 'es', out);
    expect(calls[0].url).toBe(`${API}/dubbing/project/proj_1/language/lang_1`);
    expect(calls[1].url).toBe('https://signed.example/a.flac?sig=1');
    expect(calls[1].headers['xi-api-key']).toBeUndefined();
    await expect(fs.readFile(out, 'utf8')).resolves.toBe('FLACDATA');
  });

  it('reads the target again when the signed URL expired between the read and the download', async () => {
    const { calls } = scriptFetch([
      withUrl('https://signed.example/old'),
      text('<Error><Code>ExpiredToken</Code></Error>', 400),
      withUrl('https://signed.example/new'),
      new Response('FRESH'),
    ]);
    const out = path.join(dir, 'out');
    await downloadDub(opts(), dub, 'es', out);
    expect(calls.map((c) => c.url)).toEqual([
      `${API}/dubbing/project/proj_1/language/lang_1`,
      'https://signed.example/old',
      `${API}/dubbing/project/proj_1/language/lang_1`,
      'https://signed.example/new',
    ]);
    await expect(fs.readFile(out, 'utf8')).resolves.toBe('FRESH');
  });

  it('downloads a legacy dub from its audio route', async () => {
    const { calls } = scriptFetch([new Response('MP3')]);
    await downloadDub(opts(), { kind: 'dub', dubbingId: 'd1' }, 'es', path.join(dir, 'out'));
    expect(calls[0].url).toBe(`${API}/dubbing/d1/audio/es`);
  });
});

describe('transcripts and timeline', () => {
  const source = {
    language: 'en',
    segments: [
      { id: 'seg1', text: 'Hello there.', speaker_id: 'speaker_0', start_s: 0.2, end_s: 1.4 },
      { id: 'seg2', text: 'Hi!', speaker_id: 'speaker_1', start_s: 1.6, end_s: 2.0 },
    ],
  };
  const target = {
    source_language: 'en',
    target_language: 'es',
    segments: [
      { id: 'seg1', speaker_id: 'speaker_0', start_s: 0.2, end_s: 1.4, source_text: 'Hello there.', translation: 'Hola.' },
      { id: 'seg2', speaker_id: 'speaker_1', start_s: 1.6, end_s: 2.0, source_text: 'Hi!', translation: null },
    ],
  };

  it('maps the target transcript to the shared timeline shape', () => {
    expect(transcriptTimeline(source, target)).toEqual([
      { id: 'seg1', speaker: 'speaker_0', start: 0.2, end: 1.4, sourceText: 'Hello there.', translation: 'Hola.' },
      { id: 'seg2', speaker: 'speaker_1', start: 1.6, end: 2.0, sourceText: 'Hi!', translation: null },
    ]);
  });

  it('falls back to the source transcript with no translations', () => {
    expect(transcriptTimeline(source, null)[0]).toEqual({
      id: 'seg1', speaker: 'speaker_0', start: 0.2, end: 1.4, sourceText: 'Hello there.', translation: null,
    });
    expect(transcriptTimeline(null, null)).toEqual([]);
  });

  it('reads a target transcript, and treats the conflict before the first output as none', async () => {
    const { calls } = scriptFetch([json(target), json({ detail: 'No output yet' }, 409)]);
    await expect(getTargetTranscript(opts(), 'proj_1', 'lang_1')).resolves.toEqual(target);
    expect(calls[0].url).toBe(`${API}/dubbing/project/proj_1/language/lang_1/transcript`);
    await expect(getTargetTranscript(opts(), 'proj_1', 'lang_1')).resolves.toBeNull();
  });

  it('keeps warnings by type and merges project and target ones', () => {
    const w = toWarnings([{ type: 'voices_not_permitted', speaker_ids: ['b', 'a'] }, { message: 'no type' } as any]);
    expect(w).toEqual([{ type: 'voices_not_permitted', speakerIds: ['b', 'a'] }]);
    expect(mergeWarnings(w, [{ type: 'voices_not_permitted', speakerIds: ['a', 'b'] }])).toHaveLength(1);
  });
});

describe('finding what a lost answer left behind', () => {
  it('finds a live project by reference and model, paging newest first', async () => {
    const { calls } = scriptFetch([
      json({ projects: [{ project_id: 'other', reference: 'x', status: 'ready' }], next_cursor: 'c2' }),
      json({
        projects: [
          { project_id: 'failed_one', reference: 'p1', status: 'failed', model_id: 'dubbing_v2' },
          { project_id: 'v1_one', reference: 'p1', status: 'ready', model_id: 'dubbing_v1' },
          { project_id: 'mine', reference: 'p1', status: 'preparing', model_id: 'dubbing_v2' },
        ],
        next_cursor: null,
      }),
    ]);
    await expect(findProjectByReference(opts(), 'p1', 'dubbing_v2')).resolves.toBe('mine');
    expect(calls[0].url).toBe(`${API}/dubbing/project?page_size=100&sort_direction=DESCENDING`);
    expect(calls[1].url).toBe(`${API}/dubbing/project?page_size=100&sort_direction=DESCENDING&cursor=c2`);
  });

  it('finds nothing rather than failing when the list cannot be read', async () => {
    scriptFetch([json({ detail: 'nope' }, 403)]);
    await expect(findProjectByReference(opts(), 'p1', 'dubbing_v2')).resolves.toBeNull();
  });

  it('finds a live target for the language', async () => {
    const { calls } = scriptFetch([
      json({ languages: [{ language_id: 'l_failed', target_language: 'es-MX', status: 'failed' }, { language_id: 'l_ok', target_language: 'es-MX', status: 'processing' }] }),
    ]);
    await expect(findLanguageTarget(opts(), 'proj_1', 'es-MX')).resolves.toBe('l_ok');
    expect(calls[0].url).toBe(`${API}/dubbing/project/proj_1/language?page_size=100`);
    scriptFetch([json({ languages: [] })]);
    await expect(findLanguageTarget(opts(), 'proj_1', 'fr')).resolves.toBeNull();
  });
});

describe('stored dub ids', () => {
  it('round-trips both routes', () => {
    expect(parseDub(serializeDub({ kind: 'project', projectId: 'proj_1', languageId: 'lang_1' }))).toEqual({
      kind: 'project', projectId: 'proj_1', languageId: 'lang_1',
    });
    // Rows written before the project API.
    expect(parseDub('dub:abc123')).toEqual({ kind: 'dub', dubbingId: 'abc123' });
    expect(parseDub(null)).toBeNull();
    expect(parseDub('project:only-one')).toBeNull();
  });
});

describe('helpers', () => {
  it('reads ElevenLabs reasons in every shape they come in', () => {
    expect(errorReason('{"message_type":"error","error":"bad file"}')).toBe('bad file');
    expect(errorReason('{"detail":{"status":"x","message":"quota"}}')).toBe('quota');
    expect(errorReason('{"detail":"plain"}')).toBe('plain');
    expect(errorReason('{"detail":[{"msg":"field required"}]}')).toBe('field required');
    expect(errorReason('gateway timeout')).toBe('gateway timeout');
    expect(errorReason('')).toBeNull();
  });

  it('gives long sources more time than short ones', () => {
    expect(elevenLabsDeadlineMs(60)).toBe(90 * 60 * 1000);
    expect(elevenLabsDeadlineMs(3 * 3600)).toBe(4.5 * 3600 * 1000);
  });
});
