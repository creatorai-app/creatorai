import { chatterboxParamsFor, type DubVoiceMode } from '@repo/validation';

// Where Cypher's speech comes from: services/cypher-tts, Chatterbox Multilingual V3
// behind POST /synthesize (deployed on Modal as modal/dubbing_app_v2.py). Takes the voice
// mode's cfg_weight and exaggeration, keeps the voice sample at 24 kHz, and puts short
// pauses between its internal chunks.

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
  /** WAV bytes of `text` spoken in the sample's voice. */
  synthesize(request: SynthesisRequest): Promise<Buffer>;
}

/** Test hook: how long to wait between attempts. */
export const ttsRetryDelay = { ms: (attempt: number) => 5_000 * attempt };

/** services/cypher-tts at CYPHER_TTS_V2_URL: POST {base}/synthesize, optional bearer token. */
export function cypherTtsFromEnv(env: NodeJS.ProcessEnv = process.env): CypherTts {
  const url = env.CYPHER_TTS_V2_URL?.trim();
  if (!url) throw new Error('CYPHER_TTS_V2_URL is not configured');
  const endpoint = `${url.replace(/\/+$/, '')}/synthesize`;
  const token = env.CYPHER_TTS_V2_TOKEN?.trim() || null;
  return {
    synthesize: ({ text, referenceUrl, language, voiceMode }) =>
      postWithRetry(endpoint, token, {
        text,
        reference_url: referenceUrl,
        language,
        ...chatterboxParamsFor({ voiceMode }),
      }),
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
