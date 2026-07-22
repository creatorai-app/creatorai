import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List available billing plans (public)' })
  getPlans() {
    return this.billingService.getPlans();
  }

  @Post('funnel')
  @ApiOperation({
    summary: 'Record a purchase-intent funnel event (public, unauthenticated)',
    description:
      'Fired from the pricing page. checkout_started is recorded server-side by the checkout endpoint and is not accepted here.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['event', 'sessionId'],
      properties: {
        event: { type: 'string', enum: ['pricing_viewed', 'plan_clicked'] },
        tier: { type: 'string' },
        sessionId: { type: 'string' },
        referrer: { type: 'string' },
      },
    },
  })
  async trackFunnelEvent(
    @Body()
    body: { event?: string; tier?: string; sessionId?: string; referrer?: string },
  ) {
    // Unauthenticated endpoint: only ever accept the two client-side steps, so
    // a caller can't forge conversions or write arbitrary rows.
    if (
      body.event !== 'pricing_viewed' &&
      body.event !== 'plan_clicked'
    ) {
      throw new BadRequestException('Unsupported funnel event');
    }
    if (!body.sessionId) throw new BadRequestException('sessionId is required');

    await this.billingService.trackFunnelEvent({
      event: body.event,
      tier: body.tier,
      sessionId: body.sessionId,
      referrer: body.referrer,
    });
    return { tracked: true };
  }

  @Get('info')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user subscription / billing info' })
  getBillingInfo(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.billingService.getBillingInfo(userId);
  }

  @Get('usage')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usage history for the authenticated user' })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Defaults to weekly when omitted or invalid',
  })
  getUsage(
    @Req() req: AuthRequest,
    @Query('range') range?: 'daily' | 'weekly' | 'monthly',
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.billingService.getUsageHistory(
      userId,
      range && ['daily', 'weekly', 'monthly'].includes(range) ? range : 'weekly',
    );
  }

  @Post('checkout')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Lemon Squeezy checkout session' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['planId'],
      properties: {
        planId: { type: 'string' },
        affiliateCode: { type: 'string' },
        interval: {
          type: 'string',
          enum: ['monthly', 'annual'],
          description: 'Billing interval. Defaults to monthly.',
        },
        origin: {
          type: 'string',
          description:
            'Frontend origin the checkout was started from (e.g. http://localhost:3000). Used to return the user to the same origin after payment.',
        },
      },
    },
  })
  createCheckoutSession(
    @Req() req: AuthRequest,
    @Body()
    body: {
      planId: string;
      affiliateCode?: string;
      origin?: string;
      interval?: 'monthly' | 'annual';
    },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.billingService.createCheckoutSession(
      userId,
      body.planId,
      body.affiliateCode,
      body.origin,
      body.interval === 'annual' ? 'annual' : 'monthly',
    );
  }

  @Post('expiry-reminder/:id/seen')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dismiss a plan-expiry reminder (marks the modal seen)' })
  dismissExpiryReminder(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.billingService.dismissExpiryReminder(userId, id);
  }

  @Post('portal')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer billing portal URL' })
  getCustomerPortal(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.billingService.getCustomerPortalUrl(userId);
  }

  @Post('cancel')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel active subscription' })
  cancelSubscription(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.billingService.cancelActiveSubscription(userId);
  }
}
