import { chatterboxParamsFor, type DubVoiceMode } from '@repo/validation';

// Where Cypher's speech comes from. Two hosts, one interface, so the processor never
// knows which it is talking to:
//
//   v2 (CYPHER_TTS_V2_URL set): services/cypher-tts, Chatterbox Multilingual V3 behind
//   POST /synthesize, on whichever GPU host it is deployed to. Takes the voice mode's
//   cfg_weight and exaggeration, keeps the voice sample at 24 kHz, and puts short pauses
//   between its internal chunks.
//
//   frozen (MODAL_API_URL): the Modal app that is deployed today and cannot be changed
//   (modal/dubbing_app.py). Its existing contract, used as-is: called without an
//   output_put_url it returns the WAV bytes. It takes no voice controls.

// One turn is at most a couple of minutes of speech, well inside this. A hung request
// fails the turn instead of pinning a worker slot forever.
const TTS_TIMEOUT_MS = 10 * 60 * 1000;
// A cold container or a network blip should not fail a whole dub.
const TTS_ATTEMPTS = 3;

export interface SynthesisRequest {
  text: string;
  /** Public URL of the speaker's voice sample. */
  referenceUrl: string;
  language: string;
  voiceMode: DubVoiceMode;
}

export interface CypherTts {
  /** 'v2' or 'frozen', for the job log. */
  readonly host: 'v2' | 'frozen';
  /** WAV bytes of `text` spoken in the sample's voice. */
  synthesize(request: SynthesisRequest): Promise<Buffer>;
}

/** Test hook: how long to wait between attempts. */
export const ttsRetryDelay = { ms: (attempt: number) => 5_000 * attempt };

/** The TTS host the environment points at: v2 when it is configured, else the frozen app. */
export function cypherTtsFromEnv(env: NodeJS.ProcessEnv = process.env): CypherTts {
  const v2 = env.CYPHER_TTS_V2_URL?.trim();
  if (v2) return v2Tts(v2.replace(/\/+$/, ''), env.CYPHER_TTS_V2_TOKEN?.trim() || null);
  const frozen = env.MODAL_API_URL?.trim();
  if (frozen) return frozenModalTts(frozen);
  throw new Error('Neither CYPHER_TTS_V2_URL nor MODAL_API_URL is configured');
}

/** services/cypher-tts: POST {base}/synthesize, optional bearer token. */
export function v2Tts(baseUrl: string, token: string | null): CypherTts {
  return {
    host: 'v2',
    synthesize: ({ text, referenceUrl, language, voiceMode }) =>
      postWithRetry(`${baseUrl}/synthesize`, token, {
        text,
        reference_url: referenceUrl,
        language,
        ...chatterboxParamsFor({ voiceMode }),
      }),
  };
}

/**
 * The deployed Modal app's contract: JSON { text, reference_url, is_video, language } with
 * no output_put_url, so it returns the WAV bytes instead of uploading them. MODAL_API_URL
 * is the exact URL `modal deploy` printed for the /dub endpoint (Modal gives each web
 * endpoint its own hostname, nothing is appended). The voice mode is not sent: the app
 * does not read it.
 */
export function frozenModalTts(url: string): CypherTts {
  return {
    host: 'frozen',
    synthesize: ({ text, referenceUrl, language }) =>
      postWithRetry(url, null, { text, reference_url: referenceUrl, is_video: false, language }),
  };
}

/** POST JSON, retried on 5xx and network errors; a 4xx is the request's fault and is not. */
async function postWithRetry(url: string, token: string | null, body: object): Promise<Buffer> {
  let lastError: Error = new Error('The TTS service was not called');
  for (let attempt = 1; attempt <= TTS_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
      });
      if (response.ok) return Buffer.from(await response.arrayBuffer());

      const errBody = await response.text().catch(() => 'Unknown error');
      lastError = new Error(`TTS error ${response.status}: ${errBody.slice(0, 500)}`);
      if (response.status < 500) throw lastError;
    } catch (error: any) {
      if (error === lastError) throw error;
      lastError = error;
    }
    if (attempt < TTS_ATTEMPTS) await new Promise((r) => setTimeout(r, ttsRetryDelay.ms(attempt)));
  }
  throw lastError;
}
