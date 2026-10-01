import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from './auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

const mockGetUser = jest.fn();
const mockPresenceUpdate = jest.fn();

// The guard also stamps profiles.last_seen_at for the admin "online now" count.
const presenceChain = () => {
  const chain: Record<string, unknown> = {};
  chain.update = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.or = jest.fn(() => chain);
  chain.then = (resolve: (v: { error: null }) => unknown) => {
    mockPresenceUpdate();
    return Promise.resolve(resolve({ error: null }));
  };
  return chain;
};

const mockSupabaseService = {
  getClient: () => ({
    auth: { getUser: mockGetUser },
    from: jest.fn(() => presenceChain()),
  }),
};

function createMockContext(token?: string): ExecutionContext {
  const request = {
    headers: { authorization: token ? `Bearer ${token}` : undefined },
    user: undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthGuard,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    guard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
  });

  it('should throw UnauthorizedException when no token provided', async () => {
    const ctx = createMockContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('answers 503, not 401, when Supabase cannot be reached to check the token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('fetch failed', 0) });
    await expect(guard.canActivate(createMockContext('valid-token'))).rejects.toThrow(ServiceUnavailableException);
  });

  it('should throw UnauthorizedException for invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    const ctx = createMockContext('invalid-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should set user on request and return true for valid token', async () => {
    const mockUser = { id: 'user-123', email: 'test@test.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    const ctx = createMockContext('valid-token');

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);

    const request = ctx.switchToHttp().getRequest();
    expect(request.user).toEqual(mockUser);
    expect(mockPresenceUpdate).toHaveBeenCalled();
  });
});
