import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createSupabaseClient, getSupabaseServiceEnv, reportError, SupabaseClient } from '@repo/supabase';
import {
  calculateDubbingCreditsByDuration,
  dubbingMultiplierForPlan,
  paidDubbingMultiplier,
  DUBBING_CANCEL_PREFIX,
  isDubDurationAllowed,
  maxDubSecondsForPlan,
  formatDubDuration,
  supportedLanguages,
  dubOutputObjects,
  dubProjectPrefix,
  cloningStrengthFor,
  elevenLabsModelFor,
  elevenLabsTargetTag,
  DEFAULT_DUB_VOICE_MODE,
  type DubEngine,
  type DubTimelineSegment,
  type DubVoiceMode,
  type DubWarning,
  type ElevenLabsDubbingModel,
} from '@repo/validation';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getGenAI } from './utils/genai';
import {
  concatWavs,
  cutAnalysisWindow,
  cutAudioClip,
  detectSpeech,
  DUB_PCM_BYTES_PER_SECOND,
  dubPcmToMp3,
  extractVoiceReference,
  muxDubbedAudio,
  probeDurationSeconds,
  toDubPcm,
  toMp3,
} from './utils/ffmpeg';
import {
  downloadGcsFile,
  gcsObjectExists,
  gcsPublicUrl,
  parseGsUri,
  saveGcsBuffer,
  uploadGcsFile,
} from './utils/gcs';
import { alignToSpeech, assignVoices, buildTurns, pickReferenceLines, placeOnTimeline, planWindows } from './utils/dub-segments';
import {
  ANALYSIS_WINDOW_SECONDS,
  analyzeWindow,
  cleanLines,
  mergeWindow,
  translateLines,
  type SourceAnalysis,
} from './utils/cypher-analysis';
import {
  createLanguageTarget,
  createProject,
  downloadDub,
  elevenLabsDeadlineMs,
  ElevenLabsDubFailedError,
  getElevenLabsKey,
  getSourceTranscript,
  getTargetTranscript,
  mergeWarnings,
  parseDub,
  serializeDub,
  toWarnings,
  transcriptTimeline,
  waitForDub,
  waitForProjectReady,
  type CallOptions,
  type ElevenLabsDub,
} from './utils/elevenlabs-dubbing';

// ─────────────────────────────────────────────────────────────────────────────
// One job dubs every pending language of a project (docs/dubbing-resumable-uploads.md).
// Two engines, picked per dub:
//
//   Cypher (in-house): Gemini works out who speaks when, each speaker's voice is cut
//   from their own lines, the lines are translated, and Chatterbox on Modal speaks each
//   turn in its speaker's cloned voice. Turns go back at their original times.
//
//   ElevenLabs: one vendor project per model (dubbing_v2, and dubbing_v1 for Bengali),
//   one language target per language under it. ElevenLabs detects and clones the
//   speakers, and its transcripts become the dub's timeline.
//
// Either way each language ends as an MP3 track (dubbed_audio_url), and a video dub has
// that track muxed over the original once the browser has finished uploading it. Every
// stage leaves its result behind, so a failed or cancelled run resumes where it stopped.
//
// The Modal app is frozen: this workspace cannot deploy GPU functions any more (Modal
// wants a card on file), and the endpoint we call predates that rule. So Cypher uses its
// existing contract as-is: called without an output URL it returns the WAV bytes, and
// this worker stores, places and muxes them.
// ─────────────────────────────────────────────────────────────────────────────

// One turn is at most a couple of minutes of speech, well inside this. A hung request
// fails the turn instead of pinning a worker slot forever.
const MODAL_TIMEOUT_MS = 10 * 60 * 1000;
// A cold Modal container or a network blip should not fail a whole dub.
const MODAL_ATTEMPTS = 3;
// The fallback voice when the analysis finds no speaker with enough clean speech.
const VOICE_REFERENCE_SECONDS = 120;
// Target length of a speaker's voice sample, cut from their own lines.
const SPEAKER_REFERENCE_SECONDS = 45;

class DubbingCancelledError extends Error {
  constructor() {
    super('Dubbing cancelled by user');
    this.name = 'DubbingCancelledError';
  }
}

interface DubJobData {
  userId: string;
  projectId: string;
  bullJobId: string;
  inputGsUri: string;   // gs:// audio source, read by Gemini (a legacy dub's whole file)
  inputUrl: string;     // public GCS URL of the same: probed, cut into voice samples, sent to ElevenLabs
  mimeType: string;
  isVideo: boolean;
  durationSeconds: number;
  planName?: string | null;   // for the plan duration cap, re-checked against ffprobe's reading
  reservedCredits: number;    // deducted at enqueue for the languages that need dubbing (0 for a mux-only run)
}

interface OutputRow {
  id: string;
  language: string;
  accent: string | null;
  status: string;
  translation: string[] | null;
  segment_count: number | null;
  segments_done: number;
  vendor_dub_id: string | null;
  dubbed_audio_url: string | null;
  dubbed_url: string | null;
  credits_consumed: number;
}

/** ElevenLabs project ids per model, as stored on dubbing_projects.vendor_projects. */
type VendorProjects = Partial<Record<ElevenLabsDubbingModel, string>>;

interface ProjectRow {
  engine: DubEngine | null;
  video_object: string | null;
  analysis: SourceAnalysis | null;
  source_language: string | null;
  voice_mode: DubVoiceMode | null;
  keyterms: string[] | null;
  vendor_projects: VendorProjects | null;
}

