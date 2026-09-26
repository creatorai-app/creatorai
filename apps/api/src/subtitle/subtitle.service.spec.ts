import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubtitleService } from './subtitle.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  SUBTITLE_FREE_UPLOAD_BYTES,
  SUBTITLE_PAID_UPLOAD_BYTES,
  SUBTITLE_FREE_MAX_DURATION_SECONDS,
  SUBTITLE_PAID_MAX_DURATION_SECONDS,
} from '@repo/validation';
import { deleteGcsObject, gcsObjectMetadata, getSignedUploadUrl } from '../utils';

jest.mock('../utils', () => ({
  createGoogleAI: jest.fn(),
  GEMINI_TEXT_MODEL: 'gemini-test',
  getMimeTypeFromUrl: jest.fn(() => 'video/mp4'),
  configureFFmpeg: jest.fn(),
  streamVideoToFile: jest.fn(),
  getSignedUploadUrl: jest.fn().mockResolvedValue('https://signed-upload-url'),
  gcsPublicUrl: jest.fn(() => 'https://storage.googleapis.com/sub-bucket/obj'),
  gcsUri: jest.fn(() => 'gs://sub-bucket/obj'),
  gcsObjectMetadata: jest.fn().mockResolvedValue({ size: 1_000 }),
  deleteGcsObject: jest.fn().mockResolvedValue(undefined),
}));

