import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { creatorAiFetch } from '@/lib/creator-ai-http';
import { Resend } from 'resend';
import { BACKEND_URL } from '@/lib/constants';

const CREDITS_PER_REFERRAL = 250;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendWelcomeEmail(
  full_name: string,
  email: string,
  user_id: string,
  resend: Resend
    | null) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: 'Creator AI <onboarding@tryscriptai.com>',
      to: email,
      subject: 'Welcome to Creator AI!',
      replyTo: 'support@tryscriptai.com',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; padding: 20px;">
          <h1 style="color: #4F46E5; margin-bottom: 10px;">Welcome aboard, ${escapeHtml(full_name)}! 🎉</h1>
          
          <p>We're excited to have you join <strong>Creator AI</strong>. 🚀</p>
          <p>
            Open your dashboard:
            <a href="https://tryscriptai.com/dashboard" style="color: #4F46E5; text-decoration: none; font-weight: bold;">
              Go to Dashboard
            </a>
          </p>

          <p style="margin-top: 30px;">Have any questions? Just reply to this email or reach us at 
            <a href="mailto:support@tryscriptai.com" style="color: #4F46E5; text-decoration: none;">support@tryscriptai.com</a>.
          </p>

          <p style="margin-top: 20px;">Cheers,<br/>The Creator AI Team</p>
        </div>`,
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

async function sendAdminNotification(full_name: string, email: string, resend: Resend | null) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: 'Creator AI <notifications@tryscriptai.com>',
      to: 'support@tryscriptai.com',
      subject: 'New User Sign Up Notification',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; padding: 20px;">
          <h1 style="color: #4F46E5;">New User Sign Up</h1>
          <p>A new user has signed up:</p>
          <ul>
            <li><strong>Name:</strong> ${escapeHtml(full_name)}</li>
            <li><strong>Email:</strong> ${escapeHtml(email)}</li>
            <li><strong>Time:</strong> ${new Date().toISOString()}</li>
          </ul>
        </div>`,
    });
    console.log(`Admin notification sent for new user: ${email}`);
  } catch (error) {
    console.error('Error sending admin notification:', error);
  }
}

async function updateUserProfile(
  supabase: any,
  userId: string,
  full_name: string,
  avatar_url: string | null
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name,
      avatar_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error(' Error updating profile:', error.message);
    throw error;
  }
  console.log(` Profile updated for user: ${userId}`);
}

async function processReferral(
  referralCode: string,
  userEmail: string,
) {
  try {
    const response = await creatorAiFetch(`${BACKEND_URL}/api/v1/referral/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCode, userEmail }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Referral API returned ${response.status}:`, errorData);
      return;
    }

    const result = await response.json();
    console.log(`Referral tracked for ${userEmail} with code: ${referralCode}`, result);
  } catch (error) {
    console.error('Error tracking referral:', error);
  }
}


async function completePendingReferral(
  supabase: any,
  userEmail: string,
  userId: string
) {
  try {
    // Fetch the first pending referral (should only be one)
    const { data: pendingReferral, error: fetchError } = await supabase
      .from('referrals')
      .select('id, referrer_id')
      .eq('status', 'pending')
      .eq('referred_email', userEmail.toLowerCase())
      .maybeSingle();

    if (fetchError) {
      console.error(' Error fetching pending referral:', fetchError.message);
      return;
    }

    if (!pendingReferral) {
      console.log(`No pending referral for ${userEmail}`);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (profileData) {
      await supabase
        .from('profiles')
        .update({ credits: profileData.credits + CREDITS_PER_REFERRAL })
        .eq('id', userId)
    }


    // Update the referral to completed
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        referred_user_id: userId,
        status: 'completed',
        credits_awarded: CREDITS_PER_REFERRAL,
        completed_at: new Date().toISOString(),
      })
      .eq('id', pendingReferral.id);

    if (updateError) {
      console.error(' Error completing referral:', updateError.message);
      return;
    }

    console.log(` Completed referral for: ${userEmail} (referrer: ${pendingReferral.referrer_id})`);
  } catch (error) {
    console.error(' Error processing pending referral:', error);
  }
}