/** Everything one run needs, resolved once. */
interface RunContext {
  job: Job<DubJobData>;
  userId: string;
  projectId: string;
  bucket: string;
  prefix: string;
  inputUrl: string;
  /** Object name of the audio source in `bucket`. */
  inputObject: string;
  dir: string;
  isVideo: boolean;
  durationSeconds: number;
  engine: DubEngine;
  /** What the user said the source is in; null means detect it. */
  sourceLanguage: string | null;
  voiceMode: DubVoiceMode;
  keyterms: string[];
  vendorProjects: VendorProjects;
  /** Serialises writes of vendorProjects, so two models' projects cannot overwrite each other. */
  vendorWrite: Promise<void>;
}

type DubResult = { dubbedUrl: string | null; awaitingVideo?: boolean };

@Processor('dubbing', { concurrency: 2 })
export class DubbingProcessor extends WorkerHost {
  private readonly logger = new Logger(DubbingProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly genAI: GoogleGenAI;

  constructor(@InjectQueue('dubbing') private readonly queue: Queue) {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.supabase = createSupabaseClient(url, key);
    this.genAI = getGenAI();
  }

  /**
   * Cancellation flag set by POST /dubbing/stop/:jobId, checked between stages. Left in
   * place once seen (it expires on its own): several languages may be waiting on
   * ElevenLabs at once, and each of them has to see it.
   */
  private async throwIfCancelled(jobId: string): Promise<void> {
    const client = await this.queue.client;
    if (await client.get(`${DUBBING_CANCEL_PREFIX}${jobId}`)) throw new DubbingCancelledError();
  }

  async process(job: Job<DubJobData>): Promise<DubResult> {
    const { userId, projectId, inputGsUri, inputUrl, isVideo, durationSeconds, planName } = job.data;
    const { bucket, objectName: inputObject } = parseGsUri(inputGsUri);
    const project = await this.loadProject(projectId);
    const engine: DubEngine = project.engine ?? 'cypher';
    const outputs = (await this.loadOutputs(projectId)).filter((o) => o.status !== 'completed');
    const needAudio = outputs.filter((o) => !o.dubbed_audio_url);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dub-'));
    const ctx: RunContext = {
      job, userId, projectId, bucket, prefix: dubProjectPrefix(userId, projectId), inputUrl, inputObject, dir, isVideo, durationSeconds, engine,
      sourceLanguage: project.source_language ?? null,
      voiceMode: project.voice_mode ?? DEFAULT_DUB_VOICE_MODE,
      keyterms: project.keyterms ?? [],
      vendorProjects: { ...(project.vendor_projects ?? {}) },
      vendorWrite: Promise.resolve(),
    };
    // Set once the outcome is written, so the catch below never settles credits twice.
    let settled = false;

    await job.updateProgress(needAudio.length ? 0 : 90);
    await job.log(needAudio.length ? `Dubbing into ${needAudio.map((o) => o.language).join(', ')}...` : 'Finishing the video...');

    try {
      await this.throwIfCancelled(job.id!);
      await this.updateProject(projectId, { status: 'processing' });

      if (needAudio.length) {
        // 1. Measure the source before anything expensive runs. `durationSeconds` came
        //    from the browser and set both the price and the plan cap, and this is the
        //    only independent reading of it in the whole pipeline. Without it, a tampered
        //    value buys a 3-hour dub for one second's worth of credits.
        const probedSec = await probeDurationSeconds(inputUrl);
        this.assertDurationWithinPlan(planName, probedSec, needAudio.map((o) => o.language), engine);
        await this.reprice(ctx, needAudio, probedSec);
        await job.updateProgress(3);

        // 2. Each language's dubbed track. A language that fails is refunded and marked
        //    on its own; the others carry on.
        if (engine === 'elevenlabs') await this.dubWithElevenLabs(ctx, needAudio);
        else await this.dubWithCypher(ctx, needAudio, project.analysis, probedSec ?? durationSeconds);
      }

      // 3. Video dubs get their track muxed over the original, which the browser may
      //    still be uploading. Park atomically: if the upload finished in the meantime
      //    the update matches nothing and the mux runs now; otherwise completing the
      //    upload queues it (see the API).
      const toMux = isVideo
        ? (await this.loadOutputs(projectId)).filter((o) => o.dubbed_audio_url && !o.dubbed_url && o.status !== 'failed')
        : [];
      if (toMux.length && project.video_object && (await this.parkUntilVideoArrives(projectId))) {
        await this.updateOutputs(toMux.map((o) => o.id), { status: 'awaiting_video' });
        settled = true;
        await job.updateProgress(100);
        await job.log('Dubbed audio ready. Waiting for the video upload to finish.');
        return { dubbedUrl: null, awaitingVideo: true };
      }
      if (toMux.length) {
        await this.throwIfCancelled(job.id!);
        await this.updateProject(projectId, { status: 'processing' });
        await this.muxOutputs(ctx, project.video_object ?? inputObject, toMux);
      }

      return await this.finish(ctx, () => { settled = true; });
    } catch (error: any) {
      if (settled) throw error;
      const cancelled = error instanceof DubbingCancelledError;
      // Nothing was delivered for these, so nothing is owed: hand each reservation back
      // before anything else, including before the error is reported.
      await this.failUnfinished(ctx, cancelled ? 'Cancelled by user' : error.message);
      await job.log(cancelled ? 'Cancelled by user.' : `Fatal error: ${error.message}`);
      if (!cancelled) {
        this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
        // User-initiated cancellations aren't failures, never alert on them.
        void reportError(this.supabase, {
          source: 'worker',
          feature: 'dubbing',
          userId,
          error,
          context: { jobId: job.id, projectId, engine, languages: outputs.map((o) => o.language), durationSeconds, planName, isVideo },
        });
      }
      throw error;
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => null);
    }
  }

