import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { DubTimelineSegment, DubWarning, ElevenLabsDubbingModel } from '@repo/validation';

// The ElevenLabs Dubbing *project* API. One project per source and model: ElevenLabs
// fetches and transcribes the source once (the project turns `ready`), then each target
// language is a language target under it, dubbed with every speaker cloned. The worker
// sends the source URL, adds the targets, follows them and fetches the results.
// https://elevenlabs.io/docs/api-reference/dubbing/create-project
//
// Charging, per ElevenLabs: creating a project charges one language up front, which the
// first target consumes; every further target is charged on its own. So a project is
// never created twice for one dub (its id is stored before anything else happens), and
// a target is never created twice for one language (its id is stored the moment it
// exists). The legacy POST /v1/dubbing route is only followed, for dubs started on it.

export const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const POLL_INTERVAL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000;
// A 3-hour source can take a long time to dub; a stall anywhere still frees the slot.
const MIN_DUB_DEADLINE_MS = 90 * 60 * 1000;
// Waiting out a full concurrency slot: from 5 s, doubling to a minute, with jitter so two
// jobs waiting on the same workspace do not retry in lockstep.
const BUSY_BACKOFF_MIN_MS = 5_000;
const BUSY_BACKOFF_MAX_MS = 60_000;

/** Timing hooks, swapped out by the tests so a backoff does not really wait. */
export const elevenLabsClock = {
  now: () => Date.now(),
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  random: () => Math.random(),
};

export function getElevenLabsKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not configured');
  return key;
}

/**
 * How long one dub may wait on ElevenLabs: 90 minutes, or one and a half times the
 * source for anything longer, so a 3-hour source is not timed out while it is dubbed.
 */
export function elevenLabsDeadlineMs(sourceSeconds: number): number {
  return Math.max(MIN_DUB_DEADLINE_MS, Math.ceil(sourceSeconds * 1.5) * 1000);
}

/**
 * ElevenLabs itself reported the work failed: a retry must start new work, not follow
 * this. `scope` says what failed: a `project` (the source could not be prepared, so a
 * retry needs a new project) or one `target` (a retry adds a new target to the project).
 */
export class ElevenLabsDubFailedError extends Error {
  constructor(message: string, readonly scope: 'project' | 'target' = 'target') {
    super(message);
    this.name = 'ElevenLabsDubFailedError';
  }
}

/**
 * A running dub, as stored on the output row so a resumed run follows it instead of
 * paying for a second one. `project:<projectId>:<languageId>` is a language target on the
 * project API (every new dub); `dub:<dubbingId>` is a dub started on the legacy
 * /v1/dubbing route before this, still followed and downloaded there.
 */
export type ElevenLabsDub =
  | { kind: 'dub'; dubbingId: string }
  | { kind: 'project'; projectId: string; languageId: string };

export function serializeDub(dub: ElevenLabsDub): string {
  return dub.kind === 'dub' ? `dub:${dub.dubbingId}` : `project:${dub.projectId}:${dub.languageId}`;
}

export function parseDub(value: string | null | undefined): ElevenLabsDub | null {
  const [kind, a, b] = (value ?? '').split(':');
  if (kind === 'dub' && a) return { kind: 'dub', dubbingId: a };
  if (kind === 'project' && a && b) return { kind: 'project', projectId: a, languageId: b };
  return null;
}

/** ElevenLabs' `DubbingError`: `{ message_type: "error", error: "<reason>" }`. */
interface DubbingError {
  message_type?: string;
  error?: string | null;
}

interface RawWarning {
  type?: string;
  speaker_ids?: string[];
  message?: string;
}

export interface ProjectState {
  project_id: string;
  status: 'queued' | 'preparing' | 'processing' | 'ready' | 'failed' | string;
  source_language?: string | null;
  model_id?: string | null;
  error?: DubbingError | null;
  warnings?: RawWarning[] | null;
}

export interface TargetState {
  language_id: string;
  project_id: string;
  target_language: string;
  status: 'queued' | 'processing' | 'completed' | 'stale' | 'failed' | string;
  outputs?: { lossless_audio?: string | null } | null;
  error?: DubbingError | null;
  warnings?: RawWarning[] | null;
}

/** The reason in an ElevenLabs error body, whatever shape it came in. */
export function errorReason(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.error === 'string') return parsed.error;
    if (typeof parsed?.error?.error === 'string') return parsed.error.error;
    const detail = parsed?.detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail?.message === 'string') return detail.message;
    if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg;
    if (typeof parsed?.message === 'string') return parsed.message;
  } catch {
    // Not JSON: the text itself is the reason.
  }
  return body.trim() ? body.trim().slice(0, 400) : null;
}

