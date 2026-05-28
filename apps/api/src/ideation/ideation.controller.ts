import {
  Controller, Post, Get, Delete,
  Body, Req, Res, Param, Sse, UseGuards, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Observable } from 'rxjs';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';
import { getUserId } from '../common/get-user-id';
import { createJobSSE } from '../common/sse';
import { IdeationService } from './ideation.service';

@ApiTags('ideation')
@Controller('ideation')
export class IdeationController {
  constructor(
    @InjectQueue('ideation') private readonly queue: Queue,
    private readonly ideationService: IdeationService,
  ) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Queue ideation job' })
  async create(
    @Body() body: { context?: string; nicheFocus?: string; ideaCount?: number; autoMode?: boolean },
    @Req() req: AuthRequest,
  ) {
    return this.ideationService.createJob(getUserId(req), body);
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List ideation jobs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async list(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.ideationService.listJobs(getUserId(req), p, l);
  }

  @Get('profile-status')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profile readiness for ideation' })
  async profileStatus(@Req() req: AuthRequest) {
    return this.ideationService.getProfileStatus(getUserId(req));
  }

  @Sse('status/:jobId')
  @ApiOperation({
    summary: 'SSE: ideation job status',
    description: 'Streams job state until completed or failed. No Bearer required by this route.',
  })
  @ApiParam({ name: 'jobId', description: 'BullMQ job id returned from POST /ideation' })
  status(@Param('jobId') jobId: string, @Req() req: AuthRequest): Observable<MessageEvent> {
    return createJobSSE({
      queue: this.queue,
      jobId,
      req,
      includeLogs: true,
      getMessages: {
        active: 'Generating ideas...',
        completed: 'Ideas generated!',
        failed: 'Ideation failed',
      },
      extractResult: (job) => ({ result: job.returnvalue?.result }),
    });
  }

  @Get(':id/export/pdf')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download ideation result as PDF' })
  @ApiParam({ name: 'id' })
  async exportPdf(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const { pdfBytes, filename } = await this.ideationService.exportPdf(id, getUserId(req));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(Buffer.from(pdfBytes));
  }

  @Get(':id/export/json')
  @UseGuards(SupabaseAuthGuard)
  async exportJson(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.ideationService.exportJson(id, getUserId(req));
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ideation job by id' })
  @ApiParam({ name: 'id' })
  async getJob(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.ideationService.getJob(id, getUserId(req));
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete ideation job' })
  @ApiParam({ name: 'id' })
  async deleteJob(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.ideationService.deleteJob(id, getUserId(req));
  }
}
