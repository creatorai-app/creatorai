import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { StoryBuilderService } from './story-builder.service';
import { SupabaseService } from '../supabase/supabase.service';
import { getMinimumCreditsForStoryBuilder } from '@repo/validation';

/** Chainable supabase query mock. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(() => Promise.resolve(result));
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  c.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  return c;
}

const USER = 'user-1';
const input = {
  videoTopic: 'Why espresso tastes sour',
  audienceLevel: 'general',
  videoDuration: 'medium',
  contentType: 'educational',
  storyMode: 'explainer',
  personalized: true,
} as any;

describe('StoryBuilderService', () => {
  let service: StoryBuilderService;
  let tables: Record<string, any>;
  let queue: { add: jest.Mock };

  async function build(overrides: Record<string, any> = {}) {
    jest.clearAllMocks();
    tables = {
      profiles: chain({ data: { credits: 10_000, ai_trained: true }, error: null }),
      story_builder_jobs: chain({ data: { id: 'story-1' }, error: null }),
      ideation_jobs: chain({ data: null, error: null }),
      ...overrides,
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryBuilderService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from: (t: string) => tables[t] }) },
        },
        { provide: getQueueToken('story-builder'), useValue: queue },
      ],
    }).compile();
    service = module.get(StoryBuilderService);
  }

  beforeEach(() => build());

  describe('createJob gating', () => {
    it('404s when the profile is missing', async () => {
      await build({ profiles: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(NotFoundException);
    });

    it('refuses a user one credit below the floor', async () => {
      const floor = getMinimumCreditsForStoryBuilder();
      await build({ profiles: chain({ data: { credits: floor - 1, ai_trained: true }, error: null }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(ForbiddenException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('accepts a user exactly at the floor', async () => {
      await build({
        profiles: chain({ data: { credits: getMinimumCreditsForStoryBuilder(), ai_trained: true }, error: null }),
      });
      await expect(service.createJob(USER, input)).resolves.toMatchObject({ status: 'queued' });
    });

    it('surfaces a failed job insert as a 500 and queues nothing', async () => {
      await build({ story_builder_jobs: chain({ data: null, error: { message: 'boom' } }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(InternalServerErrorException);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('createJob personalization', () => {
    it('personalizes a trained account by default', async () => {
      const res = await service.createJob(USER, input);
      expect(res.personalized).toBe(true);
      expect(queue.add.mock.calls[0][1]).toMatchObject({ personalized: true });
      expect(res.message).toMatch(/personalized/i);
    });

    it('does not personalize an untrained account', async () => {
      await build({ profiles: chain({ data: { credits: 10_000, ai_trained: false }, error: null }) });
      const res = await service.createJob(USER, input);
      expect(res.personalized).toBe(false);
      expect(res.message).not.toMatch(/personalized/i);
    });

    it('honors an explicit opt-out on a trained account', async () => {
      const res = await service.createJob(USER, { ...input, personalized: false });
      expect(res.personalized).toBe(false);
    });
  });

  describe('createJob ideation hand-off', () => {
    const ideas = {
      data: {
        result: {
          ideas: [
            {
              title: 'Sour espresso, explained',
              coreTopic: 'extraction',
              uniqueAngle: 'under-extraction, not the beans',
              hookAngle: 'pour a shot on camera',
              whyItWorks: 'people blame the beans',
              suggestedFormat: 'Breakdown',
              talkingPoints: ['grind size', 'water temp'],
            },
          ],
        },
      },
      error: null,
    };

    it('carries the chosen idea into the worker payload', async () => {
      await build({ ideation_jobs: chain(ideas) });
      await service.createJob(USER, { ...input, ideationId: 'ide-1', ideaIndex: 0 });
      const { ideationContext } = queue.add.mock.calls[0][1];
      expect(ideationContext).toContain('Sour espresso, explained');
      expect(ideationContext).toContain('grind size; water temp');
    });

    it('omits the context when the idea index does not resolve', async () => {
      await build({ ideation_jobs: chain(ideas) });
      await service.createJob(USER, { ...input, ideationId: 'ide-1', ideaIndex: 9 });
      expect(queue.add.mock.calls[0][1].ideationContext).toBeUndefined();
    });
  });

  describe('createJob queueing', () => {
    it('queues under a followable job id and writes it back to the row', async () => {
      const res = await service.createJob(USER, input);
      const [name, payload, opts] = queue.add.mock.calls[0];
      expect(name).toBe('generate-story');
      expect(payload).toMatchObject({ userId: USER, storyJobId: 'story-1', videoTopic: input.videoTopic });
      expect(opts).toMatchObject({ jobId: res.jobId, attempts: 2 });
      expect(res.jobId).toMatch(new RegExp(`^story-${USER}-\\d+$`));
      expect(tables.story_builder_jobs.update).toHaveBeenCalledWith({ job_id: res.jobId });
    });

    it('normalizes optional text fields to empty strings for the prompt builder', async () => {
      await service.createJob(USER, input);
      expect(queue.add.mock.calls[0][1]).toMatchObject({
        targetAudience: '',
        tone: '',
        additionalContext: '',
      });
    });
  });

  describe('listJobs / getJob / deleteJob / getProfileStatus', () => {
    it('surfaces a list failure as a 500', async () => {
      await build({ story_builder_jobs: chain({ data: null, error: { message: 'down' } }) });
      await expect(service.listJobs(USER)).rejects.toThrow(InternalServerErrorException);
    });

    it('404s on a job that is missing or belongs to someone else', async () => {
      await build({ story_builder_jobs: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.getJob('story-1', USER)).rejects.toThrow(NotFoundException);
    });

    it('surfaces a failed delete as a 500', async () => {
      await build({ story_builder_jobs: chain({ error: { message: 'boom' } }) });
      await expect(service.deleteJob('story-1', USER)).rejects.toThrow(InternalServerErrorException);
    });

    it('defaults a profile with null columns to untrained and zero credits', async () => {
      await build({ profiles: chain({ data: { ai_trained: null, credits: null }, error: null }) });
      await expect(service.getProfileStatus(USER)).resolves.toEqual({ aiTrained: false, credits: 0 });
    });
  });
});