async function sendWelcomeEmailsIfNeeded(
  supabase: any,
  userId: string,
  full_name: string,
  email: string,
  resend: Resend,
  isNewSignup: boolean
) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('welcome_email_sent')
      .eq('id', userId)
      .single();

    if (profile && !profile.welcome_email_sent && isNewSignup) {
      // Send both emails in parallel
      await Promise.all([
        sendWelcomeEmail(full_name, email, userId, resend),
        sendAdminNotification(full_name, email, resend),
      ]);

      // Mark as sent
      await supabase
        .from('profiles')
        .update({
          welcome_email_sent: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      console.log(` Welcome emails sent and marked for: ${email}`);
    }
  } catch (error) {
    console.error(' Error in welcome email process:', error);
  }
}

async function getRedirectByRole(supabase: any, userId: string, fallback: string | null): Promise<string> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (data?.role === 'admin') {
      return (fallback && fallback.startsWith('/dashboard/admin')) ? fallback : '/dashboard/admin';
    }

    if (fallback && fallback.startsWith('/dashboard') && !fallback.startsWith('/dashboard/admin')) {
      return fallback;
    }
  } catch { }
  return '/dashboard';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const code = searchParams.get('code');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');
  const referralCode = searchParams.get('ref');
  //validate environment
  if (!process.env.RESEND_API_KEY) {
    console.error(' RESEND_API_KEY is not configured');
    redirect('/error?message=Server configuration error. Please contact support.');
  }
  const supabase = await getSupabaseServer();
  const resend = new Resend(process.env.RESEND_API_KEY!);
  // For Google sign-in
  if (code) {
    let dest = nextParam ?? '/dashboard';
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data.user) {
        console.error('Error exchanging code for session:', error?.message);
        throw new Error('Error exchanging OAuth code for session', { cause: error });
      }

      const user = data.user;
      const full_name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email!;
      const avatar_url =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null;

      console.log(` Google OAuth callback for: ${user.email}`);

      // Update profile with OAuth data
      await updateUserProfile(supabase, user.id, full_name, avatar_url);

      // Track referral if code exists (for new signups via OAuth with ref parameter)
      if (referralCode) {
        await processReferral(referralCode, user.email!);
      }

      // Complete any pending referral for this email
      if (user.email) {
        await completePendingReferral(supabase, user.email, user.id);
      }

      await sendWelcomeEmailsIfNeeded(
        supabase,
        user.id,
        full_name,
        user.email!,
        resend,
        true
      );

      console.log(` Google OAuth flow completed for: ${user.email}`);
      dest = await getRedirectByRole(supabase, user.id, nextParam);
    } catch (error) {
      console.error(' Unexpected error in Google OAuth flow:', error);
      dest = '/error?message=Failed to sign in with Google. Please try again.';
    }
    return redirect(dest);
  }

  // For email OTP verification (manual signup)
  if (token_hash && type) {
    let dest = nextParam ?? '/dashboard';
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });

      if (error || !data.user) {
        console.error(' Error verifying OTP:', error?.message);
        throw new Error('Invalid or expired confirmation link.');
      }

      const user = data.user;
      const full_name = user.user_metadata?.full_name || user.email!;
      const avatar_url = user.user_metadata?.avatar_url || null;

      console.log(`Email OTP verification for: ${user.email} (type: ${type})`);

      // Update profile
      await updateUserProfile(supabase, user.id, full_name, avatar_url);

      // Complete any pending referral for this email
      if (user.email) {
        await completePendingReferral(supabase, user.email, user.id);
      }

      // Send welcome emails only for new signups (type === 'signup')
      const isNewSignup = type === 'signup';
      await sendWelcomeEmailsIfNeeded(
        supabase,
        user.id,
        full_name,
        user.email!,
        resend,
        isNewSignup
      );

      console.log(`Email OTP flow completed for: ${user.email}`);
      dest = await getRedirectByRole(supabase, user.id, nextParam);
    } catch (error: any) {
      console.error('Unexpected error in email OTP flow:', error);
      const msg = error?.message === 'Invalid or expired confirmation link.'
        ? 'Invalid or expired confirmation link. Please request a new one.'
        : 'An unexpected error occurred. Please try again.';
      dest = `/error?message=${encodeURIComponent(msg)}`;
    }
    return redirect(dest);
  }

  console.error('Invalid auth callback request - missing required parameters');
  redirect('/error?message=Invalid authentication request. Please try signing in again.');
}