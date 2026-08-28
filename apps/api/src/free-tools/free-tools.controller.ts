import { Controller, Post, Body, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { allowRequest, getClientIp } from '../common/rate-limit';
import { SCRIPT_TONES } from '@repo/validation';
import { FreeToolsService } from './free-tools.service';

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

export const IdeaSchema = z.object({
  niche: z.string().trim().min(3, 'Tell us the topic or niche').max(200),
  audience: z.string().trim().max(200).optional().or(z.literal('')),
});
type IdeaInput = z.infer<typeof IdeaSchema>;

export const ScriptSchema = z.object({
  topic: z.string().trim().min(3, 'Tell us what the video is about').max(500),
  tone: z.enum(SCRIPT_TONES).default('conversational'),
  // Capped well under the paid feature's range: the free sample proves quality,
  // it is not a way to get a 20-minute script without an account.
  duration: z.coerce.number().int().min(60).max(300).default(180),
});
type ScriptInput = z.infer<typeof ScriptSchema>;

@ApiTags('free-tools')
@Controller('free-tools')
export class FreeToolsController {
  constructor(private readonly freeToolsService: FreeToolsService) {}

  @Post('idea')
  @ApiOperation({
    summary: 'Generate one YouTube video idea (anonymous, free)',
    description: 'Powers /tools/youtube-video-ideas-generator. Rate limited per IP.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['niche'],
      properties: {
        niche: { type: 'string', example: 'home espresso for beginners' },
        audience: { type: 'string', example: 'people who just bought their first machine' },
      },
    },
  })
  async idea(@Body(new ZodValidationPipe(IdeaSchema)) body: IdeaInput, @Req() req: Request) {
    rateLimitOrThrow(req);
    return this.freeToolsService.generateIdea(body.niche, body.audience || undefined);
  }

  @Post('script')
  @ApiOperation({
    summary: 'Generate one YouTube script (anonymous, free)',
    description: 'Powers /tools/youtube-script-generator. Rate limited per IP.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['topic'],
      properties: {
        topic: { type: 'string', example: 'why your espresso tastes sour' },
        tone: { type: 'string', enum: [...SCRIPT_TONES], default: 'conversational' },
        duration: { type: 'integer', minimum: 60, maximum: 300, default: 180 },
      },
    },
  })
  async script(@Body(new ZodValidationPipe(ScriptSchema)) body: ScriptInput, @Req() req: Request) {
    rateLimitOrThrow(req);
    return this.freeToolsService.generateScript(body.topic, body.tone, body.duration);
  }
}
