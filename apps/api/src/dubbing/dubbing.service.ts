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
import type { InitDubUploadInput, DubOutput, DubResponse, DubUploadState, DubUploadTargets } from '@repo/validation';
import {
  canDub,
  hasEnoughCredits,
  dubbingMultiplierForPlan,
  calculateDubbingCreditsByDuration,
  isDubDurationAllowed,
  isDubSizeAllowed,
  maxDubSecondsForPlan,
  maxDubBytesForPlan,
  formatDubDuration,
  formatUploadLimit,
  dubOutputPrefix,
  dubProjectPrefix,
  isSupportedDubLanguage,
  maxDubLanguagesForPlan,
  paidDubbingMultiplier,
  DUB_ENGINES,
  DUBBING_CANCEL_PREFIX,
  DEFAULT_DUB_VOICE_MODE,
  type DubEngine,
} from '@repo/validation';
import {
  gcsObjectMetadata,
  gcsPublicUrl,
  gcsUri,
  deleteGcsObject,
  deleteGcsPrefix,
  getDubbingBucketName,
  createResumableSession,
  resumableSessionOffset,
  initiateMultipartUpload,
  signMultipartPartUrl,
  listMultipartParts,
  completeMultipartUpload,
  abortMultipartUpload,
} from '../utils';

// A dub in one of these states has a worker (or a queue slot) attached to it: it cannot
// be regenerated or deleted without orphaning a running job and its reservation.
const IN_FLIGHT_STATUSES = ['queued', 'processing', 'cloning'];

// Parts are at least 16 MiB and grow so no upload needs more than 1000 of them, which
// keeps a resume to a single ListParts page.
const MIN_PART_BYTES = 16 * 1024 * 1024;
const MAX_PARTS = 1000;

function planPartSize(size: number): number {
  const mib = 1024 * 1024;
  return Math.max(MIN_PART_BYTES, Math.ceil(size / MAX_PARTS / mib) * mib);
}

function extractedAudioExtension(contentType: string): string {
  return contentType.includes('webm') ? 'webm' : 'm4a';
}

/** Only a bare scheme://host origin is passed to GCS as the session's CORS origin. */
function sessionOrigin(origin?: string): string | undefined {
  return origin && /^https?:\/\/[^/\s]+$/.test(origin) ? origin : undefined;
}

type DubRow = Record<string, any>;
type OutputRow = Record<string, any>;

