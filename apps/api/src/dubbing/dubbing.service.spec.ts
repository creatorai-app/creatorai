import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { DubbingService } from './dubbing.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DUBBING_CANCEL_PREFIX,
  DUBBING_CREDIT_MULTIPLIER,
  CYPHER_DUBBING_CREDIT_MULTIPLIER,
  calculateDubbingCreditsByDuration,
  getMinimumCreditsForDubbing,
} from '@repo/validation';
import {
  deleteGcsObject,
  gcsObjectMetadata,
  createResumableSession,
  initiateMultipartUpload,
  listMultipartParts,
  completeMultipartUpload,
  abortMultipartUpload,
  deleteGcsPrefix,
} from '../utils';

jest.mock('../utils', () => ({
  gcsObjectMetadata: jest.fn().mockResolvedValue({ size: 1000, contentType: 'audio/mp4' }),
  gcsPublicUrl: jest.fn((_c: unknown, obj: string) => `https://storage.googleapis.com/dub-bucket/${obj}`),
  gcsUri: jest.fn((_c: unknown, obj: string) => `gs://dub-bucket/${obj}`),
  deleteGcsObject: jest.fn().mockResolvedValue(undefined),
  deleteGcsPrefix: jest.fn().mockResolvedValue(undefined),
  getDubbingBucketName: jest.fn(() => 'dub-bucket'),
  createResumableSession: jest.fn().mockResolvedValue('https://storage.googleapis.com/upload/session-1'),
  resumableSessionOffset: jest.fn().mockResolvedValue({ uploadedBytes: 0, complete: false, expired: false }),
  initiateMultipartUpload: jest.fn().mockResolvedValue('upload-1'),
  signMultipartPartUrl: jest.fn().mockResolvedValue('https://signed-part-url'),
  listMultipartParts: jest.fn().mockResolvedValue([]),
  completeMultipartUpload: jest.fn().mockResolvedValue(undefined),
  abortMultipartUpload: jest.fn().mockResolvedValue(undefined),
}));

/** Chainable supabase query mock: every builder method returns the chain. .single() and
 *  .maybeSingle() resolve to `result`; awaiting the chain itself (an insert, a list, or an
 *  update with .select()) resolves to `awaited`, which defaults to `result`. */
function chain(result: unknown, awaited: unknown = result) {
  const c: any = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'order', 'limit', 'insert', 'update', 'delete']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(() => Promise.resolve(result));
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  c.then = (res: any, rej: any) => Promise.resolve(awaited).then(res, rej);
  return c;
}

/** The dubbing_outputs table, returning these rows to every read. */
const outputsTable = (rows: object[]) => chain({ data: rows, error: null }, { data: rows, error: null });

const USER = 'user-1';
const MiB = 1024 * 1024;

// Every fixture dub here is the same length, and its price is whatever the current
// rate makes it, derived, not written down, so a repricing moves the expectations with
// it instead of leaving them asserting last quarter's price. The suite runs on
// 'Creator', a paid plan, so the paid rates apply. Fixtures dub on Cypher unless they
// say otherwise; each language is its own dub at this price.
const DUB_SECONDS = 30 * 60;
const DUB_COST = calculateDubbingCreditsByDuration(DUB_SECONDS, CYPHER_DUBBING_CREDIT_MULTIPLIER);
const ELEVENLABS_COST = calculateDubbingCreditsByDuration(DUB_SECONDS, DUBBING_CREDIT_MULTIPLIER);
// One second's worth: the most a balance can hold and still not cover the clip.
const DUB_FLOOR = getMinimumCreditsForDubbing(CYPHER_DUBBING_CREDIT_MULTIPLIER);