  // ───────────────────────────── ElevenLabs ─────────────────────────────

  /**
   * Every pending language, on ElevenLabs' side. Languages still following a dub from
   * the legacy route finish there. The rest are grouped by model (dubbing_v2, and
   * dubbing_v1 for Bengali): one project per model, one target per language, all
   * running at once since they run on ElevenLabs, not here.
   */
  private async dubWithElevenLabs(ctx: RunContext, outputs: OutputRow[]): Promise<void> {
    const apiKey = getElevenLabsKey();
    await this.updateProject(ctx.projectId, { status: 'cloning' });
    const opts: CallOptions = {
      apiKey,
      deadline: Date.now() + elevenLabsDeadlineMs(ctx.durationSeconds),
      checkCancelled: () => this.throwIfCancelled(ctx.job.id!),
      onBusy: (ms) => void ctx.job.log(`ElevenLabs is busy with other dubs. Trying again in ${Math.round(ms / 1000)}s...`),
    };
    let finished = 0;
    const progress = async () => {
      finished++;
      await ctx.job.updateProgress(10 + Math.round((80 * finished) / outputs.length));
    };

    const legacy = outputs.filter((o) => parseDub(o.vendor_dub_id)?.kind === 'dub');
    const byModel = new Map<ElevenLabsDubbingModel, OutputRow[]>();
    for (const o of outputs.filter((o) => !legacy.includes(o))) {
      const model = elevenLabsModelFor(o.language);
      byModel.set(model, [...(byModel.get(model) ?? []), o]);
    }

    // allSettled, not all: on a cancel every language must have stopped before the run's
    // failure is written, or one still downloading could land after it was refunded.
    const results = await Promise.allSettled([
      ...legacy.map((o) => this.finishElevenLabsLanguage(ctx, opts, o).finally(progress)),
      ...[...byModel].map(([model, group]) => this.dubElevenLabsModel(ctx, opts, model, group, progress)),
    ]);
    const cancelled = results.find((r) => r.status === 'rejected');
    if (cancelled) throw (cancelled as PromiseRejectedResult).reason;
  }

  /**
   * One model's languages: its project (reused if one is stored, created and stored
   * before anything else otherwise), a target for each language without one (stored the
   * moment it exists), then each language followed to its dubbed track.
   */
  private async dubElevenLabsModel(
    ctx: RunContext,
    opts: CallOptions,
    model: ElevenLabsDubbingModel,
    outputs: OutputRow[],
    progress: () => Promise<void>,
  ): Promise<void> {
    await this.updateOutputs(outputs.map((o) => o.id), { status: 'dubbing' });
    const needTarget = outputs.filter((o) => !parseDub(o.vendor_dub_id));
    let projectId = ctx.vendorProjects[model] ?? null;
    let sourceLanguage = ctx.sourceLanguage;

    try {
      if (needTarget.length) {
        if (!projectId) {
          projectId = await createProject({
            ...opts,
            sourceUrl: this.vendorSourceUrl(ctx),
            modelId: model,
            sourceLanguage: ctx.sourceLanguage,
            keyterms: ctx.keyterms,
            reference: ctx.projectId,
          });
          // Stored before any target: a resumed run reuses this project instead of
          // paying ElevenLabs' up-front charge for a second one.
          await this.saveVendorProject(ctx, model, projectId);
          await ctx.job.log(`ElevenLabs project ${projectId} created (${model}).`);
        }

        // Cloning strength depends on how far the source is from each target. With no
        // source language given, wait for ElevenLabs to detect it first.
        if (model === 'dubbing_v2' && !sourceLanguage) {
          await waitForProjectReady(opts, projectId);
          sourceLanguage = (await getSourceTranscript(opts, projectId).catch(() => null))?.language ?? null;
        }

        for (const o of needTarget) {
          await this.throwIfCancelled(ctx.job.id!);
          const cloningStrength =
            model === 'dubbing_v2'
              ? cloningStrengthFor({ voiceMode: ctx.voiceMode, sourceLanguage, targetLanguage: o.language })
              : null;
          const languageId = await createLanguageTarget({
            ...opts,
            projectId,
            targetLanguage: elevenLabsTargetTag(o.language, o.accent),
            cloningStrength,
            onVoiceSettingsRefused: (reason) =>
              this.logger.warn(`Dub ${ctx.projectId} (${o.language}): ElevenLabs refused cloning strength, dubbing with defaults. ${reason}`),
          });
          // Stored as it lands, so a retry follows this target instead of paying for another.
          o.vendor_dub_id = serializeDub({ kind: 'project', projectId, languageId });
          await this.updateOutputs([o.id], { vendor_dub_id: o.vendor_dub_id });
        }
      }
    } catch (error) {
      if (error instanceof DubbingCancelledError) throw error;
      // The project itself failed: a retry needs a new one.
      if (error instanceof ElevenLabsDubFailedError && error.scope === 'project') {
        await this.saveVendorProject(ctx, model, null);
      }
      // Languages that already have a target keep following it; the rest fail here.
      for (const o of outputs.filter((o) => !parseDub(o.vendor_dub_id))) {
        await this.failOutput(ctx, o, error as Error);
        await progress();
      }
      if (error instanceof ElevenLabsDubFailedError && error.scope === 'project') {
        for (const o of outputs.filter((o) => parseDub(o.vendor_dub_id))) {
          await this.failOutput(ctx, o, error);
          await progress();
        }
        return;
      }
    }

    const started = outputs.filter((o) => o.status !== 'failed' && parseDub(o.vendor_dub_id));
    const results = await Promise.allSettled(
      started.map((o) => this.finishElevenLabsLanguage(ctx, opts, o).finally(progress)),
    );
    const cancelled = results.find((r) => r.status === 'rejected');
    if (cancelled) throw (cancelled as PromiseRejectedResult).reason;
  }

