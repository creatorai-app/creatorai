import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import type { IdeationIdea } from '@repo/validation';
import { SupabaseService } from '../supabase/supabase.service';
import type { FreeIdea, FreeScript } from './free-tools.service';

/**
 * Keeps anonymous /tools generations, and hands them to the account created
 * afterwards.
 *
 * Two halves:
 *   record() — called after every free generation, best-effort. A DB hiccup
 *              must never turn a working generator into an error page, so a
 *              failed write is logged and swallowed; the visitor still sees
 *              their result, they just cannot claim it later.
 *   claim()  — called once from the dashboard after signup. Copies the stored
 *              run into the real feature table so the user lands on a normal
 *              record with normal history, not a special "imported" one.
 *
 * The session id is the authorization: run ids travel in URLs, session ids do
 * not, so a claim must present both.
 */

export type FreeToolName = 'script' | 'idea' | 'story';

/** Where each tool's run materializes, and what the dashboard route is. */
const TARGET: Record<FreeToolName, { table: string; route: string }> = {
  script: { table: 'scripts', route: '/dashboard/scripts' },
  idea: { table: 'ideation_jobs', route: '/dashboard/research' },
  story: { table: 'story_builder_jobs', route: '/dashboard/story-builder' },
};

export interface ClaimResult {
  tool: FreeToolName;
  recordId: string;
  /** Ready-to-push dashboard path for the materialized record. */
  redirectTo: string;
}

@Injectable()
export class FreeToolRunsService {
  private readonly logger = new Logger(FreeToolRunsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    return this.supabaseService.getClient();
  }

