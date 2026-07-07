import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateDubInput, SignDubUploadInput, DubResponse } from '@repo/validation';
import {
  canDub,
  hasEnoughCredits,
  getMinimumCreditsForDubbing,
  DUBBING_CREDIT_MULTIPLIER,
  DUBBING_CANCEL_PREFIX,
} from '@repo/validation';
import {
  getSignedUploadUrl,
  gcsObjectMetadata,
  gcsPublicUrl,
  gcsUri,
  deleteGcsObject,
  getDubbingBucketName,
} from '../utils';

// Dubbing input is usually a short clip, but a video can be large — cap generously.
const MAX_DUB_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB

// The output PUT URL is minted here (at enqueue) but used later by Modal, which only
// runs after the job leaves the queue and the clone finishes (minutes). Give it a wide
// window so a backlogged queue doesn't expire the URL before Modal uploads.
// ponytail: 2h covers the concurrency-2 queue; if backlogs ever exceed it, mint the URL
// in the worker right before the Modal call instead (needs GCS signing in the worker).
const OUTPUT_URL_TTL_MS = 2 * 60 * 60 * 1000; // 2h

/** Deterministic output object + content type, derivable from projectId alone (for cleanup). */
function dubOutput(projectId: string, isVideo: boolean): { objectName: string; contentType: string } {
  return isVideo
    ? { objectName: `dubbed/${projectId}.mp4`, contentType: 'video/mp4' }
    : { objectName: `dubbed/${projectId}.wav`, contentType: 'audio/wav' };
}

