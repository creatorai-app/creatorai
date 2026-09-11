import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { ThumbnailService } from './thumbnail.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createGoogleAI } from '../utils/genai';

jest.mock('../utils/genai', () => ({
  createGoogleAI: jest.fn(),
  GEMINI_TEXT_MODEL: 'gemini-test',
}));

/** Chainable supabase query mock — mirrors the one in dubbing.service.spec.ts. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'eq', 'insert', 'update', 'delete', 'order', 'limit']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(() => Promise.resolve(result));
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  c.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  return c;
}

const USER = 'user-1';
const UUID = '11111111-1111-4111-8111-111111111111';

describe('ThumbnailService.surprisePrompt', () => {
  let service: ThumbnailService;
  let generateContent: jest.Mock;

  async function build(tables: Record<string, any>, modelText = 'A bold close-up thumbnail.') {
    jest.clearAllMocks();
    generateContent = jest.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: modelText }] } }],
    });
    (createGoogleAI as jest.Mock).mockResolvedValue({ models: { generateContent } });

    const mockSupabase = {
      getClient: () => ({ from: (t: string) => tables[t] ?? chain({ data: null }) }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThumbnailService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getQueueToken('thumbnail'), useValue: { add: jest.fn() } },
      ],
    }).compile();
    service = module.get(ThumbnailService);
  }

  /** What the model was actually briefed with. */
  const systemInstruction = () => generateContent.mock.calls[0][0].config.systemInstruction as string;

  it('briefs the model with the linked script', async () => {
    await build({
      user_style: chain({ data: { tone: 'dry', visual_style: 'high contrast' } }),
      scripts: chain({ data: { title: 'Ship faster', content: 'Step one: delete code.' } }),
    });

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

    await service.surprisePrompt(USER, { ideationId: UUID, ideaIndex: 1 });
    expect(systemInstruction()).toContain('Title: Right one');
    expect(systemInstruction()).toContain('Unique Angle: nobody measures this');
    expect(systemInstruction()).not.toContain('Wrong one');
  });

  it('falls back to the typed context when there is no source', async () => {
    await build({ user_style: chain({ data: null }) });

    await service.surprisePrompt(USER, { context: 'Video: my morning routine' });
    expect(systemInstruction()).toContain('Video: my morning routine');
  });

  it('fails loudly when the model returns nothing', async () => {
    await build({ user_style: chain({ data: null }) }, '');

    await expect(service.surprisePrompt(USER, {})).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
