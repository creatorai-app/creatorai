import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Param,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateVideoGenerationSchema,
  type CreateVideoGenerationInput,
  EditVideoGenerationSchema,
  type EditVideoGenerationInput,
  SurpriseVideoPromptSchema,
  type SurpriseVideoPromptInput,
} from '@repo/validation';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';
import { getUserId } from '../common/get-user-id';
import type { Observable } from 'rxjs';
import { VideoGenerationService } from './video-generation.service';
import { createJobSSE } from '../common/sse';

@ApiTags('video-generation')
@Controller('video-generation')
export class VideoGenerationController {
  constructor(
    @InjectQueue('video-generation') private readonly queue: Queue,
    private readonly videoGenerationService: VideoGenerationService,
  ) { }

  @Get('access')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether the user\'s plan allows video generation (Pro/Business/Scale)' })
  async access(@Req() req: AuthRequest) {
    return this.videoGenerationService.getAccess(getUserId(req));
  }

  @Post('surprise')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate an on-brand video prompt from the creator\'s trained style' })
  async surprise(
    @Body(new ZodValidationPipe(SurpriseVideoPromptSchema)) body: SurpriseVideoPromptInput,
    @Req() req: AuthRequest,
  ) {
    return this.videoGenerationService.surprisePrompt(getUserId(req), body.mode);
  }

  @Post('generate')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Queue an Omni Flash video generation (Pro/Business/Scale plans only)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string' },
        mode: { type: 'string', enum: ['text_to_video', 'image_to_video', 'reference_to_video'], default: 'text_to_video' },
        aspectRatio: { type: 'string', enum: ['16:9', '9:16'], default: '16:9' },
        durationSeconds: { type: 'integer', enum: [4, 6, 8], default: 8 },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: { data: { type: 'string' }, mimeType: { type: 'string' } },
          },
        },
        scriptId: { type: 'string', format: 'uuid' },
      },
    },
  })
  async generate(
    @Body(new ZodValidationPipe(CreateVideoGenerationSchema)) body: CreateVideoGenerationInput,
    @Req() req: AuthRequest,
  ) {
    return this.videoGenerationService.createJob(getUserId(req), body);
  }

  @Post(':id/edit')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Statefully edit a finished video (Omni previous_interaction_id)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', required: ['instruction'], properties: { instruction: { type: 'string' } } } })
  async edit(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditVideoGenerationSchema)) body: EditVideoGenerationInput,
    @Req() req: AuthRequest,
  ) {
    return this.videoGenerationService.editJob(getUserId(req), id, body);
  }

  @Post('cancel/:jobId')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an in-progress video generation (by BullMQ job id)' })
  @ApiParam({ name: 'jobId' })
  async cancel(@Param('jobId') jobId: string, @Req() req: AuthRequest) {
    return this.videoGenerationService.cancelJob(getUserId(req), jobId);
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List video generation jobs' })
  async listJobs(@Req() req: AuthRequest) {
    return this.videoGenerationService.listJobs(getUserId(req));
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a video generation job' })
  @ApiParam({ name: 'id' })
  async getJob(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.videoGenerationService.getJob(id, getUserId(req));
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a video generation job' })
  @ApiParam({ name: 'id' })
  async deleteJob(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.videoGenerationService.deleteJob(id, getUserId(req));
  }

  @Sse('status/:jobId')
  @ApiOperation({
    summary: 'SSE: video generation job status',
    description: 'No Bearer required on this route in the current implementation.',
  })
  @ApiParam({ name: 'jobId' })
  status(@Param('jobId') jobId: string, @Req() req: AuthRequest): Observable<MessageEvent> {
    return createJobSSE({
      queue: this.queue,
      jobId,
      req,
      includeLogs: true,
      getMessages: {
        active: 'Generating video...',
        completed: 'Video generated!',
        failed: 'Generation failed',
      },
      extractResult: (job) => ({ videoUrl: job.returnvalue?.videoUrl }),
    });
  }
}
