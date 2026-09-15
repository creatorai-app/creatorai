import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseService } from '../supabase/supabase.service';
import {
  type CreateThumbnailInput,
  type SurpriseThumbnailPromptInput,
  hasEnoughCredits,
  THUMBNAIL_CREDIT_MULTIPLIER,
  getMinimumCreditsForThumbnailRequest,
} from '@repo/validation';
import { createGoogleAI, GEMINI_TEXT_MODEL } from '../utils/genai';

const BUCKET = 'thumbnails';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    @InjectQueue('thumbnail') private readonly queue: Queue,
  ) {}

  async createJob(
    userId: string,
    input: CreateThumbnailInput,
    referenceImage?: Express.Multer.File,
    faceImage?: Express.Multer.File,
  ) {
    const { prompt, context, ratio, generateCount, videoLink, personalized } = input;

    if (referenceImage) this.validateImageFile(referenceImage, 'Reference image');
    if (faceImage) this.validateImageFile(faceImage, 'Face image');
    if (videoLink) this.validateVideoLink(videoLink);

    // ── Check profile + credits ──
    const thumbnailMultiplier = this.getEnvNumber(
      'THUMBNAIL_CREDIT_MULTIPLIER',
      THUMBNAIL_CREDIT_MULTIPLIER,
    );
    const requiredCredits = getMinimumCreditsForThumbnailRequest(generateCount, thumbnailMultiplier);
    const { data: profile, error: profileError } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('credits, ai_trained, youtube_connected')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) throw new NotFoundException('Profile not found');
    if (!hasEnoughCredits(profile.credits, requiredCredits)) {
      throw new ForbiddenException(
        `Insufficient credits. Need ${requiredCredits}, have ${profile.credits}.`,
      );
    }

    // ── Deterministic IDs so storage paths are stable ──
    const bullJobId = `thumb-${userId}-${Date.now()}`;

    // ── Upload input resources to storage under a job-scoped path ──
    //    Path: {userId}/jobs/{bullJobId}/inputs/{type}.{ext}
    let referenceImageUrl: string | null = null;
    let faceImageUrl: string | null = null;

    if (referenceImage) {
      referenceImageUrl = await this.uploadToStorage(
        `${userId}/jobs/${bullJobId}/inputs/reference.${this.ext(referenceImage.mimetype)}`,
        referenceImage.buffer,
        referenceImage.mimetype,
      );
    }
    if (faceImage) {
      faceImageUrl = await this.uploadToStorage(
        `${userId}/jobs/${bullJobId}/inputs/face.${this.ext(faceImage.mimetype)}`,
        faceImage.buffer,
        faceImage.mimetype,
      );
    }

    const contentContext = await this.resolveSourceContext(userId, input);

    const shouldPersonalize = personalized && profile.ai_trained;

    const { data: job, error: jobError } = await this.supabaseService
      .getClient()
      .from('thumbnail_jobs')
      .insert({
        user_id: userId,
        prompt,
        status: 'queued',
        ratio,
        generate_count: generateCount,
        image_urls: [],
        reference_image_url: referenceImageUrl,
        face_image_url: faceImageUrl,
        video_link: videoLink || null,
        video_frame_url: null,
        error_message: null,
        credits_consumed: 0,
        job_id: bullJobId,
        script_id: input.scriptId || null,
        story_builder_id: input.storyBuilderId || null,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      this.logger.error(`thumbnail_jobs INSERT failed: ${jobError?.message}`, jobError);
      throw new InternalServerErrorException(
        `Failed to create thumbnail job: ${jobError?.message || 'unknown error'}`,
      );
    }

    // ── Queue BullMQ job ──
    await this.queue.add(
      'generate-thumbnail',
      {
        userId,
        thumbnailJobId: job.id,
        bullJobId,
        prompt,
        ratio,
        generateCount,
        referenceImageUrl,
        faceImageUrl,
        videoLink: videoLink || null,
        personalized: shouldPersonalize,
        contentContext,
        userContext: context || undefined,
      },
      {
        jobId: bullJobId,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return {
      id: job.id,
      jobId: bullJobId,
      status: 'queued',
      message: 'Thumbnail generation queued',
    };
  }

  async listJobs(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('thumbnail_jobs')
      .select(
        'id, user_id, prompt, status, ratio, generate_count, image_urls, ' +
        'reference_image_url, face_image_url, video_link, video_frame_url, ' +
        'error_message, credits_consumed, job_id, created_at, updated_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new InternalServerErrorException('Failed to fetch thumbnail jobs');
    return data;
  }

  async getJob(id: string, userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('thumbnail_jobs')
      .select(
        'id, user_id, prompt, status, ratio, generate_count, image_urls, ' +
        'reference_image_url, face_image_url, video_link, video_frame_url, ' +
        'error_message, credits_consumed, job_id, created_at, updated_at',
      )
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) throw new NotFoundException('Thumbnail job not found');
    return data;
  }

  async deleteJob(id: string, userId: string) {
    const job = await this.getJob(id, userId);

    // Clean up all storage files under this job's folder
    const jobFolder = `${userId}/jobs/${job.job_id}`;
    const { data: files } = await this.supabaseService
      .getClient()
      .storage.from(BUCKET)
      .list(jobFolder, { limit: 100 });

    if (files && files.length > 0) {
      // List nested folders too (inputs/, generated/)
      for (const entry of files) {
        if (entry.id === null) {
          // It's a folder — list its contents
          const { data: nested } = await this.supabaseService
            .getClient()
            .storage.from(BUCKET)
            .list(`${jobFolder}/${entry.name}`, { limit: 100 });

          if (nested && nested.length > 0) {
            const paths = nested.map((f) => `${jobFolder}/${entry.name}/${f.name}`);
            await this.supabaseService.getClient().storage.from(BUCKET).remove(paths);
          }
        } else {
          await this.supabaseService.getClient().storage.from(BUCKET).remove([`${jobFolder}/${entry.name}`]);
        }
      }
    }

    // Delete DB record
    const { error } = await this.supabaseService
      .getClient()
      .from('thumbnail_jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new InternalServerErrorException('Failed to delete thumbnail job');
    return { success: true, message: 'Thumbnail job deleted' };
  }

  /**
   * "Surprise me": one on-brand thumbnail prompt built from the creator's trained
   * style plus whatever they arrived with (a script, a blueprint, an idea, or free
   * text). Ungated on purpose — it is cheap and it is how a locked user sees the
   * feature work before the paywall on Generate.
   */
  async surprisePrompt(userId: string, input: SurpriseThumbnailPromptInput) {
    const [{ data: style }, sourceContext] = await Promise.all([
      this.supabaseService
        .getClient()
        .from('user_style')
        .select('tone, visual_style, themes, humor_style, narrative_structure')
        .eq('user_id', userId)
        .maybeSingle(),
      this.resolveSourceContext(userId, input),
    ]);

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

    const brief = [sourceContext, input.context?.trim()].filter(Boolean).join('\n\n');

    const system = [
      'You write a single image-generation prompt for a YouTube thumbnail.',
      'Return ONLY the prompt text — no preamble, no quotes, no markdown, no options list.',
      'Describe the subject, composition, colors, lighting, mood, and the short text overlay (4 words max, in quotes). Two or three sentences, under 70 words.',
      'It must read as a click-worthy thumbnail, not a stock photo: high contrast, one clear focal point, room for the text overlay.',
      brief
        ? `Base it on the video this thumbnail is for:\n${brief}`
        : 'The creator has not described a video yet, so invent a broadly appealing, visually striking concept.',
      styleLines
        ? `Align it with this creator's established style:\n${styleLines}`
        : 'The creator has no saved style yet, so keep it broadly appealing.',
    ].join('\n\n');

    try {
      const ai = await createGoogleAI(this.configService);
      const result = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: 'Give me one fresh thumbnail prompt.' }] }],
        // thinkingLevel minimal: Gemini 3 otherwise spends the whole maxOutputTokens
        // budget on thoughts and returns a truncated fragment. A one-line prompt needs none.
        config: {
          systemInstruction: system,
          temperature: 1.1,
          maxOutputTokens: 250,
          thinkingConfig: { thinkingLevel: 'minimal' },
        } as any,
      });
      const prompt = (
        (result as any)?.candidates?.[0]?.content?.parts?.[0]?.text ??
        result?.text ??
        ''
      )
        .trim()
        .replace(/^["']|["']$/g, '');
      if (!prompt) throw new Error('empty');
      return { success: true, prompt };
    } catch (e) {
      this.logger.error(`Surprise thumbnail prompt failed for user ${userId}: ${(e as Error).message}`);
      throw new InternalServerErrorException('Could not generate a prompt right now. Please try again.');
    }
  }

  /**
   * Turn whichever source the creator came from into plain-text context the model
   * can use. Shared by createJob (passed to the worker) and surprisePrompt.
   */
  private async resolveSourceContext(
    userId: string,
    { scriptId, storyBuilderId, ideationId, ideaIndex }: SurpriseThumbnailPromptInput,
  ): Promise<string | undefined> {
    if (scriptId) {
      const { data: script } = await this.supabaseService
        .getClient()
        .from('scripts')
        .select('title, content')
        .eq('id', scriptId)
        .eq('user_id', userId)
        .single();

      if (script) return `Script Title: ${script.title}\n${(script.content || '').slice(0, 500)}`;
      return undefined;
    }

    if (storyBuilderId) {
      const { data: story } = await this.supabaseService
        .getClient()
        .from('story_builder_jobs')
        .select('video_topic, result')
        .eq('id', storyBuilderId)
        .eq('user_id', userId)
        .single();

      if (!story) return undefined;
      const hook = story.result?.structuredBlueprint?.hook;
      return [
        `Story Topic: ${story.video_topic}`,
        hook?.openingLine && `Opening Line: ${hook.openingLine}`,
        hook?.curiosityStatement && `Curiosity Statement: ${hook.curiosityStatement}`,
        hook?.visualSuggestion && `Suggested Visual: ${hook.visualSuggestion}`,
        story.result?.structuredBlueprint?.climax?.biggestInsight &&
          `Biggest Insight: ${story.result.structuredBlueprint.climax.biggestInsight}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    if (ideationId && ideaIndex != null) {
      const { data: ideationJob } = await this.supabaseService
        .getClient()
        .from('ideation_jobs')
        .select('result')
        .eq('id', ideationId)
        .eq('user_id', userId)
        .single();

      const idea = ideationJob?.result?.ideas?.[ideaIndex];
      if (!idea) return undefined;
      return [
        `Title: ${idea.title}`,
        idea.coreTopic && `Core Topic: ${idea.coreTopic}`,
        idea.uniqueAngle && `Unique Angle: ${idea.uniqueAngle}`,
        idea.hookAngle && `Hook Angle: ${idea.hookAngle}`,
        idea.suggestedFormat && `Suggested Format: ${idea.suggestedFormat}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    return undefined;
  }

  // ─── Helpers ───

  private validateImageFile(file: Express.Multer.File, label: string) {
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(`${label} must be less than 10MB`);
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`${label} must be JPEG, PNG, or WebP`);
    }
  }

  private validateVideoLink(link: string) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    const driveRegex = /^(https?:\/\/)?(drive\.google\.com)\/.+$/;
    if (!youtubeRegex.test(link) && !driveRegex.test(link)) {
      throw new BadRequestException('Video link must be a valid YouTube or Google Drive URL');
    }
  }

  private async uploadToStorage(
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const { error } = await this.supabaseService
      .getClient()
      .storage.from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (error) throw new InternalServerErrorException(`Storage upload failed: ${error.message}`);

    const { data: { publicUrl } } = this.supabaseService
      .getClient()
      .storage.from(BUCKET)
      .getPublicUrl(path);

    return publicUrl;
  }

  private ext(mimetype: string): string {
    if (mimetype.includes('png')) return 'png';
    if (mimetype.includes('webp')) return 'webp';
    return 'jpg';
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
