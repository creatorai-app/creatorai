export interface ApiError {
  code: string;
  message: string;
  details?: string;
  statusCode: number;
  retryable: boolean;
}

/**
 * Maps common errors to user-friendly messages and determines if they're retryable
 */
export function mapApiError(error: any): ApiError {
  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network error. Please check your internet connection and try again.',
      details: error.message,
      statusCode: 500,
      retryable: true,
    };
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return {
      code: 'TIMEOUT_ERROR',
      message: 'Request timed out. Please try again.',
      details: error.message,
      statusCode: 408,
      retryable: true,
    };
  }

  // Rate limiting
  if (error.response?.status === 429) {
    return {
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many requests. Please wait a moment and try again.',
      details: 'Rate limit exceeded',
      statusCode: 429,
      retryable: true,
    };
  }

  // YouTube API specific errors
  if (error.response?.status === 403) {
    return {
      code: 'FORBIDDEN_ERROR',
      message: 'Access denied. Please check your YouTube channel permissions.',
      details: error.response?.data?.error?.message || 'Forbidden',
      statusCode: 403,
      retryable: false,
    };
  }

  if (error.response?.status === 401) {
    return {
      code: 'UNAUTHORIZED_ERROR',
      message: 'Authentication failed. Please reconnect your YouTube channel.',
      details: error.response?.data?.error?.message || 'Unauthorized',
      statusCode: 401,
      retryable: false,
    };
  }

  if (error.response?.status === 400) {
    return {
      code: 'BAD_REQUEST_ERROR',
      message: 'Invalid request. Please check your input and try again.',
      details: error.response?.data?.error?.message || 'Bad request',
      statusCode: 400,
      retryable: false,
    };
  }

  // Gemini API errors
  if (error.message?.includes('Gemini') || error.message?.includes('AI')) {
    return {
      code: 'AI_SERVICE_ERROR',
      message: 'AI service temporarily unavailable. Please try again.',
      details: error.message,
      statusCode: 500,
      retryable: true,
    };
  }

  // Default error
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    details: error.message || 'Unknown error',
    statusCode: error.response?.status || 500,
    retryable: false,
  };
}

/**
 * Creates a standardized error response for API endpoints
 */
export function createErrorResponse(error: any, defaultMessage = 'Internal server error') {
  const mappedError = mapApiError(error);

  return {
    error: mappedError.message,
    code: mappedError.code,
    details: mappedError.details,
    retryable: mappedError.retryable,
  };
}

/**
 * Logs errors with appropriate context for debugging
 */
export function logError(context: string, error: any, additionalInfo?: Record<string, any>) {
  const mappedError = mapApiError(error);

  console.error(`[${context}] Error:`, {
    code: mappedError.code,
    message: mappedError.message,
    details: mappedError.details,
    statusCode: mappedError.statusCode,
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