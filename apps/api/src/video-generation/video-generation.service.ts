import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseService } from '../supabase/supabase.service';
import {
  type CreateVideoGenerationInput,
  type EditVideoGenerationInput,
  type VideoGenerationMode,
  canGenerateVideo,
  hasEnoughCredits,
  getMinimumCreditsForVideoGeneration,
  VIDEO_GENERATION_CREDIT_MULTIPLIER,
  VIDEO_GEN_CANCEL_PREFIX,
  requiredImageRange,
} from '@repo/validation';
import { createGoogleAI, GEMINI_TEXT_MODEL } from '../utils/genai';
import { deleteVideoGcsUri } from '../utils';

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    @InjectQueue('video-generation') private readonly queue: Queue,
  ) {}

  /**
   * The active plan is the most-recent active subscription (same source as
   * BillingService / the subtitle upload gate). Gate by plan NAME — video generation
   * is Pro/Business/Scale only.
   */
  private async getActivePlanName(userId: string): Promise<string | null> {
    const { data: subscription } = await this.supabaseService.getClient()
      .from('subscriptions')
      .select('plans(name)')
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (subscription?.plans as { name?: string } | null)?.name ?? null;
  }

  /** Lightweight gate check for the UI — form vs. upgrade card. */
  async getAccess(userId: string) {
    const planName = await this.getActivePlanName(userId);
    return { success: true, allowed: canGenerateVideo(planName), plan: planName };
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  /** Authoritative plan gate + credit-floor precheck shared by create and edit. */
  private async assertCanGenerate(userId: string): Promise<void> {
    const planName = await this.getActivePlanName(userId);
    if (!canGenerateVideo(planName)) {
      throw new ForbiddenException('Video generation is available on the Pro, Business and Scale plans.');
    }

    const { data: profile, error: profileError } = await this.supabaseService.getClient()
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) throw new NotFoundException('Profile not found');

    const multiplier = this.getEnvNumber('VIDEO_GENERATION_CREDIT_MULTIPLIER', VIDEO_GENERATION_CREDIT_MULTIPLIER);
    if (!hasEnoughCredits(profile.credits, getMinimumCreditsForVideoGeneration(multiplier))) {
      throw new ForbiddenException('Insufficient credits. Please upgrade your plan or earn more credits.');
    }
  }

  async createJob(userId: string, input: CreateVideoGenerationInput) {
    const { prompt, mode, aspectRatio, durationSeconds, images, scriptId } = input;

    await this.assertCanGenerate(userId);

    // Defense in depth — the schema already enforces this, but never trust a single gate.
    const { min, max } = requiredImageRange(mode);
    const imageCount = images?.length ?? 0;
    if (imageCount < min || imageCount > max) {
      throw new BadRequestException(`${mode} requires between ${min} and ${max} image(s).`);
    }

    const { data: jobRow, error: insertError } = await this.supabaseService.getClient()
      .from('video_generation_jobs')
      .insert({
        user_id: userId,
        prompt,
        mode,
        aspect_ratio: aspectRatio,
        duration_seconds: durationSeconds,
        input_image_count: imageCount,
        script_id: scriptId || null,
        status: 'queued',
      })
      .select('id')
      .single();

    if (insertError || !jobRow) {
      this.logger.error(`Failed to create video job for user ${userId}: ${insertError?.message}`);
      throw new InternalServerErrorException('Failed to create video generation job');
    }

    return this.enqueue(userId, jobRow.id, {
      prompt,
      mode,
      aspectRatio,
      durationSeconds,
      images,
    });
  }

  /**
   * Stateful edit — refine an already-generated clip via the model's
   * previous_interaction_id. The source must be a completed job that still carries its
   * Omni interaction id.
   */
  async editJob(userId: string, sourceId: string, input: EditVideoGenerationInput) {
    await this.assertCanGenerate(userId);

    const { data: source, error } = await this.supabaseService.getClient()
      .from('video_generation_jobs')
      .select('id, status, interaction_id, aspect_ratio, duration_seconds')
      .eq('id', sourceId)
      .eq('user_id', userId)
      .single();

    if (error || !source) throw new NotFoundException('Source video not found');
    if (source.status !== 'completed' || !source.interaction_id) {
      throw new BadRequestException('You can only edit a finished video.');
    }

    const { data: jobRow, error: insertError } = await this.supabaseService.getClient()
      .from('video_generation_jobs')
      .insert({
        user_id: userId,
        prompt: input.instruction,
        mode: 'edit',
        aspect_ratio: source.aspect_ratio,
        duration_seconds: source.duration_seconds,
        parent_job_id: source.id,
        status: 'queued',
      })
      .select('id')
      .single();

    if (insertError || !jobRow) {
      this.logger.error(`Failed to create edit job for user ${userId}: ${insertError?.message}`);
      throw new InternalServerErrorException('Failed to create edit job');
    }

    return this.enqueue(userId, jobRow.id, {
      prompt: input.instruction,
      mode: 'edit',
      aspectRatio: source.aspect_ratio,
      durationSeconds: source.duration_seconds,
      previousInteractionId: source.interaction_id,
    });
  }

  /** Shared enqueue + job_id back-write. */
  private async enqueue(
    userId: string,
    videoJobId: string,
    payload: {
      prompt: string;
      mode: VideoGenerationMode | 'edit';
      aspectRatio: string;
      durationSeconds: number;
      images?: CreateVideoGenerationInput['images'];
      previousInteractionId?: string;
    },
  ) {
    const bullJobId = `video-generation-${userId}-${Date.now()}`;
    await this.queue.add(
      'video-generation',
      { userId, videoJobId, bullJobId, ...payload },
      { jobId: bullJobId },
    );

    await this.supabaseService.getClient()
      .from('video_generation_jobs')
      .update({ job_id: bullJobId })
      .eq('id', videoJobId);

    return { success: true, videoJobId, jobId: bullJobId };
  }

  /**
   * "Surprise me": generate one on-brand video prompt from the creator's trained style
   * (user_style). Falls back to a generic cinematic prompt when the user hasn't trained.
   */
  async surprisePrompt(userId: string, mode: VideoGenerationMode) {
    // No plan gate here on purpose — the prompt helper is cheap and lets locked users
    // feel the feature before they hit the paywall on Generate.
    const { data: style } = await this.supabaseService.getClient()
      .from('user_style')
      .select('tone, visual_style, themes, humor_style, narrative_structure, style_analysis')
      .eq('user_id', userId)
      .maybeSingle();

    const styleLines = style
      ? [
          style.tone && `Tone: ${style.tone}`,
          style.visual_style && `Visual style: ${style.visual_style}`,
          style.themes && `Themes: ${style.themes}`,
          style.humor_style && `Humor: ${style.humor_style}`,
          style.narrative_structure && `Narrative structure: ${style.narrative_structure}`,
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    const modeHint =
      mode === 'image_to_video'
        ? 'The creator will supply a source image; describe the motion/animation to apply to it (do not describe a scene from scratch).'
        : mode === 'reference_to_video'
          ? 'The creator will supply reference subject images; describe a short scene those subjects act out.'
          : 'Describe a self-contained cinematic scene from scratch.';

    const system = [
      'You write a single prompt for an AI video generator (Gemini Omni Flash) that makes short cinematic clips (<=10 seconds, with audio).',
      'Return ONLY the prompt text — no preamble, no quotes, no markdown, no options list.',
      'Make it vivid and shootable: subject, setting, camera movement, lighting, mood. One or two sentences, under 60 words.',
      modeHint,
      styleLines
        ? `Align it with this creator's established style:\n${styleLines}`
        : 'The creator has no saved style yet, so make it broadly appealing and visually striking.',
    ].join('\n\n');

    try {
      const ai = await createGoogleAI(this.configService);
      const result = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: 'Give me one fresh, surprising video prompt idea.' }] }],
        config: { systemInstruction: system, temperature: 1.1, maxOutputTokens: 200 } as any,
      });
      const prompt =
        ((result as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? result?.text ?? '')
          .trim()
          .replace(/^["']|["']$/g, '');
      if (!prompt) throw new Error('empty');
      return { success: true, prompt };
    } catch (e) {
      this.logger.error(`Surprise prompt failed for user ${userId}: ${(e as Error).message}`);
      throw new InternalServerErrorException('Could not generate a prompt right now. Please try again.');
    }
  }

  /**
   * Cancel an in-flight generation. A job still waiting in the queue is removed outright;
   * an active one gets a Redis flag the worker checks between steps (mirrors train-ai).
   */
  async cancelJob(userId: string, bullJobId: string) {
    const job = await this.queue.getJob(bullJobId);
    if (!job || job.data?.userId !== userId) throw new NotFoundException('Job not found');

    const state = await job.getState();
    const videoJobId = job.data?.videoJobId as string | undefined;

    if (state === 'waiting' || state === 'delayed' || state === 'prioritized') {
      await job.remove();
      if (videoJobId) {
        await this.supabaseService.getClient()
          .from('video_generation_jobs')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', videoJobId)
          .eq('user_id', userId);
      }
      return { success: true, message: 'Generation cancelled' };
    }

    if (state === 'active') {
      const client = await this.queue.client;
      await client.set(`${VIDEO_GEN_CANCEL_PREFIX}${bullJobId}`, '1', 'EX', 3600);
      return { success: true, message: 'Cancellation requested' };
    }

    return { success: true, message: 'Job already finished' };
  }

  async listJobs(userId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('video_generation_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new InternalServerErrorException('Error fetching video jobs');
    return { success: true, jobs: data ?? [] };
  }

  async getJob(id: string, userId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('video_generation_jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundException('Video job not found');
      throw new InternalServerErrorException('Error fetching video job');
    }
    return { success: true, job: data };
  }

  async deleteJob(id: string, userId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('video_generation_jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('video_gs_uri')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new InternalServerErrorException('Error deleting video job');
    }

    if (data?.video_gs_uri) {
      await deleteVideoGcsUri(this.configService, data.video_gs_uri).catch((e) =>
        this.logger.error(`Failed to delete GCS video ${data.video_gs_uri}`, e),
      );
    }

    return { success: true, message: 'Video job removed successfully' };
  }
}
