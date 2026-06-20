import axios from 'axios';

export interface TokenValidationResult {
  isValid: boolean;
  accessToken?: string;
  tokenRefreshed: boolean;
  error?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

/**
 * Validates an OAuth access token by calling Google's tokeninfo endpoint
 */
export async function validateAccessToken(accessToken: string): Promise<TokenValidationResult> {
  try {
    await axios.get('https://oauth2.googleapis.com/tokeninfo', {
      params: { access_token: accessToken },
      timeout: 10000, // 10 second timeout
    });

    return {
      isValid: true,
      accessToken,
      tokenRefreshed: false,
    };
  } catch (error: any) {
    // Check if it's a token validation error
    if (error.response?.status === 400 ||
      error.response?.data?.error === 'invalid_token' ||
      error.response?.data?.error === 'invalid_request') {
      return {
        isValid: false,
        tokenRefreshed: false,
        error: 'Token is invalid or expired',
      };
    }

    // Other network or server errors
    return {
      isValid: false,
      tokenRefreshed: false,
      error: 'Unable to validate token',
    };
  }
}

/**
 * Refreshes an OAuth access token using a refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenRefreshResult> {
  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }, {
      timeout: 15000, // 15 second timeout
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return {
      success: true,
      accessToken: tokenResponse.data.access_token,
    };
  } catch (error: any) {
    console.error('Token refresh failed:', error.response?.data || error.message);

    if (error.response?.status === 400) {
      return {
        success: false,
        error: 'Invalid refresh token or credentials',
      };
    }

    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Refresh token has expired',
      };
    }

    return {
      success: false,
      error: 'Failed to refresh token',
    };
  }
}

/**
 * Comprehensive token management function that validates and refreshes tokens as needed
 */
export async function manageAccessToken(
  currentToken: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenValidationResult> {
  // First, try to validate the current token
  const validationResult = await validateAccessToken(currentToken);

  if (validationResult.isValid) {
    return validationResult;
  }

  // Token is invalid, attempt to refresh
  if (!refreshToken) {
    return {
      isValid: false,
      tokenRefreshed: false,
      error: 'No refresh token available',
    };
  }

  const refreshResult = await refreshAccessToken(refreshToken, clientId, clientSecret);

  if (refreshResult.success && refreshResult.accessToken) {
    return {
      isValid: true,
      accessToken: refreshResult.accessToken,
      tokenRefreshed: true,
    };
  }

  return {
    isValid: false,
    tokenRefreshed: false,
    error: refreshResult.error || 'Token refresh failed',
  };
}

/**
 * Validates environment variables required for OAuth operations
 */
export function validateOAuthEnvironment(): { isValid: boolean; missing: string[] } {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  return {
    isValid: missing.length === 0,
    missing,
  };
}