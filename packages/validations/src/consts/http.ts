export const CREATOR_AI_USER_AGENT = 'CreatorAI/1.0 (+https://tryscriptai.com)';

export function mergeCreatorAiHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  merged.set('User-Agent', CREATOR_AI_USER_AGENT);
  return merged;
}

const FETCH_PATCHED = Symbol.for('creatorai.fetch.patched');

export function installCreatorAiFetchDefaults(): void {
  const g = globalThis as typeof globalThis & { [FETCH_PATCHED]?: boolean };
  if (g[FETCH_PATCHED]) return;
  g[FETCH_PATCHED] = true;

  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    original(input, {
      ...init,
      headers: mergeCreatorAiHeaders(init?.headers),
    });
}

export function installCreatorAiAxiosDefaults(axios: {
  defaults: { headers: { common: { [key: string]: unknown } } };
}): void {
  axios.defaults.headers.common['User-Agent'] = CREATOR_AI_USER_AGENT;
}