/** The reason on a failed project or target, from its `error.error` field. */
function failureReason(error: DubbingError | null | undefined): string {
  return typeof error?.error === 'string' && error.error.trim() ? error.error.trim() : 'no reason given';
}

/**
 * A full concurrency slot or a rate limit, not a fault: the request did nothing and can
 * be sent again. ElevenLabs answers these with 429 and a `detail` naming the cause
 * (`too_many_concurrent_requests`, or `system_busy`), so any 429 counts, and so does a
 * body naming concurrency under another status.
 */
export function isBusyResponse(status: number, body: string): boolean {
  if (status === 429) return true;
  return /too_many_concurrent_requests|concurrent_requests|system_busy/i.test(body);
}

function busyBackoffMs(attempt: number): number {
  const base = Math.min(BUSY_BACKOFF_MAX_MS, BUSY_BACKOFF_MIN_MS * 2 ** attempt);
  return Math.round(base * (0.5 + elevenLabsClock.random()));
}

export interface CallOptions {
  apiKey: string;
  /** Runs before every wait, so a cancel stops a backoff or a poll. */
  checkCancelled: () => Promise<void>;
  /** Epoch ms after which waiting on ElevenLabs gives up. */
  deadline: number;
  /** Called once per backoff, for the job log. */
  onBusy?: (waitMs: number) => void;
}

/** An ElevenLabs HTTP error, with the status and body kept for callers that branch on them. */
export class ElevenLabsHttpError extends Error {
  constructor(message: string, readonly status: number, readonly body: string) {
    super(message);
    this.name = 'ElevenLabsHttpError';
  }
}

function turnIntoError(status: number, body: string, what: string): ElevenLabsHttpError {
  // Cloned voices count against the workspace voice limit, and the dub is rejected
  // outright when none are free: worth naming, it is not a retry.
  if (status === 403 && /voice/i.test(body) && /limit|capacity|slots?/i.test(body)) {
    return new ElevenLabsHttpError(
      'ElevenLabs dubbing is temporarily unavailable: its voice capacity is full. Please try again later.', status, body,
    );
  }
  return new ElevenLabsHttpError(`ElevenLabs ${what} failed (${status}): ${errorReason(body) ?? 'no reason given'}`, status, body);
}

/**
 * One ElevenLabs call. A busy answer is waited out (backoff with jitter, cancel checked
 * around every wait) until the deadline: it means nothing happened, so even a create is
 * safe to send again. A read also survives a 5xx or a dropped connection; a create does
 * not, because it may have gone through and a second one would be charged again.
 */
export async function callElevenLabs(
  opts: CallOptions,
  url: string,
  init: RequestInit,
  what: string,
  { idempotent }: { idempotent: boolean },
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { 'xi-api-key': opts.apiKey, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error: any) {
      if (!idempotent || elevenLabsClock.now() >= opts.deadline) throw error;
      await waitBeforeRetry(opts, attempt);
      continue;
    }
    if (response.ok) return response;

    const body = await response.text().catch(() => '');
    const busy = isBusyResponse(response.status, body);
    if (!busy && !(idempotent && response.status >= 500)) throw turnIntoError(response.status, body, what);
    if (elevenLabsClock.now() >= opts.deadline) {
      throw new Error(`ElevenLabs stayed busy past the time allowed for this dub (${what}). Please retry.`);
    }
    await waitBeforeRetry(opts, attempt);
  }
}

async function waitBeforeRetry(opts: CallOptions, attempt: number): Promise<void> {
  const ms = busyBackoffMs(attempt);
  opts.onBusy?.(ms);
  await opts.checkCancelled();
  await elevenLabsClock.sleep(ms);
  await opts.checkCancelled();
}

async function getJson<T>(opts: CallOptions, url: string, what: string): Promise<T> {
  const response = await callElevenLabs(opts, url, { method: 'GET' }, what, { idempotent: true });
  return (await response.json()) as T;
}

/**
 * Create a dubbing project from a URL of the source. The model is sent explicitly, and
 * no `target_language` shortcut is used: targets are added one by one afterwards, so
 * each can carry its own voice settings and have its id stored as it is created.
 */
export async function createProject(
  opts: CallOptions & {
    sourceUrl: string;
    modelId: ElevenLabsDubbingModel;
    sourceLanguage?: string | null;
    keyterms?: readonly string[] | null;
    reference: string;
  },
): Promise<string> {
  const form = new FormData();
  form.append('source_url', opts.sourceUrl);
  form.append('model_id', opts.modelId);
  form.append('reference', opts.reference.slice(0, 500));
  if (opts.sourceLanguage) form.append('source_language', opts.sourceLanguage);
  for (const term of opts.keyterms ?? []) form.append('keyterms', term);

  const response = await callElevenLabs(opts, `${ELEVENLABS_API}/dubbing/project`, { method: 'POST', body: form }, 'project create', {
    idempotent: false,
  });
  const data = (await response.json()) as { project_id?: string };
  if (!data.project_id) throw new Error('ElevenLabs did not return a dubbing project');
  return data.project_id;
}