  /** Wait for one language, download it, and store the track with its timeline. */
  private async finishElevenLabsLanguage(ctx: RunContext, opts: CallOptions, o: OutputRow): Promise<void> {
    try {
      await this.updateOutputs([o.id], { status: 'dubbing' });
      const dub = parseDub(o.vendor_dub_id)!;
      const outcome = await waitForDub(opts, dub);
      if (outcome.status === 'stale') {
        await ctx.job.log(`${o.language}: ElevenLabs reports this dub as stale (its transcript changed after it was made). Using its current output.`);
      }

      const downloaded = path.join(ctx.dir, `elevenlabs-${o.language}`);
      await downloadDub(opts, dub, o.language, downloaded);
      const mp3 = path.join(ctx.dir, `${o.language}.mp3`);
      await toMp3(downloaded, mp3);

      const { timeline, warnings } = await this.elevenLabsTimeline(ctx, opts, o, dub, outcome.warnings);
      await this.storeDubbedAudio(ctx, o, mp3, { timeline, warnings: warnings.length ? warnings : null });
      for (const w of warnings.filter((w) => w.type === 'voices_not_permitted')) {
        await ctx.job.log(`${o.language}: ${w.speakerIds?.length ?? 'some'} speaker(s) got a replacement voice, since their own voice could not be cloned.`);
      }
    } catch (error) {
      if (error instanceof DubbingCancelledError) throw error;
      if (error instanceof ElevenLabsDubFailedError && error.scope === 'project') await this.saveVendorProject(ctx, elevenLabsModelFor(o.language), null);
      await this.failOutput(ctx, o, error as Error);
    }
  }

  /**
   * The language's timeline from ElevenLabs' two transcripts, and its warnings. A dub is
   * already delivered when this runs, so nothing here may fail it: a transcript that
   * cannot be read leaves the timeline empty and is logged.
   */
  private async elevenLabsTimeline(
    ctx: RunContext,
    opts: CallOptions,
    o: OutputRow,
    dub: ElevenLabsDub,
    targetWarnings: DubWarning[],
  ): Promise<{ timeline: DubTimelineSegment[] | null; warnings: DubWarning[] }> {
    if (dub.kind !== 'project') return { timeline: null, warnings: targetWarnings };
    try {
      const [source, target] = await Promise.all([
        getSourceTranscript(opts, dub.projectId),
        getTargetTranscript(opts, dub.projectId, dub.languageId),
      ]);
      const timeline = transcriptTimeline(source, target);
      return { timeline: timeline.length ? timeline : null, warnings: targetWarnings };
    } catch (error: any) {
      if (error instanceof DubbingCancelledError) throw error;
      this.logger.warn(`Dub ${ctx.projectId} (${o.language}): could not read the ElevenLabs transcripts: ${error?.message}`);
      return { timeline: null, warnings: targetWarnings };
    }
  }

  /** Record (or forget, with null) a model's ElevenLabs project, one write at a time. */
  private async saveVendorProject(ctx: RunContext, model: ElevenLabsDubbingModel, projectId: string | null): Promise<void> {
    if (projectId) ctx.vendorProjects[model] = projectId;
    else delete ctx.vendorProjects[model];
    const snapshot = { ...ctx.vendorProjects };
    ctx.vendorWrite = ctx.vendorWrite
      .catch(() => undefined)
      .then(() => this.updateProject(ctx.projectId, { vendor_projects: Object.keys(snapshot).length ? snapshot : null }));
    await ctx.vendorWrite;
  }

  /**
   * The URL ElevenLabs fetches the source from. A project returns as soon as its record
   * exists and fetches the source later, so this has to stay readable for hours. The
   * dubbing bucket is public-read, so the public URL does; this is the one place to
   * switch to a long-lived signed URL if that ever changes.
   */
  private vendorSourceUrl(ctx: RunContext): string {
    return gcsPublicUrl(ctx.bucket, ctx.inputObject);
  }

  // ─────────────────────────────── Cypher ───────────────────────────────

  private async dubWithCypher(
    ctx: RunContext,
    outputs: OutputRow[],
    storedAnalysis: SourceAnalysis | null,
    sourceSeconds: number,
  ): Promise<void> {
    const modalUrl = process.env.MODAL_API_URL;
    if (!modalUrl) throw new Error('MODAL_API_URL is not configured');

    const analysis = await this.ensureAnalysis(ctx, storedAnalysis, sourceSeconds);
    if (!analysis.utterances.length) throw new Error('No speech was found in this file to dub.');
    const voices = await this.ensureVoices(ctx, analysis);
    await ctx.job.updateProgress(25);
    await this.updateProject(ctx.projectId, { status: 'cloning' });

    // Languages one after another: every turn is a GPU call, and running languages side
    // by side would only start more Modal containers.
    for (const [index, o] of outputs.entries()) {
      const from = 25 + (65 * index) / outputs.length;
      const span = 65 / outputs.length;
      try {
        await this.dubOneLanguageWithCypher(ctx, o, analysis, voices, modalUrl, from, span);
      } catch (error) {
        if (error instanceof DubbingCancelledError) throw error;
        await this.failOutput(ctx, o, error as Error);
      }
    }
  }

