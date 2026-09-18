import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import request from 'supertest';

import { SubtitleController } from '../src/subtitle/subtitle.controller';
import { SubtitleService } from '../src/subtitle/subtitle.service';
import { StoryBuilderController } from '../src/story-builder/story-builder.controller';
import { StoryBuilderService } from '../src/story-builder/story-builder.service';
import { SupabaseService } from '../src/supabase/supabase.service';

/**
 * The shared request pipeline, over real HTTP: SupabaseAuthGuard resolves the
 * bearer token, OnboardedGuard enforces the training + channel prerequisite,
 * and ZodValidationPipe rejects malformed bodies - all BEFORE a service method
 * (and therefore any credit spend) is reached.
 *
 * Every credit-spending route in the API is assembled from these three pieces,
 * so they are tested once here against two representative controllers rather
 * than re-asserted on every route.
 */

const USER = { id: 'user-1', email: 'creator@example.com' };
const TOKEN = 'valid-token';

type Profile = { ai_trained: boolean; youtube_connected: boolean };

describe('Request pipeline (e2e)', () => {
  let app: INestApplication;
  let subtitleService: Record<string, jest.Mock>;
  let storyService: Record<string, jest.Mock>;
  let getUser: jest.Mock;
  let profile: Profile;

  /** Minimal supabase double: token lookup for the auth guard, profile row for
   *  the onboarding guard, and a no-op presence write. */
  function supabaseDouble() {
    const profiles: any = {};
    // select/eq chain for the onboarding read; update/eq/or + await for the
    // guard's fire-and-forget presence write.
    for (const m of ['select', 'eq', 'or', 'update']) profiles[m] = jest.fn(() => profiles);
    profiles.single = jest.fn(async () => ({ data: profile, error: null }));
    profiles.then = (res: any) => Promise.resolve({ error: null }).then(res);

    return { getClient: () => ({ auth: { getUser }, from: () => profiles }) };
  }

  beforeEach(async () => {
    profile = { ai_trained: true, youtube_connected: true };
    getUser = jest.fn(async (token: unknown) =>
      token === TOKEN ? { data: { user: USER }, error: null } : { data: { user: null }, error: { message: 'bad token' } },
    ) as jest.Mock;

    const stub = (methods: string[]) =>
      methods.reduce<Record<string, jest.Mock>>((o, m) => {
        o[m] = jest.fn(async () => ({ success: true })) as jest.Mock;
        return o;
      }, {});

    subtitleService = stub(['create', 'findAll', 'findOne', 'remove', 'update', 'updateSubtitles', 'signUpload', 'finalizeUpload', 'getUploadLimit', 'burnSubtitle']);
    storyService = stub(['createJob', 'listJobs', 'getJob', 'deleteJob', 'getProfileStatus']);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubtitleController, StoryBuilderController],
      providers: [
        { provide: SubtitleService, useValue: subtitleService },
        { provide: StoryBuilderService, useValue: storyService },
        { provide: SupabaseService, useValue: supabaseDouble() },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: 'BullQueue_story-builder', useValue: { add: jest.fn(), getJob: jest.fn() } },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${TOKEN}`);

  describe('SupabaseAuthGuard', () => {
    it('rejects a request with no Authorization header', async () => {
      await request(app.getHttpServer()).get('/api/v1/subtitle').expect(401);
      expect(subtitleService.findAll).not.toHaveBeenCalled();
    });

    it('rejects a token Supabase does not recognize', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/subtitle')
        .set('Authorization', 'Bearer forged')
        .expect(401);
      expect(subtitleService.findAll).not.toHaveBeenCalled();
    });

    it('rejects an Authorization header that is not a bearer pair', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/subtitle')
        .set('Authorization', TOKEN)
        .expect(401);
    });

    it('passes the authenticated user id, not anything from the request body', async () => {
      // The client cannot choose whose data it reads; the id comes off the token.
      await auth(request(app.getHttpServer()).get('/api/v1/subtitle')).expect(200);
      expect(subtitleService.findAll).toHaveBeenCalledWith(USER.id);
    });

    it('guards a parameterized route the same way', async () => {
      await request(app.getHttpServer()).get('/api/v1/subtitle/sub-1').expect(401);
      await auth(request(app.getHttpServer()).get('/api/v1/subtitle/sub-1')).expect(200);
      expect(subtitleService.findOne).toHaveBeenCalledWith('sub-1', USER.id);
    });
  });

  describe('OnboardedGuard', () => {
    const signUpload = () =>
      auth(request(app.getHttpServer()).post('/api/v1/subtitle/upload/sign')).send({
        filename: 'clip.mp4',
        contentType: 'video/mp4',
        fileSize: 1000,
        duration: '60',
      });

    it('lets a fully onboarded user through', async () => {
      await signUpload().expect(201);
      expect(subtitleService.signUpload).toHaveBeenCalled();
    });

    it.each([
      [{ ai_trained: false, youtube_connected: true }, /AI training/],
      [{ ai_trained: true, youtube_connected: false }, /connected YouTube channel/],
    ])('names the missing prerequisite %#', async (p, message) => {
      profile = p;
      const res = await signUpload().expect(403);
      expect(res.body.message).toMatch(message);
      expect(subtitleService.signUpload).not.toHaveBeenCalled();
    });

    it('lists both prerequisites when neither is met', async () => {
      profile = { ai_trained: false, youtube_connected: false };
      const res = await signUpload().expect(403);
      expect(res.body.message).toMatch(/AI training and a connected YouTube channel/);
    });

    it('leaves read-only routes ungated, so a new user can still see an empty list', async () => {
      profile = { ai_trained: false, youtube_connected: false };
      await auth(request(app.getHttpServer()).get('/api/v1/subtitle')).expect(200);
      await auth(request(app.getHttpServer()).get('/api/v1/subtitle/upload/limit')).expect(200);
    });

    it('runs after authentication, so an anonymous caller gets 401 and not 403', async () => {
      profile = { ai_trained: false, youtube_connected: false };
      await request(app.getHttpServer())
        .post('/api/v1/subtitle/upload/sign')
        .send({ filename: 'clip.mp4', contentType: 'video/mp4', fileSize: 1000, duration: '60' })
        .expect(401);
    });
  });

  describe('ZodValidationPipe', () => {
    it('rejects a body missing a required field, naming the field', async () => {
      const res = await auth(request(app.getHttpServer()).post('/api/v1/subtitle/upload/finalize'))
        .send({ filename: 'clip.mp4', duration: '60' })
        .expect(400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors).toContainEqual(expect.objectContaining({ path: 'objectName' }));
      expect(subtitleService.finalizeUpload).not.toHaveBeenCalled();
    });

    it('rejects a field of the wrong type rather than coercing it', async () => {
      await auth(request(app.getHttpServer()).post('/api/v1/subtitle/upload/sign'))
        .send({ filename: 'clip.mp4', contentType: 'video/mp4', fileSize: '1000', duration: '60' })
        .expect(400);
    });

    it('rejects a non-positive file size', async () => {
      await auth(request(app.getHttpServer()).post('/api/v1/subtitle/upload/sign'))
        .send({ filename: 'clip.mp4', contentType: 'video/mp4', fileSize: 0, duration: '60' })
        .expect(400);
    });

    it('rejects an optional field that is present but malformed', async () => {
      await auth(request(app.getHttpServer()).post('/api/v1/subtitle/upload/finalize'))
        .send({ objectName: 'user-1/clip.mp4', filename: 'clip.mp4', duration: '60', scriptId: 'not-a-uuid' })
        .expect(400);
    });

    it('strips unknown keys, so a client cannot smuggle extra columns into a service', async () => {
      await auth(request(app.getHttpServer()).post('/api/v1/subtitle/upload/finalize'))
        .send({ objectName: 'user-1/clip.mp4', filename: 'clip.mp4', duration: '60', user_id: 'someone-else' })
        .expect(201);
      expect(subtitleService.finalizeUpload).toHaveBeenCalledWith(
        { objectName: 'user-1/clip.mp4', filename: 'clip.mp4', duration: '60' },
        USER.id,
      );
    });

    it('applies schema defaults before the service sees the body', async () => {
      await auth(request(app.getHttpServer()).post('/api/v1/story-builder/generate'))
        .send({ videoTopic: 'Why espresso tastes sour' })
        .expect(201);
      expect(storyService.createJob).toHaveBeenCalledWith(
        USER.id,
        expect.objectContaining({ audienceLevel: expect.any(String), videoDuration: expect.any(String) }),
      );
    });

    it('validates the body on a route that mixes a param with a payload', async () => {
      await auth(request(app.getHttpServer()).patch('/api/v1/subtitle/sub-1'))
        .send({ subtitle_json: 'not-an-array' })
        .expect(400);

      await auth(request(app.getHttpServer()).patch('/api/v1/subtitle/sub-1'))
        .send({ subtitle_json: [{ start: '00:00:01.000', end: '00:00:02.000', text: 'Hello' }] })
        .expect(200);
      expect(subtitleService.updateSubtitles).toHaveBeenCalledWith('sub-1', expect.anything(), USER.id);
    });
  });

  describe('guard and pipe ordering', () => {
    it('rejects an unauthenticated request before validating its body', async () => {
      // Otherwise the API would report schema details to anyone who asks.
      const res = await request(app.getHttpServer())
        .post('/api/v1/subtitle/upload/finalize')
        .send({ nonsense: true })
        .expect(401);
      expect(res.body.message).not.toBe('Validation failed');
    });

    it('rejects an un-onboarded request before validating its body', async () => {
      profile = { ai_trained: false, youtube_connected: false };
      await auth(request(app.getHttpServer()).post('/api/v1/subtitle/upload/finalize'))
        .send({ nonsense: true })
        .expect(403);
    });
  });
});
