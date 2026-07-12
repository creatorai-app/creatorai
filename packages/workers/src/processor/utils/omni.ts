import { GoogleGenAI } from '@google/genai';
import { getGenAI } from './genai';

/**
 * Gemini Omni Flash video generation via the Interactions API (@google/genai ≥ 2.x),
 * on VERTEX AI — same Application Default Credentials (the service-account JSON key in
 * GOOGLE_APPLICATION_CREDENTIALS, role roles/aiplatform.user) as every other Gemini
 * feature. No API key is used.
 *
 * On Vertex, URI delivery writes the clip straight to GCS via `response_format.gcs_uri`
 * (like Veo did), so we get back a gs:// URI and don't buffer bytes. Inline base64 (small
 * clips) is the fallback path, handed back for the caller to upload.
 */

export type OmniTask = 'text_to_video' | 'image_to_video' | 'reference_to_video' | 'edit';

export interface OmniImageInput {
  data: string; // base64, no data-URL prefix
  mimeType: string;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 120; // ~10 min ceiling
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Omni may not be served at the same Vertex location as the other models (which default
// to `global`). GEMINI_VIDEO_LOCATION lets video-gen target a specific region (e.g.
// us-central1) with the SAME ADC/SA — without moving every other feature off `global`.
let cachedVideoClient: GoogleGenAI | null = null;
function getVideoClient(): GoogleGenAI {
  const location = process.env.GEMINI_VIDEO_LOCATION;
  if (!location) return getGenAI(); // reuse the shared Vertex client
  if (cachedVideoClient) return cachedVideoClient;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is not configured (required for Vertex AI)');
  cachedVideoClient = new GoogleGenAI({ vertexai: true, project, location });
  return cachedVideoClient;
}

export interface RunOmniVideoOptions {
  model: string;
  task: OmniTask;
  prompt: string;
  aspectRatio: string;
  durationSeconds: number;
  images?: OmniImageInput[];
  previousInteractionId?: string;
  /** gs:// prefix Omni writes the clip into (URI delivery on Vertex). */
  gcsOutputPrefix: string;
  /** Called on each status poll so the caller can nudge progress / check cancellation. */
  onPoll?: (attempt: number) => void | Promise<void>;
}

export interface OmniVideoResult {
  interactionId: string;
  gsUri?: string;   // set when Omni wrote to GCS (URI delivery)
  buffer?: Buffer;  // set when Omni returned inline base64
}

export async function runOmniVideo(opts: RunOmniVideoOptions): Promise<OmniVideoResult> {
  const ai = getVideoClient();

  // Build the multimodal input: images first, then the text instruction (per the
  // image/reference-to-video examples). Text and edit are text-only.
  let input: any;
  if (opts.task === 'text_to_video' || opts.task === 'edit') {
    input = opts.prompt;
  } else {
    input = [
      ...(opts.images ?? []).map((img) => ({ type: 'image', data: img.data, mime_type: img.mimeType })),
      { type: 'text', text: opts.prompt },
    ];
  }

  const params: any = {
    model: opts.model,
    input,
    background: true, // return immediately with an id; we poll to completion
    response_format: {
      type: 'video',
      aspect_ratio: opts.aspectRatio,
      delivery: 'uri',
      duration: `${opts.durationSeconds}s`,
      gcs_uri: opts.gcsOutputPrefix, // required on Vertex for URI delivery
    },
    ...(opts.previousInteractionId ? { previous_interaction_id: opts.previousInteractionId } : {}),
  };

  let interaction: any;
  try {
    interaction = await ai.interactions.create(params);
  } catch (err: unknown) {
    logRawOmniError('interactions.create', err);
    throw new Error(normalizeOmniError(err));
  }

  // Poll until the interaction leaves a non-terminal state (create may already be done
  // when background isn't honored — then the loop is simply skipped).
  let polls = 0;
  while (interaction?.status === 'in_progress' || interaction?.status === 'requires_action') {
    if (polls >= MAX_POLLS) throw new Error('Video generation timed out.');
    await opts.onPoll?.(polls + 1);
    await sleep(POLL_INTERVAL_MS);
    try {
      interaction = await ai.interactions.get(interaction.id);
    } catch (err: unknown) {
      logRawOmniError('interactions.get', err);
      throw new Error(normalizeOmniError(err));
    }
    polls += 1;
  }

  const status: string = interaction?.status ?? 'failed';
  if (status !== 'completed') {
    if (status === 'cancelled') throw new Error('Video generation was cancelled.');
    throw new Error(`Video generation ${status}.`);
  }

  const video = interaction.output_video;
  if (video?.uri) return { interactionId: interaction.id, gsUri: video.uri };
  if (video?.data) return { interactionId: interaction.id, buffer: Buffer.from(video.data, 'base64') };
  throw new Error('Omni completed but returned no video.');
}

/**
 * Dump the raw Vertex/SDK error so the actual server reason (PERMISSION_DENIED, API not
 * enabled, model not found, wrong region, etc.) is visible — normalizeOmniError hides it.
 */
function logRawOmniError(where: string, err: any): void {
  const detail: Record<string, unknown> = {
    where,
    name: err?.name,
    message: err?.message,
    status: err?.status ?? err?.statusCode ?? err?.code,
    body: err?.body ?? err?.response?.data ?? err?.response ?? err?.error,
  };
  try {
    // eslint-disable-next-line no-console
    console.error('[omni] raw error:', JSON.stringify(detail));
  } catch {
    // eslint-disable-next-line no-console
    console.error('[omni] raw error (unstringifiable):', detail.where, detail.status, detail.message);
  }
}

/** Map raw SDK/HTTP errors to a concise, user-facing message. */
function normalizeOmniError(err: unknown): string {
  const anyErr = err as any;
  const raw = [anyErr?.message, anyErr?.status, JSON.stringify(anyErr?.response ?? anyErr?.error ?? '')]
    .filter(Boolean)
    .join(' ');
  const lower = raw.toLowerCase();
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('unauthenticated')) {
    return 'Video generation could not authenticate to Vertex AI (check the service-account credentials, IAM role, and that Omni is enabled for this project/region).';
  }
  if (lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('429')) {
    return 'Video generation is at capacity right now. Please try again in a few minutes.';
  }
  if (lower.includes('safety') || lower.includes('blocked') || lower.includes('policy') || lower.includes('prohibited')) {
    return 'This prompt was blocked by the model\'s safety filters. Try rephrasing it.';
  }
  if (lower.includes('permission') || lower.includes('403') || lower.includes('not found') || lower.includes('404') || lower.includes('region')) {
    return 'Video generation is not available for this account, project, or region.';
  }
  return `Video generation failed: ${(anyErr?.message ?? String(err)).slice(0, 300)}`;
}
