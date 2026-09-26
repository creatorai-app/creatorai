import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { ThumbnailService } from './thumbnail.service';
import { SupabaseService } from '../supabase/supabase.service';
import { THUMBNAIL_CREDIT_MULTIPLIER } from '@repo/validation';
import { createGoogleAI } from '../utils/genai';

jest.mock('../utils/genai', () => ({
  createGoogleAI: jest.fn(),
  GEMINI_TEXT_MODEL: 'gemini-test',
}));

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
const UUID = '11111111-1111-4111-8111-111111111111';

const image = (over: Partial<Express.Multer.File> = {}) =>
  ({ originalname: 'ref.png', mimetype: 'image/png', size: 1_000, buffer: Buffer.from('x'), ...over }) as Express.Multer.File;

const input = { prompt: 'a sour espresso shot', ratio: '16:9', generateCount: 2, personalized: true } as any;

describe('ThumbnailService', () => {
  let service: ThumbnailService;
  let tables: Record<string, any>;
  let queue: { add: jest.Mock };
  let storage: Record<string, jest.Mock>;

  async function build(overrides: Record<string, any> = {}) {
    jest.clearAllMocks();
    tables = {
      profiles: chain({ data: { credits: 10_000, ai_trained: true, youtube_connected: true }, error: null }),
      thumbnail_jobs: chain({ data: { id: 'thumb-1', job_id: 'thumb-user-1-1' }, error: null }),
      scripts: chain({ data: null, error: null }),
      story_builder_jobs: chain({ data: null, error: null }),
      ...overrides,
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    storage = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn/ref.png' } })),
      list: jest.fn().mockResolvedValue({ data: [] }),
      remove: jest.fn().mockResolvedValue({ error: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThumbnailService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({ from: (t: string) => tables[t], storage: { from: () => storage } }),
          },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getQueueToken('thumbnail'), useValue: queue },
      ],
    }).compile();
    service = module.get(ThumbnailService);
  }

  beforeEach(() => build());

  describe('input validation', () => {
    it('rejects a reference image over 10MB', async () => {
      await expect(
        service.createJob(USER, input, image({ size: 11 * 1024 * 1024 })),
      ).rejects.toThrow(/Reference image must be less than 10MB/);
    });

    it('names the face image separately so the user knows which upload failed', async () => {
      await expect(
        service.createJob(USER, input, undefined, image({ size: 11 * 1024 * 1024 })),
      ).rejects.toThrow(/Face image must be less than 10MB/);
    });

    it('rejects an image type the model cannot read', async () => {
      await expect(
        service.createJob(USER, input, image({ mimetype: 'image/gif' })),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['https://www.youtube.com/watch?v=abc123', true],
      ['https://youtu.be/abc123', true],
      ['https://drive.google.com/file/d/abc/view', true],
      ['https://vimeo.com/12345', false],
      ['https://evil.com/youtube.com/x', false],
    ])('%s is %s as a source link', async (videoLink, allowed) => {
      const call = service.createJob(USER, { ...input, videoLink });
      await (allowed ? expect(call).resolves.toBeDefined() : expect(call).rejects.toThrow(BadRequestException));
    });

    it('validates uploads before spending a credit check or a queue slot', async () => {
      await build({ profiles: chain({ data: null, error: { message: 'unused' } }) });
      await expect(service.createJob(USER, input, image({ mimetype: 'image/gif' }))).rejects.toThrow(
        BadRequestException,
      );
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('credit gate', () => {
    it('requires credits for every image in the batch, not just one', async () => {
      // 2 images at 33 credits each: a balance that covers one must still be refused.
      await build({
        profiles: chain({ data: { credits: THUMBNAIL_CREDIT_MULTIPLIER, ai_trained: true }, error: null }),
      });
      await expect(service.createJob(USER, input)).rejects.toThrow(
        new RegExp(`Need ${THUMBNAIL_CREDIT_MULTIPLIER * 2}`),
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('proceeds when the balance covers the whole batch exactly', async () => {
      await build({
        profiles: chain({ data: { credits: THUMBNAIL_CREDIT_MULTIPLIER * 2, ai_trained: true }, error: null }),
      });
      await expect(service.createJob(USER, input)).resolves.toMatchObject({ status: 'queued' });
    });

    it('404s when the profile is missing', async () => {
      await build({ profiles: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploads and context', () => {
    it('stores each input under the job folder with an extension matching its type', async () => {
      await service.createJob(USER, input, image({ mimetype: 'image/webp' }), image({ mimetype: 'image/jpeg' }));
      const paths = storage.upload.mock.calls.map((c) => c[0]);
      expect(paths[0]).toMatch(new RegExp(`^${USER}/jobs/thumb-${USER}-\\d+/inputs/reference\\.webp$`));
      expect(paths[1]).toMatch(/inputs\/face\.jpg$/);
    });

    it('fails the job when storage rejects an upload', async () => {
      await build();
      storage.upload.mockResolvedValueOnce({ error: { message: 'storage down' } });
      await expect(service.createJob(USER, input, image())).rejects.toThrow(InternalServerErrorException);
    });

    it('passes a truncated slice of a linked script as context', async () => {
      await build({
        scripts: chain({ data: { title: 'Sour espresso', content: 'x'.repeat(2_000) }, error: null }),
      });
      await service.createJob(USER, { ...input, scriptId: 'script-1' });
      const { contentContext } = queue.add.mock.calls[0][1];
      expect(contentContext).toContain('Script Title: Sour espresso');
      // A whole script would crowd out the prompt in the image model's context.
      expect(contentContext).toHaveLength('Script Title: Sour espresso\n'.length + 500);
    });

    it('falls back to the story topic when no script is linked', async () => {
      await build({ story_builder_jobs: chain({ data: { video_topic: 'Espresso 101' }, error: null }) });
      await service.createJob(USER, { ...input, storyBuilderId: 'story-1' });
      expect(queue.add.mock.calls[0][1].contentContext).toBe('Story Topic: Espresso 101');
    });

    it('prefers the script when both are somehow supplied', async () => {
      await build({
        scripts: chain({ data: { title: 'Sour espresso', content: 'body' }, error: null }),
        story_builder_jobs: chain({ data: { video_topic: 'Espresso 101' }, error: null }),
      });
      await service.createJob(USER, { ...input, scriptId: 'script-1', storyBuilderId: 'story-1' });
      expect(queue.add.mock.calls[0][1].contentContext).toMatch(/^Script Title:/);
    });
  });

  describe('personalization', () => {
    it('personalizes only when asked for AND the AI is trained', async () => {
      await service.createJob(USER, input);
      expect(queue.add.mock.calls[0][1].personalized).toBe(true);
    });

    it('does not personalize an untrained account', async () => {
      await build({ profiles: chain({ data: { credits: 10_000, ai_trained: false }, error: null }) });
      await service.createJob(USER, input);
      expect(queue.add.mock.calls[0][1].personalized).toBeFalsy();
    });
  });

  describe('deleteJob', () => {
    it('clears both the nested input folder and the job row', async () => {
      await build();
      storage.list
        .mockResolvedValueOnce({ data: [{ id: null, name: 'inputs' }] }) // a folder
        .mockResolvedValueOnce({ data: [{ name: 'reference.png' }] });

      await expect(service.deleteJob('thumb-1', USER)).resolves.toMatchObject({ success: true });
      expect(storage.remove).toHaveBeenCalledWith([`${USER}/jobs/thumb-user-1-1/inputs/reference.png`]);
      expect(tables.thumbnail_jobs.delete).toHaveBeenCalled();
    });

    it('404s before removing anything when the job is not the caller\'s', async () => {
      await build({ thumbnail_jobs: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.deleteJob('thumb-1', USER)).rejects.toThrow(NotFoundException);
      expect(storage.remove).not.toHaveBeenCalled();
    });
  });

  describe('listJobs / getJob', () => {
    it('surfaces a list failure as a 500', async () => {
      await build({ thumbnail_jobs: chain({ data: null, error: { message: 'down' } }) });
      await expect(service.listJobs(USER)).rejects.toThrow(InternalServerErrorException);
    });

    it('404s on a job that is missing or belongs to someone else', async () => {
      await build({ thumbnail_jobs: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.getJob('thumb-1', USER)).rejects.toThrow(NotFoundException);
    });
  });

  describe('surprisePrompt', () => {
    let generateContent: jest.Mock;

    function mockModel(text = 'A bold close-up thumbnail.') {
      generateContent = jest.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text }] } }],
      });
      (createGoogleAI as jest.Mock).mockResolvedValue({ models: { generateContent } });
    }

    /** What the model was actually briefed with. */
    const systemInstruction = () => generateContent.mock.calls[0][0].config.systemInstruction as string;

    it('briefs the model with the linked script', async () => {
      await build({
        user_style: chain({ data: { tone: 'dry', visual_style: 'high contrast' } }),
        scripts: chain({ data: { title: 'Ship faster', content: 'Step one: delete code.' } }),
      });
      mockModel();

      await expect(service.surprisePrompt(USER, { scriptId: UUID })).resolves.toMatchObject({
        prompt: 'A bold close-up thumbnail.',
      });
      expect(systemInstruction()).toContain('Script Title: Ship faster');
      expect(systemInstruction()).toContain('Step one: delete code.');
      expect(systemInstruction()).toContain('Visual style: high contrast');
    });

    it('briefs the model with the story blueprint hook, not just the topic', async () => {
      await build({
        user_style: chain({ data: null }),
        story_builder_jobs: chain({
          data: {
            video_topic: 'Why builds break',
            result: {
              structuredBlueprint: {
                hook: { openingLine: 'Your build is lying', visualSuggestion: 'red terminal glow' },
                climax: { biggestInsight: 'the cache was stale' },
              },
            },
          },
        }),
      });
      mockModel();

      await service.surprisePrompt(USER, { storyBuilderId: UUID });
      expect(systemInstruction()).toContain('Story Topic: Why builds break');
      expect(systemInstruction()).toContain('Suggested Visual: red terminal glow');
      expect(systemInstruction()).toContain('Biggest Insight: the cache was stale');
    });

    it('briefs the model with the chosen idea, addressed by index', async () => {
      await build({
        user_style: chain({ data: null }),
        ideation_jobs: chain({
          data: {
            result: {
              ideas: [
                { title: 'Wrong one' },
                { title: 'Right one', uniqueAngle: 'nobody measures this' },
              ],
            },
          },
        }),
      });
      mockModel();

      await service.surprisePrompt(USER, { ideationId: UUID, ideaIndex: 1 });
      expect(systemInstruction()).toContain('Title: Right one');
      expect(systemInstruction()).toContain('Unique Angle: nobody measures this');
      expect(systemInstruction()).not.toContain('Wrong one');
    });

    it('falls back to the typed context when there is no source', async () => {
      await build({ user_style: chain({ data: null }) });
      mockModel();

      await service.surprisePrompt(USER, { context: 'Video: my morning routine' });
      expect(systemInstruction()).toContain('Video: my morning routine');
    });

    it('fails loudly when the model returns nothing', async () => {
      await build({ user_style: chain({ data: null }) });
      mockModel('');

      await expect(service.surprisePrompt(USER, {})).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
