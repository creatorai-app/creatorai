import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Resend } from 'resend';
import {
  createSupabaseClient,
  getSupabaseServiceEnv,
  SupabaseClient,
} from '@repo/supabase';
import { generateSubscriptionExpiryReminderEmail } from '@repo/email-templates';

// Milestones before an admin-granted plan expires. `hours` is the remaining-time
// threshold: a milestone is "due" once the plan has that many hours or fewer
// left. Ordered widest-first so the 7d row is created before the 3d/24h ones.
export const REMINDER_MILESTONES = [
  { key: '7d', hours: 7 * 24, label: '7 days' },
  { key: '3d', hours: 3 * 24, label: '3 days' },
  { key: '24h', hours: 24, label: '24 hours' },
] as const;

// Which milestones a plan with `remainingMs` left has reached. Pure + exported
// so the branchy bit is unit-tested (subscription-reminder.service.spec.ts).
export function dueMilestones(remainingMs: number) {
  if (remainingMs <= 0) return []; // already expired — the downgrade cron owns it
  const remainingHours = remainingMs / 3_600_000;
  return REMINDER_MILESTONES.filter((m) => remainingHours <= m.hours);
}

@Injectable()
export class SubscriptionReminderService {
  private readonly logger = new Logger(SubscriptionReminderService.name);
  private readonly db: SupabaseClient;
  private readonly resend: Resend | null;

  constructor() {
    const { url, key } = getSupabaseServiceEnv();
    this.db = createSupabaseClient(url, key);
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY missing — expiry reminder emails disabled');
    }
  }

  // Daily at 00:10 UTC. Single-instance worker, so no multi-node double-firing.
  // ponytail: fixed daily cadence — reminders land within a day of each
  // milestone, which matches the 7d/3d/24h granularity we promise.
  @Cron('10 0 * * *', { name: 'subscription-expiry-reminders' })
  async run(): Promise<void> {
    const now = Date.now();
    const horizonIso = new Date(now + REMINDER_MILESTONES[0].hours * 3_600_000).toISOString();
    const nowIso = new Date(now).toISOString();

    // Admin-granted (no LS id), active, expiring within the widest window.
    const { data: subs, error } = await this.db
      .from('subscriptions')
      .select('id, user_id, current_period_end, plans(name)')
      .is('ls_subscription_id', null)
      .eq('status', 'active')
      .not('current_period_end', 'is', null)
      .gt('current_period_end', nowIso)
      .lte('current_period_end', horizonIso);

    if (error) {
      this.logger.error(`Failed to load expiring subscriptions: ${error.message}`);
      return;
    }
    if (!subs?.length) return;

    // Resolve user emails in one shot (no FK from subscriptions -> profiles).
    const userIds = [...new Set(subs.map((s) => s.user_id as string))];
    const { data: profiles } = await this.db
      .from('profiles')
      .select('user_id, email')
      .in('user_id', userIds);
    const emailByUser = new Map<string, string>(
      (profiles ?? []).map((p) => [p.user_id as string, p.email as string]),
    );

    let created = 0;
    for (const sub of subs) {
      const periodEnd = sub.current_period_end as string;
      const remainingMs = new Date(periodEnd).getTime() - now;
      const planName = (sub.plans as { name?: string })?.name ?? 'your';
      const email = emailByUser.get(sub.user_id as string);

      for (const milestone of dueMilestones(remainingMs)) {
        // Idempotent: the unique (subscription_id, period_end, milestone) index
        // means only the FIRST run for a milestone inserts a row + emails.
        const { data: inserted, error: upErr } = await this.db
          .from('subscription_reminders')
          .upsert(
            {
              user_id: sub.user_id,
              subscription_id: sub.id,
              period_end: periodEnd,
              milestone: milestone.key,
              emailed_at: nowIso,
            },
            { onConflict: 'subscription_id,period_end,milestone', ignoreDuplicates: true },
          )
          .select('id');

        if (upErr) {
          this.logger.error(`Reminder upsert failed (sub ${sub.id}): ${upErr.message}`);
          continue;
        }
        if (!inserted?.length) continue; // already existed — skip email

        created++;
        if (email) await this.sendEmail(email, planName, milestone.label, periodEnd);
      }
    }

    if (created) this.logger.log(`Sent ${created} subscription expiry reminder(s)`);
  }

  private async sendEmail(
    to: string,
    planName: string,
    timeLeft: string,
    periodEnd: string,
  ): Promise<void> {
    if (!this.resend) return;
    const baseUrl =
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_PROD_URL || 'https://tryscriptai.com'
        : process.env.FRONTEND_DEV_URL || 'http://localhost:3000';
    const expiresOn = new Date(periodEnd).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const html = generateSubscriptionExpiryReminderEmail({
      planName,
      timeLeft,
      expiresOn,
      upgradeUrl: `${baseUrl}/pricing`,
    });
    try {
      await this.resend.emails.send({
        from: 'Creator AI <no-reply@tryscriptai.com>',
        to,
        subject: `Your ${planName} plan expires in ${timeLeft}`,
        html,
      });
    } catch (err) {
      // Don't fail the run — the in-app reminder row already exists and shows.
      this.logger.error(`Failed to send expiry reminder to ${to}: ${String(err)}`);
    }
  }
}