/** Chainable supabase query mock: builder methods return the chain; awaiting it
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
const paidPlan = { data: { plans: { price_monthly: 49 } } };
const freePlan = { data: { plans: { price_monthly: 0 } } };

describe('SubtitleService', () => {
  let service: SubtitleService;
  let tables: Record<string, any>;

  async function build(overrides: Record<string, any> = {}) {
    jest.clearAllMocks();
    (gcsObjectMetadata as jest.Mock).mockResolvedValue({ size: 1_000 });
    tables = {
      subscriptions: chain(freePlan),
      profiles: chain({ data: { credits: 10_000 }, error: null }),
      subtitle_jobs: chain({ data: { id: 'sub-1' }, error: null }),
      ...overrides,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubtitleService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from: (t: string) => tables[t], rpc: jest.fn() }) },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    service = module.get(SubtitleService);
  }

  beforeEach(() => build());

  describe('getUploadLimit (plan tiers)', () => {
    it('throttles a user with no subscription to the free caps', async () => {
      await build({ subscriptions: chain({ data: null }) });
      await expect(service.getUploadLimit(USER)).resolves.toEqual({
        success: true,
        maxBytes: SUBTITLE_FREE_UPLOAD_BYTES,
        maxDurationSeconds: SUBTITLE_FREE_MAX_DURATION_SECONDS,
      });
    });

    it('treats a $0/mo subscription as free, not as paid', async () => {
      await build({ subscriptions: chain(freePlan) });
      await expect(service.getUploadLimit(USER)).resolves.toMatchObject({
        maxBytes: SUBTITLE_FREE_UPLOAD_BYTES,
      });
    });

    it('lifts a paying user to the 2GB / 45 min ceiling', async () => {
      await build({ subscriptions: chain(paidPlan) });
      await expect(service.getUploadLimit(USER)).resolves.toEqual({
        success: true,
        maxBytes: SUBTITLE_PAID_UPLOAD_BYTES,
        maxDurationSeconds: SUBTITLE_PAID_MAX_DURATION_SECONDS,
      });
    });
  });

  describe('signUpload', () => {
    const input = {
      filename: 'clip.mp4',
      contentType: 'video/mp4',
      fileSize: 1_000,
      duration: '60',
    } as any;

    it('issues a signed URL under a user-scoped object name', async () => {
      const res = await service.signUpload(input, USER);
      expect(res).toMatchObject({ success: true, uploadUrl: 'https://signed-upload-url' });
      // The prefix is what finalizeUpload later checks ownership against.
      expect(res.objectName.startsWith(`${USER}/`)).toBe(true);
    });

    it('strips separators so a filename cannot escape its prefix', async () => {
      const res = await service.signUpload({ ...input, filename: '../../etc/passwd .mp4' }, USER);
      expect(res.objectName.startsWith(`${USER}/`)).toBe(true);
      // The user prefix is the only slash left, so "../" cannot walk out of it.
      expect(res.objectName.split('/')).toHaveLength(2);
      expect(res.objectName).not.toContain(' ');
    });

    it('rejects a non-video content type before any URL is issued', async () => {
      await expect(
        service.signUpload({ ...input, contentType: 'application/zip' }, USER),
      ).rejects.toThrow(BadRequestException);
      expect(getSignedUploadUrl).not.toHaveBeenCalled();
    });

    it('rejects an unparseable duration', async () => {
      await expect(service.signUpload({ ...input, duration: 'abc' }, USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a free-plan video over 10 minutes and points at the upgrade', async () => {
      await build({ subscriptions: chain(freePlan) });
      await expect(
        service.signUpload({ ...input, duration: String(SUBTITLE_FREE_MAX_DURATION_SECONDS + 1) }, USER),
      ).rejects.toThrow(/upgrade/i);
    });

    it('phrases the paid-plan duration cap as a hard maximum, not an upsell', async () => {
      await build({ subscriptions: chain(paidPlan) });
      await expect(
        service.signUpload({ ...input, duration: String(SUBTITLE_PAID_MAX_DURATION_SECONDS + 1) }, USER),
      ).rejects.toThrow(/maximum supported length/i);
    });

    it('rejects a file over the plan size cap without issuing a URL', async () => {
      await expect(
        service.signUpload({ ...input, fileSize: SUBTITLE_FREE_UPLOAD_BYTES + 1 }, USER),
      ).rejects.toThrow(PayloadTooLargeException);
      expect(getSignedUploadUrl).not.toHaveBeenCalled();
    });

    it('accepts a 1GB file once the user is on a paid plan', async () => {
      await build({ subscriptions: chain(paidPlan) });
      await expect(
        service.signUpload({ ...input, fileSize: 1024 * 1024 * 1024 }, USER),
      ).resolves.toMatchObject({ success: true });
    });
  });

  describe('finalizeUpload', () => {
    const input = { objectName: `${USER}/123_clip.mp4`, filename: 'clip.mp4', duration: '60' } as any;

    it('creates the job and returns its id', async () => {
      await expect(service.finalizeUpload(input, USER)).resolves.toEqual({
        success: true,
        subtitleId: 'sub-1',
      });
    });

    it("refuses an object under another user's prefix", async () => {
      await expect(
        service.finalizeUpload({ ...input, objectName: 'someone-else/123_clip.mp4' }, USER),
      ).rejects.toThrow(ForbiddenException);
      expect(gcsObjectMetadata).not.toHaveBeenCalled();
    });

    it('reports a missing object as a bad request rather than a 500', async () => {
      (gcsObjectMetadata as jest.Mock).mockRejectedValueOnce(new Error('404'));
      await expect(service.finalizeUpload(input, USER)).rejects.toThrow(BadRequestException);
    });

    it('re-checks the REAL uploaded size and deletes an oversize object', async () => {
      // The signed URL cannot enforce a size, so a client that lied at sign time
      // gets caught here - and the bytes must not be left in the bucket.
      (gcsObjectMetadata as jest.Mock).mockResolvedValueOnce({
        size: SUBTITLE_FREE_UPLOAD_BYTES + 1,
      });
      await expect(service.finalizeUpload(input, USER)).rejects.toThrow(PayloadTooLargeException);
      expect(deleteGcsObject).toHaveBeenCalledWith(expect.anything(), input.objectName);
    });

    it('cleans up the uploaded object when the job row cannot be inserted', async () => {
      await build({ subtitle_jobs: chain({ data: null, error: { message: 'boom' } }) });
      await expect(service.finalizeUpload(input, USER)).rejects.toThrow(InternalServerErrorException);
      expect(deleteGcsObject).toHaveBeenCalledWith(expect.anything(), input.objectName);
    });
  });

  describe('findOne', () => {
    it('returns the job for its owner', async () => {
      await build({ subtitle_jobs: chain({ data: { id: 'sub-1' }, error: null }) });
      await expect(service.findOne('sub-1', USER)).resolves.toEqual({
        success: true,
        subtitle: { id: 'sub-1' },
      });
    });

    it('maps "no rows" to 404 and any other failure to 500', async () => {
      await build({ subtitle_jobs: chain({ data: null, error: { code: 'PGRST116' } }) });
      await expect(service.findOne('sub-1', USER)).rejects.toThrow(NotFoundException);

      await build({ subtitle_jobs: chain({ data: null, error: { code: '42P01' } }) });
      await expect(service.findOne('sub-1', USER)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAll', () => {
    it('surfaces a query failure as a 500', async () => {
      await build({ subtitle_jobs: chain({ data: null, error: { message: 'down' } }) });
      await expect(service.findAll(USER)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('update / updateSubtitles', () => {
    const cues = [{ start: '00:00:01.000', end: '00:00:02.000', text: 'Hello' }];

    it('returns the saved cues alongside the rendered SRT', async () => {
      const res = await service.update({ subtitle_json: cues, subtitle_id: 'sub-1' } as any, USER);
      expect(res.success).toBe(true);
      expect(res.srt).toContain('Hello');
      // SRT timecodes are comma-separated, not the dotted form stored in JSON.
      expect(res.srt).toContain('00:00:01,000 --> 00:00:02,000');
    });

    it.each([
      ['update', (s: SubtitleService) => s.update({ subtitle_json: 'nope', subtitle_id: 'x' } as any, USER)],
      ['updateSubtitles', (s: SubtitleService) => s.updateSubtitles('x', { subtitle_json: 'nope' } as any, USER)],
    ])('%s rejects a non-array payload', async (_name, call) => {
      await expect(call(service)).rejects.toThrow(BadRequestException);
    });

    it('surfaces a failed write as a 500', async () => {
      await build({ subtitle_jobs: chain({ error: { message: 'boom' } }) });
      await expect(
        service.updateSubtitles('sub-1', { subtitle_json: cues } as any, USER),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('remove', () => {
    it('deletes the backing GCS object derived from the gs:// URI', async () => {
      await build({
        subtitle_jobs: chain({ data: { video_gs_uri: 'gs://sub-bucket/user-1/123_clip.mp4' }, error: null }),
      });
      await expect(service.remove('sub-1', USER)).resolves.toMatchObject({ success: true });
      expect(deleteGcsObject).toHaveBeenCalledWith(expect.anything(), 'user-1/123_clip.mp4');
    });

    it('still succeeds when the row carried no stored video', async () => {
      await build({ subtitle_jobs: chain({ data: { video_gs_uri: null }, error: null }) });
      await expect(service.remove('sub-1', USER)).resolves.toMatchObject({ success: true });
      expect(deleteGcsObject).not.toHaveBeenCalled();
    });
  });
});