  /**
   * Who speaks when. The audio's own pauses are the clock: ffmpeg maps where the speech
   * is, the source is cut into windows at pauses, Gemini says who said what in each, and
   * every line is placed on the speech it belongs to. Saved after every window, so a
   * failure resumes at the next one.
   */
  private async ensureAnalysis(ctx: RunContext, stored: SourceAnalysis | null, sourceSeconds: number): Promise<SourceAnalysis> {
    if (stored?.complete) return stored;
    let analysis = stored;
    if (!analysis?.windows?.length) {
      await ctx.job.log('Listening for speech...');
      const speech = await detectSpeech(ctx.inputUrl, sourceSeconds);
      if (!speech.length) throw new Error('No speech was found in this file to dub.');
      analysis = {
        speakers: [],
        utterances: [],
        speech,
        windows: planWindows(speech, sourceSeconds, ANALYSIS_WINDOW_SECONDS),
        windowsDone: 0,
        complete: false,
      };
      await this.updateProject(ctx.projectId, { analysis });
    }

    for (let w = analysis.windowsDone; w < analysis.windows.length; w++) {
      await this.throwIfCancelled(ctx.job.id!);
      await ctx.job.log(`Finding the speakers (part ${w + 1} of ${analysis.windows.length})...`);
      const window = analysis.windows[w];
      const local = path.join(ctx.dir, `window-${w}.flac`);
      await cutAnalysisWindow(ctx.inputUrl, window.start, window.end - window.start, local);
      const objectName = `${ctx.prefix}work/analysis/window-${String(w).padStart(3, '0')}.flac`;
      await uploadGcsFile(ctx.bucket, objectName, local, 'audio/flac');

      const heard = await analyzeWindow(this.genAI, `gs://${ctx.bucket}/${objectName}`, 'audio/flac', analysis.speakers);
      const spans = analysis.speech
        .filter((s) => s.end > window.start && s.start < window.end)
        .map((s) => ({ start: Math.max(s.start, window.start), end: Math.min(s.end, window.end) }));
      const placed = alignToSpeech(cleanLines(heard.lines), spans);
      analysis = { ...mergeWindow(analysis, heard.speakers, placed), windowsDone: w + 1 };
      await this.updateProject(ctx.projectId, { analysis });
      await ctx.job.updateProgress(3 + Math.round((17 * (w + 1)) / analysis.windows.length));
    }

    analysis = { ...analysis, complete: true };
    await this.updateProject(ctx.projectId, { analysis });
    await ctx.job.log(`Found ${analysis.speakers.length} speaker${analysis.speakers.length === 1 ? '' : 's'}.`);
    return analysis;
  }

  /**
   * One voice sample per speaker, cut from that speaker's own lines, so each is cloned
   * separately. A speaker with too little clean speech borrows the main voice. Returns the
   * public URL to clone from for every speaker id.
   */
  private async ensureVoices(ctx: RunContext, analysis: SourceAnalysis): Promise<Record<string, string>> {
    const owners = assignVoices(analysis.utterances);
    if (!owners) {
      // Nobody spoke long enough in one go to clone: fall back to one voice for all.
      const fallback = await this.ensureVoiceReference(ctx);
      return Object.fromEntries(analysis.speakers.map((s) => [s.id, fallback]));
    }

    const urls: Record<string, string> = {};
    for (const owner of new Set(Object.values(owners))) {
      const objectName = `${ctx.prefix}work/voices/${owner}.wav`;
      if (!(await gcsObjectExists(ctx.bucket, objectName))) {
        const clips: string[] = [];
        for (const [i, line] of pickReferenceLines(analysis.utterances, owner, SPEAKER_REFERENCE_SECONDS).entries()) {
          const clip = path.join(ctx.dir, `voice-${owner}-${i}.wav`);
          await cutAudioClip(ctx.inputUrl, line.start, line.duration, clip);
          clips.push(clip);
        }
        const sample = path.join(ctx.dir, `voice-${owner}.wav`);
        await concatWavs(clips, path.join(ctx.dir, `voice-${owner}.txt`), sample);
        await uploadGcsFile(ctx.bucket, objectName, sample, 'audio/wav');
      }
      urls[owner] = gcsPublicUrl(ctx.bucket, objectName);
    }

    const speakers = analysis.speakers.map((s) => ({ ...s, voiceOf: owners[s.id] && owners[s.id] !== s.id ? owners[s.id] : null }));
    await this.updateProject(ctx.projectId, { analysis: { ...analysis, speakers } });
    return Object.fromEntries(Object.entries(owners).map(([speaker, owner]) => [speaker, urls[owner]]));
  }

  /** The first two minutes as one voice for everyone. Cut once per dub. */
  private async ensureVoiceReference(ctx: RunContext): Promise<string> {
    const objectName = `${ctx.prefix}work/voice-reference.wav`;
    if (!(await gcsObjectExists(ctx.bucket, objectName))) {
      const local = path.join(ctx.dir, 'voice-reference.wav');
      await extractVoiceReference(ctx.inputUrl, local, VOICE_REFERENCE_SECONDS);
      await uploadGcsFile(ctx.bucket, objectName, local, 'audio/wav');
    }
    return gcsPublicUrl(ctx.bucket, objectName);
  }