export function getProject(opts: CallOptions, projectId: string): Promise<ProjectState> {
  return getJson<ProjectState>(opts, `${ELEVENLABS_API}/dubbing/project/${projectId}`, 'project status check');
}

/** Poll until the project has transcribed its source. A failed project cannot be reused. */
export async function waitForProjectReady(opts: CallOptions, projectId: string): Promise<ProjectState> {
  while (elevenLabsClock.now() < opts.deadline) {
    await opts.checkCancelled();
    const project = await getProject(opts, projectId);
    if (project.status === 'ready') return project;
    if (project.status === 'failed') {
      throw new ElevenLabsDubFailedError(`ElevenLabs could not prepare the source: ${failureReason(project.error)}`, 'project');
    }
    await elevenLabsClock.sleep(POLL_INTERVAL_MS);
  }
  throw new Error('ElevenLabs took too long to prepare the source and timed out. Please retry.');
}

/**
 * Add one language to a project and queue its dub. `targetLanguage` is a base code or
 * one of v2's dialect tags. `cloningStrength` is a Dubbing v2 setting: pass it only for a
 * v2 project. Returns the new target's id.
 *
 * If ElevenLabs refuses the voice settings themselves (a 422 naming them), the target is
 * created once more without them: the dub is worth more than the setting. Nothing was
 * created by the refused request, so this cannot double-charge.
 */
export async function createLanguageTarget(
  opts: CallOptions & {
    projectId: string;
    targetLanguage: string;
    cloningStrength?: number | null;
    onVoiceSettingsRefused?: (reason: string) => void;
  },
): Promise<string> {
  const send = (withSettings: boolean) =>
    callElevenLabs(
      opts,
      `${ELEVENLABS_API}/dubbing/project/${opts.projectId}/language`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_language: opts.targetLanguage,
          ...(withSettings ? { voice_settings: { cloning_strength: opts.cloningStrength } } : {}),
        }),
      },
      'language target create',
      { idempotent: false },
    );

  const withSettings = opts.cloningStrength !== null && opts.cloningStrength !== undefined;
  let response: Response;
  try {
    response = await send(withSettings);
  } catch (error) {
    const refusedSettings =
      withSettings && error instanceof ElevenLabsHttpError && error.status === 422 && /voice_settings|cloning_strength/i.test(error.body);
    if (!refusedSettings) throw error;
    opts.onVoiceSettingsRefused?.(error.message);
    response = await send(false);
  }
  const data = (await response.json()) as { language_id?: string };
  if (!data.language_id) throw new Error('ElevenLabs did not return a language target');
  return data.language_id;
}

export function getLanguageTarget(opts: CallOptions, projectId: string, languageId: string): Promise<TargetState> {
  return getJson<TargetState>(opts, `${ELEVENLABS_API}/dubbing/project/${projectId}/language/${languageId}`, 'language status check');
}

export type DubOutcome = { status: 'completed' | 'stale'; warnings: DubWarning[] };

/**
 * Poll until the dub is ready. `completed` is done. `stale` means the target has an
 * output that no longer matches an edited transcript; nothing here edits transcripts, so
 * it is taken as done and reported. `failed` throws, with ElevenLabs' own reason; a
 * target that failed because its project did reads the project for the real cause.
 */
export async function waitForDub(opts: CallOptions, dub: ElevenLabsDub): Promise<DubOutcome> {
  while (elevenLabsClock.now() < opts.deadline) {
    await opts.checkCancelled();

    if (dub.kind === 'dub') {
      // Legacy route: its GET returns `error` as a plain string.
      const data = await getJson<{ status?: string; error?: string | null }>(opts, `${ELEVENLABS_API}/dubbing/${dub.dubbingId}`, 'status check');
      if (data.status === 'dubbed') return { status: 'completed', warnings: [] };
      if (data.status === 'failed') {
        throw new ElevenLabsDubFailedError(`ElevenLabs dubbing failed: ${data.error?.trim() || 'no reason given'}`);
      }
    } else {
      const target = await getLanguageTarget(opts, dub.projectId, dub.languageId);
      if (target.status === 'completed' || target.status === 'stale') {
        return { status: target.status, warnings: toWarnings(target.warnings) };
      }
      if (target.status === 'failed') {
        if (target.error?.error === 'project_failed') {
          const project = await getProject(opts, dub.projectId);
          throw new ElevenLabsDubFailedError(`ElevenLabs could not prepare the source: ${failureReason(project.error)}`, 'project');
        }
        throw new ElevenLabsDubFailedError(`ElevenLabs dubbing failed: ${failureReason(target.error)}`);
      }
    }

    await elevenLabsClock.sleep(POLL_INTERVAL_MS);
  }
  throw new Error('ElevenLabs dubbing took too long and timed out. Please retry.');
}

