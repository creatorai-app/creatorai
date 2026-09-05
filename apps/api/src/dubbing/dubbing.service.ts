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
  dubbingMultiplierForPlan,
  calculateDubbingCreditsByDuration,
  isDubDurationAllowed,
  maxDubSecondsForPlan,
  DUBBING_CREDIT_MULTIPLIER,
  DUBBING_CANCEL_PREFIX,
} from '@repo/validation';
import {
  getSignedUploadUrl,
  gcsObjectMetadata,
  moveGcsObject,
  gcsPublicUrl,
  gcsUri,
  deleteGcsObject,
  getDubbingBucketName,
} from '../utils';

// Dubbing input is usually a short clip, but a video can be large — cap generously.
const MAX_DUB_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB

// Uploads land under this prefix and are MOVED to their permanent path only once the
// job is accepted. A user who signs an upload and walks away leaves the object here,
// where the bucket's lifecycle rule deletes it after a day — no sweeper to run.
// Provision it once (see docs/dubbing-design.md 9.1):
//   gcloud storage buckets update gs://<bucket> --lifecycle-file=lifecycle.json
const STAGING_PREFIX = 'staging/';

// A dub in one of these states has a worker (or a queue slot) attached to it: it cannot
// be regenerated or deleted without orphaning a running job and its reservation.
const IN_FLIGHT_STATUSES = ['queued', 'processing', 'cloning'];

// The output PUT URL is minted here (at enqueue) but used later by Modal, which only
// runs after the job leaves the queue and the clone finishes (minutes). Give it a wide
// window so a backlogged queue doesn't expire the URL before Modal uploads.
// ponytail: 2h covers the concurrency-2 queue; if backlogs ever exceed it, mint the URL
// in the worker right before the Modal call instead (needs GCS signing in the worker).
const OUTPUT_URL_TTL_MS = 2 * 60 * 60 * 1000; // 2h

/**
 * Deterministic output object + content type, derivable from projectId alone (for cleanup).
 *
 * Audio output is MP3, not WAV: the ElevenLabs dubbing endpoint streams back MP3 for an
 * audio source and MP4 for a video source. GCS binds Content-Type to the signed PUT URL,
 * so a mismatch here is rejected at upload time rather than failing loudly earlier.
 * Dubs completed under the previous Modal pipeline keep their .wav URLs and still play.
 */
