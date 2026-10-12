import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException, PayloadTooLargeException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseService } from '../supabase/supabase.service';
import {
  type CreateSubtitleInput,
  type UpdateSubtitleInput,
  type UpdateSubtitleByIdInput,
  type SignUploadInput,
  type FinalizeUploadInput,
  type BurnSubtitleInput,
  type SubtitleFromDubInput,
  hasEnoughCredits,
  getMinimumCreditsForSubtitleRequest,
  SUBTITLE_CREDIT_MULTIPLIER,
  SUBTITLE_AUTO_DETECT,
  SUBTITLE_NO_TRANSLATION,
  SUBTITLE_CANCEL_PREFIX,
  convertJsonToSrt,
  subtitleUploadLimitBytes,
  subtitleMaxDurationSeconds,
  formatUploadLimit,
  dubLanguageLabel,
} from '@repo/validation';
import {
  getMimeTypeFromUrl,
  configureFFmpeg,
  streamVideoToFile,
  getSignedUploadUrl,
  gcsPublicUrl,
  gcsUri,
  gcsObjectMetadata,
  deleteGcsObject,
  getDubbingBucketName,
} from '../utils';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

@Injectable()
export class SubtitleService {
  private readonly logger = new Logger(SubtitleService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    @InjectQueue('subtitle') private readonly queue: Queue,
  ) {}

  private async logErrorToDB(message: string, subtitleId: string) {
    if (!subtitleId) return;
    try {
      await this.supabaseService.getClient()
        .from("subtitle_jobs")
        .update({
          status: "error",
          error_message: message.slice(0, 5000)
        })
        .eq("id", subtitleId);
    } catch (dbError) {
      this.logger.error('Failed to record error in DB', dbError);
    }
  }

  private sanitizeFileName(value: string): string {
    return value.replace(/[^\w.\-]/g, '_');
  }

  /**
   * Queues the run and returns immediately. Generation itself is the `subtitle` worker's
   * job: a 45-minute video would otherwise hold an HTTP request open past every proxy
   * timeout between the browser and the API, with no retry and no progress.
   */
  async create(input: CreateSubtitleInput, userId: string) {
    const { subtitleId, language, targetLanguage, duration } = input;

    const { data: profileData, error: profileError } = await this.supabaseService.getClient()
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (profileError || !profileData) {
      await this.logErrorToDB('Profile not found or profile fetch failed', subtitleId);
      throw new NotFoundException('Profile not found');
    }

    const subtitleMultiplier = this.getEnvNumber(
      'SUBTITLE_CREDIT_MULTIPLIER',
      SUBTITLE_CREDIT_MULTIPLIER,
    );
    const minCredits = getMinimumCreditsForSubtitleRequest(subtitleMultiplier);
    if (!hasEnoughCredits(profileData.credits, minCredits)) {
      await this.logErrorToDB('Insufficient credits', subtitleId);
      throw new ForbiddenException('Insufficient credits. Please upgrade your plan or earn more credits.');
    }

    const { data: subtitle, error: subtitleError } = await this.supabaseService.getClient()
      .from('subtitle_jobs')
      .select('video_url, video_gs_uri, status')
      .eq('user_id', userId)
      .eq('id', subtitleId)
      .single();

    if ((subtitleError && subtitleError.code !== 'PGRST116') || !subtitle?.video_gs_uri) {
      await this.logErrorToDB('Subtitle lookup failed or video_gs_uri missing', subtitleId);
      throw new NotFoundException('Subtitle lookup error');
    }

    if (subtitle.status === 'processing') {
      throw new ConflictException('This video is already being transcribed. Please wait for it to finish.');
    }

    const sourceLanguage = language || SUBTITLE_AUTO_DETECT;
    const target = targetLanguage || SUBTITLE_NO_TRANSLATION;
    const bullJobId = `sub-${userId}-${Date.now()}`;

    const { error: queueUpdateError } = await this.supabaseService.getClient()
      .from('subtitle_jobs')
      .update({
        status: 'queued',
        job_id: bullJobId,
        language: sourceLanguage,
        target_language: target,
        duration: duration,
        error_message: null,
      })
      .eq('id', subtitleId)
      .eq('user_id', userId);

    if (queueUpdateError) {
      throw new InternalServerErrorException('Failed to queue subtitle job');
    }

    await this.queue.add(
      'generate-subtitles',
      {
        userId,
        subtitleId,
        bullJobId,
        videoGsUri: subtitle.video_gs_uri,
        mimeType: getMimeTypeFromUrl(subtitle.video_url),
        language: sourceLanguage,
        targetLanguage: target,
      },
      { jobId: bullJobId },
    );

    return { success: true, subtitleId, jobId: bullJobId };
  }

