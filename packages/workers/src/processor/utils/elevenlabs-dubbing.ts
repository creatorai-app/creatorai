import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { usesDubbingV1 } from '@repo/validation';

// The ElevenLabs Dubbing API, one dub per target language. ElevenLabs transcribes,
// separates and clones every speaker itself (`num_speakers: 0` auto-detects them, up to
// 32 per file), so the worker only sends the audio, follows the dub and fetches the result.
// https://elevenlabs.io/docs/api-reference/dubbing/create

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const POLL_INTERVAL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000;
// A 3-hour source can take a long time to dub; a stall anywhere still frees the slot.
const DUB_DEADLINE_MS = 90 * 60 * 1000;

export function getElevenLabsKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not configured');
  return key;
}

/** ElevenLabs itself reported the dub failed: a retry must start a new dub, not follow this one. */
export class ElevenLabsDubFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElevenLabsDubFailedError';
  }
}

/**
 * A running dub, as stored on the output row so a resumed run follows it instead of
 * paying for a second one. Two routes: the default /v1/dubbing, and the dubbing *project*
 * API pinned to dubbing_v1 for the languages the default route refuses (Bengali).
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

async function failWithDetail(response: Response, what: string): Promise<never> {
  const detail = await response.text().catch(() => '');
  // Cloned voices count against the workspace voice limit, and the dub is rejected
  // outright when none are free: worth naming, it is not a retry.
  if (response.status === 403 && /voice/i.test(detail)) {
    throw new Error('ElevenLabs dubbing is temporarily unavailable: its voice capacity is full. Please try again later.');
  }
  throw new Error(`ElevenLabs ${what} failed (${response.status}): ${detail.slice(0, 400)}`);
}

/** Start a dub from a public URL of the source. Voice cloning stays at its default (on). */
export async function createDub(
  apiKey: string,
  sourceUrl: string,
  targetLanguage: string,
  targetAccent?: string | null,
): Promise<ElevenLabsDub> {
  const form = new FormData();
  form.append('source_url', sourceUrl);

  if (usesDubbingV1(targetLanguage)) {
    // dubbing_v1 takes no accent; languages on this route offer none in the UI.
    form.append('target_language', targetLanguage);
    form.append('model_id', 'dubbing_v1');
    const response = await fetch(`${ELEVENLABS_API}/dubbing/project`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) await failWithDetail(response, 'dubbing');
    const data = (await response.json()) as { project_id?: string; language_ids?: string[] };
    const languageId = data.language_ids?.[0];
    if (!data.project_id || !languageId) throw new Error('ElevenLabs did not return a dubbing project');
    return { kind: 'project', projectId: data.project_id, languageId };
  }

  form.append('target_lang', targetLanguage);
  form.append('num_speakers', '0'); // auto-detect, so each speaker gets their own clone
  if (targetAccent) form.append('target_accent', targetAccent);
  const response = await fetch(`${ELEVENLABS_API}/dubbing`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) await failWithDetail(response, 'dubbing');
  const data = (await response.json()) as { dubbing_id?: string };
  if (!data.dubbing_id) throw new Error('ElevenLabs did not return a dubbing id');
  return { kind: 'dub', dubbingId: data.dubbing_id };
}

async function getJson<T>(url: string, apiKey: string): Promise<T> {
  const response = await fetch(url, { headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) await failWithDetail(response, 'status check');
  return (await response.json()) as T;
}

/**
 * Poll until the dub is ready. `checkCancelled` runs every round so a cancel stops the
 * wait. A project dub moves in two steps: the project transcribes (`ready`), then the
 * language renders (`completed`); one loop against one deadline covers both.
 */
export async function waitForDub(apiKey: string, dub: ElevenLabsDub, checkCancelled: () => Promise<void>): Promise<void> {
  const deadline = Date.now() + DUB_DEADLINE_MS;
  while (Date.now() < deadline) {
    await checkCancelled();

    if (dub.kind === 'dub') {
      const data = await getJson<{ status?: string; error?: string }>(`${ELEVENLABS_API}/dubbing/${dub.dubbingId}`, apiKey);
      if (data.status === 'dubbed') return;
      if (data.status === 'failed') throw new ElevenLabsDubFailedError(`ElevenLabs dubbing failed: ${data.error ?? 'no reason given'}`);
    } else {
      const base = `${ELEVENLABS_API}/dubbing/project/${dub.projectId}`;
      const project = await getJson<{ status?: string; error?: { message?: string } | null }>(base, apiKey);
      if (project.status === 'failed') {
        throw new ElevenLabsDubFailedError(`ElevenLabs dubbing failed: ${project.error?.message ?? 'no reason given'}`);
      }
      if (project.status === 'ready') {
        const language = await getJson<{ status?: string; error?: { message?: string } | null }>(
          `${base}/language/${dub.languageId}`, apiKey,
        );
        if (language.status === 'completed') return;
        if (language.status === 'failed') {
          throw new ElevenLabsDubFailedError(`ElevenLabs dubbing failed: ${language.error?.message ?? 'no reason given'}`);
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error('ElevenLabs dubbing took too long and timed out. Please retry.');
}

/**
 * Save the finished dub to `destination`. The default route streams the dubbed file
 * (MP3 or MP4); a dubbing_v1 project hands back a signed URL to lossless audio.
 */
export async function downloadDub(apiKey: string, dub: ElevenLabsDub, targetLanguage: string, destination: string): Promise<void> {
  let response: Response;
  if (dub.kind === 'dub') {
    response = await fetch(`${ELEVENLABS_API}/dubbing/${dub.dubbingId}/audio/${targetLanguage}`, {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } else {
    const language = await getJson<{ outputs?: { lossless_audio?: string | null } | null }>(
      `${ELEVENLABS_API}/dubbing/project/${dub.projectId}/language/${dub.languageId}`, apiKey,
    );
    const audioUrl = language.outputs?.lossless_audio;
    if (!audioUrl) throw new Error('ElevenLabs finished the dub but returned no audio track');
    response = await fetch(audioUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }
  if (!response.ok || !response.body) await failWithDetail(response, 'download');
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(destination));
}
