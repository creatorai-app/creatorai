import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  lemonSqueezySetup,
  createCheckout,
  getSubscription,
  cancelSubscription,
  listDiscountRedemptions,
  type NewCheckout,
} from '@lemonsqueezy/lemonsqueezy.js';
import * as crypto from 'crypto';

const COMMISSION_MATURITY_DAYS = 30;
const MAX_COMMISSIONED_PAYMENTS = 12;

// Credits granted to the *buyer* (on top of their plan allowance) when they
// make their first purchase via someone's referral link. The referrer earns
// the same amount via the award_referral_credits DB trigger.
const REFERRAL_PURCHASE_BONUS = 1000;

export interface PlanRecord {
  id: string;
  name: string;
  price_monthly: number;
  price_annual_monthly?: number | null;
  credits_monthly: number;
  features: unknown;
  is_active: boolean;
  tagline?: string | null;
  ls_variant_id?: string;
  ls_variant_id_annual?: string | null;
}

interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan_id: string;
  ls_subscription_id: string | null;
  ls_customer_id: string | null;
  ls_order_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  plans: PlanRecord;
}

export interface LsWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string; plan_id?: string; affiliate_code?: string };
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private lsInitialized = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) { }

  private initLemonSqueezy() {
    if (this.lsInitialized) return;
    const apiKey = this.configService.get<string>('LEMONSQUEEZY_API_KEY');
    if (!apiKey) throw new BadRequestException('Lemon Squeezy not configured');
    lemonSqueezySetup({ apiKey });
    this.lsInitialized = true;
  }

  async getPlans(): Promise<PlanRecord[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (error) throw new BadRequestException('Failed to fetch plans');
    return data ?? [];
  }

  async getBillingInfo(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    const starterPlan = await this.getStarterPlan();

    if (!subscription && starterPlan) {
      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: starterPlan.id,
        ls_subscription_id: null,
        ls_customer_id: null,
        ls_order_id: null,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: null,
      });
    }

    const isPaidSubscription = !!subscription?.ls_subscription_id;

    // Nearest un-dismissed expiry reminder (drives the in-app modal). Rows are
    // created by the worker's daily reminder cron; latest created = most urgent
    // milestone reached (7d -> 3d -> 24h).
    let reminder: {
      id: string;
      milestone: string;
      periodEnd: string;
      planName: string;
    } | null = null;
    if (subscription?.id) {
      const { data: rem } = await supabase
        .from('subscription_reminders')
        .select('id, milestone, period_end')
        .eq('subscription_id', subscription.id)
        .is('seen_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rem) {
        reminder = {
          id: rem.id,
          milestone: rem.milestone,
          periodEnd: rem.period_end,
          planName: (subscription.plans as { name?: string })?.name ?? 'your',
        };
      }
    }

    return {
      currentPlan: subscription?.plans ?? starterPlan,
      // Expiry of the active plan whether it's LS- or admin-granted (admin
      // grants have no lsSubscriptionId but do have a current_period_end).
      expiresAt: subscription?.current_period_end ?? null,
      reminder,
      subscription: isPaidSubscription
        ? {
          id: subscription!.id,
          status: subscription!.status,
          currentPeriodEnd: subscription!.current_period_end,
          lsSubscriptionId: subscription!.ls_subscription_id,
        }
        : null,
      credits: profile?.credits ?? 0,
    };
  }

  /** Dismiss an expiry reminder so the in-app modal stops showing it. */
  async dismissExpiryReminder(userId: string, reminderId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('subscription_reminders')
      .update({ seen_at: new Date().toISOString() })
      .eq('id', reminderId)
      .eq('user_id', userId); // scope to owner so one user can't dismiss another's
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async createCheckoutSession(
    userId: string,
    planId: string,
    affiliateCode?: string,
    origin?: string,
    interval: 'monthly' | 'annual' = 'monthly',
  ) {
    this.initLemonSqueezy();
    const supabase = this.supabaseService.getClient();

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) throw new NotFoundException('Plan not found');
    if (plan.price_monthly === 0)
      throw new BadRequestException('Cannot purchase the free plan');

    // Pick the annual variant when the caller asked for annual billing and the
    // plan has one configured; otherwise fall back to the monthly variant.
    const variantId =
      interval === 'annual' && plan.ls_variant_id_annual
        ? plan.ls_variant_id_annual
        : plan.ls_variant_id;

    if (!variantId)
      throw new BadRequestException('Plan is not configured for payments');

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', userId)
      .single();

    if (!profile?.email) throw new BadRequestException('User email not found');

    const storeId = this.configService.get<string>('LEMONSQUEEZY_STORE_ID');
    if (!storeId) throw new BadRequestException('Store not configured');

    const frontendUrl = this.resolveFrontendBase(origin);

    const checkoutData: NewCheckout = {
      productOptions: {
        redirectUrl: `${frontendUrl}/dashboard/settings?tab=billing&status=success`,
      },
      checkoutData: {
        email: profile.email,
        name: profile.full_name ?? undefined,
        custom: {
          user_id: userId,
          plan_id: planId,
          ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
        },
      },
    };

    const { data, error } = await createCheckout(
      storeId,
      variantId,
      checkoutData,
    );

    if (error) {
      this.logger.error(`Checkout creation failed: ${JSON.stringify(error)}`);
      throw new BadRequestException('Failed to create checkout');
    }

    // Tracked here rather than in the frontend so every entry point into
    // checkout (billing settings, upgrade promo cards) is counted once.
    await this.trackFunnelEvent({
      event: 'checkout_started',
      tier: plan.name,
      userId,
      sessionId: `user:${userId}`,
    });

    return { url: data?.data.attributes.url };
  }

  // --- Purchase-intent funnel ---

  /**
   * Record a step of the purchase funnel. Lemon Squeezy only ever sees people
   * who already reached its checkout, so intent above that has to come from us.
   * Never throws: analytics must not break a checkout or a page render.
   */
  async trackFunnelEvent(input: {
    event: string;
    tier?: string | null;
    userId?: string | null;
    sessionId: string;
    referrer?: string | null;
  }) {
    const trim = (v: string | null | undefined, max: number) =>
      v ? v.slice(0, max) : null;

    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('funnel_events')
        .insert({
          event: input.event,
          tier: trim(input.tier, 64),
          user_id: input.userId ?? null,
          session_id: input.sessionId.slice(0, 128),
          referrer: trim(input.referrer, 512),
        });
      if (error) this.logger.warn(`Funnel event insert failed: ${error.message}`);
    } catch (err) {
      this.logger.warn(`Funnel event insert threw: ${err}`);
    }
  }

  async getCustomerPortalUrl(userId: string) {
    this.initLemonSqueezy();
    const supabase = this.supabaseService.getClient();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('ls_subscription_id')
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription?.ls_subscription_id) {
      throw new BadRequestException('No active subscription found');
    }

    const { data, error } = await getSubscription(
      subscription.ls_subscription_id,
    );

    if (error) {
      this.logger.error(`Failed to fetch subscription: ${JSON.stringify(error)}`);
      throw new BadRequestException('Failed to get portal URL');
    }

    const urls = data?.data.attributes.urls;
    return {
      url: urls?.customer_portal ?? null,
    };
  }

  async cancelActiveSubscription(userId: string) {
    this.initLemonSqueezy();
    const supabase = this.supabaseService.getClient();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .not('ls_subscription_id', 'is', null)
      .in('status', ['active', 'on_trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription?.ls_subscription_id) {
      throw new BadRequestException('No active paid subscription found');
    }

    const { error } = await cancelSubscription(subscription.ls_subscription_id);
    if (error) {
      this.logger.error(`Failed to cancel subscription: ${JSON.stringify(error)}`);
      throw new BadRequestException('Failed to cancel subscription');
    }

    await supabase
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('id', subscription.id);

    await this.createFreePlanSubscription(userId);

    this.logger.log(`Subscription canceled for user ${userId}`);
    return { success: true };
  }

  /**
   * Set a user's balance to `allowance` while carrying their reset-protected
   * bonus credits (referral rewards, purchase bonuses) across the reset.
   * Mirrors the SQL crons — see migration 20260723000000.
   *
   * extraBonus grants a NEW bonus in the same write (used at purchase time).
   */
  private async applyAllowance(
    userId: string,
    allowance: number,
    supabase: ReturnType<typeof this.supabaseService.getClient>,
    extraBonus = 0,
  ) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('bonus_credits')
      .eq('user_id', userId)
      .maybeSingle();

    const bonus = (profile?.bonus_credits ?? 0) + extraBonus;

    const { error } = await supabase
      .from('profiles')
      .update({ credits: allowance + bonus, bonus_credits: bonus })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to reset credits for ${userId}: ${JSON.stringify(error)}`);
    } else {
      this.logger.log(`Reset credits to ${allowance} (+${bonus} bonus) for ${userId}`);
    }
  }

  private async createFreePlanSubscription(userId: string) {
    const supabase = this.supabaseService.getClient();
    const starter = await this.getStarterPlan();
    if (!starter) {
      this.logger.error(`Cannot create free plan / reset credits for ${userId}: no free plan`);
      return;
    }

    await supabase.from('subscriptions').insert({
      user_id: userId,
      plan_id: starter.id,
      ls_subscription_id: null,
      ls_customer_id: null,
      ls_order_id: null,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: null,
    });

    // Downgrade the credit balance to the free plan allowance, keeping bonuses.
    await this.applyAllowance(userId, starter.credits_monthly, supabase);
  }

  /**
   * Reset a user's credit balance to the free (Starter) plan allowance without
   * creating a new subscription row — used when a free subscription already exists.
   */
  private async resetCreditsToFreePlan(
    userId: string,
    supabase: ReturnType<typeof this.supabaseService.getClient>,
  ) {
    const starter = await this.getStarterPlan();
    if (!starter) {
      this.logger.error(`Cannot reset credits for ${userId}: no free plan`);
      return;
    }
    await this.applyAllowance(userId, starter.credits_monthly, supabase);
  }

  /**
   * Downgrade the owner of a Lemon Squeezy subscription to the free plan and
   * reset their credits. Safe to call from any "subscription ended" webhook
   * (cancelled / expired / updated→cancelled) — it is idempotent and will NOT
   * downgrade a user who still has another active paid subscription.
   */
  private async downgradeToFreePlan(
    lsSubId: string,
    supabase: ReturnType<typeof this.supabaseService.getClient>,
  ) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('ls_subscription_id', lsSubId)
      .maybeSingle();
    if (!sub?.user_id) return;

    // Don't downgrade if the user still has another active paid subscription
    // (e.g. they cancelled one plan but upgraded to another).
    const { data: activePaid } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', sub.user_id)
      .not('ls_subscription_id', 'is', null)
      .in('status', ['active', 'on_trial', 'past_due'])
      .maybeSingle();
    if (activePaid) return;

    const { data: existingFreeSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', sub.user_id)
      .is('ls_subscription_id', null)
      .eq('status', 'active')
      .maybeSingle();

    if (existingFreeSub) {
      await this.resetCreditsToFreePlan(sub.user_id, supabase);
    } else {
      await this.createFreePlanSubscription(sub.user_id);
    }

    this.logger.log(`Downgraded user ${sub.user_id} to free plan (sub ${lsSubId})`);
  }

  // --- Webhook handlers ---

  async handleSubscriptionCreated(event: LsWebhookEvent) {
    const attrs = event.data.attributes;
    const userId = event.meta.custom_data?.user_id;
    const planId = event.meta.custom_data?.plan_id;

    if (!userId || !planId) {
      this.logger.warn('Missing custom_data in subscription_created');
      return;
    }

    const supabase = this.supabaseService.getClient();
    const lsSubId = String(event.data.id);

    // Idempotency: Lemon Squeezy retries failed deliveries (and the event may be
    // registered to more than one endpoint), so the same subscription_created can
    // arrive multiple times. Skip if we've already recorded this subscription to
    // avoid duplicate rows and double-awarding credits.
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('ls_subscription_id', lsSubId)
      .maybeSingle();
    if (existingSub) {
      this.logger.log(`subscription_created already processed for ${lsSubId}`);
      return;
    }

    await supabase
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial', 'past_due']);

    const { data: plan } = await supabase
      .from('plans')
      .select('credits_monthly, ls_variant_id_annual')
      .eq('id', planId)
      .single();

    const lsVariantId = String(attrs.variant_id ?? '');
    const billingInterval =
      plan?.ls_variant_id_annual && lsVariantId === plan.ls_variant_id_annual
        ? 'annual'
        : 'monthly';

    const { data: insertedSub } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        ls_subscription_id: lsSubId,
        ls_customer_id: String(attrs.customer_id ?? ''),
        ls_order_id: String(attrs.order_id ?? ''),
        status: this.mapLsStatus(String(attrs.status ?? 'active')),
        billing_interval: billingInterval,
        credits_last_refreshed_at: new Date().toISOString(),
        current_period_start: attrs.created_at
          ? new Date(attrs.created_at as string).toISOString()
          : null,
        current_period_end: attrs.renews_at
          ? new Date(attrs.renews_at as string).toISOString()
          : null,
      })
      .select('id')
      .single();

    const subscriptionId = insertedSub?.id ?? null;
    const customerEmail = (attrs.user_email as string | undefined) ?? null;

    if (plan) {
      // If this purchase is the buyer's first conversion via a referral link,
      // complete the referral (awards the referrer 1,000 via DB trigger) and
      // grant the buyer a matching 1,000-credit bonus on top of their plan.
      const referralBonus = await this.completeReferralOnPurchase(
        userId,
        customerEmail,
        supabase,
      );

      // referralBonus is tagged as protected so the next renewal carries it.
      await this.applyAllowance(userId, plan.credits_monthly, supabase, referralBonus);
    }

    const affiliateCode = event.meta.custom_data?.affiliate_code;
    if (affiliateCode) {
      await this.trackAffiliateConversion(
        affiliateCode,
        userId,
        planId,
        supabase,
        customerEmail,
        subscriptionId,
      );
    } else if (attrs.order_id != null) {
      await this.trackPromoConversion(
        String(attrs.order_id),
        userId,
        planId,
        supabase,
        customerEmail,
        subscriptionId,
      );
    }

    this.logger.log(`Subscription created for user ${userId}`);
  }

  async handleSubscriptionUpdated(event: LsWebhookEvent) {
    const attrs = event.data.attributes;
    const supabase = this.supabaseService.getClient();
    const lsSubId = String(event.data.id);
    const mappedStatus = this.mapLsStatus(String(attrs.status ?? ''));

    await supabase
      .from('subscriptions')
      .update({
        status: mappedStatus,
        current_period_end: attrs.renews_at
          ? new Date(attrs.renews_at as string).toISOString()
          : null,
      })
      .eq('ls_subscription_id', lsSubId);

    // Lemon Squeezy fires subscription_updated (not always a dedicated
    // subscription_cancelled) when a subscription is cancelled or lapses, so this
    // is the reliable place to downgrade credits to the free plan.
    if (mappedStatus === 'canceled' || mappedStatus === 'expired') {
      await this.downgradeToFreePlan(lsSubId, supabase);
    }
  }

  async handleSubscriptionCancelled(event: LsWebhookEvent) {
    const supabase = this.supabaseService.getClient();
    const lsSubId = String(event.data.id);

    await supabase
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('ls_subscription_id', lsSubId);

    await this.downgradeToFreePlan(lsSubId, supabase);
  }

  async handleSubscriptionExpired(event: LsWebhookEvent) {
    const supabase = this.supabaseService.getClient();
    const lsSubId = String(event.data.id);

    await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('ls_subscription_id', lsSubId);

    await this.downgradeToFreePlan(lsSubId, supabase);
  }

  async handleSubscriptionPaymentSuccess(event: LsWebhookEvent) {
    const attrs = event.data.attributes;
    const lsSubId = String(attrs.subscription_id ?? '');
    if (!lsSubId) return;

    const supabase = this.supabaseService.getClient();

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, user_id, plan_id')
      .eq('ls_subscription_id', lsSubId)
      .single();

    if (!sub) return;

    const { data: plan } = await supabase
      .from('plans')
      .select('credits_monthly')
      .eq('id', sub.plan_id)
      .single();

    if (plan) {
      await this.applyAllowance(sub.user_id, plan.credits_monthly, supabase);

      await supabase
        .from('subscriptions')
        .update({ credits_last_refreshed_at: new Date().toISOString() })
        .eq('id', sub.id);
    }

    // The first ("initial") invoice fires alongside subscription_created, which
    // already records the affiliate conversion. Only genuine renewals add a new
    // recurring commission — otherwise the initial purchase is commissioned twice.
    const billingReason = String(attrs.billing_reason ?? '');
    if (billingReason === 'renewal') {
      const customerEmail = (attrs.user_email as string | undefined) ?? null;
      await this.trackRenewalCommission(
        sub.user_id,
        sub.plan_id,
        supabase,
        customerEmail,
        sub.id,
      );
    }
  }

  // --- Usage history ---

  async getUsageHistory(userId: string, range: 'daily' | 'weekly' | 'monthly' = 'weekly') {
    const supabase = this.supabaseService.getClient();

    const now = new Date();
    let daysBack: number;
    switch (range) {
      case 'daily':
        daysBack = 7;
        break;
      case 'weekly':
        daysBack = 28;
        break;
      case 'monthly':
        daysBack = 180;
        break;
    }
    const since = new Date(now.getTime() - daysBack * 86400000).toISOString();

    const tables = ['scripts', 'ideation_jobs', 'thumbnail_jobs', 'subtitle_jobs', 'dubbing_projects', 'story_builder_jobs', 'documentation_generations'] as const;
    type UsageRow = { credits_consumed: number; created_at: string };

    const rows: UsageRow[] = [];
    for (const table of tables) {
      const { data } = await supabase
        .from(table)
        .select('credits_consumed, created_at')
        .eq('user_id', userId)
        .gte('created_at', since)
        .gt('credits_consumed', 0);

      if (data) rows.push(...(data as UsageRow[]));
    }

    const buckets: Record<string, number> = {};
    for (const row of rows) {
      const d = new Date(row.created_at);
      let key: string;
      if (range === 'daily') {
        key = d.toISOString().split('T')[0]!;
      } else if (range === 'weekly') {
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().split('T')[0]!;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      buckets[key] = (buckets[key] ?? 0) + (row.credits_consumed ?? 0);
    }

    const result = Object.entries(buckets)
      .map(([date, credits]) => ({ date, credits }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalUsed = rows.reduce((sum, r) => sum + (r.credits_consumed ?? 0), 0);

    return { usage: result, totalUsed, range };
  }

  // --- Webhook audit trail ---

  /**
   * Persist every verified Lemon Squeezy webhook, including ones we don't act
   * on. This table is the source of truth for admin revenue/sales reporting.
   * Never throws: a reporting write must not fail the webhook and trigger a
   * pointless Lemon Squeezy retry of an event we already handled.
   */
  async recordWebhookEvent(eventName: string, event: LsWebhookEvent) {
    const attrs = event.data?.attributes ?? {};
    const str = (v: unknown) => (v == null ? null : String(v));

    // Invoices carry subscription_id; the subscription_* events are the
    // subscription itself. Either way this links a payment back to its plan.
    const lsSubscriptionId =
      attrs.subscription_id != null
        ? String(attrs.subscription_id)
        : event.data?.type === 'subscriptions'
          ? String(event.data.id)
          : null;

    const firstItem = attrs.first_order_item as
      | Record<string, unknown>
      | undefined;

    const rawOccurredAt = (attrs.updated_at ?? attrs.created_at) as
      | string
      | undefined;
    const occurredAt = rawOccurredAt ? new Date(rawOccurredAt) : new Date();

    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('ls_webhook_events')
        .insert({
          event_name: eventName,
          ls_id: String(event.data?.id ?? ''),
          ls_subscription_id: lsSubscriptionId,
          customer_email: str(attrs.user_email),
          variant_id: str(attrs.variant_id ?? firstItem?.variant_id),
          amount_cents: Number(attrs.total ?? 0) || 0,
          currency: str(attrs.currency),
          status: str(attrs.status),
          payload: event,
          occurred_at: (
            isNaN(occurredAt.getTime()) ? new Date() : occurredAt
          ).toISOString(),
        });

      // 23505 = duplicate delivery of an identical payload. Lemon Squeezy
      // retries, so this is expected and not worth logging as an error.
      if (error && error.code !== '23505') {
        this.logger.error(`Webhook event record failed: ${error.message}`);
      }
    } catch (err) {
      this.logger.error(`Webhook event record threw: ${err}`);
    }
  }

  // --- Webhook signature verification ---

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = this.configService.get<string>(
      'LEMONSQUEEZY_WEBHOOK_SECRET',
    );
    if (!secret) throw new Error('LEMONSQUEEZY_WEBHOOK_SECRET not configured');

    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(rawBody).digest('hex');
    const digestBuf = Buffer.from(digest);
    const signatureBuf = Buffer.from(signature);

    if (digestBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(digestBuf, signatureBuf);
  }

  // --- Helpers ---

  /**
   * Resolve which frontend origin the post-checkout redirect should return to.
   * Prefers the caller's own origin (so a checkout started on localhost returns
   * to localhost and keeps the user's session/cookies) — but only when it is an
   * allowed origin. Falls back to the configured env URLs otherwise.
   */
  private resolveFrontendBase(origin?: string): string {
    const devUrl = this.configService.get<string>('FRONTEND_DEV_URL');
    const prodUrl = this.configService.get<string>('FRONTEND_PROD_URL');
    const allowed = [devUrl, prodUrl].filter(Boolean) as string[];

    if (origin && allowed.includes(origin)) return origin;

    return prodUrl || devUrl || 'http://localhost:3000';
  }

  private async getStarterPlan(): Promise<PlanRecord | null> {
    const supabase = this.supabaseService.getClient();

    // Prefer the explicit free plan (price 0) so a renamed "Starter" can't break
    // downgrades; fall back to a case-insensitive name match.
    const { data: freePlan } = await supabase
      .from('plans')
      .select('*')
      .eq('price_monthly', 0)
      .order('credits_monthly', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (freePlan) return freePlan;

    const { data: named } = await supabase
      .from('plans')
      .select('*')
      .ilike('name', 'starter')
      .limit(1)
      .maybeSingle();

    if (!named) {
      this.logger.error('No free/Starter plan found in plans table');
    }
    return named ?? null;
  }

  private maturityDate(): string {
    return new Date(Date.now() + COMMISSION_MATURITY_DAYS * 86400000).toISOString();
  }

  /**
   * Complete a pending referral when the referred user makes their first
   * purchase. Marks the referral 'completed' (the award_referral_credits
   * trigger then credits the referrer 1,000) and returns the bonus the buyer
   * should additionally receive (1,000), or 0 when the buyer was not referred.
   *
   * Idempotent: the status guard means only the first qualifying purchase
   * completes the referral and pays out the bonus.
   */
  private async completeReferralOnPurchase(
    buyerUserId: string,
    buyerEmail: string | null,
    supabase: ReturnType<typeof this.supabaseService.getClient>,
  ): Promise<number> {
    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('user_id', buyerUserId)
      .maybeSingle();

    const email = (buyerEmail ?? buyerProfile?.email ?? '').toLowerCase();

    // Find a still-pending referral for this buyer — matched by the email
    // captured when the link was used, or by the linked profile id.
    let referral: { id: string } | null = null;
    if (email) {
      const { data } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_email', email)
        .eq('status', 'pending')
        .maybeSingle();
      referral = data ?? null;
    }
    if (!referral && buyerProfile?.id) {
      const { data } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_user_id', buyerProfile.id)
        .eq('status', 'pending')
        .maybeSingle();
      referral = data ?? null;
    }

    if (!referral) return 0;

    const { error, data: updated } = await supabase
      .from('referrals')
      .update({
        status: 'completed',
        referred_user_id: buyerProfile?.id ?? null,
        credits_awarded: REFERRAL_PURCHASE_BONUS,
        completed_at: new Date().toISOString(),
      })
      .eq('id', referral.id)
      .eq('status', 'pending') // guard against concurrent double-processing
      .select('id');

    if (error || !updated?.length) {
      if (error)
        this.logger.error(
          `Failed to complete referral ${referral.id}: ${JSON.stringify(error)}`,
        );
      return 0;
    }

    this.logger.log(
      `Referral ${referral.id} completed on purchase by ${buyerUserId}; buyer +${REFERRAL_PURCHASE_BONUS} bonus`,
    );
    return REFERRAL_PURCHASE_BONUS;
  }

  private async trackAffiliateConversion(
    code: string,
    customerId: string,
    planId: string,
    supabase: ReturnType<typeof this.supabaseService.getClient>,
    customerEmail?: string | null,
    subscriptionId?: string | null,
  ) {
    const { data: link } = await supabase
      .from('affiliate_links')
      .select('id, commission_rate, sales_rep_id')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (!link) return;

    const { data: existing } = await supabase
      .from('affiliate_sales')
      .select('id')
      .eq('affiliate_link_id', link.id)
      .eq('customer_id', customerId)
      .maybeSingle();
    if (existing) return;

    const { data: plan } = await supabase
      .from('plans')
      .select('price_monthly')
      .eq('id', planId)
      .single();

    const amount = plan?.price_monthly ?? 0;
    const commission = Number(((amount * link.commission_rate) / 100).toFixed(2));

    await supabase.from('affiliate_sales').insert({
      affiliate_link_id: link.id,
      sales_rep_id: link.sales_rep_id,
      customer_id: customerId,
      customer_email: customerEmail ?? null,
      subscription_id: subscriptionId ?? null,
      amount,
      commission,
      status: 'pending',
      source: 'link',
      mature_at: this.maturityDate(),
    });

    this.logger.log(`Affiliate conversion tracked for code ${code}`);
  }

  private async trackPromoConversion(
    orderId: string,
    customerId: string,
    planId: string,
    supabase: ReturnType<typeof this.supabaseService.getClient>,
    customerEmail?: string | null,
    subscriptionId?: string | null,
  ) {
    this.initLemonSqueezy();

    const { data: redemptions, error } = await listDiscountRedemptions({ filter: { orderId } });
    if (error || !redemptions?.data?.length) return;

    const discountCode = (
      redemptions.data[0]?.attributes as { discount_code?: string } | undefined
    )?.discount_code;
    if (!discountCode) return;

    const { data: promo } = await supabase
      .from('affiliate_promo_codes')
      .select('id, owner_id, commission_rate')
      .eq('code', discountCode)
      .eq('is_active', true)
      .maybeSingle();
    if (!promo) return;

    const { data: existing } = await supabase
      .from('affiliate_sales')
      .select('id')
      .eq('promo_code_id', promo.id)
      .eq('customer_id', customerId)
      .maybeSingle();
    if (existing) return;

    const { data: plan } = await supabase
      .from('plans')
      .select('price_monthly')
      .eq('id', planId)
      .single();

    const amount = plan?.price_monthly ?? 0;
    const commission = Number(((amount * promo.commission_rate) / 100).toFixed(2));

    await supabase.from('affiliate_sales').insert({
      affiliate_link_id: null,
      sales_rep_id: promo.owner_id,
      customer_id: customerId,
      customer_email: customerEmail ?? null,
      subscription_id: subscriptionId ?? null,
      amount,
      commission,
      status: 'pending',
      source: 'promo',
      promo_code_id: promo.id,
      mature_at: this.maturityDate(),
    });

    this.logger.log(`Promo conversion tracked for code ${discountCode}`);
  }

  private async trackRenewalCommission(
    userId: string,
    planId: string,
    supabase: ReturnType<typeof this.supabaseService.getClient>,
    customerEmail?: string | null,
    subscriptionId?: string | null,
  ) {
    const { data: original } = await supabase
      .from('affiliate_sales')
      .select('affiliate_link_id, sales_rep_id, source, promo_code_id')
      .eq('customer_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!original) return;

    // Recurring commission applies only to the first MAX_COMMISSIONED_PAYMENTS payments.
    const { count: priorCount } = await supabase
      .from('affiliate_sales')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', userId)
      .eq('sales_rep_id', original.sales_rep_id);
    if ((priorCount ?? 0) >= MAX_COMMISSIONED_PAYMENTS) return;

    let commissionRate: number | null = null;
    if (original.source === 'promo' && original.promo_code_id) {
      const { data: promo } = await supabase
        .from('affiliate_promo_codes')
        .select('commission_rate, is_active')
        .eq('id', original.promo_code_id)
        .single();
      if (promo?.is_active) commissionRate = promo.commission_rate;
    } else if (original.affiliate_link_id) {
      const { data: link } = await supabase
        .from('affiliate_links')
        .select('commission_rate, is_active')
        .eq('id', original.affiliate_link_id)
        .single();
      if (link?.is_active) commissionRate = link.commission_rate;
    }

    if (commissionRate == null) return;

    const { data: plan } = await supabase
      .from('plans')
      .select('price_monthly')
      .eq('id', planId)
      .single();

    const amount = plan?.price_monthly ?? 0;
    const commission = Number(((amount * commissionRate) / 100).toFixed(2));

    await supabase.from('affiliate_sales').insert({
      affiliate_link_id: original.affiliate_link_id,
      sales_rep_id: original.sales_rep_id,
      customer_id: userId,
      customer_email: customerEmail ?? null,
      subscription_id: subscriptionId ?? null,
      amount,
      commission,
      status: 'pending',
      source: original.source ?? 'link',
      promo_code_id: original.promo_code_id ?? null,
      mature_at: this.maturityDate(),
    });

    this.logger.log(`Renewal commission tracked for user ${userId}`);
  }

  async handleOrderRefunded(event: LsWebhookEvent) {
    const attrs = event.data.attributes;
    const customerId = attrs.customer_id != null ? String(attrs.customer_id) : null;
    const orderId = String(event.data.id);
    const supabase = this.supabaseService.getClient();

    // Resolve the affected subscriber: prefer the subscription tied to this order.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('ls_order_id', orderId)
      .maybeSingle();

    const userId = sub?.user_id;
    if (!userId && !customerId) return;

    let query = supabase
      .from('affiliate_sales')
      .update({ status: 'refunded' })
      .in('status', ['pending', 'confirmed']);

    query = userId
      ? query.eq('customer_id', userId)
      : query.eq('customer_id', customerId as string);

    await query;
    this.logger.log(`Affiliate commissions clawed back for order ${orderId}`);
  }

  private mapLsStatus(status: string): string {
    const map: Record<string, string> = {
      active: 'active',
      on_trial: 'on_trial',
      past_due: 'past_due',
      paused: 'paused',
      cancelled: 'canceled',
      expired: 'expired',
      unpaid: 'unpaid',
    };
    return map[status] ?? 'canceled';
  }
}
