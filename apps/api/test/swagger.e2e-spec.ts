import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';
import request from 'supertest';

import { HealthController } from '../src/health.controller';
import { AppController } from '../src/app.controller';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { BillingController } from '../src/billing/billing.controller';
import { BillingService } from '../src/billing/billing.service';
import { LemonSqueezyWebhookController } from '../src/billing/lemonsqueezy-webhook.controller';
import { AdminController } from '../src/admin/admin.controller';
import { AdminService } from '../src/admin/admin.service';
import { AffiliateController } from '../src/affiliate/affiliate.controller';
import { AffiliateService } from '../src/affiliate/affiliate.service';
import { CourseController } from '../src/course/course.controller';
import { CourseService } from '../src/course/course.service';
import { DubbingController } from '../src/dubbing/dubbing.controller';
import { DubbingService } from '../src/dubbing/dubbing.service';
import { IdeationController } from '../src/ideation/ideation.controller';
import { IdeationService } from '../src/ideation/ideation.service';
import { ReferralController } from '../src/referral/referral.controller';
import { ReferralService } from '../src/referral/referral.service';
import { ScriptController } from '../src/script/script.controller';
import { ScriptService } from '../src/script/script.service';
import { StoryBuilderController } from '../src/story-builder/story-builder.controller';
import { StoryBuilderService } from '../src/story-builder/story-builder.service';
import { SubtitleController } from '../src/subtitle/subtitle.controller';
import { SubtitleService } from '../src/subtitle/subtitle.service';
import { SupportController } from '../src/support/support.controller';
import { SupportService } from '../src/support/support.service';
import { ThumbnailController } from '../src/thumbnail/thumbnail.controller';
import { ThumbnailService } from '../src/thumbnail/thumbnail.service';
import { TrainAiController } from '../src/train-ai/train-ai.controller';
import { UploadController } from '../src/upload/upload.controller';
import { UploadService } from '../src/upload/upload.service';
import { YoutubeController } from '../src/youtube/youtube.controller';
import { YoutubeService } from '../src/youtube/youtube.service';
import { SupabaseService } from '../src/supabase/supabase.service';

const noopAsync = () => Promise.resolve({});
const mockQueue = { add: noopAsync, getJob: noopAsync, client: Promise.resolve({ set: noopAsync }) };
const getQueueToken = (name: string) => `BullQueue_${name}`;

function stub(methods: string[]) {
  return methods.reduce<Record<string, unknown>>((o, m) => {
    o[m] = jest.fn<() => Promise<unknown>>().mockResolvedValue({});
    return o;
  }, {});
}

