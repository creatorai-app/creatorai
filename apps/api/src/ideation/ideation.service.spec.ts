import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { IdeationService } from './ideation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { BillingService } from '../billing/billing.service';
import { IDEATION_ABSOLUTE_MAX_IDEAS } from '@repo/validation';
import { createGoogleAI } from '../utils/genai';

jest.mock('../utils/genai', () => ({
  createGoogleAI: jest.fn(),
  GEMINI_TEXT_MODEL: 'gemini-test',
}));

/** Chainable supabase query mock. `count` is read off the awaited result, so it
 *  rides along on the same object every builder method returns. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'range', 'insert', 'update', 'delete']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(() => Promise.resolve(result));
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  c.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  return c;
}

const USER = 'user-1';
const geminiText = (text: string) =>
  ({ models: { generateContent: jest.fn().mockResolvedValue({ text }) } }) as any;

describe('IdeationService', () => {
  let service: IdeationService;
  let tables: Record<string, any>;
  let queue: { add: jest.Mock };

  async function build(overrides: Record<string, any> = {}, plan = 'Creator') {
    jest.clearAllMocks();
    tables = {
      profiles: chain({ data: { credits: 10_000, ai_trained: true }, error: null }),
      // No in-flight run by default; `count` is what createJob checks.
      ideation_jobs: chain({ data: { id: 'job-1' }, error: null, count: 0 }),
      user_style: chain({ data: null }),
      ...overrides,
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdeationService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from: (t: string) => tables[t] }) },
        },
        {
          provide: BillingService,
          useValue: { getBillingInfo: jest.fn().mockResolvedValue({ currentPlan: { name: plan } }) },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getQueueToken('ideation'), useValue: queue },
      ],
    }).compile();
    service = module.get(IdeationService);
  }

  beforeEach(() => build());

  describe('createJob idea count', () => {
    it('defaults to 3 ideas when the caller does not ask for a number', async () => {
      await service.createJob(USER, {});
      expect(queue.add.mock.calls[0][1]).toMatchObject({ ideaCount: 3 });
    });

    it('honors an explicit count within the plan allowance', async () => {
      await service.createJob(USER, { ideaCount: 7 });
      expect(queue.add.mock.calls[0][1]).toMatchObject({ ideaCount: 7 });
    });

    it('refuses a count above the allowance instead of silently clamping it', async () => {
      // Silently trimming would bill for a run that returns fewer ideas than asked.
      await expect(
        service.createJob(USER, { ideaCount: IDEATION_ABSOLUTE_MAX_IDEAS + 1 }),
      ).rejects.toThrow(ForbiddenException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('floors a zero or negative count at one idea', async () => {
      await service.createJob(USER, { ideaCount: 0 });
      expect(queue.add.mock.calls[0][1]).toMatchObject({ ideaCount: 1 });
    });
  });

  describe('createJob input limits', () => {
    it('rejects a niche focus over 200 characters', async () => {
      await expect(service.createJob(USER, { nicheFocus: 'a'.repeat(201) })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects context over 1000 characters', async () => {
      await expect(service.createJob(USER, { context: 'a'.repeat(1001) })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts input exactly at each limit', async () => {
      await expect(
        service.createJob(USER, { nicheFocus: 'a'.repeat(200), context: 'b'.repeat(1000) }),
      ).resolves.toMatchObject({ status: 'pending' });
    });
  });

  describe('createJob gating', () => {
    it('404s when the profile is missing', async () => {
      await build({ profiles: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.createJob(USER, {})).rejects.toThrow(NotFoundException);
    });

    it('refuses a user below the credit floor', async () => {
      await build({ profiles: chain({ data: { credits: 1 }, error: null }) });
      await expect(service.createJob(USER, {})).rejects.toThrow(ForbiddenException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('refuses a second run while one is still pending or processing', async () => {
      // Two concurrent runs would double-charge for a single brainstorm.
      await build({ ideation_jobs: chain({ data: { id: 'job-1' }, error: null, count: 1 }) });
      await expect(service.createJob(USER, {})).rejects.toThrow(ConflictException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('surfaces a failed job insert as a 500', async () => {
      await build({ ideation_jobs: chain({ data: null, error: { message: 'boom' }, count: 0 }) });
      await expect(service.createJob(USER, {})).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createJob queueing', () => {
    it('queues under a followable job id and retries twice', async () => {
      const res = await service.createJob(USER, { nicheFocus: 'home espresso', autoMode: true });
      const [name, payload, opts] = queue.add.mock.calls[0];
      expect(name).toBe('generate-ideas');
      expect(payload).toMatchObject({ userId: USER, ideationJobId: 'job-1', nicheFocus: 'home espresso', autoMode: true });
      expect(opts).toMatchObject({ jobId: res.jobId, attempts: 2 });
      expect(res.jobId).toMatch(new RegExp(`^ideation-${USER}-\\d+$`));
    });

    it('writes the bull job id back so the SSE route can find the row', async () => {
      await service.createJob(USER, {});
      expect(tables.ideation_jobs.update).toHaveBeenCalledWith({ job_id: expect.any(String) });
    });
  });

  describe('surpriseNiche', () => {
    it('unwraps quotes the model likes to add around a one-line answer', async () => {
      (createGoogleAI as jest.Mock).mockResolvedValue(geminiText('  "AI tools for solo founders"  '));
      await expect(service.surpriseNiche(USER)).resolves.toEqual({
        success: true,
        nicheFocus: 'AI tools for solo founders',
      });
    });

    it('truncates to the same 200-character limit createJob enforces', async () => {
      (createGoogleAI as jest.Mock).mockResolvedValue(geminiText('x'.repeat(500)));
      const { nicheFocus } = await service.surpriseNiche(USER);
      expect(nicheFocus).toHaveLength(200);
    });

    it('fails cleanly when the model returns nothing usable', async () => {
      (createGoogleAI as jest.Mock).mockResolvedValue(geminiText('   '));
      await expect(service.surpriseNiche(USER)).rejects.toThrow(InternalServerErrorException);
    });

    it('does not leak the upstream error to the caller', async () => {
      (createGoogleAI as jest.Mock).mockRejectedValue(new Error('vertex 403 project-secret'));
      await expect(service.surpriseNiche(USER)).rejects.toThrow(/try again/i);
    });
  });

  describe('listJobs', () => {
    it('reports the total alongside the page so the UI can paginate', async () => {
      await build({ ideation_jobs: chain({ data: [{ id: 'job-1' }], error: null, count: 42 }) });
      await expect(service.listJobs(USER, 2, 20)).resolves.toEqual({
        data: [{ id: 'job-1' }],
        total: 42,
        page: 2,
        limit: 20,
      });
      expect(tables.ideation_jobs.range).toHaveBeenCalledWith(20, 39);
    });

    it('surfaces a query failure as a 500', async () => {
      await build({ ideation_jobs: chain({ data: null, error: { message: 'down' } }) });
      await expect(service.listJobs(USER)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getJob / deleteJob / getProfileStatus / exportJson', () => {
    it('404s on a job that is missing or belongs to someone else', async () => {
      await build({ ideation_jobs: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.getJob('job-1', USER)).rejects.toThrow(NotFoundException);
    });

    it('surfaces a failed delete as a 500', async () => {
      await build({ ideation_jobs: chain({ error: { message: 'boom' } }) });
      await expect(service.deleteJob('job-1', USER)).rejects.toThrow(InternalServerErrorException);
    });

    it('defaults a profile with null columns to untrained and zero credits', async () => {
      await build({ profiles: chain({ data: { ai_trained: null, credits: null }, error: null }) });
      await expect(service.getProfileStatus(USER)).resolves.toEqual({ aiTrained: false, credits: 0 });
    });

    it('exports only a completed run', async () => {
      await build({ ideation_jobs: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.exportJson('job-1', USER)).rejects.toThrow(NotFoundException);
      expect(tables.ideation_jobs.eq).toHaveBeenCalledWith('status', 'completed');
    });
  });
});