// Everything the API reads from a project row. Deliberately not '*': the Cypher speaker
// analysis can run to hundreds of KB, and this is read on every video part upload.
const PROJECT_COLUMNS = [
  'project_id', 'user_id', 'status', 'engine', 'target_language', 'target_accent', 'is_video',
  'duration_seconds', 'job_id', 'input_gs_uri', 'input_url', 'dubbed_url', 'credits_consumed', 'error_message',
  'audio_object', 'audio_session_uri', 'audio_size', 'audio_content_type', 'audio_extracted',
  'video_object', 'video_upload_id', 'video_part_size', 'video_size', 'video_content_type', 'video_status',
  'source_fingerprint', 'source_language', 'voice_mode', 'keyterms', 'vendor_projects',
].join(', ');

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

  /**
   * Lightweight gate check for the UI: form vs. upgrade card, the upload limits, and
   * the plan's credits-per-second on each engine so the form can price a file the same
   * way this service will. The rates are resolved here because only the API sees the
   * env overrides.
   */
  async getAccess(userId: string) {
    const planName = await this.getActivePlanName(userId);
    return {
      // The engines where the voice mode changes anything: ElevenLabs always (cloning
      // strength); Cypher only once its TTS v2 service is deployed, since the frozen Modal
      // app takes no voice controls. Set CYPHER_TTS_V2_URL here too to show it on Cypher.
      voiceModeEngines: DUB_ENGINES.filter((engine) => engine === 'elevenlabs' || !!process.env.CYPHER_TTS_V2_URL?.trim()),
      success: true,
      allowed: canDub(planName),
      plan: planName,
      maxDurationSeconds: maxDubSecondsForPlan(planName),
      maxUploadBytes: maxDubBytesForPlan(planName),
      maxLanguages: maxDubLanguagesForPlan(planName),
      creditsPerSecond: Object.fromEntries(
        DUB_ENGINES.map((engine) => [engine, this.rate(planName, engine)]),
      ) as Record<DubEngine, number>,
    };
  }

  /** Credits per second of source, per language, for a plan on an engine. */
  private rate(planName: string | null | undefined, engine: DubEngine): number {
    return dubbingMultiplierForPlan(planName, paidDubbingMultiplier(engine, process.env));
  }

  /** Dubs from before the engine choice ran on whichever engine speaks their language. */
  private engineOf(row: DubRow): DubEngine {
    return row.engine ?? (isSupportedDubLanguage(row.target_language, 'cypher') ? 'cypher' : 'elevenlabs');
  }

  /**
   * Every plan can dub; Starter is capped on clip LENGTH instead of being locked out.
   * `durationSeconds` is measured in the browser and therefore untrusted — this is the
   * cheap first gate, and the worker re-checks against the duration ffprobe
   * reports before it spends anything.
   */
  private assertDurationAllowed(
    planName: string | null,
    durationSeconds: number,
    languages: string[],
    engine: DubEngine,
  ): void {
    if (isDubDurationAllowed(planName, durationSeconds, languages, engine)) return;
    const cap = maxDubSecondsForPlan(planName, languages, engine);
    throw new BadRequestException(
      `On the ${planName ?? 'Starter'} plan you can dub clips up to ${formatDubDuration(cap)}. ` +
        `This one is ${formatDubDuration(Math.round(durationSeconds))}. Trim it, or upgrade for a longer limit.`,
    );
  }

  /** Same shape as the duration gate: plan cap, tightened by the target languages' routes. */
  private assertSizeAllowed(planName: string | null, fileSize: number, languages: string[], engine: DubEngine): void {
    if (isDubSizeAllowed(planName, fileSize, languages, engine)) return;
    throw new PayloadTooLargeException(
      `File exceeds the ${formatUploadLimit(maxDubBytesForPlan(planName, languages, engine))} dubbing upload limit on your plan.`,
    );
  }

  /**
   * Credits one language of this dub costs on an engine: the single place the price is
   * computed. Starter pays its own (higher) trial rate on either engine; the worker
   * resolves the same rate from the plan it carries and the project's engine, so the
   * settle can't disagree with what was reserved.
   */
  private dubCost(durationSeconds: number, planName: string | null | undefined, engine: DubEngine): number {
    return calculateDubbingCreditsByDuration(durationSeconds, this.rate(planName, engine));
  }

  /**
   * Reserve the dub's cost up front. Deducting at enqueue (rather than after the dub)
   * is what makes two concurrent dubs safe: `update_user_credits` refuses to go below
   * zero atomically, so the second one is rejected before the GPU is ever called
   * instead of completing and then failing to bill. The worker settles the difference
   * against the measured duration and refunds the whole reservation on failure.
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

  /** Same cost the worker will settle, checked here so we fail before the GPU runs. */
  private async assertCanAffordDub(
    userId: string,
    durationSeconds: number,
    planName: string | null | undefined,
    languages: number,
    engine: DubEngine,
  ): Promise<void> {
    // Each language is its own dub, so the price scales with how many were picked.
    const required = this.dubCost(durationSeconds, planName, engine) * languages;

    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();
    if (error || !profile) throw new NotFoundException('Profile not found');

    if (!hasEnoughCredits(profile.credits, required)) {
      const what = languages > 1 ? `${languages}-language dub` : 'dub';
      throw new ForbiddenException(
        `This ${Math.ceil(durationSeconds)}s ${what} costs ${required} credits and you have ${profile.credits}. ` +
          'Trim the clip, pick fewer languages or upgrade your plan.',
      );
    }
  }

  private async assertCanDub(userId: string): Promise<string | null> {
    const planName = await this.getActivePlanName(userId);
    if (!canDub(planName)) {
      throw new ForbiddenException('We could not find an active plan on your account. Please refresh and try again.');
    }
    return planName;
  }

  private sanitizeFileName(value: string): string {
    return value.replace(/[^\w.\-]/g, '_');
  }

  private async getOwnedRow(userId: string, projectId: string): Promise<DubRow> {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .select(PROJECT_COLUMNS)
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Dubbing project not found');
    return data;
  }

  private async getOutputs(userId: string, projectId: string): Promise<OutputRow[]> {
    const { data, error } = await this.supabase
      .from('dubbing_outputs')
      .select('id, language, accent, status, dubbed_audio_url, dubbed_url, credits_consumed')
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw new InternalServerErrorException('Failed to read the dub outputs');
    return data ?? [];
  }

  /**
   * Dubs from before per-language outputs keep their language on the project row. Give
   * one an output row (and an engine that speaks its language) the first time it is run again.
   */
  private async ensureLegacyOutput(userId: string, row: DubRow): Promise<OutputRow[]> {
    const engine = this.engineOf(row);
    const { data, error } = await this.supabase
      .from('dubbing_outputs')
      .insert({ project_id: row.project_id, user_id: userId, language: row.target_language, accent: row.target_accent })
      .select('id, language, accent, status, dubbed_audio_url, dubbed_url, credits_consumed');
    if (error || !data?.length) throw new InternalServerErrorException('Failed to prepare the dub for another run');
    if (!row.engine) {
      await this.supabase.from('dubbing_projects').update({ engine }).eq('project_id', row.project_id);
    }
    return data;
  }

  /**
   * Step 1: register the dub and open both uploads before a byte moves. Plan, length,
   * size and balance are all checked against the ORIGINAL file here, so the user learns
   * about a refusal before uploading anything. The audio goes into a resumable session,
   * the original video (when the browser could split the audio out) into a multipart
   * upload, and both are recorded on the row so a closed tab can pick them back up.
   */
  async initUpload(input: InitDubUploadInput, userId: string, origin?: string): Promise<DubUploadTargets> {
    const planName = await this.assertCanDub(userId);
    const languages = input.targets.map((t) => t.language);
    const maxLanguages = maxDubLanguagesForPlan(planName);
    if (languages.length > maxLanguages) {
      throw new ForbiddenException(
        `The ${planName ?? 'Starter'} plan dubs into up to ${maxLanguages} language${maxLanguages === 1 ? '' : 's'} at once.`,
      );
    }
    this.assertDurationAllowed(planName, input.durationSeconds, languages, input.engine);
    this.assertSizeAllowed(planName, input.fileSize, languages, input.engine);
    if (input.audio.size > input.fileSize) {
      throw new BadRequestException('The audio track cannot be larger than the file it came from.');
    }
    await this.assertCanAffordDub(userId, input.durationSeconds, planName, languages.length, input.engine);

    const projectId = crypto.randomUUID();
    const prefix = dubProjectPrefix(userId, projectId);
    const sourceObject = `${prefix}${this.sanitizeFileName(input.filename)}`;
    // Without an extracted track the whole file is the audio: one upload, and the worker
    // pulls the sound out of it (and muxes back over it) the way it always has.
    const splitVideo = input.isVideo && input.audio.extracted;
    const audioObject = input.audio.extracted
      ? `${prefix}audio.${extractedAudioExtension(input.audio.contentType)}`
      : sourceObject;

    const sessionUri = await createResumableSession(
      this.configService, audioObject, input.audio.contentType, this.bucket, sessionOrigin(origin),
    );

    let video: { uploadId: string; partSize: number; partCount: number } | null = null;
    if (splitVideo) {
      const uploadId = await initiateMultipartUpload(this.configService, sourceObject, input.contentType, this.bucket);
      const partSize = planPartSize(input.fileSize);
      video = { uploadId, partSize, partCount: Math.ceil(input.fileSize / partSize) };
    }

    const { error } = await this.supabase.from('dubbing_projects').insert({
      project_id: projectId,
      user_id: userId,
      status: 'uploading',
      engine: input.engine,
      // The first language, kept on the project for older readers of the row.
      target_language: languages[0],
      target_accent: input.targets[0].accent ?? null,
      is_video: input.isVideo,
      media_name: input.mediaName,
      duration_seconds: input.durationSeconds,
      credits_consumed: 0,
      source_fingerprint: input.fingerprint,
      audio_object: audioObject,
      audio_session_uri: sessionUri,
      audio_size: input.audio.size,
      audio_content_type: input.audio.contentType,
      audio_extracted: input.audio.extracted,
      input_gs_uri: gcsUri(this.configService, audioObject, this.bucket),
      input_url: gcsPublicUrl(this.configService, audioObject, this.bucket),
      // The player shows the original once it exists; a split video arrives later.
      original_media_url: splitVideo ? null : gcsPublicUrl(this.configService, audioObject, this.bucket),
      video_object: splitVideo ? sourceObject : null,
      video_upload_id: video?.uploadId ?? null,
      video_part_size: video?.partSize ?? null,
      video_size: splitVideo ? input.fileSize : null,
      video_content_type: splitVideo ? input.contentType : null,
      video_status: splitVideo ? 'uploading' : null,
      source_language: input.sourceLanguage ?? null,
      voice_mode: input.voiceMode ?? DEFAULT_DUB_VOICE_MODE,
      keyterms: input.keyterms ?? [],
    });
    const { error: outputsError } = error
      ? { error }
      : await this.supabase.from('dubbing_outputs').insert(
          input.targets.map((t) => ({
            project_id: projectId,
            user_id: userId,
            language: t.language,
            accent: t.accent ?? null,
          })),
        );
    if (outputsError) {
      if (!error) await this.supabase.from('dubbing_projects').delete().eq('project_id', projectId);
      if (video) await abortMultipartUpload(this.configService, sourceObject, video.uploadId, this.bucket);
      this.logger.error(`Failed to create dubbing project for user ${userId}: ${outputsError.message}`);
      throw new InternalServerErrorException('Failed to create dubbing project');
    }

    return {
      projectId,
      audio: { sessionUri },
      video: video ? { partSize: video.partSize, partCount: video.partCount } : null,
    };
  }

  /** How far each upload got, read from GCS itself, so a resume sends only what is missing. */
  async getUploadState(userId: string, projectId: string): Promise<DubUploadState & { sessionUri: string | null }> {
    const row = await this.getOwnedRow(userId, projectId);
    const audioSize = Number(row.audio_size ?? 0);

    let audio = { size: audioSize, extracted: !!row.audio_extracted, uploadedBytes: audioSize, complete: true };
    let sessionUri: string | null = null;
    if (row.status === 'uploading' && row.audio_session_uri) {
      const offset = await resumableSessionOffset(row.audio_session_uri, audioSize);
      audio = { ...audio, uploadedBytes: offset.uploadedBytes, complete: offset.complete };
      sessionUri = offset.expired ? null : row.audio_session_uri;
    }

    let video: DubUploadState['video'] = null;
    if (row.video_object && row.video_upload_id) {
      const size = Number(row.video_size);
      const partSize = Number(row.video_part_size);
      const partCount = Math.ceil(size / partSize);
      const uploadedParts =
        row.video_status === 'uploaded'
          ? Array.from({ length: partCount }, (_, i) => i + 1)
          : (await this.listPartsOrRestart(row))
              .filter((p) => p.size === this.expectedPartSize(p.partNumber, size, partSize))
              .map((p) => p.partNumber);
      video = { size, partSize, partCount, uploadedParts, status: row.video_status };
    }

    return { projectId, status: row.status, fingerprint: row.source_fingerprint ?? null, audio, video, sessionUri };
  }

  /**
   * The bucket's lifecycle rule aborts multipart uploads left unfinished for days. When
   * that has happened the upload id is gone (404), so open a new one and start the video over.
   */
  private async listPartsOrRestart(row: DubRow) {
    try {
      return await listMultipartParts(this.configService, row.video_object, row.video_upload_id, this.bucket);
    } catch (error: any) {
      if (error?.response?.status !== 404) throw error;
      const uploadId = await initiateMultipartUpload(
        this.configService, row.video_object, row.video_content_type, this.bucket,
      );
      await this.supabase
        .from('dubbing_projects')
        .update({ video_upload_id: uploadId })
        .eq('project_id', row.project_id)
        .eq('user_id', row.user_id);
      return [];
    }
  }

  private expectedPartSize(partNumber: number, size: number, partSize: number): number {
    const partCount = Math.ceil(size / partSize);
    return partNumber < partCount ? partSize : size - partSize * (partCount - 1);
  }

  /**
   * A fresh audio session, for when the old one expired or the audio has to be sent
   * again from the start (an extracted track is re-made on resume and may not be
   * byte-identical to the first one, so it is never appended to a half-finished session).
   */
  async restartAudioSession(
    userId: string,
    projectId: string,
    origin?: string,
    size?: number,
  ): Promise<{ sessionUri: string }> {
    const row = await this.getOwnedRow(userId, projectId);
    if (row.status !== 'uploading') throw new BadRequestException('The audio for this dub is already uploaded.');

    // A re-extracted track may come out a few bytes different; the whole file cannot.
    let audioSize = Number(row.audio_size);
    if (size && row.audio_extracted) {
      if (size > Number(row.video_size)) {
        throw new BadRequestException('The audio track cannot be larger than the file it came from.');
      }
      audioSize = size;
    }

    const sessionUri = await createResumableSession(
      this.configService, row.audio_object, row.audio_content_type, this.bucket, sessionOrigin(origin),
    );
    await this.supabase
      .from('dubbing_projects')
      .update({ audio_session_uri: sessionUri, audio_size: audioSize })
      .eq('project_id', projectId)
      .eq('user_id', userId);
    return { sessionUri };
  }

  /**
   * Step 2: the audio is in, start dubbing. Verifies the stored audio really is the size
   * that was declared, takes the money and queues the worker. Idempotent: a retried call
   * for a dub that already started returns the running job instead of charging twice.
   */
  async startDub(userId: string, projectId: string): Promise<{ jobId: string }> {
    const row = await this.getOwnedRow(userId, projectId);
    if (row.status !== 'uploading') {
      if (row.job_id) return { jobId: row.job_id };
      throw new BadRequestException('This dub has already started.');
    }

    const planName = await this.assertCanDub(userId);
    const durationSeconds = Number(row.duration_seconds);
    const outputs = await this.getOutputs(userId, projectId);
    if (!outputs.length) throw new BadRequestException('This dub has no target language.');
    const languages = outputs.map((o) => o.language);
    const engine = this.engineOf(row);
    this.assertDurationAllowed(planName, durationSeconds, languages, engine);

    let size: number;
    let contentType: string;
    try {
      ({ size, contentType } = await gcsObjectMetadata(this.configService, row.audio_object, this.bucket));
    } catch {
      throw new BadRequestException('The audio upload has not finished yet.');
    }
    if (size !== Number(row.audio_size)) {
      throw new BadRequestException('The uploaded audio does not match the file you picked. Please upload it again.');
    }
    // Only an unsplit file is the original itself; its real size is what the plan caps.
    if (!row.audio_extracted) this.assertSizeAllowed(planName, size, languages, engine);

    await this.assertCanAffordDub(userId, durationSeconds, planName, outputs.length, engine);
    const perLanguage = this.dubCost(durationSeconds, planName, engine);
    const reservedCredits = perLanguage * outputs.length;
    await this.reserveCredits(userId, reservedCredits);

    // Conditional, so two tabs pressing start at once cannot both queue a paid job.
    const { data: claimed } = await this.supabase
      .from('dubbing_projects')
      .update({ status: 'queued', credits_consumed: reservedCredits, audio_session_uri: null, error_message: null })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'uploading')
      .select('project_id');
    if (!claimed?.length) {
      await this.refundCredits(userId, reservedCredits);
      const fresh = await this.getOwnedRow(userId, projectId);
      if (fresh.job_id) return { jobId: fresh.job_id };
      throw new BadRequestException('This dub has already started.');
    }
    await this.supabase
      .from('dubbing_outputs')
      .update({ credits_consumed: perLanguage })
      .eq('project_id', projectId)
      .eq('user_id', userId);

    return this.enqueueOrRefund(userId, row, { mimeType: contentType, planName, reservedCredits });
  }

  /** One signed URL per part, minted just before the browser sends it so none expire mid-upload. */
  async signVideoPart(userId: string, projectId: string, partNumber: number): Promise<{ url: string }> {
    const row = await this.getOwnedRow(userId, projectId);
    if (!row.video_upload_id || row.video_status !== 'uploading') {
      throw new BadRequestException('This dub has no video upload in progress.');
    }
    if (partNumber > Math.ceil(Number(row.video_size) / Number(row.video_part_size))) {
      throw new BadRequestException('Part number is out of range.');
    }
    const url = await signMultipartPartUrl(
      this.configService, row.video_object, row.video_upload_id, partNumber, this.bucket,
    );
    return { url };
  }

  /**
   * Stitch the video parts once every one is in GCS at its expected size. If the dubbed
   * audio finished first and is waiting on the video, queue the mux now.
   */
  async completeVideo(userId: string, projectId: string): Promise<{ jobId: string | null }> {
    const row = await this.getOwnedRow(userId, projectId);
    if (!row.video_upload_id) throw new BadRequestException('This dub has no video upload.');

    if (row.video_status !== 'uploaded') {
      const size = Number(row.video_size);
      const partSize = Number(row.video_part_size);
      const partCount = Math.ceil(size / partSize);
      const parts = (await listMultipartParts(this.configService, row.video_object, row.video_upload_id, this.bucket))
        .sort((a, b) => a.partNumber - b.partNumber);
      const complete =
        parts.length === partCount &&
        parts.every((p, i) => p.partNumber === i + 1 && p.size === this.expectedPartSize(p.partNumber, size, partSize));
      if (!complete) throw new BadRequestException('Some parts of the video are still missing. Resume the upload.');

      await completeMultipartUpload(this.configService, row.video_object, row.video_upload_id, parts, this.bucket);
      const { size: stored } = await gcsObjectMetadata(this.configService, row.video_object, this.bucket);
      if (stored !== size) {
        await deleteGcsObject(this.configService, row.video_object, this.bucket).catch(() => null);
        throw new BadRequestException('The uploaded video does not match the file you picked. Please upload it again.');
      }

      await this.supabase
        .from('dubbing_projects')
        .update({
          video_status: 'uploaded',
          original_media_url: gcsPublicUrl(this.configService, row.video_object, this.bucket),
        })
        .eq('project_id', projectId)
        .eq('user_id', userId);
    }

    // Conditional: only a dub parked on the video is picked up here. One still running
    // sees video_status flip and muxes on its own (see the worker's awaiting-video step).
    const { data: waiting } = await this.supabase
      .from('dubbing_projects')
      .update({ status: 'queued', error_message: null })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'awaiting_video')
      .select('project_id');
    if (!waiting?.length) return { jobId: null };

    return this.enqueueOrRefund(userId, row, { planName: await this.getActivePlanName(userId), reservedCredits: 0 });
  }

  /**
   * Retry a failed dub from where it stopped. Finished languages are left alone; for the
   * rest the translation, dubbed segments, ElevenLabs dub id and any dubbed audio are
   * kept. A language whose audio was already delivered only needs the video mux, which is
   * free; the others are charged again, since the failure refunded them.
   */
  async resumeDub(userId: string, projectId: string): Promise<{ projectId: string; jobId: string }> {
    const row = await this.getOwnedRow(userId, projectId);
    if (row.status !== 'failed') throw new BadRequestException('Only a failed dub can be resumed.');
    const jobId = await this.requeue(userId, row, { resetProgress: false });
    return { projectId, jobId };
  }

  /**
   * Re-run a finished or failed dub from scratch with the SAME input and languages: the
   * stored source is reused (no re-upload), the speakers are detected again and every
   * language is dubbed again.
   */
  async regenerateDub(userId: string, projectId: string): Promise<{ projectId: string; jobId: string }> {
    const row = await this.getOwnedRow(userId, projectId);
    // A second run while the first is still going would charge twice and race the same
    // output objects: the in-flight run has to finish or be cancelled first.
    if (IN_FLIGHT_STATUSES.includes(row.status)) {
      throw new BadRequestException('This dub is still running. Wait for it to finish, or cancel it first.');
    }
    if (row.status === 'uploading') throw new BadRequestException('Finish uploading this dub first.');
    const jobId = await this.requeue(userId, row, { resetProgress: true });
    return { projectId, jobId };
  }

  private async requeue(userId: string, row: DubRow, { resetProgress }: { resetProgress: boolean }): Promise<string> {
    const planName = await this.assertCanDub(userId);
    if (!row.input_gs_uri || !row.duration_seconds) {
      throw new BadRequestException('This dub is missing its source media and cannot be run again.');
    }
    const durationSeconds = Number(row.duration_seconds);

    // The stored source must still exist in GCS, and gives us its content type.
    const objectName = String(row.input_gs_uri).split('/').slice(3).join('/');
    let contentType: string;
    try {
      ({ contentType } = await gcsObjectMetadata(this.configService, objectName, this.bucket));
    } catch {
      throw new BadRequestException('The original media is no longer available. Please create a new dub.');
    }

    let outputs = await this.getOutputs(userId, row.project_id);
    if (!outputs.length) outputs = await this.ensureLegacyOutput(userId, row);

    const toRun = resetProgress ? outputs : outputs.filter((o) => o.status !== 'completed');
    if (!toRun.length) throw new BadRequestException('Every language of this dub is already finished.');
    const needAudio = resetProgress ? toRun : toRun.filter((o) => !o.dubbed_audio_url);

    const engine = this.engineOf(row);
    let perLanguage = 0;
    if (needAudio.length) {
      // Re-check the caps: a downgrade since the first run must not let a long clip
      // through the back door.
      this.assertDurationAllowed(planName, durationSeconds, needAudio.map((o) => o.language), engine);
      await this.assertCanAffordDub(userId, durationSeconds, planName, needAudio.length, engine);
      perLanguage = this.dubCost(durationSeconds, planName, engine);
      await this.reserveCredits(userId, perLanguage * needAudio.length);
    }
    const reservedCredits = perLanguage * needAudio.length;

    const needAudioIds = needAudio.map((o) => o.id);
    const muxOnlyIds = toRun.filter((o) => !needAudioIds.includes(o.id)).map((o) => o.id);
    const freshStart = resetProgress
      ? {
          translation: null, segment_count: null, segments_done: 0, vendor_dub_id: null, dubbed_audio_url: null, dubbed_url: null,
          timeline: null, warnings: null,
        }
      : {};
    if (needAudioIds.length) {
      await this.supabase
        .from('dubbing_outputs')
        .update({ status: 'pending', error_message: null, credits_consumed: perLanguage, ...freshStart })
        .in('id', needAudioIds);
    }
    if (muxOnlyIds.length) {
      await this.supabase.from('dubbing_outputs').update({ status: 'pending', error_message: null }).in('id', muxOnlyIds);
    }

    const kept = outputs
      .filter((o) => !needAudioIds.includes(o.id))
      .reduce((sum, o) => sum + Number(o.credits_consumed ?? 0), 0);
    await this.supabase
      .from('dubbing_projects')
      .update({
        status: 'queued',
        error_message: null,
        credits_consumed: kept + reservedCredits,
        // A fresh start detects the speakers again, on a new ElevenLabs project: the
        // generation bump gives it a new reference, so the worker's lookup for a lost
        // project cannot find the old one. A resume keeps both, so nothing is paid twice.
        ...(resetProgress
          ? { analysis: null, dubbed_url: null, vendor_projects: { generation: Number(row.vendor_projects?.generation ?? 0) + 1 } }
          : {}),
      })
      .eq('project_id', row.project_id)
      .eq('user_id', userId);

    const { jobId } = await this.enqueueOrRefund(userId, row, { mimeType: contentType, planName, reservedCredits });
    return jobId;
  }

  /** Queue the worker; on failure hand the reservation back and mark the row failed. */
  private async enqueueOrRefund(
    userId: string,
    row: DubRow,
    opts: { mimeType?: string; planName: string | null; reservedCredits: number },
  ): Promise<{ jobId: string }> {
    try {
      const jobId = await this.enqueue({
        userId,
        projectId: row.project_id,
        inputGsUri: row.input_gs_uri,
        inputUrl: row.input_url,
        mimeType: opts.mimeType ?? row.audio_content_type ?? 'application/octet-stream',
        isVideo: !!row.is_video,
        durationSeconds: Number(row.duration_seconds),
        planName: opts.planName,
        reservedCredits: opts.reservedCredits,
        sourceLanguage: row.source_language ?? null,
        voiceMode: row.voice_mode ?? DEFAULT_DUB_VOICE_MODE,
        keyterms: row.keyterms ?? [],
      });
      return { jobId };
    } catch (error: any) {
      await this.refundCredits(userId, opts.reservedCredits);
      await this.markUndeliveredFailed(row.project_id, 'Could not be queued. Please try again.');
      this.logger.error(`Failed to enqueue dub ${row.project_id}: ${error?.message}`);
      throw new InternalServerErrorException('Failed to queue the dubbing job');
    }
  }

  /**
   * Push the job and record its id.
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
    durationSeconds: number;
    planName: string | null;
    reservedCredits: number;
    // For the job's own record; the worker reads the project row, which a retry keeps.
    sourceLanguage: string | null;
    voiceMode: string;
    keyterms: string[];
  }): Promise<string> {
    const bullJobId = `dubbing-${crypto.randomUUID()}`;

    await this.queue.add('dubbing', { ...data, bullJobId }, { jobId: bullJobId });
    await this.supabase.from('dubbing_projects').update({ job_id: bullJobId }).eq('project_id', data.projectId);

    return bullJobId;
  }

  /**
   * A run that never got going: every language without dubbed audio is refunded (by the
   * caller) and failed with no charge; a language whose audio was delivered keeps its
   * charge and only needs the mux on a retry.
   */
  private async markUndeliveredFailed(projectId: string, message: string): Promise<void> {
    await this.supabase
      .from('dubbing_outputs')
      .update({ status: 'failed', error_message: message, credits_consumed: 0 })
      .eq('project_id', projectId)
      .is('dubbed_audio_url', null)
      .neq('status', 'completed');
    await this.supabase
      .from('dubbing_outputs')
      .update({ status: 'failed', error_message: message })
      .eq('project_id', projectId)
      .not('dubbed_audio_url', 'is', null)
      .neq('status', 'completed');
    const { data: outputs } = await this.supabase
      .from('dubbing_outputs')
      .select('credits_consumed')
      .eq('project_id', projectId);
    const credits = (outputs ?? []).reduce((sum: number, o: any) => sum + Number(o.credits_consumed ?? 0), 0);
    await this.supabase
      .from('dubbing_projects')
      .update({ status: 'failed', error_message: message, credits_consumed: credits })
      .eq('project_id', projectId);
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
      // Mark the rows too, otherwise they sit 'queued' forever.
      await this.markUndeliveredFailed(job.data.projectId, 'Cancelled by user');
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
    // Explicit columns: select('*') would ship every row's speaker analysis to the list.
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .select('id, project_id, user_id, engine, original_media_url, target_language, status, video_status, is_video, dubbed_url, credits_consumed, created_at, media_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(pageSize);
    if (error) throw new InternalServerErrorException('Failed to fetch dubs');

    // One query for every listed project's languages, not one per card.
    const ids = (data ?? []).map((p) => p.project_id);
    const { data: outputs } = ids.length
      ? await this.supabase.from('dubbing_outputs').select('project_id, language').eq('user_id', userId).in('project_id', ids)
      : { data: [] as { project_id: string; language: string }[] };
    const languagesByProject = new Map<string, string[]>();
    for (const o of outputs ?? []) {
      languagesByProject.set(o.project_id, [...(languagesByProject.get(o.project_id) ?? []), o.language]);
    }
    return (data ?? []).map((p) => ({
      ...p,
      languages: languagesByProject.get(p.project_id) ?? (p.target_language ? [p.target_language] : []),
    }));
  }

  async getDub(userId: string, projectId: string): Promise<DubResponse> {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .select('project_id, engine, dubbed_url, original_media_url, target_language, target_accent, status, video_status, job_id, error_message, credits_consumed, is_video, created_at, media_name, source_language, voice_mode, keyterms, speakers:analysis->speakers')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();

    if (error || !data) {
      throw new BadRequestException('Dub not found or access denied');
    }

    const { data: rows } = await this.supabase
      .from('dubbing_outputs')
      .select('language, accent, status, dubbed_url, dubbed_audio_url, segments_done, segment_count, credits_consumed, error_message, timeline, warnings, created_at')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    const outputs: DubOutput[] = rows?.length
      ? rows.map((o) => ({
          language: o.language,
          accent: o.accent,
          status: o.status,
          dubbedUrl: o.dubbed_url,
          dubbedAudioUrl: o.dubbed_audio_url,
          segmentsDone: o.segments_done ?? 0,
          segmentCount: o.segment_count,
          creditsConsumed: o.credits_consumed ?? 0,
          errorMessage: o.error_message,
          timeline: o.timeline ?? null,
          warnings: o.warnings ?? null,
        }))
      : // A dub from before per-language outputs: its one language lives on the project.
        [{
          language: data.target_language,
          accent: data.target_accent,
          status: data.status === 'completed' || data.status === 'failed' ? data.status : 'dubbing',
          dubbedUrl: data.dubbed_url,
          dubbedAudioUrl: null,
          segmentsDone: 0,
          segmentCount: null,
          creditsConsumed: data.credits_consumed ?? 0,
          errorMessage: data.error_message,
        }];

    const speakers = (data as { speakers?: { voiceOf?: string | null }[] | null }).speakers;
    return {
      projectId: data.project_id,
      engine: data.engine,
      status: data.status,
      videoStatus: data.video_status,
      speakerCount: speakers?.length ? speakers.filter((s) => !s.voiceOf).length || speakers.length : null,
      originalMediaUrl: data.original_media_url,
      jobId: data.job_id,
      errorMessage: data.error_message,
      creditsConsumed: data.credits_consumed,
      isVideo: data.is_video,
      createdAt: data.created_at,
      mediaName: data.media_name,
      sourceLanguage: data.source_language ?? null,
      voiceMode: data.voice_mode ?? null,
      keyterms: data.keyterms ?? [],
      outputs,
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
      .select('input_gs_uri, is_video, video_object, video_upload_id, video_status')
      .single();

    if (error) throw new BadRequestException('Dub not found or access denied');
    await this.supabase.from('dubbing_outputs').delete().eq('project_id', projectId).eq('user_id', userId);

    // Best-effort cleanup: an unfinished video upload, everything under the project's
    // prefix (sources and the worker's scratch files), every language's dubbed files, and
    // the paths dubs used before any of that existed.
    if (data?.video_upload_id && data.video_status === 'uploading') {
      await abortMultipartUpload(this.configService, data.video_object, data.video_upload_id, this.bucket);
    }
    for (const prefix of [dubProjectPrefix(userId, projectId), dubOutputPrefix(projectId)]) {
      await deleteGcsPrefix(this.configService, prefix, this.bucket).catch((e) =>
        this.logger.error(`Failed to delete GCS prefix ${prefix}`, e),
      );
    }

    // Before per-language outputs a dub was one file: .mp4 for video, .wav (Modal) or
    // .mp3 (ElevenLabs) for audio. Deleting is best-effort, so trying each is cheaper
    // than leaking the old ones.
    const isVideo = Boolean(data?.is_video);
    const objectNames = [
      data?.input_gs_uri ? String(data.input_gs_uri).split('/').slice(3).join('/') : null,
      ...(isVideo ? [`dubbed/${projectId}.mp4`] : [`dubbed/${projectId}.wav`, `dubbed/${projectId}.mp3`]),
    ].filter((n): n is string => Boolean(n));

    for (const objectName of objectNames) {
      await deleteGcsObject(this.configService, objectName, this.bucket).catch((e) =>
        this.logger.error(`Failed to delete GCS object ${objectName}`, e),
      );
    }
  }
}
