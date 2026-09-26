import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ScriptService } from './script.service';
import { SupabaseService } from '../supabase/supabase.service';

// `marked` ships ESM only, which ts-jest does not transform out of node_modules.
// Stub its lexer with the token shapes exportPdf actually branches on - the PDF
// layout is what is under test here, not marked's parser.
jest.mock('marked', () => ({
  marked: {
    lexer: (md: string) =>
      md
        ? [
            { type: 'heading', depth: 1, tokens: [{ type: 'text', text: 'Hook' }] },
            { type: 'paragraph', tokens: [{ type: 'text', text: 'Pour a shot.' }] },
            {
              type: 'list',
              ordered: false,
              items: [
                { tokens: [{ type: 'text', text: 'grind size' }] },
                { tokens: [{ type: 'text', text: 'water temp' }] },
              ],
            },
            { type: 'blockquote', tokens: [{ type: 'text', text: 'Taste it.' }] },
            { type: 'space' },
          ]
        : [],
  },
}));

/** Chainable supabase query mock — see dubbing.service.spec.ts for the same shape. */
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

const file = (over: Partial<Express.Multer.File> = {}) =>
  ({
    originalname: 'brief.pdf',
    mimetype: 'application/pdf',
    size: 1_000,
    buffer: Buffer.from('x'),
    ...over,
  }) as Express.Multer.File;

const input = {
  prompt: 'Why espresso tastes sour',
  tone: 'conversational',
  language: 'english',
  duration: '180',
  includeStorytelling: false,
  includeTimestamps: false,
  personalized: true,
} as any;

