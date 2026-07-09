import { Controller, Post, Body, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';
import { getUserId } from '../common/get-user-id';
import { HannahService, type HannahMessage } from './hannah.service';

const ChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20), // bounds prompt size -> bounds Vertex cost per request
  // Current-turn voice message (base64). ~2.8M base64 chars ≈ 2MB ≈ 60s of opus.
  audio: z
    .object({
      data: z.string().min(1).max(2_800_000),
      mimeType: z.enum(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']),
    })
    .optional(),
});
type ChatInput = z.infer<typeof ChatSchema>;

const CHAT_BODY_SCHEMA = {
  schema: {
    type: 'object' as const,
    required: ['messages'],
    properties: {
      messages: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            role: { type: 'string' as const, enum: ['user', 'assistant'] },
            content: { type: 'string' as const },
          },
        },
      },
    },
  },
};

// ponytail: in-memory sliding-window limiter — fine for a single API instance.
// Move to Redis (redis.ts is already wired) if the API scales horizontally.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

/** Pure sliding-window check. Returns true if the request is allowed (and records it). */
export function allowRequest(
  store: Map<string, number[]>,
  ip: string,
  now: number,
  windowMs = WINDOW_MS,
  max = MAX_PER_WINDOW,
): boolean {
  const recent = (store.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    store.set(ip, recent);
    return false;
  }
  recent.push(now);
  store.set(ip, recent);
  return true;
}

function rateLimitOrThrow(key: string) {
  if (!allowRequest(hits, key, Date.now())) {
    throw new HttpException('Too many messages. Please slow down a moment.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

@ApiTags('hannah')
@Controller('hannah')
export class HannahController {
  constructor(private readonly hannahService: HannahService) {}

  @Post('chat')
  @ApiOperation({
    summary: 'Chat with Hannah on the public site (anonymous)',
    description: 'Answers feature/pricing/general questions only. No user data.',
  })
  @ApiBody(CHAT_BODY_SCHEMA)
  async chat(@Body(new ZodValidationPipe(ChatSchema)) body: ChatInput, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    rateLimitOrThrow(ip);
    return this.hannahService.chat(body.messages as HannahMessage[], 'public', undefined, body.audio as { data: string; mimeType: string } | undefined);
  }

  @Post('chat/dashboard')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Chat with Hannah inside the dashboard (authenticated)',
    description: "Includes the signed-in user's account snapshot (plan, credits, activity) in Hannah's context.",
  })
  @ApiBody(CHAT_BODY_SCHEMA)
  async chatDashboard(
    @Body(new ZodValidationPipe(ChatSchema)) body: ChatInput,
    @Req() req: AuthRequest,
  ) {
    const userId = getUserId(req);
    rateLimitOrThrow(userId); // per-user, not per-IP — authed users behind one NAT don't starve each other
    return this.hannahService.chat(body.messages as HannahMessage[], 'dashboard', userId, body.audio as { data: string; mimeType: string } | undefined);
  }
}
