import { Controller, Post, Body, Get, Delete, Param, Query, UseGuards, Req, Sse } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Observable } from 'rxjs';
import { DubbingService } from './dubbing.service';
import {
  SignDubUploadSchema,
  CreateDubSchema,
  type SignDubUploadInput,
  type CreateDubInput,
} from '@repo/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createJobSSE } from '../common/sse';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';

@ApiTags('dubbing')
@Controller('dubbing')
export class DubbingController {
  constructor(
    private readonly service: DubbingService,
    @InjectQueue('dubbing') private readonly queue: Queue,
  ) {}

  @Get('access')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether the user may dub (Pro/Business/Scale)' })
  async access(@Req() req: AuthRequest) {
    return this.service.getAccess(req.user!.id);
  }

  @Post('sign-upload')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a signed URL to upload source media to GCS',
    description: 'Plan-gated (paid plans only). The browser PUTs the file to the returned uploadUrl, then calls POST /dubbing with the objectName.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['filename', 'contentType', 'fileSize', 'isVideo', 'durationSeconds'],
      properties: {
        filename: { type: 'string', maxLength: 200 },
        contentType: { type: 'string', example: 'audio/mpeg', description: 'audio/* or video/*' },
        fileSize: { type: 'integer', description: 'bytes; max 500MB' },
        isVideo: { type: 'boolean' },
        durationSeconds: { type: 'number', description: 'media duration; drives credit cost' },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ success, uploadUrl, objectName, contentType }' })
  @ApiResponse({ status: 403, description: 'Free (Starter) plan or insufficient credits' })
  async signUpload(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(SignDubUploadSchema)) body: SignDubUploadInput,
  ) {
    return this.service.signUpload(body, req.user!.id);
  }

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a dubbing job from an uploaded object',
    description: 'Verifies the GCS object, prechecks credits, inserts the project row and enqueues the worker. Follow progress via SSE /dubbing/status/{jobId}.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['objectName', 'targetLanguage', 'isVideo', 'mediaName', 'durationSeconds'],
      properties: {
        objectName: { type: 'string', description: 'objectName returned by sign-upload' },
        targetLanguage: { type: 'string', example: 'es', description: 'ISO code from supportedLanguages' },
        isVideo: { type: 'boolean' },
        mediaName: { type: 'string', maxLength: 100 },
        durationSeconds: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ projectId, jobId }' })
  @ApiResponse({ status: 403, description: 'Free plan, foreign object, or insufficient credits' })
  async create(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(CreateDubSchema)) body: CreateDubInput,
  ) {
    return this.service.createDub(body, req.user!.id);
  }

  @Post(':id/regenerate')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Regenerate a dub from its original media',
    description: 'Re-runs the same source (reused from GCS) with the same target language, resetting the project in place and enqueuing a fresh job. Charges credits like a new dub.',
  })
  @ApiParam({ name: 'id', description: 'dubbing project_id' })
  @ApiResponse({ status: 201, description: '{ projectId, jobId }' })
  @ApiResponse({ status: 400, description: 'Original media no longer available' })
  @ApiResponse({ status: 403, description: 'Free plan or insufficient credits' })
  async regenerate(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.regenerateDub(req.user!.id, id);
  }

  @Post('stop/:jobId')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Stop or cancel a dubbing job',
    description: 'Queued jobs are removed immediately; active jobs are flagged and abort between pipeline stages (no credits charged).',
  })
  @ApiParam({ name: 'jobId', description: 'BullMQ job id returned by POST /dubbing' })
  @ApiResponse({ status: 201, description: '{ message }' })
  async stop(@Req() req: AuthRequest, @Param('jobId') jobId: string) {
    return this.service.stopDub(req.user!.id, jobId);
  }

  @Sse('status/:jobId')
  @ApiOperation({
    summary: 'SSE: dubbing job status',
    description: 'No Bearer required on this route in the current implementation.',
  })
  @ApiParam({ name: 'jobId' })
  status(@Param('jobId') jobId: string, @Req() req: AuthRequest): Observable<MessageEvent> {
    return createJobSSE({
      queue: this.queue,
      jobId,
      req,
      getMessages: {
        active: 'Dubbing in progress...',
        completed: 'Dubbing complete!',
        failed: 'Dubbing failed',
      },
      extractResult: (job) => ({ dubbedUrl: job.returnvalue?.dubbedUrl }),
    });
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List dubbing projects for user' })
  @ApiQuery({ name: 'page_size', required: false, schema: { default: 100, type: 'integer' } })
  async list(@Req() req: AuthRequest, @Query('page_size') pageSize: number = 100) {
    return this.service.listDubs(req.user!.id, pageSize);
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dubbing project' })
  @ApiParam({ name: 'id' })
  async get(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getDub(req.user!.id, id);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete dubbing project' })
  @ApiParam({ name: 'id' })
  async delete(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.service.deleteDub(req.user!.id, id);
    return { status: 'ok' };
  }
}