  private async dubOneLanguageWithCypher(
    ctx: RunContext,
    o: OutputRow,
    analysis: SourceAnalysis,
    voices: Record<string, string>,
    modalUrl: string,
    progressFrom: number,
    progressSpan: number,
  ): Promise<void> {
    const languageLabel = supportedLanguages.find((l) => l.value === o.language)?.label ?? o.language;
    await this.updateOutputs([o.id], { status: 'dubbing' });

    // Translate line by line, saving after every batch, so a retry never pays twice.
    await ctx.job.log(`Translating to ${languageLabel}...`);
    const translation = await translateLines(
      this.genAI,
      analysis.utterances.map((u) => u.text),
      languageLabel,
      o.translation ?? [],
      (soFar) => this.updateOutputs([o.id], { translation: soFar }),
    );

    // Speak each turn in its speaker's voice and store it as it lands.
    const turns = buildTurns(analysis.utterances, translation);
    if (!turns.length) throw new Error(`Nothing was left to say in ${languageLabel} after translating.`);
    let done = o.segment_count === turns.length ? o.segments_done : 0;
    await this.updateOutputs([o.id], { segment_count: turns.length, segments_done: done });
    const fallbackVoice = Object.values(voices)[0];

    for (; done < turns.length; done++) {
      await this.throwIfCancelled(ctx.job.id!);
      const turn = turns[done];
      await ctx.job.log(`${languageLabel}: line ${done + 1} of ${turns.length} (${turn.speaker})...`);
      const wav = await this.callModalSegment(modalUrl, turn.text, voices[turn.speaker] ?? fallbackVoice, o.language);
      const wavPath = path.join(ctx.dir, 'turn.wav');
      const pcmPath = path.join(ctx.dir, 'turn.pcm');
      await fs.writeFile(wavPath, wav);
      await toDubPcm(wavPath, pcmPath);
      await saveGcsBuffer(ctx.bucket, this.turnObject(ctx.prefix, o.language, done), await fs.readFile(pcmPath), 'application/octet-stream');
      await this.updateOutputs([o.id], { segments_done: done + 1 });
      await ctx.job.updateProgress(Math.round(progressFrom + (progressSpan * (done + 1)) / turns.length));
    }

    // Lay every turn on the source's timeline and encode the finished track.
    await this.throwIfCancelled(ctx.job.id!);
    const mp3 = await this.assembleTurns(ctx, o.language, turns.map((t) => t.start));
    await this.storeDubbedAudio(ctx, o, mp3);
  }

  private turnObject(prefix: string, language: string, index: number): string {
    return `${prefix}work/${language}/turn-${String(index).padStart(4, '0')}.pcm`;
  }

  /**
   * Each turn starts where its line started in the source, or straight after the turn
   * before if that one ran long, with silence in the gaps. Raw PCM makes every duration
   * exact, so placement is byte arithmetic, not a filter graph.
   */
  private async assembleTurns(ctx: RunContext, language: string, starts: number[]): Promise<string> {
    const pieces: string[] = [];
    for (let i = 0; i < starts.length; i++) {
      const local = path.join(ctx.dir, `${language}-turn-${i}.pcm`);
      await downloadGcsFile(ctx.bucket, this.turnObject(ctx.prefix, language, i), local);
      pieces.push(local);
    }
    const sizes = await Promise.all(pieces.map(async (p) => (await fs.stat(p)).size));
    const offsets = placeOnTimeline(starts.map((start, i) => ({ start, duration: sizes[i] / DUB_PCM_BYTES_PER_SECOND })));

    const rawPath = path.join(ctx.dir, `${language}.pcm`);
    const raw = await fs.open(rawPath, 'w');
    try {
      let written = 0;
      for (const [i, piece] of pieces.entries()) {
        // Whole 16-bit samples only, or the rest of the track would play as noise.
        const at = Math.round((offsets[i] * DUB_PCM_BYTES_PER_SECOND) / 2) * 2;
        if (at > written) {
          await raw.write(Buffer.alloc(at - written));
          written = at;
        }
        const data = await fs.readFile(piece);
        await raw.write(data);
        written += data.length;
      }
    } finally {
      await raw.close();
    }

    const mp3 = path.join(ctx.dir, `${language}.mp3`);
    await dubPcmToMp3(rawPath, mp3);
    return mp3;
  }