  /**
   * Cancels a queued or running job. A waiting job is removed outright; an active one is
   * flagged in Redis and the worker throws at its next checkpoint.
   */
  async cancel(jobId: string, userId: string) {
    const { data: row } = await this.supabaseService.getClient()
      .from('subtitle_jobs')
      .select('id')
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .maybeSingle();

    if (!row) throw new NotFoundException('Subtitle job not found');

    const job = await this.queue.getJob(jobId);
    if (!job) return { message: 'Job already finished' };

    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      await this.supabaseService.getClient()
        .from('subtitle_jobs')
        .update({ status: 'failed', error_message: 'Cancelled by user' })
        .eq('id', row.id);
      return { message: 'Subtitle generation cancelled' };
    }

    if (state === 'active') {
      const client = await this.queue.client;
      await client.set(`${SUBTITLE_CANCEL_PREFIX}${jobId}`, '1', 'EX', 3600);
      return { message: 'Cancellation requested' };
    }

    return { message: 'Job already finished' };
  }

  async findAll(userId: string) {
    const { data: subtitleData, error: subtitleError } = await this.supabaseService.getClient()
      .from('subtitle_jobs')
      .select("*")
      .eq("user_id", userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (subtitleError) {
      throw new InternalServerErrorException('Error fetching subtitle');
    }

    return subtitleData;
  }

  async findOne(id: string, userId: string) {
    const { data: subtitleData, error: subtitleError } = await this.supabaseService.getClient()
      .from('subtitle_jobs')
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (subtitleError) {
      if (subtitleError.code === 'PGRST116') {
        throw new NotFoundException('Subtitle not found');
      }
      throw new InternalServerErrorException('Error fetching subtitle');
    }

    return {
      success: true,
      subtitle: subtitleData
    };
  }

  async update(input: UpdateSubtitleInput, userId: string) {
    const { subtitle_json, subtitle_id } = input;

    if (!Array.isArray(subtitle_json)) {
      throw new BadRequestException('Invalid subtitle format');
    }

    const srtContent = convertJsonToSrt(subtitle_json);

    const { error: updateError } = await this.supabaseService.getClient()
      .from("subtitle_jobs")
      .update({
        subtitles_json: subtitle_json
      })
      .eq("id", subtitle_id)
      .eq("user_id", userId);

    if (updateError) {
      this.logger.error('Failed to update subtitles', updateError);
      throw new InternalServerErrorException('Failed to update subtitles');
    }

    return {
      success: true,
      message: 'Subtitles updated successfully',
      subtitles: subtitle_json,
      srt: srtContent
    };
  }

  async remove(id: string, userId: string) {
    try {
      const { data: subtitleData, error: subtitleError } = await this.supabaseService.getClient()
        .from('subtitle_jobs')
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select('video_gs_uri')
        .single();

      if (subtitleError && subtitleError.code !== 'PGRST116') {
        this.logger.error('Subtitle lookup error', subtitleError);
        throw new NotFoundException('Subtitle lookup error');
      }

      // Only a video this user uploaded for subtitles is deleted; one made from a dub
      // still belongs to the dub.
      const ownPrefix = gcsUri(this.configService, `${userId}/`);
      if (subtitleData?.video_gs_uri?.startsWith(ownPrefix)) {
        const objectName = subtitleData.video_gs_uri.slice(gcsUri(this.configService, '').length);
        await deleteGcsObject(this.configService, objectName).catch((e) =>
          this.logger.error(`Failed to delete GCS object ${objectName}`, e),
        );
      }

      return {
        success: true,
        message: 'Subtitle removed successfully',
      };

    } catch (error) {
      throw new InternalServerErrorException('Error removing subtitle');
    }

  }

  async updateSubtitles(id: string, input: UpdateSubtitleByIdInput, userId: string) {
    const { subtitle_json } = input;
    if (!Array.isArray(subtitle_json)) {
      throw new BadRequestException('Invalid subtitle format');
    }
    const srtContent = convertJsonToSrt(subtitle_json);
    const { error: updateError } = await this.supabaseService.getClient()
      .from("subtitle_jobs")
      .update({ subtitles_json: subtitle_json })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) {
      this.logger.error('Failed to update subtitles', updateError);
      throw new InternalServerErrorException('Failed to update subtitles');
    }
    return {
      success: true,
      message: 'Subtitles updated successfully',
      subtitles: subtitle_json,
      srt: srtContent
    };
  }

  /**
   * Plan-based upload limits. Starter (free) is throttled on BOTH size (100MB) and
   * duration (10 min); paid plans get 2GB and the 45-min Gemini ceiling.
   *
   * The active plan is the most-recent active subscription (same source as getBillingInfo /
   * the billing UI). `subscriptions` is the single source of truth for the current plan —
   * there is no plan column on `profiles`.
   */
  private async getUploadLimits(userId: string): Promise<{ maxBytes: number; maxDurationSeconds: number; isPaid: boolean }> {
    const { data: subscription } = await this.supabaseService.getClient()
      .from('subscriptions')
      .select('plans(price_monthly)')
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const priceMonthly = Number((subscription?.plans as { price_monthly?: number } | null)?.price_monthly ?? 0);
    const isPaid = priceMonthly > 0;

    return {
      maxBytes: subtitleUploadLimitBytes(isPaid),
      maxDurationSeconds: subtitleMaxDurationSeconds(isPaid),
      isPaid,
    };
  }

  /** Exposed so the uploader can show the correct limits and pre-validate before uploading. */
  async getUploadLimit(userId: string) {
    const { maxBytes, maxDurationSeconds } = await this.getUploadLimits(userId);
    return { success: true, maxBytes, maxDurationSeconds };
  }

  // isUpgradeable: free plans can lift the cap by upgrading; paid plans are at the
  // Gemini ceiling, so phrase the rejection as a hard maximum, not an upsell.
  private parseDuration(duration: string, maxDurationSeconds: number, isUpgradeable: boolean): number {
    const parsed = parseFloat(duration);
    if (isNaN(parsed)) {
      throw new BadRequestException('Invalid duration format');
    }
    if (parsed > maxDurationSeconds) {
      const mins = Math.round(maxDurationSeconds / 60);
      throw new BadRequestException(
        isUpgradeable
          ? `Video duration exceeds ${mins} minutes on your current plan. Please upgrade to upload longer videos.`
          : `Video duration exceeds the maximum supported length of ${mins} minutes.`,
      );
    }
    return parsed;
  }

  private uploadSizeError(maxBytes: number, isUpgradeable: boolean): PayloadTooLargeException {
    return new PayloadTooLargeException(
      isUpgradeable
        ? `This video exceeds your plan's ${formatUploadLimit(maxBytes)} upload limit. Please upgrade to upload larger videos.`
        : `This video exceeds the maximum ${formatUploadLimit(maxBytes)} upload size.`,
    );
  }

  /**
   * Step 1: issue a signed URL the browser PUTs the file straight to GCS with — the
   * API server never touches the bytes, so multi-GB uploads don't blow up its memory.
   */
  async signUpload(input: SignUploadInput, userId: string) {
    const { filename, contentType, fileSize, duration } = input;

    if (!/^video\//.test(contentType)) {
      throw new BadRequestException('Unsupported video format. Please upload a valid video file.');
    }

    // Reject oversize / over-length BEFORE issuing the URL, so a throttled plan wastes no upload.
    const { maxBytes, maxDurationSeconds, isPaid } = await this.getUploadLimits(userId);
    this.parseDuration(duration, maxDurationSeconds, !isPaid);
    if (fileSize > maxBytes) {
      throw this.uploadSizeError(maxBytes, !isPaid);
    }

    const safeOriginalName = this.sanitizeFileName(filename);
    const objectName = `${userId}/${Date.now()}_${safeOriginalName}`;

    const uploadUrl = await getSignedUploadUrl(this.configService, objectName, contentType);
    return { success: true, uploadUrl, objectName, contentType };
  }

  /**
   * Step 2: after the browser uploads, verify the object's REAL size server-side
   * (the signed URL can't enforce it), then create the job. Rejects + deletes oversize.
   */
  async finalizeUpload(input: FinalizeUploadInput, userId: string) {
    const { objectName, filename, duration, scriptId } = input;

    // Prevent finalizing someone else's object — the signed URL was scoped to this prefix.
    if (!objectName.startsWith(`${userId}/`)) {
      throw new ForbiddenException('Object does not belong to user');
    }

    const { maxBytes, maxDurationSeconds, isPaid } = await this.getUploadLimits(userId);
    const parsedDuration = this.parseDuration(duration, maxDurationSeconds, !isPaid);

    let size: number;
    try {
      ({ size } = await gcsObjectMetadata(this.configService, objectName));
    } catch {
      throw new BadRequestException('Uploaded file not found in storage');
    }

    // Re-check the REAL size against the plan limit — the signed URL can't enforce it,
    // and the size sent at sign time was unverified.
    if (size > maxBytes) {
      await deleteGcsObject(this.configService, objectName).catch(() => null);
      throw this.uploadSizeError(maxBytes, !isPaid);
    }

    const publicUrl = gcsPublicUrl(this.configService, objectName);
    const gsUri = gcsUri(this.configService, objectName);

    const { data, error: subtitleInsertError } = await this.supabaseService
      .getClient()
      .from('subtitle_jobs')
      .insert({
        user_id: userId,
        video_path: publicUrl,
        video_url: publicUrl,
        video_gs_uri: gsUri,
        duration: parsedDuration,
        filename: filename,
        script_id: scriptId || null,
      })
      .select()
      .single();

    if (subtitleInsertError) {
      await deleteGcsObject(this.configService, objectName).catch(() => null);
      this.logger.error(
        `Subtitle job creation failed after upload: userId=${userId}, message=${subtitleInsertError.message}, code=${subtitleInsertError.code ?? 'n/a'}`,
      );
      throw new InternalServerErrorException('Failed to create subtitle job');
    }

    return { success: true, subtitleId: data.id };
  }

  /**
   * A subtitle job on a finished dub's video, read from the dub's own object in GCS: no
   * upload, no copy. Asking twice for the same video returns the same job.
   */
  async createFromDub(input: SubtitleFromDubInput, userId: string) {
    const { projectId, language } = input;
    const client = this.supabaseService.getClient();

    const [{ data: project }, { data: output }] = await Promise.all([
      client.from('dubbing_projects').select('is_video, duration_seconds, media_name')
        .eq('user_id', userId).eq('project_id', projectId).maybeSingle(),
      client.from('dubbing_outputs').select('status, dubbed_url')
        .eq('user_id', userId).eq('project_id', projectId).eq('language', language).maybeSingle(),
    ]);
    if (!project || !output) throw new NotFoundException('Dub not found');
    if (!project.is_video) throw new BadRequestException('Subtitles need a video. This dub is audio only.');

    const bucket = getDubbingBucketName(this.configService);
    const bucketUrl = gcsPublicUrl(this.configService, '', bucket);
    if (output.status !== 'completed' || !output.dubbed_url?.startsWith(bucketUrl)) {
      throw new BadRequestException('This language has not finished dubbing yet.');
    }
    const objectName = output.dubbed_url.slice(bucketUrl.length);
    const gsUri = gcsUri(this.configService, objectName, bucket);

    const { data: existing } = await client.from('subtitle_jobs').select('id')
      .eq('user_id', userId).eq('video_gs_uri', gsUri).limit(1).maybeSingle();
    if (existing) return { success: true, subtitleId: existing.id };

    // The same plan caps as an upload: the dub's plan allows longer and larger clips.
    const { maxBytes, maxDurationSeconds, isPaid } = await this.getUploadLimits(userId);
    const duration = this.parseDuration(String(project.duration_seconds), maxDurationSeconds, !isPaid);
    let size: number;
    try {
      ({ size } = await gcsObjectMetadata(this.configService, objectName, bucket));
    } catch {
      throw new NotFoundException('The dubbed video is no longer available.');
    }
    if (size > maxBytes) throw this.uploadSizeError(maxBytes, !isPaid);

    const { data, error } = await client
      .from('subtitle_jobs')
      .insert({
        user_id: userId,
        video_path: output.dubbed_url,
        video_url: output.dubbed_url,
        video_gs_uri: gsUri,
        duration,
        filename: `${project.media_name || 'Dub'} (${dubLanguageLabel(language)}).mp4`,
      })
      .select('id')
      .single();
    if (error) {
      this.logger.error(`Subtitle job from dub failed: userId=${userId}, projectId=${projectId}, message=${error.message}`);
      throw new InternalServerErrorException('Failed to create subtitle job');
    }
    return { success: true, subtitleId: data.id };
  }

  /**
   * Burns subtitles into the video and returns the output file path plus a cleanup fn.
   * Returns a path (not a Buffer) so the controller can STREAM a multi-GB result back
   * instead of loading it all into RAM. Caller MUST call cleanup() when done streaming.
   */
  async burnSubtitle(input: BurnSubtitleInput): Promise<{ outputPath: string; cleanup: () => Promise<void> }> {
    const { videoUrl, subtitles } = input;

    const tmpDir = path.join(os.tmpdir(), 'video_processing');
    await fs.mkdir(tmpDir, { recursive: true });

    const videoPath = path.join(tmpDir, `input_${Date.now()}.mp4`);
    const srtPath = path.join(tmpDir, `subs_${Date.now()}.srt`);
    const outputPath = path.join(tmpDir, `output_${Date.now()}.mp4`);

    const cleanupSources = () =>
      Promise.allSettled([
        fs.unlink(videoPath).catch(() => null),
        fs.unlink(srtPath).catch(() => null),
      ]);
    const cleanup = async () => {
      await Promise.allSettled([cleanupSources(), fs.unlink(outputPath).catch(() => null)]);
    };

    try {
      // Stream the source to disk instead of buffering it — a 2GB video would OOM the server.
      await streamVideoToFile(videoUrl, videoPath);
      const srtContent = convertJsonToSrt(subtitles);
      await fs.writeFile(srtPath, srtContent, 'utf-8');

      const ffmpeg = configureFFmpeg();

      const safeSubtitlePath = srtPath
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:');

      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions(['-c:v', 'libx264', '-c:a', 'copy'])
          .videoFilter(`subtitles='${safeSubtitlePath}'`)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      });

      await cleanupSources(); // output stays until the controller streams it
      return { outputPath, cleanup };
    } catch (error) {
      await cleanup();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to burn subtitles: ${errorMessage}`);
      if (errorMessage.includes('ENOENT') || errorMessage.toLowerCase().includes('ffmpeg')) {
        throw new InternalServerErrorException(
          'Video processing dependency is missing (FFmpeg). Please contact support or try again later.',
        );
      }
      throw new InternalServerErrorException('Failed to process video with subtitles');
    }
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