describe('DubbingService', () => {
  let service: DubbingService;
  let tables: Record<string, any>;
  let queue: { add: jest.Mock; getJob: jest.Mock; client: Promise<any> };
  let rpc: jest.Mock;
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  function planResult(name: string | null) {
    return { data: name ? { plans: { name } } : null };
  }

  async function build(overrides: Partial<Record<string, any>> = {}) {
    jest.clearAllMocks();
    tables = {
      subscriptions: chain(planResult('Creator')),
      profiles: chain({ data: { credits: 100_000 }, error: null }),
      dubbing_projects: chain({ data: null, error: null }),
      dubbing_outputs: outputsTable([]),
      ...overrides,
    };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    queue = { add: jest.fn(), getJob: jest.fn(), client: Promise.resolve(redis) };

    // update_user_credits is the reservation/refund RPC - floored at zero in Postgres,
    // so "not enough credits" surfaces here as an error, not a negative balance.
    rpc = jest.fn().mockResolvedValue({ error: null });
    const mockSupabase = { getClient: () => ({ from: (t: string) => tables[t], rpc }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DubbingService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'GCS_DUBBING_BUCKET' ? 'dub-bucket' : undefined) } },
        { provide: getQueueToken('dubbing'), useValue: queue },
      ],
    }).compile();
    service = module.get(DubbingService);
  }

  describe('getAccess (plan gate)', () => {
    it.each(['Creator', 'Pro', 'Business', 'Scale'])('allows the paid %s plan', async (plan) => {
      await build({ subscriptions: chain(planResult(plan)) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({ allowed: true, plan });
    });

    it('allows Starter, and reports its 500MB / 45 min / one-language caps', async () => {
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({
        allowed: true,
        maxDurationSeconds: 45 * 60,
        maxUploadBytes: 500 * 1024 * 1024,
        maxLanguages: 1,
        // Starter's trial rate is the same on both engines.
        creditsPerSecond: { cypher: 3, elevenlabs: 3 },
      });
    });

    it('reports voice mode on ElevenLabs, and on Cypher only once its v2 voice service is configured', async () => {
      await build();
      delete process.env.CYPHER_TTS_V2_URL;
      await expect(service.getAccess(USER)).resolves.toMatchObject({ voiceModeEngines: ['elevenlabs'] });
      process.env.CYPHER_TTS_V2_URL = 'https://tts.example';
      await expect(service.getAccess(USER)).resolves.toMatchObject({ voiceModeEngines: ['cypher', 'elevenlabs'] });
      delete process.env.CYPHER_TTS_V2_URL;
    });

    it('prices each engine at its own rate on a paid plan', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({
        creditsPerSecond: { cypher: CYPHER_DUBBING_CREDIT_MULTIPLIER, elevenlabs: DUBBING_CREDIT_MULTIPLIER },
      });
    });

    it('lets an env override move only the engine it names', async () => {
      process.env.CYPHER_DUBBING_CREDIT_MULTIPLIER = '2';
      try {
        await build({ subscriptions: chain(planResult('Pro')) });
        await expect(service.getAccess(USER)).resolves.toMatchObject({
          creditsPerSecond: { cypher: 2, elevenlabs: DUBBING_CREDIT_MULTIPLIER },
        });
      } finally {
        delete process.env.CYPHER_DUBBING_CREDIT_MULTIPLIER;
      }
    });

    it.each([['Creator', 2], ['Pro', 2], ['Business', 3], ['Scale', 3]])(
      'lets %s dub into %i languages at once',
      async (plan, max) => {
        await build({ subscriptions: chain(planResult(plan as string)) });
        await expect(service.getAccess(USER)).resolves.toMatchObject({ maxLanguages: max });
      },
    );

    it('still denies users with no subscription at all', async () => {
      await build({ subscriptions: chain(planResult(null)) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({ allowed: false });
    });
  });

  describe('initUpload', () => {
    const input = {
      filename: 'my clip.mp4',
      contentType: 'video/mp4',
      fileSize: 1000,
      isVideo: true,
      durationSeconds: DUB_SECONDS,
      engine: 'cypher' as const,
      targets: [{ language: 'es' }],
      mediaName: 'My clip',
      fingerprint: 'my clip.mp4|1000|1',
      audio: { contentType: 'audio/mp4', size: 100, extracted: true },
    };
    const audioOnly = {
      ...input,
      filename: 'a.mp3',
      contentType: 'audio/mpeg',
      isVideo: false,
      audio: { contentType: 'audio/mpeg', size: 1000, extracted: false },
    };
    const two = [{ language: 'es' }, { language: 'fr' }];
    const three = [...two, { language: 'de' }];

    it('accepts a Starter clip within the 45 min cap', async () => {
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.initUpload({ ...input, durationSeconds: 40 * 60 }, USER)).resolves.toMatchObject({
        audio: { sessionUri: expect.any(String) },
      });
    });

    it('rejects a Starter clip over the 45 min cap', async () => {
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.initUpload({ ...input, durationSeconds: 50 * 60 }, USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lets a paid plan exceed the Starter cap but stops it at the vendor ceiling', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(service.initUpload({ ...input, durationSeconds: 60 * 60 }, USER)).resolves.toBeTruthy();
      await expect(service.initUpload({ ...input, durationSeconds: 181 * 60 }, USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      ['Starter', two, false],
      ['Creator', two, true],
      ['Pro', three, false],
      ['Business', three, true],
      ['Scale', three, true],
    ])('on %s, %j languages allowed: %s', async (plan, targets, allowed) => {
      await build({ subscriptions: chain(planResult(plan as string)) });
      const attempt = service.initUpload({ ...input, targets: targets as typeof two }, USER);
      if (allowed) await expect(attempt).resolves.toBeTruthy();
      else await expect(attempt).rejects.toThrow(/languages? at once/);
    });

    // Each language is its own dub, so the balance must cover all of them up front.
    it('prices the balance check per language', async () => {
      await build({ profiles: chain({ data: { credits: DUB_COST }, error: null }) });
      await expect(service.initUpload(input, USER)).resolves.toBeTruthy();
      await expect(service.initUpload({ ...input, targets: two }, USER)).rejects.toThrow(
        new RegExp(`2-language dub costs ${DUB_COST * 2} credits`),
      );
    });

    // Hebrew, Norwegian and Swahili moved to Dubbing v2: an hour-long dub in them is held
    // to the plan's cap on either engine, not the v1 route's 45 minutes.
    it.each(['he', 'no', 'sw'])('holds %s to the plan cap on both engines', async (language) => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(
        service.initUpload({ ...input, targets: [{ language }], durationSeconds: 60 * 60 }, USER),
      ).resolves.toBeTruthy();
      await expect(
        service.initUpload({ ...input, engine: 'elevenlabs', targets: [{ language }], durationSeconds: 60 * 60 }, USER),
      ).resolves.toBeTruthy();
    });

    // Bengali routes through ElevenLabs' dubbing_v1, which tops out at 1GB / 45 min no
    // matter what the plan allows. One such language tightens the whole dub.
    it('holds a dub with a dubbing_v1 language to the smaller route limits', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      const withBengali = { ...input, engine: 'elevenlabs' as const, targets: [{ language: 'es' }, { language: 'bn' }] };
      await expect(service.initUpload({ ...withBengali, durationSeconds: 60 * 60 }, USER)).rejects.toThrow(BadRequestException);
      await expect(service.initUpload({ ...withBengali, fileSize: 2 * 1024 * MiB }, USER)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    // The size cap is on the ORIGINAL file, even though only the small audio track
    // uploads first: the video follows, and it is what the plan limits.
    it('caps the original file size, not the extracted audio', async () => {
      const big = { ...input, fileSize: 501 * MiB };
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.initUpload(big, USER)).rejects.toThrow(PayloadTooLargeException);

      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(service.initUpload(big, USER)).resolves.toBeTruthy();
      await expect(service.initUpload({ ...input, fileSize: 4 * 1024 * MiB }, USER)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it('rejects an audio track larger than its source', async () => {
      await build();
      await expect(
        service.initUpload({ ...input, audio: { ...input.audio, size: 2000 } }, USER),
      ).rejects.toThrow(BadRequestException);
    });

    // Regression: a user short on credits must learn it before uploading anything.
    it('rejects an unaffordable dub before any upload opens', async () => {
      await build({ profiles: chain({ data: { credits: DUB_FLOOR }, error: null }) });
      await expect(service.initUpload(input, USER)).rejects.toThrow(ForbiddenException);
      expect(createResumableSession).not.toHaveBeenCalled();
      expect(initiateMultipartUpload).not.toHaveBeenCalled();
    });

    it('opens an audio session, a multipart plan, and one output per language', async () => {
      await build();
      const res = await service.initUpload(
        { ...input, engine: 'elevenlabs', targets: [{ language: 'en', accent: 'british' }, { language: 'fr' }] },
        USER,
        'https://trycreatorai.com',
      );
      const prefix = `${USER}/dubbing/${res.projectId}/`;
      // The browser's origin goes on the session, or every browser PUT to it fails CORS.
      expect(createResumableSession).toHaveBeenCalledWith(
        expect.anything(), `${prefix}audio.m4a`, 'audio/mp4', 'dub-bucket', 'https://trycreatorai.com',
      );
      expect(initiateMultipartUpload).toHaveBeenCalledWith(
        expect.anything(), `${prefix}my_clip.mp4`, 'video/mp4', 'dub-bucket',
      );
      expect(res.video).toEqual({ partSize: 16 * MiB, partCount: 1 });
      expect(tables.dubbing_projects.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'uploading',
          engine: 'elevenlabs',
          video_status: 'uploading',
          credits_consumed: 0,
          video_upload_id: 'upload-1',
        }),
      );
      expect(tables.dubbing_outputs.insert).toHaveBeenCalledWith([
        { project_id: res.projectId, user_id: USER, language: 'en', accent: 'british' },
        { project_id: res.projectId, user_id: USER, language: 'fr', accent: null },
      ]);
      // Nothing is charged until the audio is in and the dub starts.
      expect(rpc).not.toHaveBeenCalled();
    });

    it('stores the source language, voice mode and keyterms on the project', async () => {
      await build();
      await service.initUpload(
        { ...input, engine: 'elevenlabs', sourceLanguage: 'en', voiceMode: 'native', keyterms: ['Creator AI', 'Cypher'] },
        USER,
      );
      expect(tables.dubbing_projects.insert).toHaveBeenCalledWith(
        expect.objectContaining({ source_language: 'en', voice_mode: 'native', keyterms: ['Creator AI', 'Cypher'] }),
      );
    });

    it('stores a detected source, the balanced mode and no keyterms by default', async () => {
      await build();
      await service.initUpload(input as any, USER);
      expect(tables.dubbing_projects.insert).toHaveBeenCalledWith(
        expect.objectContaining({ source_language: null, voice_mode: 'balanced', keyterms: [] }),
      );
    });

    it('drops a malformed origin rather than passing it to GCS', async () => {
      await build();
      await service.initUpload(input, USER, 'https://evil.example/path');
      expect(createResumableSession).toHaveBeenCalledWith(
        expect.anything(), expect.any(String), 'audio/mp4', 'dub-bucket', undefined,
      );
    });

    it('uploads an audio file (or an unsplit video) as a single resumable object', async () => {
      await build();
      const res = await service.initUpload(audioOnly, USER);
      expect(res.video).toBeNull();
      expect(initiateMultipartUpload).not.toHaveBeenCalled();
      expect(tables.dubbing_projects.insert).toHaveBeenCalledWith(
        expect.objectContaining({ audio_object: `${USER}/dubbing/${res.projectId}/a.mp3`, video_status: null }),
      );
    });

    it('keeps every upload under 1000 parts', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      const res = await service.initUpload({ ...input, fileSize: 3 * 1024 * MiB }, USER);
      expect(res.video!.partCount).toBeLessThanOrEqual(1000);
      expect(res.video!.partSize).toBeGreaterThanOrEqual(5 * MiB); // GCS minimum for non-final parts
    });

    it('aborts the multipart upload when the row cannot be created', async () => {
      await build({ dubbing_projects: chain({ data: null, error: { message: 'boom' } }) });
      await expect(service.initUpload(input, USER)).rejects.toThrow();
      expect(abortMultipartUpload).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'upload-1', 'dub-bucket');
    });

    it('removes the project again when its outputs cannot be created', async () => {
      await build({ dubbing_outputs: chain({ data: null, error: { message: 'boom' } }) });
      await expect(service.initUpload(input, USER)).rejects.toThrow();
      expect(tables.dubbing_projects.delete).toHaveBeenCalled();
      expect(abortMultipartUpload).toHaveBeenCalled();
    });
  });

  describe('startDub', () => {
    const row = {
      project_id: 'p-1',
      user_id: USER,
      status: 'uploading',
      engine: 'cypher',
      target_language: 'es',
      target_accent: null,
      is_video: true,
      duration_seconds: DUB_SECONDS,
      audio_object: `${USER}/dubbing/p-1/audio.m4a`,
      audio_size: 1000,
      audio_content_type: 'audio/mp4',
      audio_extracted: true,
      input_gs_uri: `gs://dub-bucket/${USER}/dubbing/p-1/audio.m4a`,
      input_url: `https://storage.googleapis.com/dub-bucket/${USER}/dubbing/p-1/audio.m4a`,
    };
    const claimed = { data: [{ project_id: 'p-1' }], error: null };
    const outputs = [{ id: 'o-es', language: 'es', status: 'pending', credits_consumed: 0 }];

    const project = (over: object = {}, awaited: unknown = claimed) =>
      chain({ data: { ...row, ...over }, error: null }, awaited);

    it('refuses to start before the audio has landed', async () => {
      await build({ dubbing_projects: project(), dubbing_outputs: outputsTable(outputs) });
      (gcsObjectMetadata as jest.Mock).mockRejectedValueOnce(new Error('404'));
      await expect(service.startDub(USER, 'p-1')).rejects.toThrow(/has not finished/);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('refuses audio whose stored size differs from what was declared', async () => {
      await build({ dubbing_projects: project({ audio_size: 999 }), dubbing_outputs: outputsTable(outputs) });
      await expect(service.startDub(USER, 'p-1')).rejects.toThrow(/does not match/);
      expect(rpc).not.toHaveBeenCalled();
    });

    // Regression: the old precheck only asked for one second's worth, so a user who
    // could not cover the whole dub still got enqueued and only failed after the GPU ran.
    it('rejects when credits cover the floor but not the full duration', async () => {
      await build({
        profiles: chain({ data: { credits: DUB_FLOOR }, error: null }),
        dubbing_projects: project(),
        dubbing_outputs: outputsTable(outputs),
      });
      await expect(service.startDub(USER, 'p-1')).rejects.toThrow(
        new RegExp(`costs ${DUB_COST} credits and you have ${DUB_FLOOR}`),
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    // Reserving up front is what stops two concurrent dubs from both passing the
    // precheck and only failing to bill after the GPU has already run.
    it('reserves one dub per language and enqueues the worker with a random job id', async () => {
      const two = [...outputs, { id: 'o-fr', language: 'fr', status: 'pending', credits_consumed: 0 }];
      await build({ dubbing_projects: project(), dubbing_outputs: outputsTable(two) });
      const { jobId } = await service.startDub(USER, 'p-1');
      expect(rpc).toHaveBeenCalledWith('update_user_credits', { user_uuid: USER, credit_change: -DUB_COST * 2 });
      expect(tables.dubbing_outputs.update).toHaveBeenCalledWith({ credits_consumed: DUB_COST });
      // A random id, not `dubbing-{userId}-{ms}`: the SSE status route is unauthenticated,
      // so a guessable job id would let a stranger watch someone else's dub.
      expect(jobId).toMatch(/^dubbing-[0-9a-f-]{36}$/);
      expect(jobId).not.toContain(USER);
      expect(queue.add).toHaveBeenCalledWith(
        'dubbing',
        expect.objectContaining({ userId: USER, reservedCredits: DUB_COST * 2, mimeType: 'audio/mp4', isVideo: true }),
        expect.objectContaining({ jobId }),
      );
    });

    it('passes the source language, voice mode and keyterms to the job', async () => {
      await build({
        dubbing_projects: project({ source_language: 'en', voice_mode: 'like_me', keyterms: ['Creator AI'] }),
        dubbing_outputs: outputsTable(outputs),
      });
      await service.startDub(USER, 'p-1');
      expect(queue.add).toHaveBeenCalledWith(
        'dubbing',
        expect.objectContaining({ sourceLanguage: 'en', voiceMode: 'like_me', keyterms: ['Creator AI'] }),
        expect.anything(),
      );
    });

    it('sends the defaults for a row from before the voice mode existed', async () => {
      await build({ dubbing_projects: project(), dubbing_outputs: outputsTable(outputs) });
      await service.startDub(USER, 'p-1');
      expect(queue.add).toHaveBeenCalledWith(
        'dubbing',
        expect.objectContaining({ sourceLanguage: null, voiceMode: 'balanced', keyterms: [] }),
        expect.anything(),
      );
    });

    it('reserves an ElevenLabs dub at the ElevenLabs rate', async () => {
      await build({ dubbing_projects: project({ engine: 'elevenlabs' }), dubbing_outputs: outputsTable(outputs) });
      await service.startDub(USER, 'p-1');
      expect(rpc).toHaveBeenCalledWith('update_user_credits', { user_uuid: USER, credit_change: -ELEVENLABS_COST });
    });

    it('rejects the second of two concurrent dubs at the reservation', async () => {
      await build({ dubbing_projects: project(), dubbing_outputs: outputsTable(outputs) });
      rpc.mockResolvedValueOnce({ error: { message: 'Insufficient credits' } });
      await expect(service.startDub(USER, 'p-1')).rejects.toThrow(ForbiddenException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    // Two tabs pressing start at once: the loser's reservation goes straight back.
    it('refunds when another request already claimed the start', async () => {
      await build({ dubbing_projects: project({}, { data: [], error: null }), dubbing_outputs: outputsTable(outputs) });
      await expect(service.startDub(USER, 'p-1')).rejects.toThrow(/already started/);
      expect(rpc).toHaveBeenLastCalledWith('update_user_credits', { user_uuid: USER, credit_change: DUB_COST });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('returns the running job when start is retried', async () => {
      await build({ dubbing_projects: project({ status: 'processing', job_id: 'dubbing-x' }) });
      await expect(service.startDub(USER, 'p-1')).resolves.toEqual({ jobId: 'dubbing-x' });
      expect(rpc).not.toHaveBeenCalled();
    });

    it('refunds and fails the languages when the job cannot be queued', async () => {
      await build({ dubbing_projects: project(), dubbing_outputs: outputsTable(outputs) });
      queue.add.mockRejectedValueOnce(new Error('redis down'));
      await expect(service.startDub(USER, 'p-1')).rejects.toThrow(/Failed to queue/);
      expect(rpc).toHaveBeenLastCalledWith('update_user_credits', { user_uuid: USER, credit_change: DUB_COST });
      expect(tables.dubbing_outputs.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', credits_consumed: 0 }),
      );
    });
  });

  describe('completeVideo', () => {
    const row = {
      project_id: 'p-1',
      user_id: USER,
      status: 'cloning',
      is_video: true,
      duration_seconds: DUB_SECONDS,
      video_object: `${USER}/dubbing/p-1/clip.mp4`,
      video_upload_id: 'upload-1',
      video_size: 40 * MiB,
      video_part_size: 16 * MiB,
      video_status: 'uploading',
    };
    const allParts = [
      { partNumber: 1, etag: '"a"', size: 16 * MiB },
      { partNumber: 2, etag: '"b"', size: 16 * MiB },
      { partNumber: 3, etag: '"c"', size: 8 * MiB },
    ];
    const nothingWaiting = { data: [], error: null };

    it('refuses to complete while a part is missing', async () => {
      await build({ dubbing_projects: chain({ data: row, error: null }, nothingWaiting) });
      (listMultipartParts as jest.Mock).mockResolvedValueOnce(allParts.slice(0, 2));
      await expect(service.completeVideo(USER, 'p-1')).rejects.toThrow(/still missing/);
      expect(completeMultipartUpload).not.toHaveBeenCalled();
    });

    it('refuses a part of the wrong size', async () => {
      await build({ dubbing_projects: chain({ data: row, error: null }, nothingWaiting) });
      (listMultipartParts as jest.Mock).mockResolvedValueOnce([allParts[0], { ...allParts[1], size: 1 }, allParts[2]]);
      await expect(service.completeVideo(USER, 'p-1')).rejects.toThrow(/still missing/);
    });

    it('completes in part order and leaves a running dub to mux on its own', async () => {
      await build({ dubbing_projects: chain({ data: row, error: null }, nothingWaiting) });
      (listMultipartParts as jest.Mock).mockResolvedValueOnce([allParts[2], allParts[0], allParts[1]]);
      (gcsObjectMetadata as jest.Mock).mockResolvedValueOnce({ size: 40 * MiB, contentType: 'video/mp4' });
      await expect(service.completeVideo(USER, 'p-1')).resolves.toEqual({ jobId: null });
      expect(completeMultipartUpload).toHaveBeenCalledWith(
        expect.anything(), row.video_object, 'upload-1', allParts, 'dub-bucket',
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    // The dubbed audio finished first and parked on 'awaiting_video': the mux is queued
    // now, and it is free, since the audio dub was already paid for.
    it('queues a free mux for a dub waiting on the video', async () => {
      await build({
        dubbing_projects: chain(
          { data: { ...row, status: 'awaiting_video' }, error: null },
          { data: [{ project_id: 'p-1' }], error: null },
        ),
      });
      (listMultipartParts as jest.Mock).mockResolvedValueOnce(allParts);
      (gcsObjectMetadata as jest.Mock).mockResolvedValueOnce({ size: 40 * MiB, contentType: 'video/mp4' });
      const { jobId } = await service.completeVideo(USER, 'p-1');
      expect(jobId).toMatch(/^dubbing-/);
      expect(queue.add).toHaveBeenCalledWith('dubbing', expect.objectContaining({ reservedCredits: 0 }), expect.anything());
      expect(rpc).not.toHaveBeenCalled();
    });

    it('deletes an assembled video whose size does not match the picked file', async () => {
      await build({ dubbing_projects: chain({ data: row, error: null }, nothingWaiting) });
      (listMultipartParts as jest.Mock).mockResolvedValueOnce(allParts);
      (gcsObjectMetadata as jest.Mock).mockResolvedValueOnce({ size: 1, contentType: 'video/mp4' });
      await expect(service.completeVideo(USER, 'p-1')).rejects.toThrow(/does not match/);
      expect(deleteGcsObject).toHaveBeenCalledWith(expect.anything(), row.video_object, 'dub-bucket');
    });
  });

  describe('resumeDub and regenerateDub', () => {
    const row = {
      project_id: 'p-1',
      user_id: USER,
      status: 'failed',
      engine: 'cypher',
      is_video: true,
      target_language: 'es',
      duration_seconds: DUB_SECONDS,
      input_gs_uri: `gs://dub-bucket/${USER}/dubbing/p-1/audio.m4a`,
      input_url: `https://storage.googleapis.com/dub-bucket/${USER}/dubbing/p-1/audio.m4a`,
    };
    const done = { id: 'o-es', language: 'es', status: 'completed', dubbed_audio_url: 'x.mp3', dubbed_url: 'x.mp4', credits_consumed: DUB_COST };
    const undelivered = { id: 'o-fr', language: 'fr', status: 'failed', dubbed_audio_url: null, credits_consumed: 0 };
    const unmuxed = { id: 'o-de', language: 'de', status: 'failed', dubbed_audio_url: 'd.mp3', credits_consumed: DUB_COST };

    it('only resumes a failed dub', async () => {
      await build({ dubbing_projects: chain({ data: { ...row, status: 'completed' }, error: null }) });
      await expect(service.resumeDub(USER, 'p-1')).rejects.toThrow(/Only a failed dub/);
    });

    it('re-charges only the languages whose audio never landed, and keeps their progress', async () => {
      await build({
        dubbing_projects: chain({ data: row, error: null }),
        dubbing_outputs: outputsTable([done, undelivered, unmuxed]),
      });
      await service.resumeDub(USER, 'p-1');
      expect(rpc).toHaveBeenCalledWith('update_user_credits', { user_uuid: USER, credit_change: -DUB_COST });
      const updates = (tables.dubbing_outputs.update as jest.Mock).mock.calls.map((c) => c[0]);
      expect(updates).toContainEqual({ status: 'pending', error_message: null, credits_consumed: DUB_COST });
      expect(updates).toContainEqual({ status: 'pending', error_message: null });
      for (const u of updates) expect(u).not.toHaveProperty('translation');
      expect(tables.dubbing_projects.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'queued', credits_consumed: DUB_COST * 3 }),
      );
      expect(queue.add).toHaveBeenCalledWith('dubbing', expect.objectContaining({ reservedCredits: DUB_COST }), expect.anything());
    });

    it('re-runs only the free mux when every unfinished language has its audio', async () => {
      await build({ dubbing_projects: chain({ data: row, error: null }), dubbing_outputs: outputsTable([done, unmuxed]) });
      await service.resumeDub(USER, 'p-1');
      expect(rpc).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith('dubbing', expect.objectContaining({ reservedCredits: 0 }), expect.anything());
    });

    it('refuses to resume a dub whose every language finished', async () => {
      await build({ dubbing_projects: chain({ data: row, error: null }), dubbing_outputs: outputsTable([done]) });
      await expect(service.resumeDub(USER, 'p-1')).rejects.toThrow(/already finished/);
    });

    it.each(['queued', 'processing', 'cloning'])('refuses to regenerate a %s dub', async (status) => {
      await build({ dubbing_projects: chain({ data: { ...row, status }, error: null }) });
      await expect(service.regenerateDub(USER, 'p-1')).rejects.toThrow(/still running/);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('refuses to regenerate a dub that is still uploading', async () => {
      await build({ dubbing_projects: chain({ data: { ...row, status: 'uploading' }, error: null }) });
      await expect(service.regenerateDub(USER, 'p-1')).rejects.toThrow(/Finish uploading/);
    });

    it('regenerates every language from scratch and detects the speakers again', async () => {
      await build({
        dubbing_projects: chain({ data: { ...row, status: 'completed' }, error: null }),
        dubbing_outputs: outputsTable([done, { ...undelivered, status: 'completed' }]),
      });
      await service.regenerateDub(USER, 'p-1');
      expect(rpc).toHaveBeenCalledWith('update_user_credits', { user_uuid: USER, credit_change: -DUB_COST * 2 });
      expect(tables.dubbing_outputs.update).toHaveBeenCalledWith(
        expect.objectContaining({
          translation: null, segments_done: 0, vendor_dub_id: null, dubbed_audio_url: null, timeline: null, warnings: null,
        }),
      );
      // A fresh start is a new ElevenLabs project too, under a new reference.
      expect(tables.dubbing_projects.update).toHaveBeenCalledWith(
        expect.objectContaining({ analysis: null, vendor_projects: { generation: 1 } }),
      );
    });

    it('bumps the generation again on a second regenerate', async () => {
      await build({
        dubbing_projects: chain({ data: { ...row, status: 'completed', vendor_projects: { dubbing_v2: 'proj_1', generation: 1 } }, error: null }),
        dubbing_outputs: outputsTable([done]),
      });
      await service.regenerateDub(USER, 'p-1');
      expect(tables.dubbing_projects.update).toHaveBeenCalledWith(expect.objectContaining({ vendor_projects: { generation: 2 } }));
    });

    it('keeps the ElevenLabs project on a resume', async () => {
      await build({
        dubbing_projects: chain({ data: { ...row, status: 'failed', vendor_projects: { dubbing_v2: 'proj_1' } }, error: null }),
        dubbing_outputs: outputsTable([undelivered]),
      });
      await service.resumeDub(USER, 'p-1');
      const writes = tables.dubbing_projects.update.mock.calls.map(([fields]: [Record<string, unknown>]) => fields);
      expect(writes.some((w: Record<string, unknown>) => 'vendor_projects' in w)).toBe(false);
    });

    // A dub from before per-language outputs gets one output row the first time it runs again.
    it('gives an older single-language dub an output row when it is regenerated', async () => {
      const legacyOutputs = chain(
        { data: null, error: null },
        { data: [], error: null },
      );
      legacyOutputs.insert = jest.fn(() => ({
        select: () => Promise.resolve({ data: [{ id: 'o-1', language: 'bn', status: 'pending', credits_consumed: 0 }], error: null }),
      }));
      await build({
        dubbing_projects: chain({ data: { ...row, status: 'completed', engine: null, target_language: 'bn' }, error: null }),
        dubbing_outputs: legacyOutputs,
      });
      await service.regenerateDub(USER, 'p-1');
      expect(legacyOutputs.insert).toHaveBeenCalledWith(expect.objectContaining({ language: 'bn' }));
      // Bengali has no Chatterbox voice, so the older dub is picked up by ElevenLabs.
      expect(tables.dubbing_projects.update).toHaveBeenCalledWith({ engine: 'elevenlabs' });
    });
  });

  describe('getDub', () => {
    const project = {
      project_id: 'p-1', engine: 'cypher', status: 'completed', is_video: true, created_at: 'now', media_name: 'Clip',
      target_language: 'es', target_accent: null, dubbed_url: 'old.mp4', credits_consumed: 10, error_message: null,
      speakers: [{ id: 'S1' }, { id: 'S2' }, { id: 'S3', voiceOf: 'S1' }],
    };

    it('lists every language and counts the distinct voices', async () => {
      await build({
        dubbing_projects: chain({ data: project, error: null }),
        dubbing_outputs: outputsTable([
          { language: 'es', status: 'completed', dubbed_url: 'es.mp4', segments_done: 4, credits_consumed: 5 },
          { language: 'fr', status: 'failed', error_message: 'boom', segments_done: 1, credits_consumed: 0 },
        ]),
      });
      const dub = await service.getDub(USER, 'p-1');
      expect(dub.speakerCount).toBe(2);
      expect(dub.outputs.map((o) => [o.language, o.status])).toEqual([['es', 'completed'], ['fr', 'failed']]);
    });

    it('returns each language\'s timeline and warnings, and the dub\'s voice settings', async () => {
      const timeline = [{ id: 's1', speaker: 'speaker_0', start: 0, end: 1.2, sourceText: 'Hi', translation: 'Hola' }];
      const warnings = [{ type: 'voices_not_permitted', speakerIds: ['speaker_1'] }];
      await build({
        dubbing_projects: chain({ data: { ...project, source_language: 'en', voice_mode: 'native', keyterms: ['Cypher'] }, error: null }),
        dubbing_outputs: outputsTable([{ language: 'es', status: 'completed', segments_done: 0, credits_consumed: 5, timeline, warnings }]),
      });
      const dub = await service.getDub(USER, 'p-1');
      expect(dub).toMatchObject({ sourceLanguage: 'en', voiceMode: 'native', keyterms: ['Cypher'] });
      expect(dub.outputs[0]).toMatchObject({ timeline, warnings });
    });

    it('returns no timeline for a language made before timelines', async () => {
      await build({
        dubbing_projects: chain({ data: project, error: null }),
        dubbing_outputs: outputsTable([{ language: 'es', status: 'completed', segments_done: 0, credits_consumed: 5 }]),
      });
      const dub = await service.getDub(USER, 'p-1');
      expect(dub.outputs[0].timeline).toBeNull();
      expect(dub.voiceMode).toBeNull();
    });

    it('shows an older dub as its one language', async () => {
      await build({ dubbing_projects: chain({ data: { ...project, speakers: null }, error: null }) });
      const dub = await service.getDub(USER, 'p-1');
      expect(dub.outputs).toEqual([expect.objectContaining({ language: 'es', status: 'completed', dubbedUrl: 'old.mp4' })]);
    });
  });

  describe('stopDub (cancellation)', () => {
    it('404s when the job does not exist or belongs to someone else', async () => {
      await build();
      queue.getJob.mockResolvedValue(null);
      await expect(service.stopDub(USER, 'nope')).rejects.toThrow(NotFoundException);

      queue.getJob.mockResolvedValue({ data: { userId: 'other' } });
      await expect(service.stopDub(USER, 'job-1')).rejects.toThrow(NotFoundException);
    });

    it('removes a waiting job, refunds it and fails its undelivered languages', async () => {
      await build();
      const remove = jest.fn();
      queue.getJob.mockResolvedValue({
        data: { userId: USER, projectId: 'p-1', reservedCredits: DUB_COST * 2 },
        getState: () => Promise.resolve('waiting'),
        remove,
      });
      const res = await service.stopDub(USER, 'job-1');
      expect(remove).toHaveBeenCalled();
      // The worker never ran it, so the API owns the refund here.
      expect(rpc).toHaveBeenCalledWith('update_user_credits', { user_uuid: USER, credit_change: DUB_COST * 2 });
      expect(tables.dubbing_outputs.update).toHaveBeenCalledWith(
        { status: 'failed', error_message: 'Cancelled by user', credits_consumed: 0 },
      );
      expect(tables.dubbing_projects.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error_message: 'Cancelled by user' }),
      );
      expect(res.message).toBe('Dubbing cancelled');
    });

    // A queued mux-only job holds no reservation: a language whose audio was delivered
    // keeps the charge it earned.
    it('keeps the earned charge of delivered languages when a free mux job is cancelled', async () => {
      await build();
      queue.getJob.mockResolvedValue({
        data: { userId: USER, projectId: 'p-1', reservedCredits: 0 },
        getState: () => Promise.resolve('waiting'),
        remove: jest.fn(),
      });
      await service.stopDub(USER, 'job-1');
      expect(rpc).not.toHaveBeenCalled();
      expect(tables.dubbing_outputs.update).toHaveBeenCalledWith({ status: 'failed', error_message: 'Cancelled by user' });
    });

    it('sets the Redis cancel flag for an active job', async () => {
      await build();
      queue.getJob.mockResolvedValue({
        data: { userId: USER, projectId: 'p-1' },
        getState: () => Promise.resolve('active'),
      });
      const res = await service.stopDub(USER, 'job-1');
      expect(redis.set).toHaveBeenCalledWith(`${DUBBING_CANCEL_PREFIX}job-1`, '1', 'EX', 3600);
      expect(res.message).toMatch(/^Cancellation requested/);
      // The worker refunds an active job when it aborts - the API must not double-refund.
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe('deleteDub', () => {
    it('refuses to delete a running dub', async () => {
      await build({ dubbing_projects: chain({ data: { status: 'processing' }, error: null }) });
      await expect(service.deleteDub(USER, 'p-1')).rejects.toThrow(/Cancel it before deleting/);
    });

    it('removes the outputs, every language file and the older single-file names', async () => {
      await build({
        dubbing_projects: chain({
          data: { status: 'completed', input_gs_uri: `gs://dub-bucket/${USER}/dubbing/a.mp3`, is_video: false },
          error: null,
        }),
      });
      await service.deleteDub(USER, 'p-1');
      expect(tables.dubbing_outputs.delete).toHaveBeenCalled();
      expect(deleteGcsPrefix).toHaveBeenCalledWith(expect.anything(), 'dubbed/p-1/', 'dub-bucket');
      const deleted = (deleteGcsObject as jest.Mock).mock.calls.map((c) => c[1]);
      // Audio dubs were .wav (Modal) or .mp3 (ElevenLabs) before per-language files.
      expect(deleted).toEqual(
        expect.arrayContaining([`${USER}/dubbing/a.mp3`, 'dubbed/p-1.wav', 'dubbed/p-1.mp3']),
      );
    });

    it('does not chase an mp3 for an older video dub', async () => {
      await build({
        dubbing_projects: chain({
          data: { status: 'completed', input_gs_uri: `gs://dub-bucket/${USER}/dubbing/a.mp4`, is_video: true },
          error: null,
        }),
      });
      await service.deleteDub(USER, 'p-1');
      const deleted = (deleteGcsObject as jest.Mock).mock.calls.map((c) => c[1]);
      expect(deleted).toContain('dubbed/p-1.mp4');
      expect(deleted).not.toContain('dubbed/p-1.mp3');
    });

    it('aborts an unfinished video upload and clears the project prefix', async () => {
      await build({
        dubbing_projects: chain({
          data: {
            status: 'awaiting_video',
            input_gs_uri: `gs://dub-bucket/${USER}/dubbing/p-1/audio.m4a`,
            is_video: true,
            video_object: `${USER}/dubbing/p-1/clip.mp4`,
            video_upload_id: 'upload-1',
            video_status: 'uploading',
          },
          error: null,
        }),
      });
      await service.deleteDub(USER, 'p-1');
      expect(abortMultipartUpload).toHaveBeenCalledWith(
        expect.anything(), `${USER}/dubbing/p-1/clip.mp4`, 'upload-1', 'dub-bucket',
      );
      expect(deleteGcsPrefix).toHaveBeenCalledWith(expect.anything(), `${USER}/dubbing/p-1/`, 'dub-bucket');
    });
  });
});
