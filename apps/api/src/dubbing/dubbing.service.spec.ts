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
  calculateDubbingCreditsByDuration,
  getMinimumCreditsForDubbing,
} from '@repo/validation';
import { deleteGcsObject, moveGcsObject, getSignedUploadUrl } from '../utils';

jest.mock('../utils', () => ({
  getSignedUploadUrl: jest.fn().mockResolvedValue('https://signed-upload-url'),
  gcsObjectMetadata: jest.fn().mockResolvedValue({ size: 1000, contentType: 'audio/mpeg' }),
  gcsPublicUrl: jest.fn(() => 'https://storage.googleapis.com/dub-bucket/obj'),
  gcsUri: jest.fn(() => 'gs://dub-bucket/obj'),
  deleteGcsObject: jest.fn().mockResolvedValue(undefined),
  moveGcsObject: jest.fn().mockResolvedValue(undefined),
  getDubbingBucketName: jest.fn(() => 'dub-bucket'),
}));

/** Chainable supabase query mock: every builder method returns the chain; awaiting it
 *  (or .single()/.maybeSingle()) resolves to the configured result. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update', 'delete']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(() => Promise.resolve(result));
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  c.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  return c;
}

const USER = 'user-1';

// Every fixture dub here is the same length, and its price is whatever the current
// rate makes it — derived, not written down, so a repricing (see the
// DUBBING_CREDIT_MULTIPLIER promo note) moves the expectations with it instead of
// leaving them asserting last quarter's price. The suite runs on 'Creator', a paid
// plan, so the paid multiplier applies.
const DUB_SECONDS = 30 * 60;
const DUB_COST = calculateDubbingCreditsByDuration(DUB_SECONDS, DUBBING_CREDIT_MULTIPLIER);
// One second's worth: the most a balance can hold and still not cover the clip.
const DUB_FLOOR = getMinimumCreditsForDubbing(DUBBING_CREDIT_MULTIPLIER);

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
      profiles: chain({ data: { credits: 10_000 }, error: null }),
      dubbing_projects: chain({ data: null, error: null }),
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

    it('allows Starter, and reports its 500MB / 45 min caps', async () => {
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({
        allowed: true,
        maxDurationSeconds: 45 * 60,
        maxUploadBytes: 500 * 1024 * 1024,
        creditsPerSecond: 3,
      });
    });

    it('reports the wider vendor ceiling on paid plans', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({
        allowed: true,
        maxDurationSeconds: 180 * 60,
        maxUploadBytes: 3 * 1024 * 1024 * 1024,
      });
    });

    it('still denies users with no subscription at all', async () => {
      await build({ subscriptions: chain(planResult(null)) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({ allowed: false });
    });
  });

  describe('signUpload', () => {
    const input = { filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: DUB_SECONDS };

    it('accepts a Starter clip within the 45 min cap', async () => {
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.signUpload({ ...input, durationSeconds: 40 * 60 }, USER)).resolves.toMatchObject({
        success: true,
      });
    });

    it('rejects a Starter clip over the 45 min cap', async () => {
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.signUpload({ ...input, durationSeconds: 50 * 60 }, USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lets a paid plan exceed the Starter cap', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(service.signUpload({ ...input, durationSeconds: 60 * 60 }, USER)).resolves.toMatchObject({
        success: true,
      });
    });

    it('still stops a paid plan at the vendor ceiling', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(service.signUpload({ ...input, durationSeconds: 181 * 60 }, USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a Starter file over 500MB but accepts it on a paid plan', async () => {
      const big = { ...input, fileSize: 501 * 1024 * 1024 };
      await build({ subscriptions: chain(planResult('Starter')) });
      await expect(service.signUpload(big, USER)).rejects.toThrow(PayloadTooLargeException);

      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(service.signUpload(big, USER)).resolves.toMatchObject({ success: true });
    });

    it('rejects files over the paid 3GB ceiling', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(
        service.signUpload({ ...input, fileSize: 4 * 1024 * 1024 * 1024 }, USER),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    // Bengali routes through dubbing_v1, whose endpoint tops out at 1GB / 45 min no
    // matter what the plan allows. Caught here so the bytes are never uploaded.
    it('holds a dubbing_v1 language to the smaller route limits', async () => {
      await build({ subscriptions: chain(planResult('Pro')) });
      await expect(
        service.signUpload({ ...input, durationSeconds: 60 * 60, targetLanguage: 'bn' }, USER),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.signUpload({ ...input, fileSize: 2 * 1024 * 1024 * 1024, targetLanguage: 'bn' }, USER),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('returns a signed URL scoped to the user prefix under staging', async () => {
      await build();
      const res = await service.signUpload(input, USER);
      expect(res.uploadUrl).toBe('https://signed-upload-url');
      // staging/, not the permanent path: an upload nobody claims must expire on its own.
      expect(res.objectName.startsWith(`staging/${USER}/dubbing/`)).toBe(true);
    });

    // Regression: the balance was only checked at createDub, so a user short on credits
    // pushed up to 500MB to GCS and was only then told they could not afford it.
    it('rejects an unaffordable dub before the upload starts', async () => {
      await build({ profiles: chain({ data: { credits: DUB_FLOOR }, error: null }) });
      await expect(service.signUpload(input, USER)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createDub', () => {
    const input = {
      objectName: `staging/${USER}/dubbing/123_a.mp3`,
      targetLanguage: 'es',
      isVideo: false,
      mediaName: 'My clip',
      durationSeconds: DUB_SECONDS,
    };

    it("rejects an object outside the user's prefix", async () => {
      await build();
      await expect(
        service.createDub({ ...input, objectName: 'staging/other-user/dubbing/x.mp3' }, USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when credits are below the floor', async () => {
      await build({ profiles: chain({ data: { credits: 0 }, error: null }) });
      await expect(service.createDub(input, USER)).rejects.toThrow(ForbiddenException);
    });

    // Regression: the old precheck only asked for one second's worth, so a user who
    // could not cover the whole dub still got enqueued and only failed after
    // ElevenLabs had run — at which point we'd already paid for it.
    it('rejects when credits cover the floor but not the full duration', async () => {
      await build({ profiles: chain({ data: { credits: DUB_FLOOR }, error: null }) });
      await expect(service.createDub(input, USER)).rejects.toThrow(
        new RegExp(`costs ${DUB_COST} credits and you have ${DUB_FLOOR}`),
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    // Regression: a rejected dub used to leave the uploaded media sitting in the bucket.
    it('deletes the staged upload when the dub is rejected', async () => {
      await build({ profiles: chain({ data: { credits: DUB_FLOOR }, error: null }) });
      await expect(service.createDub(input, USER)).rejects.toThrow(ForbiddenException);
      expect(deleteGcsObject).toHaveBeenCalledWith(expect.anything(), input.objectName, 'dub-bucket');
    });

    it('promotes the staged object out of staging once accepted', async () => {
      await build();
      await service.createDub(input, USER);
      expect(moveGcsObject).toHaveBeenCalledWith(
        expect.anything(),
        input.objectName,
        `${USER}/dubbing/123_a.mp3`,
        'dub-bucket',
      );
    });

    // Reserving up front is what stops two concurrent dubs from both passing the
    // precheck and only failing to bill after ElevenLabs has already run.
    it('reserves the full cost before enqueueing', async () => {
      await build();
      await service.createDub(input, USER);
      expect(rpc).toHaveBeenCalledWith('update_user_credits', { user_uuid: USER, credit_change: -DUB_COST });
      expect(queue.add).toHaveBeenCalledWith(
        'dubbing',
        expect.objectContaining({ reservedCredits: DUB_COST }),
        expect.anything(),
      );
    });

    it('refunds and cleans up when the reservation succeeds but the insert fails', async () => {
      await build({ dubbing_projects: chain({ data: null, error: { message: 'boom' } }) });
      await expect(service.createDub(input, USER)).rejects.toThrow();
      expect(rpc).toHaveBeenCalledWith('update_user_credits', { user_uuid: USER, credit_change: DUB_COST });
      expect(deleteGcsObject).toHaveBeenCalledWith(expect.anything(), `${USER}/dubbing/123_a.mp3`, 'dub-bucket');
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('rejects the second of two concurrent dubs at the reservation', async () => {
      await build();
      rpc.mockResolvedValueOnce({ error: { message: 'Insufficient credits' } });
      await expect(service.createDub(input, USER)).rejects.toThrow(ForbiddenException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    // The dubbed file's name and Content-Type are bound into the signed PUT URL, and GCS
    // does not inspect the bytes: sign for the wrong type and the upload still succeeds,
    // it just stores a file that will not play. Modal writes WAV for an audio source, so
    // this must stay .wav / audio/wav for as long as Modal is the backend.
    it('signs the audio output for exactly what Modal uploads', async () => {
      await build();
      const res = await service.createDub(input, USER);
      expect(getSignedUploadUrl).toHaveBeenCalledWith(
        expect.anything(),
        `dubbed/${res.projectId}.wav`,
        'audio/wav',
        'dub-bucket',
        expect.any(Number),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'dubbing',
        expect.objectContaining({ outputContentType: 'audio/wav' }),
        expect.anything(),
      );
    });

    it('signs a video output as MP4', async () => {
      await build();
      const res = await service.createDub({ ...input, isVideo: true }, USER);
      expect(getSignedUploadUrl).toHaveBeenCalledWith(
        expect.anything(),
        `dubbed/${res.projectId}.mp4`,
        'video/mp4',
        'dub-bucket',
        expect.any(Number),
      );
    });

    it('inserts the project and enqueues the worker job', async () => {
      await build();
      const res = await service.createDub(input, USER);
      expect(res.projectId).toBeTruthy();
      // A random id, not `dubbing-{userId}-{ms}`: the SSE status route is unauthenticated,
      // so a guessable job id would let a stranger watch someone else's dub.
      expect(res.jobId).toMatch(/^dubbing-[0-9a-f-]{36}$/);
      expect(res.jobId).not.toContain(USER);
      expect(queue.add).toHaveBeenCalledWith(
        'dubbing',
        expect.objectContaining({ userId: USER, targetLanguage: 'es', durationSeconds: DUB_SECONDS }),
        expect.objectContaining({ jobId: res.jobId }),
      );
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

    it('removes a waiting job and marks the row failed', async () => {
      await build();
      const remove = jest.fn();
      queue.getJob.mockResolvedValue({
        data: { userId: USER, projectId: 'p-1', reservedCredits: DUB_COST },
        getState: () => Promise.resolve('waiting'),
        remove,
      });
      const res = await service.stopDub(USER, 'job-1');
      expect(remove).toHaveBeenCalled();
      // The worker never ran it, so the API owns the refund here.
      expect(rpc).toHaveBeenCalledWith('update_user_credits', { user_uuid: USER, credit_change: DUB_COST });
      expect(tables.dubbing_projects.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error_message: 'Cancelled by user' }),
      );
      expect(res.message).toBe('Dubbing cancelled');
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

  describe('in-flight guards', () => {
    const row = {
      input_gs_uri: 'gs://dub-bucket/user-1/dubbing/a.mp3',
      input_url: 'https://storage.googleapis.com/dub-bucket/user-1/dubbing/a.mp3',
      target_language: 'es',
      target_accent: null,
      is_video: false,
      duration_seconds: DUB_SECONDS,
    };

    it.each(['queued', 'processing', 'cloning'])('refuses to regenerate a %s dub', async (status) => {
      await build({ dubbing_projects: chain({ data: { ...row, status }, error: null }) });
      await expect(service.regenerateDub(USER, 'p-1')).rejects.toThrow(/still running/);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('regenerates a completed dub, reserving credits again', async () => {
      await build({ dubbing_projects: chain({ data: { ...row, status: 'completed' }, error: null }) });
      await service.regenerateDub(USER, 'p-1');
      expect(rpc).toHaveBeenCalledWith('update_user_credits', { user_uuid: USER, credit_change: -DUB_COST });
      expect(queue.add).toHaveBeenCalled();
    });

    it('refuses to delete a running dub', async () => {
      await build({ dubbing_projects: chain({ data: { status: 'processing' }, error: null }) });
      await expect(service.deleteDub(USER, 'p-1')).rejects.toThrow(/Cancel it before deleting/);
    });

    // Audio dubs are .wav today and were .mp3 on ElevenLabs. Deleting only today's name
    // leaves every older dub's file behind in the bucket, paid for and unreachable.
    it('deletes the source and both audio output names', async () => {
      await build({
        dubbing_projects: chain({
          data: {
            status: 'completed',
            input_gs_uri: `gs://dub-bucket/${USER}/dubbing/a.mp3`,
            is_video: false,
          },
          error: null,
        }),
      });
      await service.deleteDub(USER, 'p-1');
      const deleted = (deleteGcsObject as jest.Mock).mock.calls.map((c) => c[1]);
      expect(deleted).toEqual(
        expect.arrayContaining([`${USER}/dubbing/a.mp3`, 'dubbed/p-1.wav', 'dubbed/p-1.mp3']),
      );
    });

    it('does not chase an mp3 for a video dub', async () => {
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
  });
});
