import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockFrom = jest.fn();
const mockSupabaseClient = { from: mockFrom };
const mockSupabaseService = {
  getClient: () => mockSupabaseClient,
  getAdminClient: () => mockSupabaseClient,
};

describe('BillingService', () => {
  let service: BillingService;
  let configService: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                LEMONSQUEEZY_API_KEY: 'test-key',
                LEMONSQUEEZY_STORE_ID: 'store-1',
                LEMONSQUEEZY_WEBHOOK_SECRET: 'webhook-secret',
                FRONTEND_PROD_URL: 'https://app.test.com',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('getPlans', () => {
    it('should return active plans sorted by price', async () => {
      const plans = [
        { id: '1', name: 'Starter', price_monthly: 0 },
        { id: '2', name: 'Pro', price_monthly: 29 },
      ];

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            order: () => ({ data: plans, error: null }),
          }),
        }),
      });

      const result = await service.getPlans();
      expect(result).toEqual(plans);
    });

    it('should throw on database error', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            order: () => ({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      });

      await expect(service.getPlans()).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for valid signature', () => {
      const crypto = require('crypto');
      const secret = 'webhook-secret';
      const body = Buffer.from('test-body');
      const hmac = crypto.createHmac('sha256', secret);
      const validSignature = hmac.update(body).digest('hex');

      const result = service.verifyWebhookSignature(body, validSignature);
      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const body = Buffer.from('test-body');
      const result = service.verifyWebhookSignature(body, 'invalid-sig');
      expect(result).toBe(false);
    });
  });

  describe('recordWebhookEvent', () => {
    const insertedRow = () => mockInsert.mock.calls[0][0];
    let mockInsert: jest.Mock;

    beforeEach(() => {
      mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });
    });

    it('maps a subscription payment to its amount, status and subscription', async () => {
      await service.recordWebhookEvent('subscription_payment_success', {
        meta: { event_name: 'subscription_payment_success' },
        data: {
          id: 'invoice-1',
          type: 'subscription-invoices',
          attributes: {
            subscription_id: 555,
            total: 2900,
            currency: 'USD',
            status: 'paid',
            user_email: 'buyer@test.com',
            created_at: '2026-07-01T00:00:00.000Z',
          },
        },
      });

      expect(mockFrom).toHaveBeenCalledWith('ls_webhook_events');
      expect(insertedRow()).toMatchObject({
        event_name: 'subscription_payment_success',
        ls_id: 'invoice-1',
        ls_subscription_id: '555',
        amount_cents: 2900,
        status: 'paid',
        customer_email: 'buyer@test.com',
      });
    });

    it('uses the subscription id itself when the event is the subscription', async () => {
      await service.recordWebhookEvent('subscription_created', {
        meta: { event_name: 'subscription_created' },
        data: {
          id: '777',
          type: 'subscriptions',
          attributes: { variant_id: 42, status: 'active' },
        },
      });

      expect(insertedRow()).toMatchObject({
        ls_subscription_id: '777',
        variant_id: '42',
        amount_cents: 0,
      });
    });

    it('swallows duplicate-delivery errors so Lemon Squeezy is not retried', async () => {
      mockInsert.mockResolvedValue({ error: { code: '23505', message: 'dup' } });

      await expect(
        service.recordWebhookEvent('subscription_created', {
          meta: { event_name: 'subscription_created' },
          data: { id: '777', type: 'subscriptions', attributes: {} },
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('trackFunnelEvent', () => {
    it('truncates caller-supplied strings and never throws', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      await service.trackFunnelEvent({
        event: 'plan_clicked',
        tier: 'x'.repeat(200),
        sessionId: 's'.repeat(300),
        referrer: 'r'.repeat(900),
      });

      const row = mockInsert.mock.calls[0][0];
      expect(row.tier).toHaveLength(64);
      expect(row.session_id).toHaveLength(128);
      expect(row.referrer).toHaveLength(512);
    });

    it('does not throw when the insert blows up', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('db down');
      });

      await expect(
        service.trackFunnelEvent({ event: 'pricing_viewed', sessionId: 'abc' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getUsageHistory', () => {
    it('should aggregate usage across tables', async () => {
      const mockData = [
        { credits_consumed: 5, created_at: new Date().toISOString() },
      ];

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            gte: () => ({
              gt: () => ({ data: mockData }),
            }),
          }),
        }),
      });

      const result = await service.getUsageHistory('user-1', 'weekly');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('totalUsed');
      expect(result.range).toBe('weekly');
    });

    it('should return empty when no usage data', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            gte: () => ({
              gt: () => ({ data: [] }),
            }),
          }),
        }),
      });

      const result = await service.getUsageHistory('user-1', 'daily');
      expect(result.usage).toEqual([]);
      expect(result.totalUsed).toBe(0);
    });
  });
});
