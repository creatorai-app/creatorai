import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AffiliateService } from './affiliate.service';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import { RolesGuard, Roles } from '../guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateAffiliateLinkSchema,
  PayoutMethodSchema,
  RequestWithdrawalSchema,
  CreatePromoCodeSchema,
  UpdatePromoCodeSchema,
  UpdateWithdrawalSchema,
  type CreateAffiliateLinkInput,
  type PayoutMethodInput,
  type RequestWithdrawalInput,
  type CreatePromoCodeInput,
  type UpdatePromoCodeInput,
  type UpdateWithdrawalInput,
} from '@repo/validation';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';

@ApiTags('affiliate')
@ApiBearerAuth()
@Controller('affiliate')
@UseGuards(SupabaseAuthGuard)
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  private getUserId(req: AuthRequest): string {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }

  // ==================== USER ENDPOINTS ====================

  @Post('apply')
  @ApiOperation({ summary: 'Submit affiliate application' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['full_name', 'email', 'reason'],
      properties: {
        full_name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        website: { type: 'string' },
        social_media: { type: 'string' },
        audience_size: { type: 'string' },
        promotion_method: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  })
  apply(
    @Body() body: {
      full_name: string;
      email: string;
      website?: string;
      social_media?: string;
      audience_size?: string;
      promotion_method?: string;
      reason: string;
    },
    @Req() req: AuthRequest,
  ) {
    return this.affiliateService.submitRequest(this.getUserId(req), body);
  }

  @Get('status')
  @ApiOperation({ summary: 'Affiliate application status for current user' })
  getStatus(@Req() req: AuthRequest) {
    return this.affiliateService.getRequestStatus(this.getUserId(req));
  }

  // ==================== USER HUB ====================

  @Get('hub')
  @ApiOperation({ summary: 'Affiliate hub stats for current user' })
  getHub(@Req() req: AuthRequest) {
    return this.affiliateService.getHubStats(this.getUserId(req));
  }

  @Get('links')
  @ApiOperation({ summary: 'Own affiliate links' })
  getLinks(@Req() req: AuthRequest) {
    return this.affiliateService.getUserLinks(this.getUserId(req));
  }

  @Post('links')
  @ApiOperation({ summary: 'Create own affiliate link' })
  @ApiBody({ schema: { type: 'object', properties: { label: { type: 'string' }, target_url: { type: 'string' } } } })
  createLink(
    @Body(new ZodValidationPipe(CreateAffiliateLinkSchema)) body: CreateAffiliateLinkInput,
    @Req() req: AuthRequest,
  ) {
    return this.affiliateService.createUserLink(this.getUserId(req), body);
  }

  @Put('links/:id')
  @ApiOperation({ summary: 'Update own affiliate link' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  updateLink(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthRequest,
  ) {
    return this.affiliateService.updateUserLink(this.getUserId(req), id, body);
  }

  @Delete('links/:id')
  @ApiOperation({ summary: 'Delete own affiliate link' })
  @ApiParam({ name: 'id' })
  deleteLink(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.affiliateService.deleteUserLink(this.getUserId(req), id);
  }

  @Get('promo-codes')
  @ApiOperation({ summary: 'Own assigned promo codes' })
  getPromoCodes(@Req() req: AuthRequest) {
    return this.affiliateService.getUserPromoCodes(this.getUserId(req));
  }

  @Get('sales')
  @ApiOperation({ summary: 'Own commission records' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSales(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.affiliateService.getUserSales(this.getUserId(req), Number(page) || 1, Number(limit) || 20);
  }

  @Get('payout-method')
  @ApiOperation({ summary: 'Own payout method' })
  getPayoutMethod(@Req() req: AuthRequest) {
    return this.affiliateService.getPayoutMethod(this.getUserId(req));
  }

  @Put('payout-method')
  @ApiOperation({ summary: 'Save own payout method' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['method', 'details'],
      properties: {
        method: { type: 'string', enum: ['paypal', 'wise', 'bank'] },
        details: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
  })
  savePayoutMethod(
    @Body(new ZodValidationPipe(PayoutMethodSchema)) body: PayoutMethodInput,
    @Req() req: AuthRequest,
  ) {
    return this.affiliateService.upsertPayoutMethod(this.getUserId(req), body);
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Own withdrawal requests' })
  @ApiQuery({ name: 'page', required: false })
  getWithdrawals(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
  ) {
    return this.affiliateService.getUserWithdrawals(this.getUserId(req), Number(page) || 1);
  }

  @Post('withdrawals')
  @ApiOperation({ summary: 'Request a withdrawal' })
  @ApiBody({ schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number' } } } })
  requestWithdrawal(
    @Body(new ZodValidationPipe(RequestWithdrawalSchema)) body: RequestWithdrawalInput,
    @Req() req: AuthRequest,
  ) {
    return this.affiliateService.requestWithdrawal(this.getUserId(req), body.amount);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('requests')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] List affiliate applications' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.affiliateService.getRequests(
      Number(page) || 1,
      Number(limit) || 20,
      status,
    );
  }

  @Put('requests/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Approve/deny affiliate request' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['approved', 'denied', 'pending'] },
        admin_notes: { type: 'string' },
      },
    },
  })
  reviewRequest(
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'denied' | 'pending'; admin_notes?: string },
    @Req() req: AuthRequest,
  ) {
    return this.affiliateService.reviewRequest(
      id,
      this.getUserId(req),
      body.status,
      body.admin_notes,
    );
  }

  @Post('admin/create-link')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Create affiliate link for a user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code'],
      properties: {
        owner_id: { type: 'string', format: 'uuid' },
        sales_rep_id: { type: 'string', format: 'uuid' },
        code: { type: 'string' },
        label: { type: 'string' },
        target_url: { type: 'string' },
        commission_rate: { type: 'number' },
        ls_affiliate_id: { type: 'string' },
      },
    },
  })
  createLinkForRep(
    @Body() body: {
      owner_id?: string;
      sales_rep_id?: string;
      code: string;
      label?: string;
      target_url?: string;
      commission_rate?: number;
      ls_affiliate_id?: string;
    },
    @Req() req: AuthRequest,
  ) {
    return this.affiliateService.createAffiliateLinkForRep(
      this.getUserId(req),
      body,
    );
  }

  @Get('admin/promo-codes')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] List affiliate promo codes' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getAdminPromoCodes(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.affiliateService.getPromoCodes(Number(page) || 1, Number(limit) || 20);
  }

  @Post('admin/promo-codes')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Create a promo code (Lemon Squeezy discount) for a user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['owner_id', 'code', 'amount', 'amount_type'],
      properties: {
        owner_id: { type: 'string', format: 'uuid' },
        code: { type: 'string' },
        amount: { type: 'number' },
        amount_type: { type: 'string', enum: ['percent', 'fixed'] },
        commission_rate: { type: 'number' },
        label: { type: 'string' },
      },
    },
  })
  createPromoCode(@Body(new ZodValidationPipe(CreatePromoCodeSchema)) body: CreatePromoCodeInput) {
    return this.affiliateService.createPromoCode(body);
  }

  @Put('admin/promo-codes/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Update a promo code' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        commission_rate: { type: 'number' },
        label: { type: 'string' },
        is_active: { type: 'boolean' },
      },
    },
  })
  updatePromoCode(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePromoCodeSchema)) body: UpdatePromoCodeInput,
  ) {
    return this.affiliateService.updatePromoCode(id, body);
  }

  @Get('admin/ls-discounts')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] List Lemon Squeezy discounts' })
  getLsDiscounts() {
    return this.affiliateService.getLsDiscounts();
  }

  @Get('admin/withdrawals')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] List withdrawal requests' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getAdminWithdrawals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.affiliateService.getWithdrawals(Number(page) || 1, Number(limit) || 20, status);
  }

  @Put('admin/withdrawals/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Update withdrawal status' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['approved', 'paid', 'rejected'] },
        admin_notes: { type: 'string' },
      },
    },
  })
  updateWithdrawal(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWithdrawalSchema)) body: UpdateWithdrawalInput,
    @Req() req: AuthRequest,
  ) {
    return this.affiliateService.updateWithdrawal(id, this.getUserId(req), body);
  }

  @Get('admin/ls-affiliates')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] List Lemon Squeezy affiliates' })
  getLsAffiliates() {
    return this.affiliateService.getLsAffiliates();
  }

  @Get('admin/ls-signup-url')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Lemon Squeezy affiliate signup URL' })
  getLsSignupUrl() {
    return this.affiliateService.getLsAffiliateSignupUrl();
  }
}
