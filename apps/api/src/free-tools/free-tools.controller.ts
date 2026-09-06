import { Controller, Post, Body, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { allowRequest, getClientIp } from '../common/rate-limit';
import {
  SCRIPT_TONES,
  AUDIENCE_LEVELS,
  VIDEO_DURATIONS,
  CONTENT_TYPES,
  STORY_MODES,
} from '@repo/validation';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';
import { getUserId } from '../common/get-user-id';
import { FreeToolsService } from './free-tools.service';
import { FreeToolRunsService } from './free-tool-runs.service';

/**
 * Anonymous generators behind the public /tools pages. No auth, no credits, no
 * queue — one Gemini call in, one result out.
 *
 * The signup prompt on the second attempt is a client-side nudge and trivially
 * bypassed (clear localStorage, open a private window). This window is the
 * actual ceiling: generous enough that a shared office NAT or a curious visitor
 * who reloads never sees a wall, tight enough that nobody runs a content farm
 * through it. An hour rather than a minute, because the cost worth bounding
 * here is Gemini calls per visitor per day, not burst rate.
 */
export const WINDOW_MS = 60 * 60_000;
export const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

function rateLimitOrThrow(req: Request) {
  if (!allowRequest(hits, getClientIp(req), Date.now(), WINDOW_MS, MAX_PER_WINDOW)) {
    throw new HttpException(
      "You've used all the free generations for now. Create a free account to keep going: it comes with credits for every tool.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Every free generation carries the visitor's localStorage session id, so the
 * run can be stored now and handed to the account they create later.
 */
const sessionId = z.string().uuid('Invalid session');

export const IdeaSchema = z.object({
  sessionId,
  niche: z.string().trim().min(3, 'Tell us the topic or niche').max(200),
  audience: z.string().trim().max(200).optional().or(z.literal('')),
});
type IdeaInput = z.infer<typeof IdeaSchema>;

export const ScriptSchema = z.object({
  sessionId,
  topic: z.string().trim().min(3, 'Tell us what the video is about').max(500),
  tone: z.enum(SCRIPT_TONES).default('conversational'),
  // Capped well under the paid feature's range: the free sample proves quality,
  // it is not a way to get a 20-minute script without an account.
  duration: z.coerce.number().int().min(60).max(300).default(180),
  includeStorytelling: z.coerce.boolean().optional().default(false),
  includeTimestamps: z.coerce.boolean().optional().default(false),
});
type ScriptInput = z.infer<typeof ScriptSchema>;

/**
 * The free story blueprint takes the six inputs that shape the structure and
 * drops the four that only matter once there is a channel to personalize
 * against (tone, additional context, an ideation link, the personalized flag).
 */
export const StorySchema = z.object({
  sessionId,
  videoTopic: z.string().trim().min(3, 'Tell us what the video is about').max(500),
  targetAudience: z.string().trim().max(300).optional().or(z.literal('')),
  audienceLevel: z.enum(AUDIENCE_LEVELS).default('general'),
  videoDuration: z.enum(VIDEO_DURATIONS).default('medium'),
  contentType: z.enum(CONTENT_TYPES).default('tutorial'),
  storyMode: z.enum(STORY_MODES).default('conversational'),
});
type StoryInput = z.infer<typeof StorySchema>;

export const ClaimSchema = z.object({
  runId: z.string().uuid(),
  sessionId,
});
type ClaimInput = z.infer<typeof ClaimSchema>;

@ApiTags('free-tools')
@Controller('free-tools')
export class FreeToolsController {
  constructor(
    private readonly freeToolsService: FreeToolsService,
    private readonly runs: FreeToolRunsService,
  ) {}

  @Post('idea')
  @ApiOperation({
    summary: 'Generate one YouTube video idea (anonymous, free)',
    description: 'Powers /tools/free-youtube-video-ideas-generator. Rate limited per IP.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'niche'],
      properties: {
        sessionId: { type: 'string', format: 'uuid' },
        niche: { type: 'string', example: 'home espresso for beginners' },
        audience: { type: 'string', example: 'people who just bought their first machine' },
      },
    },
  })
  async idea(@Body(new ZodValidationPipe(IdeaSchema)) body: IdeaInput, @Req() req: Request) {
    rateLimitOrThrow(req);
    const { sessionId: session, ...input } = body;
    const result = await this.freeToolsService.generateIdea(body.niche, body.audience || undefined);
    const runId = await this.runs.record(session, 'idea', input, result);
    return { ...result, runId };
  }

  @Post('script')
  @ApiOperation({
    summary: 'Generate one YouTube script (anonymous, free)',
    description: 'Powers /tools/free-youtube-script-generator. Rate limited per IP.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'topic'],
      properties: {
        sessionId: { type: 'string', format: 'uuid' },
        topic: { type: 'string', example: 'why your espresso tastes sour' },
        tone: { type: 'string', enum: [...SCRIPT_TONES], default: 'conversational' },
        duration: { type: 'integer', minimum: 60, maximum: 300, default: 180 },
        includeStorytelling: { type: 'boolean', default: false },
        includeTimestamps: { type: 'boolean', default: false },
      },
    },
  })
  async script(@Body(new ZodValidationPipe(ScriptSchema)) body: ScriptInput, @Req() req: Request) {
    rateLimitOrThrow(req);
    const { sessionId: session, ...input } = body;
    const result = await this.freeToolsService.generateScript(body.topic, body.tone, body.duration, {
      storytelling: body.includeStorytelling,
      timestamps: body.includeTimestamps,
    });
    const runId = await this.runs.record(session, 'script', input, result);
    return { ...result, runId };
  }

  @Post('story')
  @ApiOperation({
    summary: 'Generate one story blueprint (anonymous, free)',
    description: 'Powers /tools/free-youtube-story-structure-generator. Rate limited per IP.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'videoTopic'],
      properties: {
        sessionId: { type: 'string', format: 'uuid' },
        videoTopic: { type: 'string', example: 'why your espresso tastes sour' },
        targetAudience: { type: 'string', example: 'people who just bought their first machine' },
        audienceLevel: { type: 'string', enum: [...AUDIENCE_LEVELS], default: 'general' },
        videoDuration: { type: 'string', enum: [...VIDEO_DURATIONS], default: 'medium' },
        contentType: { type: 'string', enum: [...CONTENT_TYPES], default: 'tutorial' },
        storyMode: { type: 'string', enum: [...STORY_MODES], default: 'conversational' },
      },
    },
  })
  async story(@Body(new ZodValidationPipe(StorySchema)) body: StoryInput, @Req() req: Request) {
    rateLimitOrThrow(req);
    const { sessionId: session, ...input } = body;
    const result = await this.freeToolsService.generateStory({
      videoTopic: body.videoTopic,
      targetAudience: body.targetAudience || undefined,
      audienceLevel: body.audienceLevel,
      videoDuration: body.videoDuration,
      contentType: body.contentType,
      storyMode: body.storyMode,
    });
    const runId = await this.runs.record(session, 'story', input, result);
    return { ...result, runId };
  }

  /**
   * Copy a stored anonymous run into the caller's account.
   *
   * SupabaseAuthGuard only, deliberately without OnboardedGuard: this runs
   * seconds after signup, when the user has neither a trained AI nor a
   * connected channel, and it spends no credits. The dashboard read routes it
   * redirects to are gated the same way.
   */
  @Post('claim')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Claim an anonymous free-tool run into the signed-in account',
    description:
      'Materializes the stored run into scripts / ideation_jobs / story_builder_jobs and returns the dashboard path for it. Idempotent per run.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['runId', 'sessionId'],
      properties: {
        runId: { type: 'string', format: 'uuid' },
        sessionId: { type: 'string', format: 'uuid' },
      },
    },
  })
  async claim(@Body(new ZodValidationPipe(ClaimSchema)) body: ClaimInput, @Req() req: AuthRequest) {
    return this.runs.claim(body.runId, body.sessionId, getUserId(req));
  }
}
