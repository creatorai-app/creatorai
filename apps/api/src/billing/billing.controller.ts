import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Query,
  UseGuards,
  UnauthorizedException,
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
