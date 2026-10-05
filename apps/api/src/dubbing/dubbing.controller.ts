import { Controller, Post, Body, Get, Delete, Param, Query, UseGuards, Req, Sse } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Observable } from 'rxjs';
import { DubbingService } from './dubbing.service';
import {
  InitDubUploadSchema,
  DubVideoPartSchema,
  DubAudioSessionSchema,
  RegenerateDubSchema,
  type InitDubUploadInput,
  type RegenerateDubInput,
  type DubVideoPartInput,
  type DubAudioSessionInput,
} from '@repo/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createJobSSE } from '../common/sse';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import { OnboardedGuard } from '../guards/onboarded.guard';
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
  @ApiOperation({ summary: 'Whether the user may dub, and the max clip length their plan allows' })
  async access(@Req() req: AuthRequest) {
    return this.service.getAccess(req.user!.id);
  }

  @Post('uploads')
  @UseGuards(SupabaseAuthGuard, OnboardedGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register a dub and open its uploads',
    description: 'Plan-gates, prices and size-checks the original file, creates the project row, and returns a GCS resumable session for the audio track plus (for a split video) a multipart upload plan for the original. Starter is capped at 500MB / 45 min per clip; paid plans at 3GB / 180 min.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['filename', 'contentType', 'fileSize', 'isVideo', 'durationSeconds', 'engine', 'targets', 'mediaName', 'fingerprint', 'audio'],
      properties: {
        filename: { type: 'string', maxLength: 200 },
        contentType: { type: 'string', example: 'video/mp4', description: 'audio/* or video/* of the original file' },
        fileSize: { type: 'integer', description: 'bytes of the original file' },
        isVideo: { type: 'boolean' },
        durationSeconds: { type: 'number', description: 'media duration; drives credit cost' },
        engine: { type: 'string', enum: ['cypher', 'elevenlabs'], description: 'cypher = Cypher (in-house dubbing), elevenlabs = ElevenLabs' },
        targets: {
          type: 'array',
          description: 'One output per language: up to 1 on Starter, 2 on Creator/Pro, 3 on Business/Scale',
          items: { type: 'object', properties: { language: { type: 'string', example: 'es' }, accent: { type: 'string', description: 'ElevenLabs Dubbing v2 dialect, e.g. british (en-GB)' } } },
        },
        mediaName: { type: 'string', maxLength: 100 },
        fingerprint: { type: 'string', description: 'name|size|lastModified, checked on resume' },
        sourceLanguage: { type: 'string', example: 'en', description: 'Language of the source. Omit to detect it. Must not be a target.' },
        voiceMode: { type: 'string', enum: ['like_me', 'balanced', 'native'], default: 'balanced', description: 'How close each cloned voice stays to the original' },
        outputFormat: {
          type: 'string',
          enum: ['mp4', 'mp3', 'wav'],
          description: 'What the dub comes back as: the video (mp4, video sources only) or the dubbed track alone. Omit for mp4 on a video, mp3 on audio. An audio-only dub of a video uploads no video.',
        },
        keyterms: {
          type: 'array',
          maxItems: 50,
          items: { type: 'string', maxLength: 50 },
          description: 'Names and terms kept as they are. At most 5 words each, none of <>{}[]\\',
        },
        audio: {
          type: 'object',
          properties: {
            contentType: { type: 'string', example: 'audio/mp4' },
            size: { type: 'integer' },
            extracted: { type: 'boolean', description: 'false when the whole file is uploaded as the audio' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ projectId, audio: { sessionUri }, video: { partSize, partCount } | null }' })
  @ApiResponse({ status: 403, description: 'No active plan or insufficient credits' })
  async initUpload(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(InitDubUploadSchema)) body: InitDubUploadInput,
  ) {
    return this.service.initUpload(body, req.user!.id, req.headers.origin);
  }

  @Get(':id/upload')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'How far the uploads got, read from GCS, for resuming' })
  @ApiParam({ name: 'id', description: 'dubbing project_id' })
  async uploadState(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getUploadState(req.user!.id, id);
  }

  @Post(':id/upload/audio-session')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Open a fresh resumable session for the audio track',
    description: 'For an expired session, or a resume that re-extracted the audio (pass its new size).',
  })
  @ApiParam({ name: 'id', description: 'dubbing project_id' })
  @ApiBody({ required: false, schema: { type: 'object', properties: { size: { type: 'integer' } } } })
  async restartAudioSession(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DubAudioSessionSchema)) body: DubAudioSessionInput,
  ) {
    return this.service.restartAudioSession(req.user!.id, id, req.headers.origin, body.size);
  }

  @Post(':id/upload/video-part')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Signed PUT URL for one part of the video upload' })
  @ApiParam({ name: 'id', description: 'dubbing project_id' })
  @ApiBody({ schema: { type: 'object', required: ['partNumber'], properties: { partNumber: { type: 'integer' } } } })
  async signVideoPart(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DubVideoPartSchema)) body: DubVideoPartInput,
  ) {
    return this.service.signVideoPart(req.user!.id, id, body.partNumber);
  }

  @Post(':id/upload/video-complete')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Assemble the uploaded video parts',
    description: 'Verifies every part, completes the multipart upload, and queues the mux if the dubbed audio was waiting on the video. Returns the new jobId in that case, else null.',
  })
  @ApiParam({ name: 'id', description: 'dubbing project_id' })
  async completeVideo(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.completeVideo(req.user!.id, id);
  }

  @Post(':id/start')
  @UseGuards(SupabaseAuthGuard, OnboardedGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start dubbing once the audio is uploaded',
    description: 'Verifies the stored audio, reserves the credits and enqueues the worker. Follow progress via SSE /dubbing/status/{jobId}.',
  })
  @ApiParam({ name: 'id', description: 'dubbing project_id' })
  @ApiResponse({ status: 201, description: '{ jobId }' })
  async start(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.startDub(req.user!.id, id);
  }

  @Post(':id/resume')
  @UseGuards(SupabaseAuthGuard, OnboardedGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retry a failed dub from where it stopped',
    description: 'Keeps the translation, finished segments and any dubbed audio. Charges each unfinished language again, since a failure refunds it.',
  })
  @ApiParam({ name: 'id', description: 'dubbing project_id' })
  async resume(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.resumeDub(req.user!.id, id);
  }

  @Post(':id/regenerate')
  @UseGuards(SupabaseAuthGuard, OnboardedGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dub the same media again with other settings',
    description: 'Reuses the media already in storage, so nothing is uploaded, and starts the new dub right away. It belongs to the original dub (regenerating a regenerated dub goes back to the original) and is charged like any dub. mp4 needs the video in storage: an audio-only dub of a video uploaded only its audio.',
  })
  @ApiParam({ name: 'id', description: 'project_id of the original dub or of any dub regenerated from it' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['engine', 'targets'],
      properties: {
        engine: { type: 'string', enum: ['cypher', 'elevenlabs'] },
        targets: {
          type: 'array',
          items: { type: 'object', properties: { language: { type: 'string', example: 'es' }, accent: { type: 'string' } } },
        },
        sourceLanguage: { type: 'string', example: 'en' },
        voiceMode: { type: 'string', enum: ['like_me', 'balanced', 'native'], default: 'balanced' },
        outputFormat: { type: 'string', enum: ['mp4', 'mp3', 'wav'] },
        keyterms: { type: 'array', maxItems: 50, items: { type: 'string', maxLength: 50 } },
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ projectId, jobId }' })
  async regenerate(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RegenerateDubSchema)) body: RegenerateDubInput,
  ) {
    return this.service.regenerateDub(req.user!.id, id, body);
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

  @Post(':id/cancel')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel a dub, whatever stage it is in',
    description: 'A queued or running job is stopped as with /stop/{jobId}. A dub waiting on its video upload stops waiting, is marked failed and refunded; its dubbed audio is kept for a retry. A dub whose upload never finished is deleted, since nothing was charged.',
  })
  @ApiParam({ name: 'id', description: 'dubbing project_id' })
  @ApiResponse({ status: 201, description: '{ message }' })
  @ApiResponse({ status: 400, description: 'The dub is not running' })
  async cancel(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.cancelDub(req.user!.id, id);
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
      // No media URLs: this route is unauthenticated, and the dub's own GET hands out
      // finished media to its owner.
      extractResult: (job) => ({ awaitingVideo: !!job.returnvalue?.awaitingVideo }),
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

  @Get(':id/group')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Every dub of one media',
    description: 'From any of its dubs: the original first, then each dub regenerated from it, oldest first.',
  })
  @ApiParam({ name: 'id' })
  async group(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getDubGroup(req.user!.id, id);
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
  @ApiOperation({
    summary: 'Delete dubbing project',
    description: 'A regenerated dub is deleted alone. The original takes every dub regenerated from it and the source media with it.',
  })
  @ApiParam({ name: 'id' })
  async delete(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.service.deleteDub(req.user!.id, id);
    return { status: 'ok' };
  }
}