  /**
   * Store one anonymous run. Returns the run id, or null when the write failed.
   * Never throws: the generation already succeeded and the visitor is looking
   * at it.
   */
  async record(
    sessionId: string,
    tool: FreeToolName,
    input: Record<string, unknown>,
    output: unknown,
  ): Promise<string | null> {
    try {
      const { data, error } = await this.db
        .from('free_tool_runs')
        .insert({ session_id: sessionId, tool, input, output })
        .select('id')
        .single();

      if (error || !data) {
        this.logger.warn(`free_tool_runs insert failed (${tool}): ${error?.message ?? 'no row'}`);
        return null;
      }
      return data.id as string;
    } catch (error) {
      this.logger.warn(`free_tool_runs insert threw (${tool}): ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Materialize one stored run into the real feature table for `userId`.
   *
   * Idempotent: a run already claimed by this user returns the record it
   * created rather than inserting a second copy, so a refresh of the dashboard
   * URL that carries `?freeRun=` is harmless.
   */
  async claim(runId: string, sessionId: string, userId: string): Promise<ClaimResult> {
    const { data: run, error } = await this.db
      .from('free_tool_runs')
      .select('id, tool, input, output, claimed_by, claimed_record_id')
      .eq('id', runId)
      .eq('session_id', sessionId)
      .maybeSingle();

    // Same 404 for "no such run" and "wrong session": a claim endpoint that
    // distinguishes them is a probe for which run ids exist.
    if (error || !run) throw new NotFoundException('That free result is no longer available.');

    const tool = run.tool as FreeToolName;

    if (run.claimed_by) {
      if (run.claimed_by !== userId) {
        throw new NotFoundException('That free result is no longer available.');
      }
      return this.toResult(tool, run.claimed_record_id as string);
    }

    const recordId = await this.materialize(tool, userId, run.input ?? {}, run.output ?? {});

    const { error: markError } = await this.db
      .from('free_tool_runs')
      .update({
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        claimed_record_id: recordId,
      })
      .eq('id', runId)
      // Only claim a run nobody else has taken in the meantime.
      .is('claimed_by', null);

    if (markError) {
      // The real row exists and is the thing the user asked for, so this is a
      // bookkeeping failure, not a user-facing one. Worst case the run stays
      // claimable and a second claim inserts a duplicate they can delete.
      this.logger.warn(`free_tool_runs claim mark failed for ${runId}: ${markError.message}`);
    }

    return this.toResult(tool, recordId);
  }

  private toResult(tool: FreeToolName, recordId: string): ClaimResult {
    return { tool, recordId, redirectTo: `${TARGET[tool].route}/${recordId}` };
  }

  private async materialize(
    tool: FreeToolName,
    userId: string,
    input: Record<string, any>,
    output: any,
  ): Promise<string> {
    const now = new Date().toISOString();
    // Every claimed row is free by definition: the generation was already paid
    // for by us, not by the user's credits.
    const row =
      tool === 'script'
        ? scriptRow(userId, input, output as FreeScript, now)
        : tool === 'idea'
          ? ideaRow(userId, input, output as FreeIdea, now)
          : storyRow(userId, input, output, now);

    const { data, error } = await this.db
      .from(TARGET[tool].table)
      .insert(row)
      .select('id')
      .single();

    if (error || !data) {
      this.logger.error(`${TARGET[tool].table} insert failed on claim: ${error?.message}`);
      throw new InternalServerErrorException('Could not save that result to your account.');
    }
    return data.id as string;
  }

}

export function scriptRow(userId: string, input: Record<string, any>, output: FreeScript, now: string) {
  return {
    user_id: userId,
    title: output?.title || input.topic || 'Untitled script',
    content: output?.script ?? '',
    prompt: input.topic ?? '',
    tone: input.tone ?? 'conversational',
    language: 'English',
    duration: input.duration ?? 180,
    include_storytelling: !!input.includeStorytelling,
    include_timestamps: !!input.includeTimestamps,
    status: 'completed',
    credits_consumed: 0,
    created_at: now,
    updated_at: now,
  };
}

/**
 * The free generator returns one idea with a slightly narrower shape than the
 * paid one (no channel to derive coreTopic, reference signals or momentum
 * from). Fill those in rather than leaving them undefined: IdeaCard renders
 * `trendMomentum` as text and would print an empty badge.
 */
export function ideaRow(userId: string, input: Record<string, any>, output: FreeIdea, now: string) {
  const idea: IdeationIdea = {
    id: `free-${Date.now()}`,
    title: output?.title ?? '',
    titleVariations: output?.titleVariations ?? [],
    coreTopic: input.niche ?? output?.title ?? '',
    uniqueAngle: output?.uniqueAngle ?? '',
    whyItWorks: output?.whyItWorks ?? '',
    hookAngle: output?.hookAngle ?? '',
    targetKeywords: output?.targetKeywords ?? [],
    suggestedFormat: output?.suggestedFormat ?? '',
    talkingPoints: output?.talkingPoints ?? [],
    referenceSignals: [],
    searchIntentSummary: '',
    opportunityScore: output?.opportunityScore ?? 0,
    trendMomentum: 'stable',
  };

  return {
    user_id: userId,
    niche_focus: input.niche ?? null,
    context: input.audience || null,
    idea_count: 1,
    auto_mode: false,
    status: 'completed',
    credits_consumed: 0,
    // trendSnapshot and channelFit are deliberately absent: both need a
    // connected channel, and the dashboard already guards on them.
    result: { ideas: [idea], metadata: { generatedAt: now, creditsConsumed: 0, totalTokens: 0 } },
    created_at: now,
    updated_at: now,
  };
}

export function storyRow(userId: string, input: Record<string, any>, output: any, now: string) {
  return {
    user_id: userId,
    video_topic: input.videoTopic ?? '',
    target_audience: input.targetAudience || null,
    audience_level: input.audienceLevel ?? 'general',
    video_duration: input.videoDuration ?? 'medium',
    content_type: input.contentType ?? 'tutorial',
    story_mode: input.storyMode ?? 'conversational',
    status: 'completed',
    credits_consumed: 0,
    result: output,
    created_at: now,
    updated_at: now,
  };
}
