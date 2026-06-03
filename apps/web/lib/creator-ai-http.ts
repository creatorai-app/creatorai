import {
  CREATOR_AI_USER_AGENT,
  mergeCreatorAiHeaders,
} from '@repo/validation';

export { CREATOR_AI_USER_AGENT, mergeCreatorAiHeaders };

export function creatorAiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: mergeCreatorAiHeaders(init?.headers),
  });
}
