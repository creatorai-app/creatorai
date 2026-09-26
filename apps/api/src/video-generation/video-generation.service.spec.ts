import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { VideoGenerationService } from './video-generation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { VIDEO_GEN_CANCEL_PREFIX } from '@repo/validation';
import { createGoogleAI } from '../utils/genai';
import { deleteVideoGcsUri } from '../utils';

jest.mock('../utils/genai', () => ({
  createGoogleAI: jest.fn(),
  GEMINI_TEXT_MODEL: 'gemini-test',
}));
jest.mock('../utils', () => ({ deleteVideoGcsUri: jest.fn().mockResolvedValue(undefined) }));

/** Chainable supabase query mock. */
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
const plan = (name: string | null) => ({ data: name ? { plans: { name } } : null });
const img = { data: 'AAAA', mimeType: 'image/png' };
const input = {
  prompt: 'a barista pulling a shot',
  mode: 'text_to_video',
  aspectRatio: '16:9',
  durationSeconds: 8,
} as any;

describe('VideoGenerationService', () => {
  let service: VideoGenerationService;
  let tables: Record<string, any>;
  let queue: { add: jest.Mock; getJob: jest.Mock; client: Promise<any> };
  let redis: { set: jest.Mock };

  async function build(overrides: Record<string, any> = {}) {
    jest.clearAllMocks();
    (deleteVideoGcsUri as jest.Mock).mockResolvedValue(undefined);
    tables = {
      subscriptions: chain(plan('Pro')),
      profiles: chain({ data: { credits: 100_000 }, error: null }),
      video_generation_jobs: chain({ data: { id: 'vid-1' }, error: null }),
      user_style: chain({ data: null }),
      ...overrides,
    };
    redis = { set: jest.fn() };
    queue = { add: jest.fn(), getJob: jest.fn(), client: Promise.resolve(redis) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoGenerationService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from: (t: string) => tables[t] }) },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getQueueToken('video-generation'), useValue: queue },
      ],
    }).compile();
    service = module.get(VideoGenerationService);
  }

  beforeEach(() => build());

  describe('getAccess (plan gate)', () => {
    it.each(['Pro', 'Business', 'Scale'])('allows %s', async (name) => {
      await build({ subscriptions: chain(plan(name)) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({ allowed: true, plan: name });
    });

    it.each(['Starter', 'Creator'])('locks %s, which is not a video plan', async (name) => {
      await build({ subscriptions: chain(plan(name)) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({ allowed: false });
    });

    it('locks a user with no subscription at all', async () => {
      await build({ subscriptions: chain(plan(null)) });
      await expect(service.getAccess(USER)).resolves.toMatchObject({ allowed: false, plan: null });
    });
  });

  describe('createJob', () => {
    it('queues under a followable job id and writes it back to the row', async () => {
      const res = await service.createJob(USER, input);
      expect(res).toMatchObject({ success: true, videoJobId: 'vid-1' });
      const [name, payload, opts] = queue.add.mock.calls[0];
      expect(name).toBe('video-generation');
      expect(payload).toMatchObject({ userId: USER, videoJobId: 'vid-1', mode: 'text_to_video' });
      expect(opts).toMatchObject({ jobId: res.jobId });
      expect(tables.video_generation_jobs.update).toHaveBeenCalledWith({ job_id: res.jobId });
    });

    it('refuses a plan that does not include video generation', async () => {
      await build({ subscriptions: chain(plan('Creator')) });
      await expect(service.createJob(USER, input)).rejects.toThrow(ForbiddenException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('refuses a user below the credit floor even on an allowed plan', async () => {
      await build({ profiles: chain({ data: { credits: 0 }, error: null }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(ForbiddenException);
    });

    it('404s when the profile is missing', async () => {
      await build({ profiles: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(NotFoundException);
    });

    it.each([
      ['text_to_video', [img], 'rejects images it cannot use'],
      ['image_to_video', [], 'requires exactly one guide image'],
      ['image_to_video', [img, img], 'refuses a second guide image'],
      ['reference_to_video', [], 'requires at least one reference'],
      ['reference_to_video', [img, img, img, img], 'caps references at three'],
    ])('%s %s', async (mode, images) => {
      await expect(service.createJob(USER, { ...input, mode, images } as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it.each([
      ['image_to_video', [img]],
      ['reference_to_video', [img, img, img]],
    ])('accepts %s at the edge of its image range', async (mode, images) => {
      await expect(service.createJob(USER, { ...input, mode, images } as any)).resolves.toMatchObject({
        success: true,
      });
    });

    it('surfaces a failed insert as a 500 and queues nothing', async () => {
      await build({ video_generation_jobs: chain({ data: null, error: { message: 'boom' } }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(InternalServerErrorException);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('editJob', () => {
    const completed = {
      data: {
        id: 'vid-1',
        status: 'completed',
        interaction_id: 'int-1',
        aspect_ratio: '9:16',
        duration_seconds: 6,
      },
      error: null,
    };

    it('chains onto the source interaction and inherits its format', async () => {
      await build({ video_generation_jobs: chain(completed) });
      await service.editJob(USER, 'vid-1', { instruction: 'make it slower' } as any);
      expect(queue.add.mock.calls[0][1]).toMatchObject({
        mode: 'edit',
        previousInteractionId: 'int-1',
        aspectRatio: '9:16',
        durationSeconds: 6,
      });
    });

    it('404s on a source video that is missing or belongs to someone else', async () => {
      await build({ video_generation_jobs: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.editJob(USER, 'vid-1', { instruction: 'x' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to edit a clip that has not finished', async () => {
      await build({
        video_generation_jobs: chain({ data: { ...completed.data, status: 'processing' }, error: null }),
      });
      await expect(service.editJob(USER, 'vid-1', { instruction: 'x' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses to edit a completed clip whose interaction id was never stored', async () => {
      // Without it the model has no state to continue from, so the edit is impossible.
      await build({
        video_generation_jobs: chain({ data: { ...completed.data, interaction_id: null }, error: null }),
      });
      await expect(service.editJob(USER, 'vid-1', { instruction: 'x' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('applies the same plan gate as a fresh generation', async () => {
      await build({ subscriptions: chain(plan('Starter')), video_generation_jobs: chain(completed) });
      await expect(service.editJob(USER, 'vid-1', { instruction: 'x' } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('cancelJob', () => {
    const job = (state: string) => ({
      data: { userId: USER, videoJobId: 'vid-1' },
      getState: jest.fn().mockResolvedValue(state),
      remove: jest.fn().mockResolvedValue(undefined),
    });

    it.each(['waiting', 'delayed', 'prioritized'])(
      'removes a %s job outright and marks the row cancelled',
      async (state) => {
        const j = job(state);
        queue.getJob.mockResolvedValue(j);
        await expect(service.cancelJob(USER, 'bull-1')).resolves.toMatchObject({ success: true });
        expect(j.remove).toHaveBeenCalled();
        expect(tables.video_generation_jobs.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'cancelled' }),
        );
      },
    );

    it('flags an active job in Redis for the worker to notice mid-run', async () => {
      const j = job('active');
      queue.getJob.mockResolvedValue(j);
      await expect(service.cancelJob(USER, 'bull-1')).resolves.toMatchObject({ success: true });
      expect(j.remove).not.toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(`${VIDEO_GEN_CANCEL_PREFIX}bull-1`, '1', 'EX', 3600);
    });

    it('is a no-op on a job that already finished', async () => {
      queue.getJob.mockResolvedValue(job('completed'));
      await expect(service.cancelJob(USER, 'bull-1')).resolves.toMatchObject({
        message: 'Job already finished',
      });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it("refuses to cancel another user's job", async () => {
      queue.getJob.mockResolvedValue({ ...job('active'), data: { userId: 'someone-else' } });
      await expect(service.cancelJob(USER, 'bull-1')).rejects.toThrow(NotFoundException);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('404s on an unknown job id', async () => {
      queue.getJob.mockResolvedValue(null);
      await expect(service.cancelJob(USER, 'bull-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('surprisePrompt', () => {
    const gemini = (text: string) =>
      ({ models: { generateContent: jest.fn().mockResolvedValue({ text }) } }) as any;

    it('strips the quotes the model wraps a one-line prompt in', async () => {
      (createGoogleAI as jest.Mock).mockResolvedValue(gemini('  "A barista at dawn."  '));
      await expect(service.surprisePrompt(USER, 'text_to_video')).resolves.toEqual({
        success: true,
        prompt: 'A barista at dawn.',
      });
    });

    it('is reachable on a locked plan, so users can feel the feature first', async () => {
      await build({ subscriptions: chain(plan('Starter')) });
      (createGoogleAI as jest.Mock).mockResolvedValue(gemini('A barista at dawn.'));
      await expect(service.surprisePrompt(USER, 'text_to_video')).resolves.toMatchObject({
        success: true,
      });
    });

    it('fails cleanly when the model returns nothing usable', async () => {
      (createGoogleAI as jest.Mock).mockResolvedValue(gemini('  '));
      await expect(service.surprisePrompt(USER, 'text_to_video')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('listJobs / getJob / deleteJob', () => {
    it('returns an empty list rather than null when there is nothing yet', async () => {
      await build({ video_generation_jobs: chain({ data: null, error: null }) });
      await expect(service.listJobs(USER)).resolves.toEqual({ success: true, jobs: [] });
    });

    it('surfaces a list failure as a 500', async () => {
      await build({ video_generation_jobs: chain({ data: null, error: { message: 'down' } }) });
      await expect(service.listJobs(USER)).rejects.toThrow(InternalServerErrorException);
    });

    it('maps "no rows" to 404 and any other failure to 500', async () => {
      await build({ video_generation_jobs: chain({ data: null, error: { code: 'PGRST116' } }) });
      await expect(service.getJob('vid-1', USER)).rejects.toThrow(NotFoundException);

      await build({ video_generation_jobs: chain({ data: null, error: { code: '42P01' } }) });
      await expect(service.getJob('vid-1', USER)).rejects.toThrow(InternalServerErrorException);
    });

    it('deletes the stored clip from GCS along with the row', async () => {
      await build({
        video_generation_jobs: chain({ data: { video_gs_uri: 'gs://vid/clip.mp4' }, error: null }),
      });
      await expect(service.deleteJob('vid-1', USER)).resolves.toMatchObject({ success: true });
      expect(deleteVideoGcsUri).toHaveBeenCalledWith(expect.anything(), 'gs://vid/clip.mp4');
    });

    it('still reports success when the job never produced a clip', async () => {
      await build({ video_generation_jobs: chain({ data: null, error: { code: 'PGRST116' } }) });
      await expect(service.deleteJob('vid-1', USER)).resolves.toMatchObject({ success: true });
      expect(deleteVideoGcsUri).not.toHaveBeenCalled();
    });
  });
});
