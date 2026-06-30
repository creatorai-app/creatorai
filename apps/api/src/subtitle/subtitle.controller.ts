import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Res, UseGuards, UnauthorizedException, BadRequestException, UsePipes } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { SubtitleService } from './subtitle.service';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';
import {
  CreateSubtitleSchema,
  UpdateSubtitleSchema,
  UpdateSubtitleByIdSchema,
  SignUploadSchema,
  FinalizeUploadSchema,
  BurnSubtitleSchema,
} from '@repo/validation';
import type {
  CreateSubtitleInput,
  UpdateSubtitleInput,
  UpdateSubtitleByIdInput,
  SignUploadInput,
  FinalizeUploadInput,
  BurnSubtitleInput,
} from '@repo/validation';

@ApiTags('subtitle')
@ApiBearerAuth()
@Controller('subtitle')
@UseGuards(SupabaseAuthGuard)
export class SubtitleController {
  constructor(private readonly subtitleService: SubtitleService) { }

  @Post()
  @ApiOperation({ summary: 'Create subtitle record' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subtitleId'],
      properties: {
        subtitleId: { type: 'string' },
        language: { type: 'string' },
        targetLanguage: { type: 'string' },
        duration: { type: 'number' },
      },
    },
  })
  @UsePipes(new ZodValidationPipe(CreateSubtitleSchema))
  create(@Body() body: CreateSubtitleInput, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.subtitleService.create(body, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List subtitles for user' })
  findAll(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.subtitleService.findAll(userId);
  }


  @Get('upload/limit')
  @ApiOperation({ summary: 'Get the video upload size limit for the user\'s plan' })
  getUploadLimit(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.subtitleService.getUploadLimit(userId);
  }

  @Post('upload/sign')
  @ApiOperation({ summary: 'Get a signed URL to upload the video directly to storage' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['filename', 'contentType', 'fileSize', 'duration'],
      properties: {
        filename: { type: 'string' },
        contentType: { type: 'string' },
        fileSize: { type: 'number' },
        duration: { type: 'string' },
        scriptId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @UsePipes(new ZodValidationPipe(SignUploadSchema))
  signUpload(@Body() body: SignUploadInput, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.subtitleService.signUpload(body, userId);
  }

  @Post('upload/finalize')
  @ApiOperation({ summary: 'Create the subtitle job after the direct upload completes' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['objectName', 'filename', 'duration'],
      properties: {
        objectName: { type: 'string' },
        filename: { type: 'string' },
        duration: { type: 'string' },
        scriptId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @UsePipes(new ZodValidationPipe(FinalizeUploadSchema))
  finalizeUpload(@Body() body: FinalizeUploadInput, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.subtitleService.finalizeUpload(body, userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update subtitle JSON by subtitle_id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subtitle_json', 'subtitle_id'],
      properties: {
        subtitle_id: { type: 'string' },
        subtitle_json: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
              text: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @UsePipes(new ZodValidationPipe(UpdateSubtitleSchema))
  update(@Body() body: UpdateSubtitleInput, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.subtitleService.update(body, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subtitle by id' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.subtitleService.findOne(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subtitle' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.subtitleService.remove(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Replace subtitle lines for record id' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subtitle_json'],
      properties: {
        subtitle_json: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
              text: { type: 'string' },
            },
          },
        },
      },
    },
  })
  updateSubtitles(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSubtitleByIdSchema)) body: UpdateSubtitleByIdInput,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.subtitleService.updateSubtitles(id, body, userId);
  }

  @Post('burn')
  @ApiOperation({ summary: 'Burn subtitles into video (returns MP4 stream)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['videoUrl', 'subtitles'],
      properties: {
        videoUrl: { type: 'string', format: 'uri' },
        subtitles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
              text: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async burnSubtitle(
    @Body(new ZodValidationPipe(BurnSubtitleSchema)) body: BurnSubtitleInput,
    @Res() res: Response,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }

    let cleanup: (() => Promise<void>) | null = null;
    try {
      const { outputPath, cleanup: cleanupFn } = await this.subtitleService.burnSubtitle(body);
      cleanup = cleanupFn;

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename=video_with_subtitles.mp4');

      const stream = createReadStream(outputPath);
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).json({ error: 'Failed to stream video' });
        else res.destroy();
      });
      res.on('close', () => { void cleanup?.(); });
      stream.pipe(res);
    } catch (error) {
      await cleanup?.();
      if (!res.headersSent) {
        if (error instanceof BadRequestException) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
        }
      }
    }
  }
}
