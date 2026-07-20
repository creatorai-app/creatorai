import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import { RolesGuard, Roles } from '../guards/roles.guard';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';
import {
  EmailCampaignService,
  SegmentFilter,
} from './email-campaign.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class EmailCampaignController {
  constructor(private readonly service: EmailCampaignService) {}

  private getUserId(req: AuthRequest): string {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }

  @Get('email-templates')
  @ApiOperation({ summary: 'Active email templates, optionally by category' })
  getTemplates(@Query('category') category?: string) {
    return this.service.getTemplates(category);
  }

  @Post('email-templates')
  @ApiOperation({ summary: 'Create a new template' })
  createTemplate(
    @Body()
    body: {
      category: string;
      name?: string;
      subject: string;
      html: string;
      defaultFromAddress?: string;
    },
  ) {
    return this.service.createTemplate(body);
  }

  @Put('email-templates/:id')
  @ApiOperation({ summary: 'Update a template subject/html' })
  updateTemplate(
    @Param('id') id: string,
    @Body() body: { subject?: string; html?: string },
  ) {
    return this.service.updateTemplate(id, body);
  }

  @Get('email-from-addresses')
  @ApiOperation({ summary: 'Active from-address pool for the compose dropdown' })
  getFromAddresses() {
    return this.service.getFromAddresses();
  }

  @Post('email-campaigns/preview-recipients')
  @ApiOperation({ summary: 'Full recipient records matching a segment filter' })
  previewRecipients(@Body() body: { segmentFilter?: SegmentFilter }) {
    return this.service.getUsersBySegment(body.segmentFilter ?? {});
  }

  @Post('email-campaigns/send')
  @ApiOperation({ summary: 'Enqueue a personalized bulk send to a confirmed list' })
  send(
    @Req() req: AuthRequest,
    @Body()
    body: {
      templateId: string;
      fromAddress: string;
      recipientIds: string[];
      subject?: string;
      html?: string;
      edited?: boolean;
      segmentFilter?: SegmentFilter;
    },
  ) {
    return this.service.sendCampaign({
      ...body,
      sentBy: this.getUserId(req),
    });
  }

  @Get('email-campaigns/history')
  @ApiOperation({ summary: 'Paginated send history' })
  getHistory(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.getHistory(Number(page) || 1, Number(limit) || 20);
  }

  // Declared after /history so the static route wins over :id.
  @Get('email-campaigns/:id')
  @ApiOperation({ summary: 'Full details of one campaign send' })
  getCampaign(@Param('id') id: string) {
    return this.service.getCampaign(id);
  }
}
