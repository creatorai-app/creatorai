import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';
import { TrackReferralSchema, type TrackReferralInput } from '@repo/validation';

@ApiTags('referral')
@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Referral stats and code for current user' })
  getReferralData(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('User not found');
    return this.referralService.getReferralData(userId);
  }

  @Post('generate')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate referral code for current user' })
  generateReferralCode(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('User not found');
    return this.referralService.generateReferralCode(userId);
  }

  @Get('validate/:code')
  @ApiOperation({ summary: 'Check a referral code before sign-up (public, no auth)' })
  @ApiParam({ name: 'code' })
  validateReferralCode(@Param('code') code: string) {
    return this.referralService.validateReferralCode(code);
  }

  @Post('track')
  @ApiOperation({ summary: 'Track referral signup (public, no auth)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['referralCode', 'userEmail'],
      properties: {
        referralCode: { type: 'string' },
        userEmail: { type: 'string', format: 'email' },
      },
    },
  })
  trackReferral(
    @Body(new ZodValidationPipe(TrackReferralSchema)) body: TrackReferralInput,
  ) {
    return this.referralService.trackReferral(body);
  }
}
