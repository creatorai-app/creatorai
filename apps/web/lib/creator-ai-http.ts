import { mergeCreatorAiHeaders } from '@repo/validation';

export function creatorAiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: mergeCreatorAiHeaders(init?.headers),
  });
}