  /**
   * One turn through Modal's existing contract: JSON { text, reference_url, is_video,
   * language } with no output_put_url, so the endpoint returns the WAV bytes instead of
   * uploading them. MODAL_API_URL is the exact URL `modal deploy` printed for the /dub
   * endpoint (Modal gives each web endpoint its own hostname, nothing is appended).
   * Retried on 5xx and network errors: a cold container or a blip should not fail a dub.
   */
  private async callModalSegment(modalUrl: string, text: string, referenceUrl: string, language: string): Promise<Buffer> {
    let lastError: Error = new Error('Modal was not called');
    for (let attempt = 1; attempt <= MODAL_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(modalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, reference_url: referenceUrl, is_video: false, language }),
          signal: AbortSignal.timeout(MODAL_TIMEOUT_MS),
        });
        if (response.ok) return Buffer.from(await response.arrayBuffer());

        const errBody = await response.text().catch(() => 'Unknown error');
        lastError = new Error(`Modal API error ${response.status}: ${errBody.slice(0, 500)}`);
        if (response.status < 500) throw lastError;
      } catch (error: any) {
        if (error === lastError) throw error;
        lastError = error;
      }
      if (attempt < MODAL_ATTEMPTS) await new Promise((r) => setTimeout(r, 5_000 * attempt));
    }
    throw lastError;
  }

  // ──────────────────────────── Shared stages ───────────────────────────

  /**
   * Store a language's dubbed track. From here its charge is earned: a later failure
   * (the mux) keeps it, and the retry that finishes the mux is free. An audio dub is done.
   */
  private async storeDubbedAudio(
    ctx: RunContext,
    o: OutputRow,
    mp3Path: string,
    extra: { timeline?: DubTimelineSegment[] | null; warnings?: DubWarning[] | null } = {},
  ): Promise<void> {
    const { audio } = dubOutputObjects(ctx.projectId, o.language);
    await uploadGcsFile(ctx.bucket, audio.objectName, mp3Path, audio.contentType);
    o.dubbed_audio_url = gcsPublicUrl(ctx.bucket, audio.objectName);
    await this.updateOutputs([o.id], {
      dubbed_audio_url: o.dubbed_audio_url,
      error_message: null,
      ...extra,
      ...(ctx.isVideo ? {} : { status: 'completed', dubbed_url: o.dubbed_audio_url }),
    });
  }

  /**
   * ponytail: goes through /tmp because ffmpeg needs a seekable MP4. The ceiling is worker
   * disk: the source plus one output at a time, two jobs at a time. A streamed remux is
   * the upgrade if that ever bites, not a bigger disk.
   */
  private async muxOutputs(ctx: RunContext, videoObject: string, outputs: OutputRow[]): Promise<void> {
    await ctx.job.log('Adding the dubbed audio to your video...');
    const videoPath = path.join(ctx.dir, 'source-video');
    await downloadGcsFile(ctx.bucket, videoObject, videoPath);

    for (const o of outputs) {
      try {
        const { audio, video } = dubOutputObjects(ctx.projectId, o.language);
        const audioPath = path.join(ctx.dir, `mux-${o.language}.mp3`);
        await downloadGcsFile(ctx.bucket, audio.objectName, audioPath);
        const outputPath = path.join(ctx.dir, `${o.language}.mp4`);
        await muxDubbedAudio({ audioPath, videoPath, outputPath });
        await uploadGcsFile(ctx.bucket, video.objectName, outputPath, video.contentType);
        await fs.rm(outputPath, { force: true });
        await this.updateOutputs([o.id], {
          status: 'completed',
          dubbed_url: gcsPublicUrl(ctx.bucket, video.objectName),
          error_message: null,
        });
      } catch (error) {
        await this.failOutput(ctx, o, error as Error);
      }
    }
  }

  /**
   * A language failed on its own. Without a delivered track it is refunded and costs
   * nothing; with one, the charge stands and a retry only redoes the mux. An ElevenLabs
   * dub that ElevenLabs itself failed is forgotten, so the retry starts a new one.
   */
  private async failOutput(ctx: RunContext, o: OutputRow, error: Error): Promise<void> {
    const delivered = !!o.dubbed_audio_url;
    if (!delivered) await this.refundCredits(ctx.userId, o.credits_consumed);
    await ctx.job.log(`${o.language} failed: ${error.message}`);
    this.logger.warn(`Dub ${ctx.projectId} (${o.language}) failed: ${error.message}`);
    await this.updateOutputs([o.id], {
      status: 'failed',
      error_message: error.message?.slice(0, 2000),
      ...(delivered ? {} : { credits_consumed: 0 }),
      ...(error instanceof ElevenLabsDubFailedError ? { vendor_dub_id: null } : {}),
    });
    if (!delivered) o.credits_consumed = 0;
    o.status = 'failed';
  }

  /** The whole run stopped: fail every language that is not finished, refunding the undelivered. */
  private async failUnfinished(ctx: RunContext, message: string): Promise<void> {
    try {
      for (const o of await this.loadOutputs(ctx.projectId)) {
        if (o.status === 'completed' || o.status === 'failed') continue;
        await this.failOutput(ctx, o, new Error(message));
      }
      await this.writeProjectTotals(ctx.projectId, { status: 'failed', error_message: message.slice(0, 5000) });
    } catch (updateError: any) {
      this.logger.error(
        `Job ${ctx.job.id}: failed to persist the failure of dub ${ctx.projectId}: ${updateError?.message}`,
        updateError?.stack,
      );
    }
  }

  /**
   * Write the project's outcome from its languages. Every language failing fails the job
   * (so the progress stream reports it); a partial failure completes it, with the failed
   * languages marked for a retry.
   */
  private async finish(ctx: RunContext, markSettled: () => void): Promise<DubResult> {
    const outputs = await this.loadOutputs(ctx.projectId);
    const failed = outputs.filter((o) => o.status === 'failed');
    const done = outputs.filter((o) => o.status === 'completed');
    const errorMessage = failed.length ? (await this.outputErrors(ctx.projectId)) || 'Dubbing failed.' : null;

    await this.writeProjectTotals(ctx.projectId, {
      status: failed.length ? 'failed' : 'completed',
      error_message: errorMessage?.slice(0, 5000) ?? null,
      // Older readers of the row still look at the project's own dubbed_url.
      dubbed_url: done[0]?.dubbed_url ?? null,
    });
    markSettled();
    await ctx.job.updateProgress(100);

    if (!done.length) throw new Error(errorMessage ?? 'Dubbing failed.');
    await ctx.job.log(failed.length ? `Done, with ${failed.length} language(s) failed.` : 'Done!');
    return { dubbedUrl: done[0].dubbed_url };
  }

  private async outputErrors(projectId: string): Promise<string> {
    const { data } = await this.supabase
      .from('dubbing_outputs')
      .select('language, error_message')
      .eq('project_id', projectId)
      .eq('status', 'failed');
    return (data ?? []).map((o: any) => `${o.language}: ${o.error_message ?? 'failed'}`).join(' | ');
  }

  /** Project status plus the credits its languages now hold, in one write. */
  private async writeProjectTotals(projectId: string, fields: Record<string, any>): Promise<void> {
    const outputs = await this.loadOutputs(projectId);
    const credits = outputs.reduce((sum, o) => sum + Number(o.credits_consumed ?? 0), 0);
    await this.updateProject(projectId, { ...fields, credits_consumed: credits });
  }

  /**
   * Conditional on the video still uploading, so it cannot race the API marking the
   * upload complete: exactly one side sees the other's write.
   */
  private async parkUntilVideoArrives(projectId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .update({ status: 'awaiting_video' })
      .eq('project_id', projectId)
      .eq('video_status', 'uploading')
      .select('project_id');
    if (error) throw new Error(`dubbing_projects update failed: ${error.message}`);
    return !!data?.length;
  }

  // ─────────────────────────────── Credits ──────────────────────────────

  /**
   * Charge what the measured source says, not what the browser claimed, for every
   * language being dubbed. A null reading means the container declared no duration and
   * the client's number stands. That is rare, and not worth failing a paid dub over.
   */
  private async reprice(ctx: RunContext, outputs: OutputRow[], probedSec: number | null): Promise<void> {
    if (!probedSec) {
      this.logger.warn(`Dub ${ctx.projectId}: ffprobe read no duration, priced on the client's ${ctx.durationSeconds}s.`);
      return;
    }
    const charged = outputs.reduce((sum, o) => sum + Number(o.credits_consumed ?? 0), 0);
    const owedTotal = await this.settleCredits(ctx.userId, charged, probedSec, ctx.job, outputs.length, ctx.engine);
    const perLanguage = owedTotal / outputs.length;
    for (const o of outputs) o.credits_consumed = perLanguage;
    await this.updateOutputs(outputs.map((o) => o.id), { credits_consumed: perLanguage });
    await this.writeProjectTotals(ctx.projectId, {});
  }

  /**
   * Bring the amount already deducted in line with what the dub actually costs at the
   * measured duration, and return the new total.
   *
   * Charging more can fail (the user may not hold the difference), and it must fail the
   * job rather than deliver, because this runs before anything is dubbed. Refunding the
   * difference cannot fail in a way worth stopping for.
   */
  private async settleCredits(
    userId: string,
    charged: number,
    actualDurationSeconds: number,
    job: Job<DubJobData>,
    languages: number,
    engine: DubEngine,
  ): Promise<number> {
    // Same plan- and engine-aware rate the API reserved at. Resolving it differently here
    // would settle a Starter dub at the paid rate and silently refund most of the charge.
    const multiplier = dubbingMultiplierForPlan(job.data.planName, paidDubbingMultiplier(engine, process.env));
    const owed = calculateDubbingCreditsByDuration(actualDurationSeconds, multiplier) * languages;
    const delta = owed - charged;
    if (delta === 0) return owed;

    if (delta > 0) {
      const { error } = await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -delta,
      });
      if (error) {
        throw new Error(
          `This clip is ${Math.round(actualDurationSeconds)}s and costs ${owed} credits, more than your balance covers. Top up or trim the clip.`,
        );
      }
      await job.log(`Clip measured ${Math.round(actualDurationSeconds)}s: ${delta} more credits charged.`);
      return owed;
    }

    await this.refundCredits(userId, -delta);
    await job.log(`Clip measured ${Math.round(actualDurationSeconds)}s: ${-delta} credits returned.`);
    return owed;
  }

  /** Give credits back. Never throws: a failed refund must not mask the original error. */
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

  /** The measured length against the plan cap, tightened by the languages' routes on the engine. */
  private assertDurationWithinPlan(
    planName: string | null | undefined,
    seconds: number | null,
    languages: string[],
    engine: DubEngine,
  ): void {
    if (!seconds || isDubDurationAllowed(planName, seconds, languages, engine)) return;
    throw new Error(
      `This clip is ${Math.round(seconds)}s, over the ` +
        `${formatDubDuration(maxDubSecondsForPlan(planName, languages, engine))} limit on your plan.`,
    );
  }

  // ─────────────────────────────── Rows ─────────────────────────────────

  private async loadProject(projectId: string): Promise<ProjectRow> {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .select('engine, video_object, analysis, source_language, voice_mode, keyterms, vendor_projects')
      .eq('project_id', projectId)
      .single();
    if (error || !data) throw new Error(`dubbing_projects read failed: ${error?.message ?? 'row not found'}`);
    return data;
  }

  private async loadOutputs(projectId: string): Promise<OutputRow[]> {
    const { data, error } = await this.supabase
      .from('dubbing_outputs')
      .select('id, language, accent, status, translation, segment_count, segments_done, vendor_dub_id, dubbed_audio_url, dubbed_url, credits_consumed')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`dubbing_outputs read failed: ${error.message}`);
    return (data ?? []) as OutputRow[];
  }

  private async updateOutputs(ids: string[], fields: Record<string, any>): Promise<void> {
    if (!ids.length) return;
    const { error } = await this.supabase.from('dubbing_outputs').update(fields).in('id', ids);
    if (error) throw new Error(`dubbing_outputs update failed: ${error.message}`);
  }

  private async updateProject(projectId: string, fields: Record<string, any>): Promise<void> {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .update({ ...fields })
      .eq('project_id', projectId)
      .select('project_id')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to update dubbing_projects project_id=${projectId}. fields=${Object.keys(fields).join(', ')} error=${error?.message ?? 'no rows updated (RLS or missing row)'}`,
      );
      throw new Error(`dubbing_projects update failed: ${error?.message ?? 'row not found or RLS blocked'}`);
    }
  }
}
