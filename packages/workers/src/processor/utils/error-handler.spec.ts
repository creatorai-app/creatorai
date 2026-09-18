import { calculateRetryDelay, mapApiError, shouldRetry } from './error-handler';

/**
 * Retry classification decides whether a failed job burns its BullMQ attempts or
 * fails fast. Getting it backwards either hammers a vendor that already said no,
 * or gives up on a blip the user paid for.
 */

describe('mapApiError', () => {
  it.each([
    ['ECONNREFUSED', 'NETWORK_ERROR'],
    ['ENOTFOUND', 'NETWORK_ERROR'],
    ['ECONNABORTED', 'TIMEOUT_ERROR'],
  ])('classifies the %s socket error as %s and retryable', (code, expected) => {
    expect(mapApiError({ code })).toEqual({ code: expected, retryable: true });
  });

  it('treats a timeout described only in the message as a timeout', () => {
    expect(mapApiError({ message: 'request timeout of 15000ms exceeded' })).toEqual({
      code: 'TIMEOUT_ERROR',
      retryable: true,
    });
  });

  it('retries a rate limit, since the window rolls', () => {
    expect(mapApiError({ response: { status: 429 } })).toEqual({
      code: 'RATE_LIMIT_ERROR',
      retryable: true,
    });
  });

  it.each([
    [403, 'FORBIDDEN_ERROR'],
    [401, 'UNAUTHORIZED_ERROR'],
    [400, 'BAD_REQUEST_ERROR'],
  ])('does not retry an HTTP %i, which will fail identically next time', (status, expected) => {
    expect(mapApiError({ response: { status } })).toEqual({ code: expected, retryable: false });
  });

  it('retries a model-side failure', () => {
    expect(mapApiError({ message: 'Gemini returned no candidates' })).toEqual({
      code: 'AI_SERVICE_ERROR',
      retryable: true,
    });
  });

  it('defaults an unrecognized failure to non-retryable', () => {
    // Retrying something we cannot classify spends credits on an unknown fault.
    expect(mapApiError(new Error('something odd'))).toEqual({
      code: 'UNKNOWN_ERROR',
      retryable: false,
    });
  });

  it('does not throw on an error with no message or response', () => {
    expect(mapApiError({})).toEqual({ code: 'UNKNOWN_ERROR', retryable: false });
  });

  it('prefers the socket code over the status when both are present', () => {
    expect(mapApiError({ code: 'ECONNREFUSED', response: { status: 403 } }).retryable).toBe(true);
  });
});

describe('shouldRetry', () => {
  it('retries a retryable error until the attempt budget is spent', () => {
    const err = { response: { status: 429 } };
    expect(shouldRetry(err, 0, 3)).toBe(true);
    expect(shouldRetry(err, 2, 3)).toBe(true);
    expect(shouldRetry(err, 3, 3)).toBe(false);
  });

  it('never retries a non-retryable error, even on the first attempt', () => {
    expect(shouldRetry({ response: { status: 401 } }, 0, 3)).toBe(false);
  });

  it('defaults to three attempts when no budget is given', () => {
    const err = { code: 'ECONNREFUSED' };
    expect(shouldRetry(err, 2)).toBe(true);
    expect(shouldRetry(err, 3)).toBe(false);
  });
});

describe('calculateRetryDelay', () => {
  it('doubles each attempt', () => {
    expect(calculateRetryDelay(0)).toBe(1_000);
    expect(calculateRetryDelay(1)).toBe(2_000);
    expect(calculateRetryDelay(2)).toBe(4_000);
  });

  it('caps the backoff at ten seconds so a job does not stall the queue', () => {
    expect(calculateRetryDelay(4)).toBe(10_000);
    expect(calculateRetryDelay(20)).toBe(10_000);
  });

  it('scales off a custom base delay', () => {
    expect(calculateRetryDelay(1, 500)).toBe(1_000);
  });
});
