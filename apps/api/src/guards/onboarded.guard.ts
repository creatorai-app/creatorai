import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Every credit-spending feature requires a trained AI *and* a connected YouTube
 * channel. This lived as a hand-written check inside subtitle and ideation only,
 * which is how dubbing and video-generation ended up chargeable by users who had
 * neither. Applying it as a guard makes the requirement declarative: a new route
 * either lists it in @UseGuards or it deliberately doesn't need it.
 *
 * Order matters — it must follow SupabaseAuthGuard, which is what sets request.user.
 */
@Injectable()
export class OnboardedGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException('Authentication required');

    const { data: profile, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('ai_trained, youtube_connected')
      .eq('user_id', userId)
      .single();

    if (error || !profile) throw new ForbiddenException('Profile not found');

    const missing: string[] = [];
    if (!profile.ai_trained) missing.push('your AI memory');
    if (!profile.youtube_connected) missing.push('a connected YouTube channel');
    if (missing.length > 0) {
      throw new ForbiddenException(`This feature requires ${missing.join(' and ')}.`);
    }

    // Downstream services re-read the profile for credits; these two are already
    // proven here, so nothing below needs to check them again.
    return true;
  }
}