@Injectable()
export class DubbingService {
  private readonly logger = new Logger(DubbingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    @InjectQueue('dubbing') private readonly queue: Queue,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /** Dedicated dubbing bucket (GCS_DUBBING_BUCKET) — separate from subtitles. */
  private get bucket(): string {
    return getDubbingBucketName(this.configService);
  }

  /** The active plan is the most-recent active subscription (same source as BillingService). */
  private async getActivePlanName(userId: string): Promise<string | null> {
    const { data: subscription } = await this.supabase
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
    return { success: true, allowed: canDub(planName), plan: planName };
  }

  private sanitizeFileName(value: string): string {
    return value.replace(/[^\w.\-]/g, '_');
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  /**
   * Step 1: plan-gate, size-check, then issue a signed URL the browser PUTs the
   * source media straight to GCS with — the API never touches the bytes.
   */
  async signUpload(input: SignDubUploadInput, userId: string) {
    const planName = await this.getActivePlanName(userId);
    if (!canDub(planName)) {
      throw new ForbiddenException('Dubbing is available on all paid plans. Please upgrade from Starter to dub your media.');
    }

    if (input.fileSize > MAX_DUB_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(
        `File exceeds the ${Math.round(MAX_DUB_UPLOAD_BYTES / 1024 / 1024)}MB dubbing upload limit.`,
      );
    }

    const safeName = this.sanitizeFileName(input.filename);
    const objectName = `${userId}/dubbing/${Date.now()}_${safeName}`;
    const uploadUrl = await getSignedUploadUrl(this.configService, objectName, input.contentType, this.bucket);
    return { success: true, uploadUrl, objectName, contentType: input.contentType };
  }

  /**
   * Step 2: verify the uploaded object (ownership + real size), create the job row,
   * and enqueue the dubbing worker. The worker deducts the real (duration-based) cost.
   */
  async createDub(input: CreateDubInput, userId: string): Promise<{ projectId: string; jobId: string }> {
    const { objectName, targetLanguage, isVideo, mediaName, durationSeconds } = input;

    const planName = await this.getActivePlanName(userId);
    if (!canDub(planName)) {
      throw new ForbiddenException('Dubbing is available on all paid plans. Please upgrade from Starter to dub your media.');
    }

    // The signed URL was scoped to this user's prefix — refuse someone else's object.
    if (!objectName.startsWith(`${userId}/`)) {
      throw new ForbiddenException('Object does not belong to user');
    }

    let size: number;
    let contentType: string;
    try {
      ({ size, contentType } = await gcsObjectMetadata(this.configService, objectName, this.bucket));
    } catch {
      throw new BadRequestException('Uploaded file not found in storage');
    }
    if (size > MAX_DUB_UPLOAD_BYTES) {
      await deleteGcsObject(this.configService, objectName, this.bucket).catch(() => null);
      throw new PayloadTooLargeException('Uploaded file exceeds the dubbing upload limit.');
    }

    // Precheck the floor before enqueuing — the worker deducts the duration-based cost.
    const multiplier = this.getEnvNumber('DUBBING_CREDIT_MULTIPLIER', DUBBING_CREDIT_MULTIPLIER);
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();
    if (profileError || !profile) throw new NotFoundException('Profile not found');
    if (!hasEnoughCredits(profile.credits, getMinimumCreditsForDubbing(multiplier))) {
      throw new ForbiddenException('Insufficient credits. Please upgrade your plan or earn more credits.');
    }

    const publicUrl = gcsPublicUrl(this.configService, objectName, this.bucket);
    const inputGsUri = gcsUri(this.configService, objectName, this.bucket);
    const projectId = crypto.randomUUID();

    const { error: insertError } = await this.supabase.from('dubbing_projects').insert({
      project_id: projectId,
      user_id: userId,
      original_media_url: publicUrl,
      input_url: publicUrl,
      input_gs_uri: inputGsUri,
      target_language: targetLanguage,
      is_video: isVideo,
      media_name: mediaName,
      duration_seconds: durationSeconds,
      status: 'queued',
      credits_consumed: 0,
    });
    if (insertError) {
      await deleteGcsObject(this.configService, objectName, this.bucket).catch(() => null);
      this.logger.error(`Failed to create dubbing project for user ${userId}: ${insertError.message}`);
      throw new InternalServerErrorException('Failed to create dubbing project');
    }

    const output = await this.signOutputUpload(projectId, isVideo);

    const bullJobId = `dubbing-${userId}-${Date.now()}`;
    await this.queue.add(
      'dubbing',
      {
        userId,
        projectId,
        bullJobId,
        inputGsUri,
        inputUrl: publicUrl,
        mimeType: contentType,
        isVideo,
        targetLanguage,
        durationSeconds,
        ...output,
      },
      { jobId: bullJobId },
    );

    await this.supabase.from('dubbing_projects').update({ job_id: bullJobId }).eq('project_id', projectId);

    return { projectId, jobId: bullJobId };
  }

  /**
   * Mint the destination for the dubbed file: a long-lived signed PUT URL Modal uploads
   * to directly (the worker never handles the bytes), plus the public URL we'll record.
   */
  private async signOutputUpload(projectId: string, isVideo: boolean) {
    const { objectName, contentType } = dubOutput(projectId, isVideo);
    const outputPutUrl = await getSignedUploadUrl(
      this.configService,
      objectName,
      contentType,
      this.bucket,
      OUTPUT_URL_TTL_MS,
    );
    return {
      outputPutUrl,
      outputContentType: contentType,
      outputPublicUrl: gcsPublicUrl(this.configService, objectName, this.bucket),
    };
  }

  /**
   * Re-run a completed/failed dub with the SAME input — reuses the source object
   * still in GCS (no re-upload), resets the row and enqueues a fresh job in place.
   */
  async regenerateDub(userId: string, projectId: string): Promise<{ projectId: string; jobId: string }> {
    const planName = await this.getActivePlanName(userId);
    if (!canDub(planName)) {
      throw new ForbiddenException('Dubbing is available on all paid plans. Please upgrade from Starter to dub your media.');
    }

    const { data: row, error } = await this.supabase
      .from('dubbing_projects')
      .select('input_gs_uri, input_url, target_language, is_video, duration_seconds')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();
    if (error || !row) throw new NotFoundException('Dubbing project not found');
    if (!row.input_gs_uri || !row.input_url || !row.duration_seconds) {
      throw new BadRequestException('This dub is missing its source media and cannot be regenerated.');
    }

    // The stored source must still exist in GCS — and gives us its content type.
    const objectName = String(row.input_gs_uri).split('/').slice(3).join('/');
    let contentType: string;
    try {
      ({ contentType } = await gcsObjectMetadata(this.configService, objectName, this.bucket));
    } catch {
      throw new BadRequestException('The original media is no longer available. Please create a new dub.');
    }

    const multiplier = this.getEnvNumber('DUBBING_CREDIT_MULTIPLIER', DUBBING_CREDIT_MULTIPLIER);
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();
    if (profileError || !profile) throw new NotFoundException('Profile not found');
    if (!hasEnoughCredits(profile.credits, getMinimumCreditsForDubbing(multiplier))) {
      throw new ForbiddenException('Insufficient credits. Please upgrade your plan or earn more credits.');
    }

    // Reset the row in place so the same detail page reflects the new run.
    await this.supabase
      .from('dubbing_projects')
      .update({ status: 'queued', dubbed_url: null, error_message: null, credits_consumed: 0 })
      .eq('project_id', projectId)
      .eq('user_id', userId);

    const output = await this.signOutputUpload(projectId, row.is_video);

    const bullJobId = `dubbing-${userId}-${Date.now()}`;
    await this.queue.add(
      'dubbing',
      {
        userId,
        projectId,
        bullJobId,
        inputGsUri: row.input_gs_uri,
        inputUrl: row.input_url,
        mimeType: contentType,
        isVideo: row.is_video,
        targetLanguage: row.target_language,
        durationSeconds: Number(row.duration_seconds),
        ...output,
      },
      { jobId: bullJobId },
    );

    await this.supabase.from('dubbing_projects').update({ job_id: bullJobId }).eq('project_id', projectId);

    return { projectId, jobId: bullJobId };
  }

  /**
   * Mid-run cancellation (train-ai pattern): a queued job is removed outright;
   * an active one gets a Redis flag the worker checks between pipeline stages.
   */
  async stopDub(userId: string, jobId: string): Promise<{ message: string }> {
    const job = await this.queue.getJob(jobId);
    if (!job || job.data?.userId !== userId) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();

    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      // Mark the row too — otherwise it sits 'queued' forever.
      await this.supabase
        .from('dubbing_projects')
        .update({ status: 'failed', error_message: 'Cancelled by user' })
        .eq('project_id', job.data.projectId)
        .eq('user_id', userId);
      return { message: 'Dubbing cancelled' };
    }

    if (state === 'active') {
      const client = await this.queue.client;
      await client.set(`${DUBBING_CANCEL_PREFIX}${jobId}`, '1', 'EX', 3600);
      return { message: 'Cancellation requested' };
    }

    return { message: 'Job already finished' };
  }

  async listDubs(userId: string, pageSize = 100) {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(pageSize);

    if (error) throw new InternalServerErrorException('Failed to fetch dubs');
    return data;
  }

  async getDub(userId: string, projectId: string): Promise<DubResponse> {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .select('project_id, dubbed_url, original_media_url, target_language, status, credits_consumed, is_video, created_at, media_name')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();

    if (error || !data) {
      throw new BadRequestException('Dub not found or access denied');
    }

    return {
      projectId: data.project_id,
      originalMediaUrl: data.original_media_url,
      dubbedUrl: data.dubbed_url,
      status: data.status,
      creditsConsumed: data.credits_consumed,
      isVideo: data.is_video,
      createdAt: data.created_at,
      targetLanguage: data.target_language,
      mediaName: data.media_name,
    };
  }

  async deleteDub(userId: string, projectId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .delete()
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .select('input_gs_uri, is_video')
      .single();

    if (error) throw new BadRequestException('Dub not found or access denied');

    // Clean up both GCS objects: the source (input_gs_uri) and the dubbed output
    // (deterministic name from projectId + is_video).
    const objectNames = [
      data?.input_gs_uri ? String(data.input_gs_uri).split('/').slice(3).join('/') : null,
      dubOutput(projectId, Boolean(data?.is_video)).objectName,
    ].filter((n): n is string => Boolean(n));

    for (const objectName of objectNames) {
      await deleteGcsObject(this.configService, objectName, this.bucket).catch((e) =>
        this.logger.error(`Failed to delete GCS object ${objectName}`, e),
      );
    }
  }
}
