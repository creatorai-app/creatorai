import {
  Controller,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { BillingService, type LsWebhookEvent } from './billing.service';

@ApiTags('billing')
@Controller('lemonsqueezy')
export class LemonSqueezyWebhookController {
  private readonly logger = new Logger(LemonSqueezyWebhookController.name);

  constructor(private readonly billingService: BillingService) {}

  @Post('webhook')
  @ApiOperation({
    summary: 'Lemon Squeezy webhook (signed)',
    description:
      'Requires raw body + valid `x-signature`. Headers: `x-event-name` (e.g. subscription_created). Intended for Lemon Squeezy servers, not interactive Swagger testing.',
  })
  @ApiHeader({ name: 'x-signature', required: true, description: 'Lemon Squeezy HMAC signature' })
  @ApiHeader({
    name: 'x-event-name',
    required: true,
    description: 'Event type (e.g. subscription_created, subscription_updated)',
  })
  @ApiBody({
    description: 'Lemon Squeezy webhook JSON payload',
    schema: { type: 'object', additionalProperties: true },
  })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const signature = req.headers['x-signature'] as string;
    if (!signature || !req.rawBody) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Missing signature' });
    }

    try {
      const valid = this.billingService.verifyWebhookSignature(
        req.rawBody,
        signature,
      );
      if (!valid) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ error: 'Invalid signature' });
      }
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err}`);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ error: 'Invalid signature' });
    }

    const eventName = req.headers['x-event-name'] as string;
    const event: LsWebhookEvent = req.body;

    // Record before dispatching so the audit trail captures events we don't act
    // on (order_created, subscription_payment_failed) and survives a handler
    // that throws. Never throws itself.
    await this.billingService.recordWebhookEvent(eventName, event);

    try {
      switch (eventName) {
        case 'subscription_created':
          await this.billingService.handleSubscriptionCreated(event);
          break;
        case 'subscription_updated':
          await this.billingService.handleSubscriptionUpdated(event);
          break;
        case 'subscription_cancelled':
          await this.billingService.handleSubscriptionCancelled(event);
          break;
        case 'subscription_expired':
          await this.billingService.handleSubscriptionExpired(event);
          break;
        case 'subscription_payment_success':
          await this.billingService.handleSubscriptionPaymentSuccess(event);
          break;
        case 'order_refunded':
        case 'subscription_payment_refunded':
          await this.billingService.handleOrderRefunded(event);
          break;
        default:
          this.logger.log(`Unhandled event: ${eventName}`);
      }
    } catch (err) {
      this.logger.error(`Webhook handler error: ${err}`);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'Handler failed' });
    }

    return res.status(HttpStatus.OK).json({ received: true });
  }
}