/**
 * Save the finished dub to `destination`. A project target is re-read right before the
 * download, because its signed `lossless_audio` URL expires an hour after it is issued;
 * if the URL is refused anyway (it expired between the read and the request) it is read
 * once more. The legacy route streams the dubbed file itself.
 */
export async function downloadDub(opts: CallOptions, dub: ElevenLabsDub, targetLanguage: string, destination: string): Promise<void> {
  let response: Response;
  if (dub.kind === 'dub') {
    response = await callElevenLabs(opts, `${ELEVENLABS_API}/dubbing/${dub.dubbingId}/audio/${targetLanguage}`, { method: 'GET' }, 'download', {
      idempotent: true,
    });
  } else {
    response = await fetchLosslessAudio(opts, dub);
    if (!response.ok && [400, 401, 403, 404, 410].includes(response.status)) {
      await response.body?.cancel().catch(() => null);
      response = await fetchLosslessAudio(opts, dub);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw turnIntoError(response.status, body, 'download');
    }
  }
  if (!response.body) throw new Error('ElevenLabs returned an empty download');
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(destination));
}

async function fetchLosslessAudio(opts: CallOptions, dub: Extract<ElevenLabsDub, { kind: 'project' }>): Promise<Response> {
  const target = await getLanguageTarget(opts, dub.projectId, dub.languageId);
  const audioUrl = target.outputs?.lossless_audio;
  if (!audioUrl) throw new Error('ElevenLabs finished the dub but returned no audio track');
  // A signed storage URL: no API key on it.
  return fetch(audioUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

export interface SourceTranscript {
  language?: string | null;
  segments: { id: string; text: string; speaker_id: string; start_s: number; end_s: number }[];
}

export interface TargetTranscript {
  source_language?: string | null;
  target_language: string;
  segments: {
    id: string;
    speaker_id: string;
    start_s: number;
    end_s: number;
    source_text: string;
    translation?: string | null;
  }[];
}

/** The project's source transcript, with the language ElevenLabs detected or was told. */
export function getSourceTranscript(opts: CallOptions, projectId: string): Promise<SourceTranscript> {
  return getJson<SourceTranscript>(opts, `${ELEVENLABS_API}/dubbing/project/${projectId}/transcript`, 'source transcript');
}

/**
 * A target's transcript: the source segments with their translations. ElevenLabs answers
 * with a conflict until the target has produced its first output; that comes back as null.
 */
export async function getTargetTranscript(opts: CallOptions, projectId: string, languageId: string): Promise<TargetTranscript | null> {
  try {
    return await getJson<TargetTranscript>(opts, `${ELEVENLABS_API}/dubbing/project/${projectId}/language/${languageId}/transcript`, 'target transcript');
  } catch (error) {
    if (error instanceof ElevenLabsHttpError && error.status === 409) return null;
    throw error;
  }
}

/**
 * The dub's timeline from ElevenLabs' transcripts: the target's when it has one (it
 * carries the translation), otherwise the source's with no translation yet.
 */
export function transcriptTimeline(source: SourceTranscript | null, target: TargetTranscript | null): DubTimelineSegment[] {
  if (target?.segments?.length) {
    return target.segments.map((s) => ({
      id: s.id,
      speaker: s.speaker_id,
      start: s.start_s,
      end: s.end_s,
      sourceText: s.source_text ?? '',
      translation: s.translation ?? null,
    }));
  }
  return (source?.segments ?? []).map((s) => ({
    id: s.id,
    speaker: s.speaker_id,
    start: s.start_s,
    end: s.end_s,
    sourceText: s.text ?? '',
    translation: null,
  }));
}

/** ElevenLabs' warnings, keyed on `type` (their wording may change; the type does not). */
export function toWarnings(raw: RawWarning[] | null | undefined): DubWarning[] {
  return (raw ?? [])
    .filter((w) => typeof w?.type === 'string')
    .map((w) => ({
      type: w.type!,
      ...(Array.isArray(w.speaker_ids) ? { speakerIds: w.speaker_ids } : {}),
      ...(typeof w.message === 'string' ? { message: w.message } : {}),
    }));
}

/** Project and target warnings together, one entry per type and speaker set. */
export function mergeWarnings(...lists: DubWarning[][]): DubWarning[] {
  const seen = new Set<string>();
  return lists.flat().filter((w) => {
    const key = `${w.type}|${[...(w.speakerIds ?? [])].sort().join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
