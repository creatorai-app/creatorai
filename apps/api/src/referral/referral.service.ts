import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TrackReferralInput } from '@repo/validation';

// Reward is granted on the referred user's first *purchase*, not at sign-up.
// The award itself happens in the billing webhook (billing.service.ts) and the
// award_referral_credits DB trigger. Referrals stay 'pending' until then.
const CREDITS_PER_REFERRAL = 1000;

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  async getReferralData(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, referral_code, total_referrals, referral_credits, full_name, avatar_url')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new NotFoundException('Profile not found');
    }

    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select(`
        id,
        referred_user_id,
        status,
        credits_awarded,
        created_at,
        completed_at,
        referred_email,
        referred_user:profiles!referrals_referred_user_id_fkey(
          id,
          full_name,
          avatar_url,
          email
        )
      `)
      .eq('referrer_id', profile.id)
      .order('created_at', { ascending: false });

    if (referralsError) {
      this.logger.error('Error fetching referrals:', referralsError);
      throw new InternalServerErrorException('Failed to fetch referrals');
    }

    const pendingReferrals = referrals?.filter(r => r.status === 'pending') || [];
    const completedReferrals = referrals?.filter(r => r.status === 'completed') || [];

    return {
      referralCode: profile.referral_code,
      totalReferrals: profile.total_referrals,
      referralCredits: profile.referral_credits,
      userProfile: {
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      },
      pendingReferrals,
      completedReferrals,
    };
  }

  async generateReferralCode(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.referral_code) {
      return {
        message: 'Referral code already exists',
        referralCode: profile.referral_code,
      };
    }

    const maxAttempts = 5;
    for (let i = 0; i < maxAttempts; i++) {
      const referralCode = this.createReferralCode();

      const { data: existing } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('referral_code', referralCode)
        .single();

      if (!existing) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ referral_code: referralCode })
          .eq('user_id', userId);

        if (updateError) {
          this.logger.error('Failed to update referral code:', updateError);
          throw new InternalServerErrorException('Failed to generate referral code');
        }

        return { referralCode };
      }
    }

    throw new InternalServerErrorException('Failed to generate unique referral code. Please try again.');
  }

  /**
   * Public pre-signup check so the sign-up page only promises a bonus for a code
   * that actually exists. Returns the referrer's display name and nothing else —
   * referral codes are shared publicly by design, the rest of the profile is not.
   */
  async validateReferralCode(code: string) {
    const referralCode = code.toUpperCase().trim();
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, name')
      .eq('referral_code', referralCode)
      .maybeSingle();

    if (error) {
      this.logger.error('Referral code lookup failed:', error);
      throw new InternalServerErrorException(
        'Could not check that referral code right now. Please try again.',
      );
    }

    return {
      valid: Boolean(data),
      referrerName: data?.full_name || data?.name || null,
    };
  }

  async trackReferral(input: TrackReferralInput) {
    const { referralCode, userEmail } = input;
    const supabase = this.supabaseService.getClient();

    const { data: referrer, error: referrerError } = await supabase
      .from('profiles')
      .select('id, user_id, email, referral_code, total_referrals')
      .eq('referral_code', referralCode)
      .maybeSingle();

    // A failed lookup is our problem, not a bad code — don't tell the user their
    // friend's code is fake because the database blinked.
    if (referrerError) {
      this.logger.error('Referrer lookup failed:', referrerError);
      throw new InternalServerErrorException(
        'Could not check that referral code right now. Please try again.',
      );
    }

    if (!referrer) {
      throw new BadRequestException(
        `Referral code "${referralCode}" does not exist. Check the link you were sent.`,
      );
    }

    if (referrer.email?.toLowerCase() === userEmail.toLowerCase()) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id, status, referrer_id')
      .eq('referred_email', userEmail.toLowerCase())
      .maybeSingle();

    if (existingReferral) {
      const msg = existingReferral.referrer_id === referrer.id
        ? 'This email has already been referred by you'
        : 'This email has already used a referral code';
      throw new ConflictException(msg);
    }

    let referredUserId: string | null = null;
    const { data: referredUser } = await supabase
      .from('profiles')
      .select('user_id, email')
      .eq('email', userEmail.toLowerCase())
      .maybeSingle();

    if (referredUser) {
      referredUserId = referredUser.user_id;
      if (referredUserId === referrer.user_id) {
        throw new BadRequestException('You cannot use your own referral code');
      }
    }

    const referralData = {
      referrer_id: referrer.id,
      referral_code: referralCode,
      status: 'pending' as const,
      referred_email: userEmail.toLowerCase(),
    };

    const { data: createdReferral, error: createError } = await supabase
      .from('referrals')
      .insert(referralData)
      .select()
      .single();

    if (createError) {
      if (createError.code === '23505') {
        throw new ConflictException('This referral has already been tracked');
      }
      this.logger.error('Failed to create referral:', createError);
      throw new InternalServerErrorException('Failed to create referral');
    }

    // Link the referred profile if it already exists, but keep the referral
    // 'pending'. No credits are awarded at sign-up — the reward is only granted
    // when the referred user makes their first purchase (see billing webhook).
    if (referredUserId) {
      const { data: referredProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', referredUserId)
        .maybeSingle();

      if (referredProfile?.id) {
        const { error: linkError } = await supabase
          .from('referrals')
          .update({ referred_user_id: referredProfile.id })
          .eq('id', createdReferral.id);

        if (linkError) {
          this.logger.error('Failed to link referral:', linkError);
        }
      }
    }

    return {
      message: 'Referral tracked successfully',
      referralId: createdReferral.id,
    };
  }

  private createReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(x => chars[x % chars.length])
      .join('');
  }
}
