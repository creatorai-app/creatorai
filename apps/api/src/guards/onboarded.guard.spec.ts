import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OnboardedGuard } from './onboarded.guard';
import { SupabaseService } from '../supabase/supabase.service';

type Profile = { ai_trained: boolean; youtube_connected: boolean } | null;

function makeGuard(profile: Profile, error: unknown = null) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    single: jest.fn(async () => ({ data: profile, error })),
  };
  const supabase = { getClient: () => ({ from: jest.fn(() => chain) }) };
  return new OnboardedGuard(supabase as unknown as SupabaseService);
}

const ctx = (userId?: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: userId ? { id: userId } : undefined }) }),
  }) as unknown as ExecutionContext;

describe('OnboardedGuard', () => {
  it('lets a fully onboarded user through', async () => {
    const guard = makeGuard({ ai_trained: true, youtube_connected: true });
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
  });

  // The bug this guard exists for: dubbing charged users who had neither.
  it('blocks when both are missing, and names both', async () => {
    const guard = makeGuard({ ai_trained: false, youtube_connected: false });
    await expect(guard.canActivate(ctx('u1'))).rejects.toThrow(
      'This feature requires your AI memory and a connected YouTube channel.',
    );
  });

  // Requirement is AND, not OR — one of the two is not enough.
  it('blocks when only training is missing', async () => {
    const guard = makeGuard({ ai_trained: false, youtube_connected: true });
    await expect(guard.canActivate(ctx('u1'))).rejects.toThrow('This feature requires your AI memory.');
  });

  it('blocks when only YouTube is missing', async () => {
    const guard = makeGuard({ ai_trained: true, youtube_connected: false });
    await expect(guard.canActivate(ctx('u1'))).rejects.toThrow(
      'This feature requires a connected YouTube channel.',
    );
  });

  // Null columns on an older profile row must fail closed, not sail through.
  it('fails closed on null flags', async () => {
    const guard = makeGuard({ ai_trained: null, youtube_connected: null } as never);
    await expect(guard.canActivate(ctx('u1'))).rejects.toThrow(ForbiddenException);
  });

  it('rejects a missing profile', async () => {
    const guard = makeGuard(null, { message: 'no rows' });
    await expect(guard.canActivate(ctx('u1'))).rejects.toThrow('Profile not found');
  });

  it('rejects an unauthenticated request', async () => {
    const guard = makeGuard({ ai_trained: true, youtube_connected: true });
    await expect(guard.canActivate(ctx())).rejects.toThrow('Authentication required');
  });
});
