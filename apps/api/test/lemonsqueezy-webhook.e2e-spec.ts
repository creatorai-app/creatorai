import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, it, beforeAll, afterAll, beforeEach, expect, jest } from '@jest/globals';
import request from 'supertest';
import * as crypto from 'crypto';

import { LemonSqueezyWebhookController } from '../src/billing/lemonsqueezy-webhook.controller';
import { BillingService } from '../src/billing/billing.service';
import { SupabaseService } from '../src/supabase/supabase.service';

/**
 * End-to-end over the real HTTP pipeline: raw body -> HMAC check -> event
 * dispatch. This is the only unauthenticated write path in the API that grants
 * paid plans and credits, so it is exercised through an actual request rather
 * than by calling the controller method directly - the raw-body wiring is part
 * of what makes the signature check meaningful.
 */

const SECRET = 'whsec_test';

/** A real BillingService, so signature verification is the production one. */
function realBilling() {
  return new BillingService(
    { getClient: () => ({}), getAdminClient: () => ({}) } as unknown as SupabaseService,
    { get: (k: string) => (k === 'LEMONSQUEEZY_WEBHOOK_SECRET' ? SECRET : undefined) } as ConfigService,
  );
}

const sign = (body: string) => crypto.createHmac('sha256', SECRET).update(body).digest('hex');

describe('LemonSqueezy webhook (e2e)', () => {
  let app: INestApplication;
  let billing: BillingService;
  let handlers: Record<string, jest.Mock>;
  let recordWebhookEvent: jest.Mock;

  beforeAll(async () => {
    billing = realBilling();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LemonSqueezyWebhookController],
      providers: [{ provide: BillingService, useValue: billing }],
    }).compile();

    // rawBody mirrors main.ts; without it there is nothing to verify against.
    app = module.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    recordWebhookEvent = jest.fn(async () => undefined);
    (billing as any).recordWebhookEvent = recordWebhookEvent;

    handlers = {};
    for (const name of [
      'handleSubscriptionCreated',
      'handleSubscriptionUpdated',
      'handleSubscriptionCancelled',
      'handleSubscriptionExpired',
      'handleSubscriptionPaymentSuccess',
      'handleOrderRefunded',
    ]) {
      handlers[name] = jest.fn(async () => undefined);
      (billing as any)[name] = handlers[name];
    }
  });

  function post(body: unknown, opts: { signature?: string; event?: string } = {}) {
    const raw = JSON.stringify(body);
    const req = request(app.getHttpServer())
      .post('/api/v1/lemonsqueezy/webhook')
      .set('Content-Type', 'application/json');
    if (opts.signature !== null) req.set('x-signature', opts.signature ?? sign(raw));
    if (opts.event) req.set('x-event-name', opts.event);
    return req.send(raw);
  }

  const payload = { data: { id: '1', attributes: {} } };

  describe('signature verification', () => {
    it('accepts a correctly signed payload', async () => {
      await post(payload, { event: 'subscription_created' }).expect(200).expect({ received: true });
    });

    it('rejects a request with no signature header', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/lemonsqueezy/webhook')
        .set('Content-Type', 'application/json')
        .set('x-event-name', 'subscription_created')
        .send(JSON.stringify(payload))
        .expect(400);
      expect(handlers.handleSubscriptionCreated).not.toHaveBeenCalled();
    });

    it('rejects a forged signature', async () => {
      await post(payload, { signature: sign('{}'), event: 'subscription_created' }).expect(400);
      expect(handlers.handleSubscriptionCreated).not.toHaveBeenCalled();
    });

    it('rejects a signature of the wrong length without leaking a timing comparison', async () => {
      await post(payload, { signature: 'deadbeef', event: 'subscription_created' }).expect(400);
    });

    it('rejects a body tampered with after signing', async () => {
      // The canonical replay attack: valid signature, swapped-in payload.
      const raw = JSON.stringify(payload);
      await request(app.getHttpServer())
        .post('/api/v1/lemonsqueezy/webhook')
        .set('Content-Type', 'application/json')
        .set('x-signature', sign(raw))
        .set('x-event-name', 'subscription_created')
        .send(JSON.stringify({ data: { id: '999', attributes: { upgraded: true } } }))
        .expect(400);
      expect(handlers.handleSubscriptionCreated).not.toHaveBeenCalled();
    });

    it('rejects rather than 500s when the secret is not configured', async () => {
      const original = (billing as any).configService;
      (billing as any).configService = { get: () => undefined };
      await post(payload, { event: 'subscription_created' }).expect(400);
      (billing as any).configService = original;
    });

    it('records nothing until the signature has passed', async () => {
      await post(payload, { signature: 'bad', event: 'subscription_created' });
      expect(recordWebhookEvent).not.toHaveBeenCalled();
    });
  });

  describe('event dispatch', () => {
    it.each([
      ['subscription_created', 'handleSubscriptionCreated'],
      ['subscription_updated', 'handleSubscriptionUpdated'],
      ['subscription_cancelled', 'handleSubscriptionCancelled'],
      ['subscription_expired', 'handleSubscriptionExpired'],
      ['subscription_payment_success', 'handleSubscriptionPaymentSuccess'],
      ['order_refunded', 'handleOrderRefunded'],
      ['subscription_payment_refunded', 'handleOrderRefunded'],
    ])('routes %s to %s', async (event, handler) => {
      await post(payload, { event }).expect(200);
      expect(handlers[handler]).toHaveBeenCalledTimes(1);
      for (const [name, fn] of Object.entries(handlers)) {
        if (name !== handler) expect(fn).not.toHaveBeenCalled();
      }
    });

    it('acknowledges an event it does not act on, so it is not redelivered', async () => {
      await post(payload, { event: 'order_created' }).expect(200).expect({ received: true });
      for (const fn of Object.values(handlers)) expect(fn).not.toHaveBeenCalled();
    });

    it('records every verified event, including the ones with no handler', async () => {
      await post(payload, { event: 'subscription_payment_failed' }).expect(200);
      expect(recordWebhookEvent).toHaveBeenCalledWith('subscription_payment_failed', expect.anything());
    });

    it('records the event before dispatching, so a throwing handler still leaves a trail', async () => {
      handlers.handleSubscriptionCreated.mockImplementation(async () => {
        throw new Error('db down');
      });
      await post(payload, { event: 'subscription_created' }).expect(500);
      expect(recordWebhookEvent).toHaveBeenCalled();
    });

    it('returns 500 on a handler failure so Lemon Squeezy retries the delivery', async () => {
      handlers.handleSubscriptionUpdated.mockImplementation(async () => {
        throw new Error('db down');
      });
      await post(payload, { event: 'subscription_updated' }).expect(500).expect({ error: 'Handler failed' });
    });

    it('passes the parsed body through to the handler', async () => {
      const event = { data: { id: '42', attributes: { status: 'active' } } };
      await post(event, { event: 'subscription_created' }).expect(200);
      expect(handlers.handleSubscriptionCreated).toHaveBeenCalledWith(event);
    });
  });
});
