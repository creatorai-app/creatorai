import axios from 'axios';
import { manageAccessToken, validateOAuthEnvironment } from './token-manager';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Every YouTube-backed worker runs through manageAccessToken first. A wrong
 * branch here means either a job that fails with a valid token in hand, or one
 * that silently keeps using a dead one.
 */

const TOKEN = 'token-current';
const REFRESH = 'refresh-1';

describe('manageAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('keeps a still-valid token and does not call the refresh endpoint', () => {
    mockedAxios.get.mockResolvedValue({ data: {} });
    return expect(manageAccessToken(TOKEN, REFRESH, 'id', 'secret')).resolves.toEqual({
      isValid: true,
      accessToken: TOKEN,
      tokenRefreshed: false,
    }).then(() => {
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  it('refreshes an expired token and reports the swap', async () => {
    mockedAxios.get.mockRejectedValue({ response: { status: 400 } });
    mockedAxios.post.mockResolvedValue({ data: { access_token: 'token-new' } });

    await expect(manageAccessToken(TOKEN, REFRESH, 'id', 'secret')).resolves.toEqual({
      isValid: true,
      accessToken: 'token-new',
      tokenRefreshed: true,
    });
  });

  it('refreshes after a transient validation failure too', async () => {
    // A network blip on tokeninfo is indistinguishable from expiry; attempting the
    // refresh is cheap, and failing the job outright is not.
    mockedAxios.get.mockRejectedValue({ code: 'ECONNRESET' });
    mockedAxios.post.mockResolvedValue({ data: { access_token: 'token-new' } });

    await expect(manageAccessToken(TOKEN, REFRESH, 'id', 'secret')).resolves.toMatchObject({
      isValid: true,
      tokenRefreshed: true,
    });
  });

  it('gives up when there is no refresh token to fall back on', async () => {
    mockedAxios.get.mockRejectedValue({ response: { status: 400 } });

    await expect(manageAccessToken(TOKEN, '', 'id', 'secret')).resolves.toEqual({
      isValid: false,
      tokenRefreshed: false,
      error: 'No refresh token available',
    });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'Invalid refresh token or credentials'],
    [401, 'Refresh token has expired'],
    [500, 'Failed to refresh token'],
  ])('reports a %i from the refresh endpoint as "%s"', async (status, error) => {
    mockedAxios.get.mockRejectedValue({ response: { status: 400 } });
    mockedAxios.post.mockRejectedValue({ response: { status } });

    await expect(manageAccessToken(TOKEN, REFRESH, 'id', 'secret')).resolves.toEqual({
      isValid: false,
      tokenRefreshed: false,
      error,
    });
  });

  it('treats a refresh that returns no token as a failure, not a success', async () => {
    mockedAxios.get.mockRejectedValue({ response: { status: 400 } });
    mockedAxios.post.mockResolvedValue({ data: {} });

    await expect(manageAccessToken(TOKEN, REFRESH, 'id', 'secret')).resolves.toMatchObject({
      isValid: false,
    });
  });
});

describe('validateOAuthEnvironment', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('passes when both OAuth variables are set', () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    expect(validateOAuthEnvironment()).toEqual({ isValid: true, missing: [] });
  });

  it('names every missing variable, so one deploy fixes them all', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(validateOAuthEnvironment()).toEqual({
      isValid: false,
      missing: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    });
  });

  it('treats an empty string as missing, not configured', () => {
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    expect(validateOAuthEnvironment().missing).toEqual(['GOOGLE_CLIENT_ID']);
  });
});