describe('Swagger / OpenAPI Specification', () => {
  let app: INestApplication;
  let spec: OpenAPIObject;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        HealthController,
        AppController,
        AuthController,
        BillingController,
        LemonSqueezyWebhookController,
        AdminController,
        AffiliateController,
        CourseController,
        DubbingController,
        IdeationController,
        ReferralController,
        ScriptController,
        StoryBuilderController,
        SubtitleController,
        SupportController,
        ThumbnailController,
        TrainAiController,
        UploadController,
        YoutubeController,
      ],
      providers: [
        Reflector,
        { provide: SupabaseService, useValue: stub(['getClient', 'getAdminClient']) },
        { provide: AuthService, useValue: stub(['forgotPassword', 'verifyOtp', 'resetPassword']) },
        { provide: BillingService, useValue: stub(['getPlans', 'getBillingInfo', 'getUsageHistory', 'createCheckoutSession', 'getCustomerPortalUrl', 'cancelActiveSubscription', 'verifyWebhookSignature', 'handleSubscriptionCreated', 'handleSubscriptionUpdated', 'handleSubscriptionCancelled', 'handleSubscriptionExpired', 'handleSubscriptionPaymentSuccess']) },
        { provide: AdminService, useValue: stub(['getDashboardStats', 'getUsers', 'getUser', 'updateUser', 'deleteUser', 'getBlogs', 'getBlog', 'createBlog', 'updateBlog', 'deleteBlog', 'getActivities', 'getMails', 'updateMailStatus', 'getJobPosts', 'getJobPost', 'createJobPost', 'updateJobPost', 'deleteJobPost', 'getApplications', 'getApplication', 'updateApplicationStatus', 'deleteApplication', 'getAllAffiliateLinks', 'getAllAffiliateSales', 'updateAffiliateLink', 'updateAffiliateSaleStatus', 'logActivity']) },
        { provide: AffiliateService, useValue: stub(['submitRequest', 'getRequestStatus', 'getRequests', 'reviewRequest', 'createAffiliateLinkForRep', 'getLsAffiliates', 'getLsAffiliateSignupUrl', 'getHubStats', 'getUserLinks', 'createUserLink', 'updateUserLink', 'deleteUserLink', 'getUserPromoCodes', 'getUserSales', 'getPayoutMethod', 'upsertPayoutMethod', 'getUserWithdrawals', 'requestWithdrawal', 'getPromoCodes', 'createPromoCode', 'updatePromoCode', 'getLsDiscounts', 'getWithdrawals', 'updateWithdrawal']) },
        { provide: CourseService, useValue: stub(['generate']) },
        { provide: DubbingService, useValue: stub(['createDub', 'streamDubbingStatus', 'listDubs', 'getDub', 'deleteDub']) },
        { provide: IdeationService, useValue: stub(['createJob', 'listJobs', 'getProfileStatus', 'getJob', 'deleteJob', 'exportPdf', 'exportJson']) },
        { provide: ReferralService, useValue: stub(['getReferralData', 'generateReferralCode', 'trackReferral']) },
        { provide: ScriptService, useValue: stub(['createJob', 'list', 'exportPdf', 'getOne', 'update', 'remove']) },
        { provide: StoryBuilderService, useValue: stub(['createJob', 'getProfileStatus', 'listJobs', 'getJob', 'deleteJob']) },
        { provide: SubtitleService, useValue: stub(['create', 'findAll', 'upload', 'update', 'findOne', 'remove', 'updateSubtitles', 'burnSubtitle']) },
        { provide: SupportService, useValue: stub(['reportIssue']) },
        { provide: ThumbnailService, useValue: stub(['createJob', 'listJobs', 'getJob', 'deleteJob']) },
        { provide: UploadService, useValue: stub(['uploadAvatar', 'deleteAvatar']) },
        { provide: YoutubeService, useValue: stub(['getVideoMetadata', 'getChannelVideos']) },
        { provide: getQueueToken('train-ai'), useValue: mockQueue },
        { provide: getQueueToken('script'), useValue: mockQueue },
        { provide: getQueueToken('ideation'), useValue: mockQueue },
        { provide: getQueueToken('story-builder'), useValue: mockQueue },
        { provide: getQueueToken('thumbnail'), useValue: mockQueue },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['/'] });

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Creator AI API')
      .setDescription('Backend API for Creator AI platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    spec = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, spec);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Document structure ───

  describe('Document structure', () => {
    it('should have valid OpenAPI 3.x version', () => {
      expect(spec.openapi).toMatch(/^3\.\d+\.\d+$/);
    });

    it('should have correct title and version', () => {
      expect(spec.info.title).toBe('Creator AI API');
      expect(spec.info.version).toBe('1.0');
    });

    it('should include bearer auth security scheme', () => {
      const schemes = spec.components?.securitySchemes;
      expect(schemes).toBeDefined();
      expect(schemes!['bearer']).toBeDefined();
      expect((schemes!['bearer'] as any).type).toBe('http');
      expect((schemes!['bearer'] as any).scheme).toBe('bearer');
    });

    it('should define at least one path', () => {
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    });
  });

  // ─── Swagger JSON endpoint ───

  describe('GET /api/docs-json', () => {
    it('should serve the OpenAPI JSON', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
      expect(res.body.openapi).toBeDefined();
      expect(res.body.info.title).toBe('Creator AI API');
    });
  });

  // ─── Health ───

  describe('Health', () => {
    it('GET /', () => {
      expect(spec.paths['/']?.get).toBeDefined();
    });
  });

  // ─── Auth ───

  describe('Auth', () => {
    const base = '/api/v1/auth';

    it.each([
      ['post', 'forgot-password'],
      ['post', 'verify-otp'],
      ['post', 'reset-password'],
    ])('%s /%s', (method, path) => {
      expect((spec.paths[`${base}/${path}`] as any)?.[method]).toBeDefined();
    });
  });

  // ─── Billing ───

  describe('Billing', () => {
    const base = '/api/v1/billing';

    it.each([
      ['get', 'plans'],
      ['get', 'info'],
      ['get', 'usage'],
      ['post', 'checkout'],
      ['post', 'portal'],
      ['post', 'cancel'],
    ])('%s /%s', (method, path) => {
      expect((spec.paths[`${base}/${path}`] as any)?.[method]).toBeDefined();
    });
  });

  // ─── LemonSqueezy Webhook ───

  describe('LemonSqueezy webhook', () => {
    it('POST /lemonsqueezy/webhook', () => {
      expect(spec.paths['/api/v1/lemonsqueezy/webhook']?.post).toBeDefined();
    });
  });

  // ─── Admin ───

  describe('Admin', () => {
    const base = '/api/v1/admin';

    it.each([
      ['get', 'stats'],
      ['get', 'users'],
      ['get', 'users/{userId}'],
      ['put', 'users/{userId}'],
      ['delete', 'users/{userId}'],
      ['get', 'blogs'],
      ['get', 'blogs/{id}'],
      ['post', 'blogs'],
      ['put', 'blogs/{id}'],
      ['delete', 'blogs/{id}'],
      ['get', 'activities'],
      ['get', 'mails'],
      ['put', 'mails/{id}'],
      ['get', 'jobs'],
      ['get', 'jobs/{id}'],
      ['post', 'jobs'],
      ['put', 'jobs/{id}'],
      ['delete', 'jobs/{id}'],
      ['get', 'applications'],
      ['get', 'applications/{id}'],
      ['put', 'applications/{id}'],
      ['delete', 'applications/{id}'],
      ['get', 'affiliates/links'],
      ['get', 'affiliates/sales'],
      ['put', 'affiliates/links/{id}'],
      ['put', 'affiliates/sales/{id}'],
    ])('%s /%s', (method, path) => {
      expect((spec.paths[`${base}/${path}`] as any)?.[method]).toBeDefined();
    });
  });

  // ─── Affiliate ───

  describe('Affiliate', () => {
    const base = '/api/v1/affiliate';

    it.each([
      ['post', 'apply'],
      ['get', 'status'],
      ['get', 'requests'],
      ['put', 'requests/{id}'],
      ['get', 'hub'],
      ['get', 'links'],
      ['post', 'links'],
      ['put', 'links/{id}'],
      ['delete', 'links/{id}'],
      ['get', 'promo-codes'],
      ['get', 'sales'],
      ['get', 'payout-method'],
      ['put', 'payout-method'],
      ['get', 'withdrawals'],
      ['post', 'withdrawals'],
      ['post', 'admin/create-link'],
      ['get', 'admin/ls-affiliates'],
      ['get', 'admin/ls-signup-url'],
      ['get', 'admin/promo-codes'],
      ['post', 'admin/promo-codes'],
      ['put', 'admin/promo-codes/{id}'],
      ['get', 'admin/ls-discounts'],
      ['get', 'admin/withdrawals'],
      ['put', 'admin/withdrawals/{id}'],
    ])('%s /%s', (method, path) => {
      expect((spec.paths[`${base}/${path}`] as any)?.[method]).toBeDefined();
    });
  });

  // ─── Course ───

  describe('Course', () => {
    it('POST /generate', () => {
      expect(spec.paths['/api/v1/course/generate']?.post).toBeDefined();
    });
  });

  // ─── Dubbing ───

  describe('Dubbing', () => {
    const base = '/api/v1/dubbing';

    it.each([
      ['post', ''],
      ['get', ''],
      ['get', '{id}'],
      ['delete', '{id}'],
      ['get', 'status/{projectId}'],
    ])('%s /%s', (method, path) => {
      const full = path ? `${base}/${path}` : base;
      expect((spec.paths[full] as any)?.[method]).toBeDefined();
    });
  });

  // ─── Ideation ───

  describe('Ideation', () => {
    const base = '/api/v1/ideation';

    it.each([
      ['post', ''],
      ['get', ''],
      ['get', 'profile-status'],
      ['get', 'status/{jobId}'],
      ['get', '{id}/export/pdf'],
      ['get', '{id}/export/json'],
      ['get', '{id}'],
      ['delete', '{id}'],
    ])('%s /%s', (method, path) => {
      const full = path ? `${base}/${path}` : base;
      expect((spec.paths[full] as any)?.[method]).toBeDefined();
    });
  });

  // ─── Referral ───

  describe('Referral', () => {
    const base = '/api/v1/referral';

    it('GET /', () => expect(spec.paths[base]?.get).toBeDefined());
    it('POST /generate', () => expect(spec.paths[`${base}/generate`]?.post).toBeDefined());
    it('POST /track', () => expect(spec.paths[`${base}/track`]?.post).toBeDefined());
  });

  // ─── Script ───

  describe('Script', () => {
    const base = '/api/v1/script';

    it.each([
      ['post', 'generate'],
      ['get', ''],
      ['get', '{id}/export'],
      ['get', '{id}'],
      ['patch', '{id}'],
      ['delete', '{id}'],
      ['get', 'status/{jobId}'],
    ])('%s /%s', (method, path) => {
      const full = path ? `${base}/${path}` : base;
      expect((spec.paths[full] as any)?.[method]).toBeDefined();
    });
  });

  // ─── Story Builder ───

  describe('Story Builder', () => {
    const base = '/api/v1/story-builder';

    it.each([
      ['post', 'generate'],
      ['get', 'profile-status'],
      ['get', ''],
      ['get', '{id}'],
      ['delete', '{id}'],
      ['get', 'status/{jobId}'],
    ])('%s /%s', (method, path) => {
      const full = path ? `${base}/${path}` : base;
      expect((spec.paths[full] as any)?.[method]).toBeDefined();
    });
  });

  // ─── Subtitle ───

  describe('Subtitle', () => {
    const base = '/api/v1/subtitle';

    it.each([
      ['post', ''],
      ['get', ''],
      ['post', 'upload'],
      ['patch', ''],
      ['get', '{id}'],
      ['delete', '{id}'],
      ['patch', '{id}'],
      ['post', 'burn'],
    ])('%s /%s', (method, path) => {
      const full = path ? `${base}/${path}` : base;
      expect((spec.paths[full] as any)?.[method]).toBeDefined();
    });
  });

  // ─── Support ───

  describe('Support', () => {
    it('POST /report-issue', () => {
      expect(spec.paths['/api/v1/support/report-issue']?.post).toBeDefined();
    });
  });

  // ─── Thumbnail ───

  describe('Thumbnail', () => {
    const base = '/api/v1/thumbnail';

    it.each([
      ['post', 'generate'],
      ['get', ''],
      ['get', '{id}'],
      ['delete', '{id}'],
      ['get', 'status/{jobId}'],
    ])('%s /%s', (method, path) => {
      const full = path ? `${base}/${path}` : base;
      expect((spec.paths[full] as any)?.[method]).toBeDefined();
    });
  });

  // ─── Train AI ───

  describe('Train AI', () => {
    const base = '/api/v1/train-ai';

    it('POST /', () => expect(spec.paths[base]?.post).toBeDefined());
    it('POST /stop/{jobId}', () => expect(spec.paths[`${base}/stop/{jobId}`]?.post).toBeDefined());
    it('GET /status/{jobId}', () => expect(spec.paths[`${base}/status/{jobId}`]?.get).toBeDefined());
  });

  // ─── Upload ───

  describe('Upload', () => {
    const base = '/api/v1/upload';

    it('POST /avatar', () => expect(spec.paths[`${base}/avatar`]?.post).toBeDefined());
    it('DELETE /avatar', () => expect(spec.paths[`${base}/avatar`]?.delete).toBeDefined());
  });

  // ─── YouTube ───

  describe('YouTube', () => {
    const base = '/api/v1/youtube';

    it('GET /video-metadata', () => expect(spec.paths[`${base}/video-metadata`]?.get).toBeDefined());
    it('GET /channel-videos', () => expect(spec.paths[`${base}/channel-videos`]?.get).toBeDefined());
  });

  // ─── App ───

  describe('App', () => {
    it('GET /test-db', () => {
      expect(spec.paths['/api/v1/test-db']?.get).toBeDefined();
    });
  });

  // ─── Tag coverage ───

  describe('Tag coverage', () => {
    const expectedTags = [
      'health', 'auth', 'billing', 'admin', 'course', 'dubbing',
      'ideation', 'referral', 'script', 'story-builder',
      'subtitle', 'support', 'thumbnail', 'train-ai', 'upload', 'youtube', 'app',
      'affiliate',
    ];

    it('every expected tag should appear on at least one operation', () => {
      const usedTags = new Set<string>();
      for (const pathItem of Object.values(spec.paths)) {
        for (const op of Object.values(pathItem as Record<string, any>)) {
          if (op?.tags) {
            (op.tags as string[]).forEach((t: string) => usedTags.add(t));
          }
        }
      }
      for (const tag of expectedTags) {
        expect(usedTags).toContain(tag);
      }
    });
  });

  // ─── Full endpoint completeness ───

  describe('Completeness', () => {
    const ALL_ENDPOINTS: [string, string][] = [
      ['get', '/'],
      ['get', '/api/v1/test-db'],
      ['post', '/api/v1/auth/forgot-password'],
      ['post', '/api/v1/auth/verify-otp'],
      ['post', '/api/v1/auth/reset-password'],
      ['get', '/api/v1/billing/plans'],
      ['get', '/api/v1/billing/info'],
      ['get', '/api/v1/billing/usage'],
      ['post', '/api/v1/billing/checkout'],
      ['post', '/api/v1/billing/portal'],
      ['post', '/api/v1/billing/cancel'],
      ['post', '/api/v1/lemonsqueezy/webhook'],
      ['get', '/api/v1/admin/stats'],
      ['get', '/api/v1/admin/users'],
      ['get', '/api/v1/admin/users/{userId}'],
      ['put', '/api/v1/admin/users/{userId}'],
      ['delete', '/api/v1/admin/users/{userId}'],
      ['get', '/api/v1/admin/blogs'],
      ['get', '/api/v1/admin/blogs/{id}'],
      ['post', '/api/v1/admin/blogs'],
      ['put', '/api/v1/admin/blogs/{id}'],
      ['delete', '/api/v1/admin/blogs/{id}'],
      ['get', '/api/v1/admin/activities'],
      ['get', '/api/v1/admin/mails'],
      ['put', '/api/v1/admin/mails/{id}'],
      ['get', '/api/v1/admin/jobs'],
      ['get', '/api/v1/admin/jobs/{id}'],
      ['post', '/api/v1/admin/jobs'],
      ['put', '/api/v1/admin/jobs/{id}'],
      ['delete', '/api/v1/admin/jobs/{id}'],
      ['get', '/api/v1/admin/applications'],
      ['get', '/api/v1/admin/applications/{id}'],
      ['put', '/api/v1/admin/applications/{id}'],
      ['delete', '/api/v1/admin/applications/{id}'],
      ['get', '/api/v1/admin/affiliates/links'],
      ['get', '/api/v1/admin/affiliates/sales'],
      ['put', '/api/v1/admin/affiliates/links/{id}'],
      ['put', '/api/v1/admin/affiliates/sales/{id}'],
      ['post', '/api/v1/affiliate/apply'],
      ['get', '/api/v1/affiliate/status'],
      ['get', '/api/v1/affiliate/requests'],
      ['put', '/api/v1/affiliate/requests/{id}'],
      ['get', '/api/v1/affiliate/hub'],
      ['get', '/api/v1/affiliate/links'],
      ['post', '/api/v1/affiliate/links'],
      ['put', '/api/v1/affiliate/links/{id}'],
      ['delete', '/api/v1/affiliate/links/{id}'],
      ['get', '/api/v1/affiliate/promo-codes'],
      ['get', '/api/v1/affiliate/sales'],
      ['get', '/api/v1/affiliate/payout-method'],
      ['put', '/api/v1/affiliate/payout-method'],
      ['get', '/api/v1/affiliate/withdrawals'],
      ['post', '/api/v1/affiliate/withdrawals'],
      ['post', '/api/v1/affiliate/admin/create-link'],
      ['get', '/api/v1/affiliate/admin/ls-affiliates'],
      ['get', '/api/v1/affiliate/admin/ls-signup-url'],
      ['get', '/api/v1/affiliate/admin/promo-codes'],
      ['post', '/api/v1/affiliate/admin/promo-codes'],
      ['put', '/api/v1/affiliate/admin/promo-codes/{id}'],
      ['get', '/api/v1/affiliate/admin/ls-discounts'],
      ['get', '/api/v1/affiliate/admin/withdrawals'],
      ['put', '/api/v1/affiliate/admin/withdrawals/{id}'],
      ['post', '/api/v1/course/generate'],
      ['post', '/api/v1/dubbing'],
      ['get', '/api/v1/dubbing'],
      ['get', '/api/v1/dubbing/{id}'],
      ['delete', '/api/v1/dubbing/{id}'],
      ['get', '/api/v1/dubbing/status/{projectId}'],
      ['post', '/api/v1/ideation'],
      ['get', '/api/v1/ideation'],
      ['get', '/api/v1/ideation/profile-status'],
      ['get', '/api/v1/ideation/status/{jobId}'],
      ['get', '/api/v1/ideation/{id}/export/pdf'],
      ['get', '/api/v1/ideation/{id}/export/json'],
      ['get', '/api/v1/ideation/{id}'],
      ['delete', '/api/v1/ideation/{id}'],
      ['get', '/api/v1/referral'],
      ['post', '/api/v1/referral/generate'],
      ['post', '/api/v1/referral/track'],
      ['post', '/api/v1/script/generate'],
      ['get', '/api/v1/script'],
      ['get', '/api/v1/script/{id}/export'],
      ['get', '/api/v1/script/{id}'],
      ['patch', '/api/v1/script/{id}'],
      ['delete', '/api/v1/script/{id}'],
      ['get', '/api/v1/script/status/{jobId}'],
      ['post', '/api/v1/story-builder/generate'],
      ['get', '/api/v1/story-builder/profile-status'],
      ['get', '/api/v1/story-builder'],
      ['get', '/api/v1/story-builder/{id}'],
      ['delete', '/api/v1/story-builder/{id}'],
      ['get', '/api/v1/story-builder/status/{jobId}'],
      ['post', '/api/v1/subtitle'],
      ['get', '/api/v1/subtitle'],
      ['post', '/api/v1/subtitle/upload'],
      ['patch', '/api/v1/subtitle'],
      ['get', '/api/v1/subtitle/{id}'],
      ['delete', '/api/v1/subtitle/{id}'],
      ['patch', '/api/v1/subtitle/{id}'],
      ['post', '/api/v1/subtitle/burn'],
      ['post', '/api/v1/support/report-issue'],
      ['post', '/api/v1/thumbnail/generate'],
      ['get', '/api/v1/thumbnail'],
      ['get', '/api/v1/thumbnail/{id}'],
      ['delete', '/api/v1/thumbnail/{id}'],
      ['get', '/api/v1/thumbnail/status/{jobId}'],
      ['post', '/api/v1/train-ai'],
      ['post', '/api/v1/train-ai/stop/{jobId}'],
      ['get', '/api/v1/train-ai/status/{jobId}'],
      ['post', '/api/v1/upload/avatar'],
      ['delete', '/api/v1/upload/avatar'],
      ['get', '/api/v1/youtube/video-metadata'],
      ['get', '/api/v1/youtube/channel-videos'],
    ];

    it(`should document all ${ALL_ENDPOINTS.length} endpoints`, () => {
      const missing: string[] = [];
      for (const [method, path] of ALL_ENDPOINTS) {
        if (!(spec.paths[path] as any)?.[method]) {
          missing.push(`${method.toUpperCase()} ${path}`);
        }
      }
      expect(missing).toEqual([]);
    });

    it('should not have undocumented paths', () => {
      const expectedPaths = new Set(ALL_ENDPOINTS.map(([, p]) => p));
      const unexpected = Object.keys(spec.paths).filter((p) => !expectedPaths.has(p));
      expect(unexpected).toEqual([]);
    });
  });
});
