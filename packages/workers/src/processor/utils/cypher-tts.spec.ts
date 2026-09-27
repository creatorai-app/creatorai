import { cypherTtsFromEnv, ttsRetryDelay } from './cypher-tts';

const request = { text: 'Hola.', referenceUrl: 'https://x/S1.wav', language: 'es', voiceMode: 'native' as const };

beforeEach(() => {
  jest.restoreAllMocks();
  ttsRetryDelay.ms = () => 0;
});

function capture(replies: (Response | Error)[]) {
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (url: any, init: any) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    const next = replies.shift()!;
    if (next instanceof Error) throw next;
    return next;
  });
  return calls;
}

describe('cypherTtsFromEnv', () => {
  it('uses the v2 service when CYPHER_TTS_V2_URL is set, with the voice mode and the token', async () => {
    const calls = capture([new Response('WAV')]);
    const tts = cypherTtsFromEnv({ CYPHER_TTS_V2_URL: 'https://tts.example/', CYPHER_TTS_V2_TOKEN: 'secret', MODAL_API_URL: 'https://modal' });
    expect(tts.host).toBe('v2');
    await expect(tts.synthesize(request)).resolves.toEqual(Buffer.from('WAV'));
    expect(calls[0].url).toBe('https://tts.example/synthesize');
    expect(calls[0].headers.Authorization).toBe('Bearer secret');
    expect(calls[0].body).toEqual({ text: 'Hola.', reference_url: 'https://x/S1.wav', language: 'es', cfg_weight: 0, exaggeration: 0.5 });
  });

  it('sends no token header when none is configured', async () => {
    const calls = capture([new Response('WAV')]);
    await cypherTtsFromEnv({ CYPHER_TTS_V2_URL: 'https://tts.example' }).synthesize(request);
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  it('keeps the frozen Modal contract, unchanged, when v2 is not configured', async () => {
    const calls = capture([new Response('WAV')]);
    const tts = cypherTtsFromEnv({ MODAL_API_URL: 'https://me--creator-ai-dubbing-dub.modal.run' });
    expect(tts.host).toBe('frozen');
    await tts.synthesize(request);
    expect(calls[0].url).toBe('https://me--creator-ai-dubbing-dub.modal.run');
    expect(calls[0].body).toEqual({ text: 'Hola.', reference_url: 'https://x/S1.wav', is_video: false, language: 'es' });
  });

  it('refuses to start with neither configured', () => {
    expect(() => cypherTtsFromEnv({})).toThrow('Neither CYPHER_TTS_V2_URL nor MODAL_API_URL');
  });

  it('retries a cold start (5xx) and a dropped connection, not a 4xx', async () => {
    const calls = capture([new Response('warming', { status: 503 }), new TypeError('socket hang up'), new Response('WAV')]);
    await expect(cypherTtsFromEnv({ MODAL_API_URL: 'https://m' }).synthesize(request)).resolves.toEqual(Buffer.from('WAV'));
    expect(calls).toHaveLength(3);

    const refused = capture([new Response('text too long', { status: 400 })]);
    await expect(cypherTtsFromEnv({ CYPHER_TTS_V2_URL: 'https://t' }).synthesize(request)).rejects.toThrow('TTS error 400: text too long');
    expect(refused).toHaveLength(1);
  });

  it('gives up after three failures', async () => {
    capture([new Response('a', { status: 500 }), new Response('b', { status: 502 }), new Response('c', { status: 504 })]);
    await expect(cypherTtsFromEnv({ MODAL_API_URL: 'https://m' }).synthesize(request)).rejects.toThrow('TTS error 504');
  });
});
