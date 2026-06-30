export interface ApiError {
  code: string;
  retryable: boolean;
}

/**
 * Classifies common errors into a code + whether they're worth retrying.
 */
export function mapApiError(error: any): ApiError {
  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return { code: 'NETWORK_ERROR', retryable: true };
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return { code: 'TIMEOUT_ERROR', retryable: true };
  }

  // Rate limiting
  if (error.response?.status === 429) {
    return { code: 'RATE_LIMIT_ERROR', retryable: true };
  }

  // YouTube API specific errors
  if (error.response?.status === 403) {
    return { code: 'FORBIDDEN_ERROR', retryable: false };
  }

  if (error.response?.status === 401) {
    return { code: 'UNAUTHORIZED_ERROR', retryable: false };
  }

  if (error.response?.status === 400) {
    return { code: 'BAD_REQUEST_ERROR', retryable: false };
  }

  // Gemini API errors
  if (error.message?.includes('Gemini') || error.message?.includes('AI')) {
    return { code: 'AI_SERVICE_ERROR', retryable: true };
  }

  // Default error
  return { code: 'UNKNOWN_ERROR', retryable: false };
}

/**
 * Logs errors with appropriate context for debugging
 */
export function logError(context: string, error: any, additionalInfo?: Record<string, any>) {
  const mappedError = mapApiError(error);

  console.error(`[${context}] Error:`, {
    code: mappedError.code,
    retryable: mappedError.retryable,
    originalError: error.message,
    stack: error.stack,
    ...additionalInfo,
  });
}

/**
 * Determines if an error should trigger a retry
 */
export function shouldRetry(error: any, retryCount: number, maxRetries: number = 3): boolean {
  if (retryCount >= maxRetries) {
    return false;
  }

  const mappedError = mapApiError(error);
  return mappedError.retryable;
}

/**
 * Calculates retry delay with exponential backoff
 */
export function calculateRetryDelay(retryCount: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, retryCount), 10000); // Max 10 seconds
}