describe('ScriptService', () => {
  let service: ScriptService;
  let tables: Record<string, any>;
  let queue: { add: jest.Mock };
  let storage: { upload: jest.Mock; getPublicUrl: jest.Mock };

  async function build(overrides: Record<string, any> = {}) {
    jest.clearAllMocks();
    tables = {
      profiles: chain({ data: { credits: 10_000, ai_trained: true, youtube_connected: true }, error: null }),
      scripts: chain({ data: { id: 'script-1' }, error: null }),
      ideation_jobs: chain({ data: null, error: null }),
      ...overrides,
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    storage = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn/brief.pdf' } })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScriptService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({ from: (t: string) => tables[t], storage: { from: () => storage } }),
          },
        },
        { provide: getQueueToken('script'), useValue: queue },
      ],
    }).compile();
    service = module.get(ScriptService);
  }

  beforeEach(() => build());

  describe('createJob attachment validation', () => {
    it('rejects a file over the 10MB limit, naming the file', async () => {
      await expect(
        service.createJob(USER, input, [file({ size: 11 * 1024 * 1024 })]),
      ).rejects.toThrow(/brief\.pdf exceeds 10MB/);
    });

    it('rejects a file type the model cannot read', async () => {
      await expect(
        service.createJob(USER, input, [file({ mimetype: 'application/x-msdownload' })]),
      ).rejects.toThrow(BadRequestException);
    });

    it.each(['application/pdf', 'text/plain', 'image/png'])('accepts %s', async (mimetype) => {
      await expect(service.createJob(USER, input, [file({ mimetype })])).resolves.toMatchObject({
        status: 'queued',
      });
    });

    it('validates attachments before touching the profile or the queue', async () => {
      await build({ profiles: chain({ data: null, error: { message: 'unused' } }) });
      await expect(service.createJob(USER, input, [file({ size: 20 * 1024 * 1024 })])).rejects.toThrow(
        BadRequestException,
      );
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('createJob gating', () => {
    it('404s when the profile is missing', async () => {
      await build({ profiles: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(NotFoundException);
    });

    it('refuses a user below the credit floor and never queues work', async () => {
      await build({ profiles: chain({ data: { credits: 0, ai_trained: true }, error: null }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(ForbiddenException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('surfaces a failed job insert as a 500', async () => {
      await build({ scripts: chain({ data: null, error: { message: 'boom' } }) });
      await expect(service.createJob(USER, input)).rejects.toThrow(InternalServerErrorException);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('createJob personalization', () => {
    it('personalizes when the user asked for it and the AI is trained', async () => {
      const res = await service.createJob(USER, input);
      expect(res.message).toMatch(/personalized/i);
      expect(queue.add.mock.calls[0][1]).toMatchObject({ personalized: true });
    });

    it('falls back to generic output when the AI was never trained', async () => {
      await build({ profiles: chain({ data: { credits: 10_000, ai_trained: false }, error: null }) });
      const res = await service.createJob(USER, input);
      expect(res.message).not.toMatch(/personalized/i);
      expect(queue.add.mock.calls[0][1]).toMatchObject({ personalized: false });
    });

    it('honors an explicit opt-out even when the AI is trained', async () => {
      await service.createJob(USER, { ...input, personalized: false });
      expect(queue.add.mock.calls[0][1]).toMatchObject({ personalized: false });
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

    it('passes the selected idea through to the worker as context', async () => {
      await build({ ideation_jobs: chain(ideas) });
      await service.createJob(USER, { ...input, ideationId: 'ide-1', ideaIndex: 0 });
      const { ideationContext } = queue.add.mock.calls[0][1];
      expect(ideationContext).toContain('Sour espresso, explained');
      expect(ideationContext).toContain('grind size; water temp');
    });

    it('queues without context when the index points past the end of the list', async () => {
      await build({ ideation_jobs: chain(ideas) });
      await service.createJob(USER, { ...input, ideationId: 'ide-1', ideaIndex: 7 });
      expect(queue.add.mock.calls[0][1].ideationContext).toBeUndefined();
    });

    it('queues without context when no ideation job was referenced', async () => {
      await service.createJob(USER, input);
      expect(queue.add.mock.calls[0][1].ideationContext).toBeUndefined();
    });
  });

  describe('createJob queueing', () => {
    it('uploads attachments and hands the worker their public URLs', async () => {
      await service.createJob(USER, input, [file()]);
      expect(storage.upload).toHaveBeenCalled();
      expect(queue.add.mock.calls[0][1].fileUrls).toEqual(['https://cdn/brief.pdf']);
    });

    it('drops an attachment whose upload failed rather than failing the whole job', async () => {
      await build();
      storage.upload.mockResolvedValueOnce({ error: { message: 'storage down' } });
      await expect(service.createJob(USER, input, [file()])).resolves.toMatchObject({ status: 'queued' });
      expect(queue.add.mock.calls[0][1].fileUrls).toEqual([]);
    });

    it('retries twice with backoff under a job id the SSE route can follow', async () => {
      const res = await service.createJob(USER, input);
      const [name, , opts] = queue.add.mock.calls[0];
      expect(name).toBe('generate-script');
      expect(opts).toMatchObject({ jobId: res.jobId, attempts: 2 });
      expect(res.jobId).toMatch(new RegExp(`^script-${USER}-\\d+$`));
    });
  });

  describe('list / getOne / update / remove', () => {
    it('returns the caller their scripts', async () => {
      await build({ scripts: chain({ data: [{ id: 'script-1' }], error: null }) });
      await expect(service.list(USER)).resolves.toEqual([{ id: 'script-1' }]);
    });

    it('surfaces a list failure as a 500', async () => {
      await build({ scripts: chain({ data: null, error: { message: 'down' } }) });
      await expect(service.list(USER)).rejects.toThrow(InternalServerErrorException);
    });

    it('404s on a script that is missing or belongs to someone else', async () => {
      await build({ scripts: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.getOne('script-1', USER)).rejects.toThrow(NotFoundException);
    });

    it.each([
      ['title', '', 'body'],
      ['content', 'Title', ''],
    ])('rejects an update with an empty %s', async (_field, title, content) => {
      await expect(service.update('script-1', USER, title, content)).rejects.toThrow(BadRequestException);
    });

    it('404s when the update matches no row owned by the caller', async () => {
      await build({ scripts: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.update('script-1', USER, 'Title', 'Body')).rejects.toThrow(NotFoundException);
    });

    it('404s when the delete matches no row owned by the caller', async () => {
      await build({ scripts: chain({ error: { message: 'no rows' } }) });
      await expect(service.remove('script-1', USER)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportPdf', () => {
    it('renders the script markdown into a real PDF named after the title', async () => {
      await build({
        scripts: chain({
          data: {
            title: 'Why espresso tastes sour',
            content: '# Hook\n\nPour a shot.\n\n- grind size\n- water temp\n\n> Taste it.',
            language: 'english',
            tone: 'conversational',
            duration: '180',
            updated_at: '2026-02-01T00:00:00.000Z',
          },
          error: null,
        }),
      });

      const { pdfBytes, filename } = await service.exportPdf('script-1', USER);
      expect(Buffer.from(pdfBytes).subarray(0, 5).toString()).toBe('%PDF-');
      // Spaces and punctuation would break a Content-Disposition filename.
      expect(filename).toBe('Why_espresso_tastes_sour.pdf');
    });

    it('404s before doing any rendering work when the script is not the caller\'s', async () => {
      await build({ scripts: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.exportPdf('script-1', USER)).rejects.toThrow(NotFoundException);
    });
  });
});
