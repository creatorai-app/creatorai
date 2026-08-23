// src/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { Resend } from 'resend';
import { generateResetPasswordEmail } from '@repo/email-templates';

@Injectable()
export class AuthService implements OnModuleInit {
  private resend: Resend | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
  }

  async onModuleInit() {
    const apiKey = this.configService?.get<string>('RESEND_API_KEY');

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      console.warn('RESEND_API_KEY missing in environment');
    }
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendResetEmail(email: string, otp: string): Promise<void> {
    if (!this.resend) {
    console.warn('Resend not configured - skipping email');
      return;
    }

    const html = generateResetPasswordEmail({ otp, expiresInMinutes: 10 });

    try {
      await this.resend.emails.send({
        from: 'Creator AI <no-reply@trycreatorai.com>',
        to: email,
        subject: 'Your Password Reset Code',
        html,
      });
    } catch (error) {
      console.error('Failed to send reset email:', error);
      // Do NOT fail the request — user already has OTP in DB
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const supabase = this.supabaseService.getClient();
    const adminClient = this.supabaseService.getAdminClient();

    if (!adminClient) {
      throw new BadRequestException('Supabase admin client not configured');
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // Always return generic message (security)
    const genericMessage = 'If an account exists, a reset code has been sent.';

    if (!profile?.id) {
      return { message: genericMessage };
    }

    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const { error } = await supabase
      .from('profiles')
      .update({
        password_reset_otp: otp,
        password_reset_otp_expires_at: expiresAt.toISOString(),
        password_reset_otp_verified: false,
        password_reset_otp_attempts: 0,
      })
      .eq('id', profile.id);

    if (error) {
      console.error('Failed to store OTP:', error);
      throw new BadRequestException('Failed to initiate reset');
    }

    await this.sendResetEmail(normalizedEmail, otp);

    return { message: genericMessage };
  }

  async verifyOtp(email: string, otp: string): Promise<{ valid: boolean; message?: string }> {
    const supabase = this.supabaseService.getClient();
    const normalizedEmail = email.toLowerCase().trim();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        password_reset_otp,
        password_reset_otp_expires_at,
        password_reset_otp_attempts,
        password_reset_otp_verified
      `)
      .eq('email', normalizedEmail)
      .eq('password_reset_otp', otp)
      .eq('password_reset_otp_verified', false)
      .single();

    // Invalid OTP or already verified
    if (error || !profile) {
      await this.incrementAttempts(normalizedEmail);
      return { valid: false, message: 'Invalid or expired code' };
    }

    // Check expiry
    if (new Date(profile.password_reset_otp_expires_at!) < new Date()) {
      return { valid: false, message: 'Code has expired' };
    }

    // Block after 5 failed attempts
    if ((profile.password_reset_otp_attempts ?? 0) >= 5) {
      return { valid: false, message: 'Too many attempts. Request a new code.' };
    }

    // Mark as verified (one-time use)
    await supabase
      .from('profiles')
      .update({ password_reset_otp_verified: true })
      .eq('id', profile.id);

    return { valid: true };
  }

  private async incrementAttempts(email: string) {
    const supabase = this.supabaseService.getClient();

    await supabase.rpc('increment_otp_attempts', {
      p_email: email.toLowerCase().trim()
    });
  }

  async resetPassword(email: string, otp: string, newPassword: string, confirmNewPassword: string): Promise<{ message: string }> {
    const supabase = this.supabaseService.getClient();
    const adminClient = this.supabaseService.getAdminClient();

    if (!adminClient) {
      throw new BadRequestException('Admin client missing');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Must be verified + not expired + matching OTP
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, password_reset_otp_expires_at')
      .eq('email', normalizedEmail)
      .eq('password_reset_otp', otp)
      .eq('password_reset_otp_verified', true)
      .gt('password_reset_otp_expires_at', new Date().toISOString())
      .single();

    if (error || !profile) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    // Update password via Supabase Auth
    const { error: updateError } = await adminClient.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('Password update failed:', updateError);
      throw new BadRequestException('Failed to update password');
    }

    // Clear all OTP data
    await supabase
      .from('profiles')
      .update({
        password_reset_otp: null,
        password_reset_otp_expires_at: null,
        password_reset_otp_verified: false,
        password_reset_otp_attempts: 0,
      })
      .eq('id', profile.id);

    return { message: 'Password reset successfully' };
  }
}