function dubOutput(projectId: string, isVideo: boolean): { objectName: string; contentType: string } {
  return isVideo
    ? { objectName: `dubbed/${projectId}.mp4`, contentType: 'video/mp4' }
    : { objectName: `dubbed/${projectId}.mp3`, contentType: 'audio/mpeg' };
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

  /** Lightweight gate check for the UI — form vs. upgrade card, plus the length limit. */
  async getAccess(userId: string) {
    const planName = await this.getActivePlanName(userId);
    return {
      success: true,
      allowed: canDub(planName),
      plan: planName,
      maxDurationSeconds: maxDubSecondsForPlan(planName),
    };
  }

  /**
   * Every plan can dub; Starter is capped on clip LENGTH instead of being locked out.
   * `durationSeconds` is measured in the browser and therefore untrusted — this is the
   * cheap first gate, and the worker re-checks against the duration the dubbing vendor
   * reports before it spends anything.
   */
  private assertDurationAllowed(planName: string | null, durationSeconds: number): void {
    if (isDubDurationAllowed(planName, durationSeconds)) return;
    const cap = maxDubSecondsForPlan(planName);
    throw new BadRequestException(
      `On the ${planName ?? 'Starter'} plan you can dub clips up to ${cap} seconds. ` +
        `This one is ${Math.round(durationSeconds)}s — trim it, or upgrade for unlimited length.`,
    );
  }

  /**
   * Credits this dub costs at the current rate — the single place the price is computed.
   * Starter pays its own (higher) rate; the worker resolves the same rate from the plan
   * it carries in the job, so the settle can't disagree with what was reserved.
   */
  private dubCost(durationSeconds: number, planName?: string | null): number {
    const paid = this.getEnvNumber('DUBBING_CREDIT_MULTIPLIER', DUBBING_CREDIT_MULTIPLIER);
    return calculateDubbingCreditsByDuration(
      durationSeconds,
      dubbingMultiplierForPlan(planName, paid),
    );
  }

  /**
   * Reserve the dub's cost up front. Deducting at enqueue (rather than after the dub)
   * is what makes two concurrent dubs safe: `update_user_credits` refuses to go below
   * zero atomically, so the second one is rejected before ElevenLabs is ever called
   * instead of completing and then failing to bill. The worker settles the difference
   * against the vendor's own duration and refunds the whole reservation on failure.
   */
  private async reserveCredits(userId: string, credits: number): Promise<void> {
    const { error } = await this.supabase.rpc('update_user_credits', {
      user_uuid: userId,
      credit_change: -credits,
    });
    if (error) {
      throw new ForbiddenException(
        `This dub costs ${credits} credits and your balance is short. Trim the clip or upgrade your plan.`,
      );
    }
  }

  /** Give a reservation back — used when anything after the deduction fails. */
  private async refundCredits(userId: string, credits: number): Promise<void> {
    if (credits <= 0) return;
    const { error } = await this.supabase.rpc('update_user_credits', {
      user_uuid: userId,
      credit_change: credits,
    });
    if (error) {
      this.logger.error(`Failed to refund ${credits} credits to user ${userId}: ${error.message}`);
    }
  }

  /** Same cost the worker will settle — checked here so we fail before ElevenLabs runs. */
  private async assertCanAffordDub(
    userId: string,
    durationSeconds: number,
    planName?: string | null,
  ): Promise<void> {
    const required = this.dubCost(durationSeconds, planName);

    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();
    if (error || !profile) throw new NotFoundException('Profile not found');

    if (!hasEnoughCredits(profile.credits, required)) {
      throw new ForbiddenException(
        `This ${Math.ceil(durationSeconds)}s dub costs ${required} credits and you have ${profile.credits}. ` +
          'Trim the clip or upgrade your plan.',
      );
    }
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
      throw new ForbiddenException('We could not find an active plan on your account. Please refresh and try again.');
    }
    this.assertDurationAllowed(planName, input.durationSeconds);

    if (input.fileSize > MAX_DUB_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(
        `File exceeds the ${Math.round(MAX_DUB_UPLOAD_BYTES / 1024 / 1024)}MB dubbing upload limit.`,
      );
    }

    // Check the balance BEFORE the browser pushes up to 500MB — being told the dub is
    // unaffordable is much cheaper before the upload than after it.
    await this.assertCanAffordDub(userId, input.durationSeconds, planName);

    const safeName = this.sanitizeFileName(input.filename);
    const objectName = `${STAGING_PREFIX}${userId}/dubbing/${Date.now()}_${safeName}`;
    const uploadUrl = await getSignedUploadUrl(this.configService, objectName, input.contentType, this.bucket);
    return { success: true, uploadUrl, objectName, contentType: input.contentType };
  }

  /**
   * Step 2: verify the uploaded object (ownership + real size), reserve the credits,
   * create the job row and enqueue the worker. The worker settles the reservation
   * against the vendor's own duration and refunds it in full if the dub never lands.
   */
  async createDub(input: CreateDubInput, userId: string): Promise<{ projectId: string; jobId: string }> {
    const { objectName, targetLanguage, targetAccent, isVideo, mediaName, durationSeconds } = input;

    const planName = await this.getActivePlanName(userId);
    if (!canDub(planName)) {
      throw new ForbiddenException('We could not find an active plan on your account. Please refresh and try again.');
    }
    this.assertDurationAllowed(planName, durationSeconds);

    // The signed URL was scoped to this user's staging prefix — refuse someone else's object.
    if (!objectName.startsWith(`${STAGING_PREFIX}${userId}/`)) {
      throw new ForbiddenException('Object does not belong to user');
    }

    let size: number;
    let contentType: string;
    try {
      ({ size, contentType } = await gcsObjectMetadata(this.configService, objectName, this.bucket));
    } catch {
      throw new BadRequestException('Uploaded file not found in storage');
    }

    // From here on the staged object is ours to clean up: every failure path below
    // deletes it, so a rejected dub never leaves 500MB behind.
    const discardUpload = () => deleteGcsObject(this.configService, objectName, this.bucket).catch(() => null);

    if (size > MAX_DUB_UPLOAD_BYTES) {
      await discardUpload();
      throw new PayloadTooLargeException('Uploaded file exceeds the dubbing upload limit.');
    }

    // Precheck the FULL duration-based cost, not just a one-second floor, so the user
    // gets a clear message rather than the bare "balance is short" from the reservation.
    try {
      await this.assertCanAffordDub(userId, durationSeconds, planName);
    } catch (error) {
      await discardUpload();
      throw error;
    }

    // Promote the staged object to its permanent path. Anything still in staging is,
    // by definition, an upload nobody claimed.
    const finalObject = objectName.slice(STAGING_PREFIX.length);
    try {
      await moveGcsObject(this.configService, objectName, finalObject, this.bucket);
    } catch (error: any) {
      await discardUpload();
      this.logger.error(`Failed to promote staged dub upload for user ${userId}: ${error?.message}`);
      throw new InternalServerErrorException('Failed to store the uploaded media');
    }

    const cleanupMedia = () => deleteGcsObject(this.configService, finalObject, this.bucket).catch(() => null);

    // Take the money now. Atomic and floored at zero, so two dubs started at once can
    // never both pass — the second is rejected here instead of after ElevenLabs ran.
    const reservedCredits = this.dubCost(durationSeconds, planName);
    try {
      await this.reserveCredits(userId, reservedCredits);
    } catch (error) {
      await cleanupMedia();
      throw error;
    }

    const publicUrl = gcsPublicUrl(this.configService, finalObject, this.bucket);
    const inputGsUri = gcsUri(this.configService, finalObject, this.bucket);
    const projectId = crypto.randomUUID();

    const { error: insertError } = await this.supabase.from('dubbing_projects').insert({
      project_id: projectId,
      user_id: userId,
      original_media_url: publicUrl,
      input_url: publicUrl,
      input_gs_uri: inputGsUri,
      target_language: targetLanguage,
      target_accent: targetAccent ?? null,
      is_video: isVideo,
      media_name: mediaName,
      duration_seconds: durationSeconds,
      status: 'queued',
      credits_consumed: reservedCredits,
    });
    if (insertError) {
      await this.refundCredits(userId, reservedCredits);
      await cleanupMedia();
      this.logger.error(`Failed to create dubbing project for user ${userId}: ${insertError.message}`);
      throw new InternalServerErrorException('Failed to create dubbing project');
    }

    try {
      const jobId = await this.enqueue({
        userId,
        projectId,
        inputGsUri,
        inputUrl: publicUrl,
        mimeType: contentType,
        isVideo,
        targetLanguage,
        targetAccent,
        durationSeconds,
        planName,
        reservedCredits,
      });
      return { projectId, jobId };
    } catch (error: any) {
      await this.refundCredits(userId, reservedCredits);
      await this.supabase
        .from('dubbing_projects')
        .update({ status: 'failed', error_message: 'Could not be queued. Please try again.', credits_consumed: 0 })
        .eq('project_id', projectId);
      this.logger.error(`Failed to enqueue dub ${projectId}: ${error?.message}`);
      throw new InternalServerErrorException('Failed to queue the dubbing job');
    }
  }

  /**
   * Mint the output URL, push the job and record its id.
   *
   * The job id is a random UUID, not `dubbing-{userId}-{timestamp}`: the SSE status
   * route is unauthenticated (EventSource cannot send an Authorization header), so the
   * id is the only thing standing between a job's progress and a stranger. A predictable
   * id built from a user id and a millisecond is guessable; a UUID is not.
   */
  private async enqueue(data: {
    userId: string;
    projectId: string;
    inputGsUri: string;
    inputUrl: string;
    mimeType: string;
    isVideo: boolean;
    targetLanguage: string;
    targetAccent?: string | null;
    durationSeconds: number;
    planName: string | null;
    reservedCredits: number;
  }): Promise<string> {
    const output = await this.signOutputUpload(data.projectId, data.isVideo);
    const bullJobId = `dubbing-${crypto.randomUUID()}`;

    await this.queue.add('dubbing', { ...data, bullJobId, ...output }, { jobId: bullJobId });
    await this.supabase.from('dubbing_projects').update({ job_id: bullJobId }).eq('project_id', data.projectId);

    return bullJobId;
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
      throw new ForbiddenException('We could not find an active plan on your account. Please refresh and try again.');
    }

    const { data: row, error } = await this.supabase
      .from('dubbing_projects')
      .select('input_gs_uri, input_url, target_language, target_accent, is_video, duration_seconds, status')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();
    if (error || !row) throw new NotFoundException('Dubbing project not found');
    if (!row.input_gs_uri || !row.input_url || !row.duration_seconds) {
      throw new BadRequestException('This dub is missing its source media and cannot be regenerated.');
    }
    // A second run while the first is still going would charge twice and race the same
    // output object — the in-flight run has to finish or be cancelled first.
    if (IN_FLIGHT_STATUSES.includes(row.status)) {
      throw new BadRequestException('This dub is still running. Wait for it to finish, or cancel it first.');
    }

    // Re-check the cap: a downgrade since the original dub must not let a long clip
    // through the back door.
    this.assertDurationAllowed(planName, Number(row.duration_seconds));

    // The stored source must still exist in GCS — and gives us its content type.
    const objectName = String(row.input_gs_uri).split('/').slice(3).join('/');
    let contentType: string;
    try {
      ({ contentType } = await gcsObjectMetadata(this.configService, objectName, this.bucket));
    } catch {
      throw new BadRequestException('The original media is no longer available. Please create a new dub.');
    }

    await this.assertCanAffordDub(userId, Number(row.duration_seconds), planName);

    const reservedCredits = this.dubCost(Number(row.duration_seconds), planName);
    await this.reserveCredits(userId, reservedCredits);

    // Reset the row in place so the same detail page reflects the new run.
    await this.supabase
      .from('dubbing_projects')
      .update({ status: 'queued', dubbed_url: null, error_message: null, credits_consumed: reservedCredits })
      .eq('project_id', projectId)
      .eq('user_id', userId);

    try {
      const jobId = await this.enqueue({
        userId,
        projectId,
        inputGsUri: row.input_gs_uri,
        inputUrl: row.input_url,
        mimeType: contentType,
        isVideo: row.is_video,
        targetLanguage: row.target_language,
        targetAccent: row.target_accent,
        durationSeconds: Number(row.duration_seconds),
        planName,
        reservedCredits,
      });
      return { projectId, jobId };
    } catch (error: any) {
      await this.refundCredits(userId, reservedCredits);
      await this.supabase
        .from('dubbing_projects')
        .update({ status: 'failed', error_message: 'Could not be queued. Please try again.', credits_consumed: 0 })
        .eq('project_id', projectId);
      this.logger.error(`Failed to enqueue regenerated dub ${projectId}: ${error?.message}`);
      throw new InternalServerErrorException('Failed to queue the dubbing job');
    }
  }

  /**
   * Mid-run cancellation (train-ai pattern): a queued job is removed outright;
   * an active one gets a Redis flag the worker checks between pipeline stages.
   *
   * Refunds are split by who owns the job at that moment: a job removed from the queue
   * never reaches the worker, so the API gives the reservation back here; an active one
   * is refunded by the worker when it aborts. Exactly one of the two runs.
   */
  async stopDub(userId: string, jobId: string): Promise<{ message: string }> {
    const job = await this.queue.getJob(jobId);
    if (!job || job.data?.userId !== userId) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();

    if (state === 'waiting' || state === 'delayed') {
      // remove() throws if the job went active in the meantime, so reaching the next
      // line means the worker never picked it up and the refund cannot double up.
      await job.remove();
      await this.refundCredits(userId, Number(job.data?.reservedCredits ?? 0));
      // Mark the row too — otherwise it sits 'queued' forever.
      await this.supabase
        .from('dubbing_projects')
        .update({ status: 'failed', error_message: 'Cancelled by user', credits_consumed: 0 })
        .eq('project_id', job.data.projectId)
        .eq('user_id', userId);
      return { message: 'Dubbing cancelled' };
    }

    if (state === 'active') {
      const client = await this.queue.client;
      await client.set(`${DUBBING_CANCEL_PREFIX}${jobId}`, '1', 'EX', 3600);
      // "Requested", not "cancelled": the worker only checks between stages, so a run
      // already past its last checkpoint will finish and charge normally.
      return { message: 'Cancellation requested — it will stop at the next step if it has not already finished.' };
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
    // Deleting the row out from under a running worker makes its status writes fail and
    // strands the reservation — make the user cancel first.
    const { data: existing } = await this.supabase
      .from('dubbing_projects')
      .select('status')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (existing && IN_FLIGHT_STATUSES.includes(existing.status)) {
      throw new BadRequestException('This dub is still running. Cancel it before deleting.');
    }

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
