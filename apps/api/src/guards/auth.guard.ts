import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  /** Don't rewrite last_seen_at more often than this per user. */
  private static readonly TOUCH_INTERVAL_MS = 2 * 60 * 1000;

  constructor(private supabaseService: SupabaseService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1]; // Bearer <token>

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Validate Supabase JWT
    const { data, error } = await this.supabaseService.getClient().auth.getUser(token);
    // Supabase unreachable says nothing about the token: a 401 here would tell the user
    // their session expired and send them to sign in for a network blip.
    if (isAuthRetryableFetchError(error)) {
      throw new ServiceUnavailableException('Could not verify your session right now. Please try again.');
    }
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = data.user;
    this.touchLastSeen(data.user.id);
    return true;
  }

  /**
   * Presence for the admin dashboard's "online now" count. Not awaited — this is
   * telemetry, it must never add latency to or fail a request. The age filter
   * makes Postgres no-op the write on all but one call per user per interval,
   * so a chatty client does not turn into a write per request.
   */
  private touchLastSeen(userId: string): void {
    const staleBefore = new Date(Date.now() - SupabaseAuthGuard.TOUCH_INTERVAL_MS).toISOString();

    try {
      void this.supabaseService
        .getClient()
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('user_id', userId)
        .or(`last_seen_at.is.null,last_seen_at.lt.${staleBefore}`)
        .then(({ error }) => {
          if (error) console.error('[presence] last_seen_at update failed:', error.message);
        });
    } catch (e) {
      console.error('[presence] last_seen_at update threw:', e instanceof Error ? e.message : e);
    }
  }
}