import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { BLOG_POST_WRITABLE_FIELDS } from '@repo/validation';
import { SupabaseService } from '../supabase/supabase.service';

interface FeedEvent {
  id: string;
  user_id: string;
  category: 'feature' | 'error' | 'subscription' | 'affiliate' | 'unsubscribe';
  label: string;
  action: string;
  status: string | null;
  error_message: string | null;
  credits_consumed: number;
  created_at: string;
}

@Injectable()
export class AdminService {
  private readonly resend: Resend | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) this.resend = new Resend(apiKey);
  }

  private get db() {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Admin client is not configured');
    }
    return client;
  }

  // ==================== DASHBOARD STATS ====================

  /**
   * How recently a user must have hit the API to count as "online now". The auth
   * guard refreshes last_seen_at at most every 2 minutes, so anything under ~5
   * would flicker for users who are reading rather than clicking.
   */
  private static readonly ONLINE_WINDOW_MINUTES = 5;

  async getDashboardStats() {
    const [
      usersRes,
      newUsersRes,
      subsRes,
      blogsRes,
      salesRes,
      revenueRes,
      mailsRes,
      applicationsRes,
      affiliateRequestsRes,
      onlineRes,
      active24hRes,
      errors24hRes,
    ] = await Promise.all([
      this.db.from('profiles').select('id', { count: 'exact', head: true }),
      this.db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      this.db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      this.db.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      this.db.from('ls_webhook_events').select('id', { count: 'exact', head: true }).eq('event_name', 'subscription_created'),
      // ponytail: summed in JS like the affiliate queries below it. Move to a
      // Postgres RPC if the payment count ever outgrows a single page.
      this.db.from('ls_webhook_events').select('amount_cents').eq('event_name', 'subscription_payment_success').eq('status', 'paid'),
      this.db.from('mail_messages').select('id', { count: 'exact', head: true }).eq('status', 'unread'),
      this.db.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      this.db.from('affiliate_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      // "Online" = made an authenticated API call inside the presence window.
      this.db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('last_seen_at', new Date(Date.now() - AdminService.ONLINE_WINDOW_MINUTES * 60000).toISOString()),
      this.db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('last_seen_at', new Date(Date.now() - 86400000).toISOString()),
      this.db
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ]);

    // Lemon Squeezy reports money in cents.
    const totalRevenue =
      (revenueRes.data?.reduce((sum, r) => sum + Number(r.amount_cents || 0), 0) ?? 0) / 100;

    return {
      totalUsers: usersRes.count ?? 0,
      newUsers30d: newUsersRes.count ?? 0,
      activeSubscriptions: subsRes.count ?? 0,
      publishedBlogs: blogsRes.count ?? 0,
      totalSales: salesRes.count ?? 0,
      totalRevenue,
      unreadMails: mailsRes.count ?? 0,
      pendingApplications: applicationsRes.count ?? 0,
      pendingAffiliateRequests: affiliateRequestsRes.count ?? 0,
      onlineUsers: onlineRes.count ?? 0,
      onlineWindowMinutes: AdminService.ONLINE_WINDOW_MINUTES,
      activeUsers24h: active24hRes.count ?? 0,
      errors24h: errors24hRes.count ?? 0,
    };
  }

  // ==================== REVENUE & FUNNEL ====================

  /**
   * Revenue, sales, failed payments and churn per plan, from the Lemon Squeezy
   * webhook audit trail. Revenue counts subscription_payment_success only --
   * order_created also fires for a subscription's first payment, so counting
   * both would double every initial purchase.
   */
  async getRevenueByTier() {
    const { data, error } = await this.db
      .from('ls_revenue_by_tier')
      .select('*')
      .order('revenue_cents', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((r) => ({
      tier: r.tier as string,
      revenue: Number(r.revenue_cents ?? 0) / 100,
      payments: Number(r.payments ?? 0),
      sales: Number(r.sales ?? 0),
      failedPayments: Number(r.failed_payments ?? 0),
      churned: Number(r.churned ?? 0),
    }));
  }

  /**
   * Purchase-intent funnel: viewed -> clicked -> checkout started -> completed.
   * The first three steps come from our own frontend (Lemon Squeezy only sees
   * people who already reached its checkout); completions come from the
   * webhook trail, joined by plan name.
   */
  async getFunnel() {
    const [funnelRes, tiers] = await Promise.all([
      this.db.from('funnel_summary').select('*'),
      this.getRevenueByTier(),
    ]);

    if (funnelRes.error) throw new BadRequestException(funnelRes.error.message);

    const rows = funnelRes.data ?? [];
    const sessionsFor = (event: string, tier?: string) =>
      rows
        .filter((r) => r.event === event && (tier ? r.tier === tier : true))
        .reduce((sum, r) => sum + Number(r.sessions ?? 0), 0);

    // Tiers people actually interacted with, plus any tier that has sold.
    const tierNames = Array.from(
      new Set([
        ...rows.map((r) => r.tier as string).filter((t) => t && t !== 'all'),
        ...tiers.map((t) => t.tier),
      ]),
    );

    const completedByTier = new Map<string, number>(
      tiers.map((t) => [t.tier, t.sales]),
    );

    return {
      // pricing_viewed carries no tier, so it is the top of the whole funnel.
      pricingViewed: sessionsFor('pricing_viewed'),
      planClicked: sessionsFor('plan_clicked'),
      checkoutStarted: sessionsFor('checkout_started'),
      completed: tiers.reduce((sum, t) => sum + t.sales, 0),
      byTier: tierNames
        .map((tier) => {
          const clicked = sessionsFor('plan_clicked', tier);
          const started = sessionsFor('checkout_started', tier);
          const completed = completedByTier.get(tier) ?? 0;
          return {
            tier,
            clicked,
            checkoutStarted: started,
            completed,
            abandoned: Math.max(started - completed, 0),
            conversionRate: clicked ? Math.round((completed / clicked) * 1000) / 10 : 0,
          };
        })
        .sort((a, b) => b.clicked - a.clicked),
    };
  }

  // ==================== USERS CRUD ====================

  async getUsers(page = 1, limit = 20, search?: string, role?: string) {
    let query = this.db
      .from('profiles')
      .select('id, user_id, full_name, name, email, credits, role, ai_trained, created_at, updated_at, avatar_url', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%,name.ilike.%${sanitized}%`);
    }
    if (role) {
      query = query.eq('role', role);
    }

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    // subscriptions.user_id has no FK to profiles, so PostgREST can't embed it.
    // Fetch active subscriptions separately and join in JS — same pattern as the
    // affiliate admin queries. (subscriptions.plan_id -> plans FK does resolve.)
    const userIds = [...new Set((data ?? []).map((u) => u.user_id))];
    const { data: subs } = userIds.length
      ? await this.db
          .from('subscriptions')
          .select('user_id, plan_id, plans(id, name, credits_monthly)')
          .in('user_id', userIds)
          .eq('status', 'active')
      : { data: [] };
    const planByUser = new Map<string, { plan_id: string; plans: unknown }>(
      (subs ?? []).map((s) => [s.user_id as string, s as { plan_id: string; plans: unknown }]),
    );

    const withPlan = (data ?? []).map((u) => {
      const sub = planByUser.get(u.user_id);
      return { ...u, plan: sub?.plans ?? null, plan_id: sub?.plan_id ?? null };
    });

    return { data: withPlan, total: count ?? 0, page, limit };
  }

  async getPlans() {
    const { data, error } = await this.db
      .from('plans')
      .select('id, name, price_monthly, credits_monthly')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // Validity options (in months) an admin may grant a paid plan for.
  private static readonly VALIDITY_MONTHS = [1, 2, 3, 6, 12];

  /**
   * Manually set a user's membership plan and grant that plan's credit allowance.
   * Mirrors the billing free-plan flow: cancel active subs, insert a fresh active
   * row. ponytail: admin-granted override — Lemon Squeezy is NOT touched, so a user
   * on a real paid subscription keeps getting billed there. Cancel in LS separately
   * if that's intended.
   *
   * validityMonths (1/2/3/6/12) sets current_period_end = now + N months for PAID
   * plans; the daily downgrade cron drops the user back to Starter after that date
   * (see migration 20260715000000). Free/Starter plans never expire (period_end null),
   * so validityMonths is ignored for them.
   */
  async setUserPlan(userId: string, planId: string, validityMonths?: number) {
    const { data: plan, error: planErr } = await this.db
      .from('plans')
      .select('id, credits_monthly, price_monthly')
      .eq('id', planId)
      .single();
    if (planErr || !plan) throw new NotFoundException('Plan not found');

    const isPaid = Number(plan.price_monthly) > 0;
    if (isPaid && validityMonths !== undefined &&
        !AdminService.VALIDITY_MONTHS.includes(validityMonths)) {
      throw new BadRequestException('validityMonths must be one of 1, 2, 3, 6, 12');
    }

    await this.db
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial', 'past_due']);

    const nowDate = new Date();
    const now = nowDate.toISOString();
    // Paid plan with a chosen validity -> expiry date; otherwise no expiry.
    let periodEnd: string | null = null;
    if (isPaid && validityMonths) {
      const end = new Date(nowDate);
      end.setMonth(end.getMonth() + validityMonths);
      periodEnd = end.toISOString();
    }
    const { data: newSub, error: subErr } = await this.db
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        ls_subscription_id: null,
        ls_customer_id: null,
        ls_order_id: null,
        status: 'active',
        billing_interval: 'monthly',
        credits_last_refreshed_at: now,
        current_period_start: now,
        current_period_end: periodEnd,
      })
      .select('*, plans(*)')
      .single();
    if (subErr) throw new BadRequestException(subErr.message);

    // Grant the plan allowance on top of any reset-protected bonus credits the
    // user has earned (referrals, purchase bonuses) — see migration 20260723000000.
    const { data: current } = await this.db
      .from('profiles')
      .select('bonus_credits')
      .eq('user_id', userId)
      .maybeSingle();
    const bonus = current?.bonus_credits ?? 0;

    const { data: profile, error: credErr } = await this.db
      .from('profiles')
      .update({ credits: plan.credits_monthly + bonus })
      .eq('user_id', userId)
      .select()
      .single();
    if (credErr) throw new BadRequestException(credErr.message);

    return { success: true, credits: plan.credits_monthly + bonus, subscription: newSub, profile };
  }

  // Feature tables that record per-user credit usage — same set billing uses for
  // usage history. Each has user_id, created_at and credits_consumed.
  private static readonly ACTIVITY_TABLES: Record<string, string> = {
    scripts: 'Script',
    ideation_jobs: 'Ideation',
    thumbnail_jobs: 'Thumbnail',
    subtitle_jobs: 'Subtitle',
    dubbing_projects: 'Dubbing',
    story_builder_jobs: 'Story Builder',
    documentation_generations: 'Documentation',
    video_generation_jobs: 'Video Generation',
  };

  // Never expose password-reset OTP columns to the admin UI.
  private static readonly PROFILE_SECRET_FIELDS = [
    'password_reset_otp',
    'password_reset_otp_expires_at',
    'password_reset_otp_attempts',
    'password_reset_otp_verified',
  ];

  async getUser(userId: string) {
    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) throw new NotFoundException('User not found');

    for (const f of AdminService.PROFILE_SECRET_FIELDS) delete (data as Record<string, unknown>)[f];

    // subscriptions / usage_credits / youtube_channels have no FK to profiles, so
    // they can't be embedded — fetch them separately by user_id.
    const [{ data: subscriptions }, { data: usage_credits }, { data: channels }] = await Promise.all([
      this.db.from('subscriptions').select('*, plans(*)').eq('user_id', userId).order('created_at', { ascending: false }),
      this.db.from('usage_credits').select('*').eq('user_id', userId),
      this.db.from('youtube_channels').select('*').eq('user_id', userId),
    ]);

    const activity = await this.getUserActivity(userId);

    return {
      ...data,
      subscriptions: subscriptions ?? [],
      usage_credits: usage_credits ?? [],
      channels: channels ?? [],
      activity,
    };
  }

  private async getUserActivity(userId: string, perTable = 10) {
    const entries = Object.entries(AdminService.ACTIVITY_TABLES);
    const results = await Promise.all(
      entries.map(async ([table, label]) => {
        const { data } = await this.db
          .from(table)
          .select('id, created_at, credits_consumed')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(perTable);
        return (data ?? []).map((r) => ({ ...r, feature: label }));
      }),
    );

    return results
      .flat()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 30);
  }

  private static readonly ALLOWED_USER_FIELDS = new Set([
    'full_name', 'name', 'email', 'bio', 'credits', 'role', 'avatar_url',
    'ai_trained', 'youtube_connected', 'language', 'referral_code', 'referred_by',
  ]);

  async updateUser(userId: string, updates: Record<string, unknown>) {
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (!AdminService.ALLOWED_USER_FIELDS.has(key)) continue;
      let value = updates[key];
      // referred_by is a FK to profiles.referral_code (and referral_code is unique). A
      // blank string matches no code and violates profiles_referred_by_fkey, so an empty
      // input means "no referral" → null, not "".
      if ((key === 'referred_by' || key === 'referral_code') && (value === '' || value == null)) {
        value = null;
      }
      filtered[key] = value;
    }

    if (Object.keys(filtered).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    const { data, error } = await this.db
      .from('profiles')
      .update(filtered)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteUser(userId: string) {
    const { error } = await this.db.auth.admin.deleteUser(userId);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // ==================== BLOGS CRUD ====================

  async getBlogs(page = 1, limit = 20, status?: string) {
    // No profiles embed here. blog_posts_author_fkey points at auth.users, not
    // public.profiles, and PostgREST can only embed across foreign keys between
    // tables it exposes -- so asking for `profiles!blog_posts_author_fkey`
    // returned "Could not find a relationship between 'blog_posts' and
    // 'profiles' in the schema cache" on every single request. The byline the
    // list actually needs is the blog_posts.author_name column, and the audit
    // trail of who touched a post lives in `activities`.
    let query = this.db
      .from('blog_posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count ?? 0, page, limit };
  }

  async getBlog(id: string) {
    const { data, error } = await this.db
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Blog post not found');
    return data;
  }

  // Whitelist: spreading the request body straight into the write let a caller
  // set id, author_id, created_at or any future column.
  private pickBlogFields(body: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of BLOG_POST_WRITABLE_FIELDS) {
      if (body[field] !== undefined) out[field] = body[field];
    }
    return out;
  }

  async createBlog(authorId: string, blog: Record<string, unknown>) {
    const fields = this.pickBlogFields(blog);

    const { data, error } = await this.db
      .from('blog_posts')
      .insert({
        ...fields,
        author_id: authorId,
        // An explicit date wins, so a post can be backdated or scheduled on
        // creation. Otherwise publishing stamps now and a draft stays undated.
        published_at:
          fields.published_at ??
          (fields.status === 'published' ? new Date().toISOString() : null),
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateBlog(id: string, updates: Record<string, unknown>) {
    const fields = this.pickBlogFields(updates);

    // Publishing needs a date. Keep the one it already has rather than resetting
    // it, since published_at drives ordering, the sitemap and datePublished.
    if (fields.status === 'published' && !fields.published_at) {
      const { data: current } = await this.db
        .from('blog_posts')
        .select('published_at')
        .eq('id', id)
        .single();
      fields.published_at = current?.published_at ?? new Date().toISOString();
    }

    const { data, error } = await this.db
      .from('blog_posts')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteBlog(id: string) {
    const { error } = await this.db
      .from('blog_posts')
      .delete()
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // ==================== ACTIVITIES ====================

  // Feature tables that record per-user work. `status`/`error` flag which optional
  // columns each has (scripts has neither job-status nor error_message).
  private static readonly FEATURE_SOURCES: Array<{ table: string; label: string; status: boolean; error: boolean }> = [
    { table: 'scripts', label: 'Script', status: false, error: false },
    { table: 'ideation_jobs', label: 'Ideation', status: true, error: true },
    { table: 'thumbnail_jobs', label: 'Thumbnail', status: true, error: true },
    { table: 'subtitle_jobs', label: 'Subtitle', status: true, error: true },
    { table: 'dubbing_projects', label: 'Dubbing', status: true, error: false },
    { table: 'story_builder_jobs', label: 'Story Builder', status: true, error: true },
    { table: 'documentation_generations', label: 'Documentation', status: true, error: true },
    { table: 'video_generation_jobs', label: 'Video Generation', status: true, error: true },
  ];

  // ponytail: bounded "recent" feed — pull the newest FEED_CAP rows per source,
  // merge and sort in JS. There's no unified events table, so deep historical
  // paging past this window isn't supported; add one if that's ever needed.
  private static readonly FEED_CAP = 200;

  /**
   * Cross-feature activity feed: every user's feature usage (with failures surfaced
   * as errors), subscription changes, and affiliate actions — merged and sorted by
   * time. `category` filters to feature | error | subscription | affiliate.
   */
  async getActivityFeed(page = 1, limit = 30, category?: string) {
    const cap = AdminService.FEED_CAP;
    const wantFeature = !category || category === 'feature' || category === 'error';
    const wantSub = !category || category === 'subscription';
    const wantAff = !category || category === 'affiliate';
    const wantUnsub = !category || category === 'unsubscribe';

    const recent = (table: string, cols: string) =>
      this.db.from(table).select(cols).order('created_at', { ascending: false }).limit(cap);

    const tasks: Promise<FeedEvent[]>[] = [];

    if (wantFeature) {
      for (const src of AdminService.FEATURE_SOURCES) {
        const cols = ['id', 'user_id', 'created_at', 'credits_consumed'];
        if (src.status) cols.push('status');
        if (src.error) cols.push('error_message');
        tasks.push(
          recent(src.table, cols.join(', ')).then(({ data }) =>
            ((data ?? []) as Array<Record<string, unknown>>).map((r): FeedEvent => {
              const failed = r.status === 'failed';
              return {
                id: `${src.table}:${r.id as string}`,
                user_id: r.user_id as string,
                category: failed ? 'error' : 'feature',
                label: src.label,
                action: r.status ? String(r.status) : 'generated',
                status: (r.status as string) ?? null,
                error_message: (r.error_message as string) ?? null,
                credits_consumed: Number(r.credits_consumed ?? 0),
                created_at: r.created_at as string,
              };
            }),
          ),
        );
      }
    }

    // Captured exceptions — the errors the job tables never saw (API failures,
    // worker crashes). Same feed, with the detail hanging off error_logs.
    if (wantFeature) {
      tasks.push(
        recent('error_logs', 'id, user_id, created_at, name, message, feature, source, status_code').then(({ data }) =>
          ((data ?? []) as Array<Record<string, unknown>>).map((r): FeedEvent => ({
            id: `error_logs:${r.id as string}`,
            user_id: r.user_id as string,
            category: 'error',
            label: `${(r.feature as string) ?? (r.source as string)} · ${(r.name as string) ?? 'Error'}`,
            action: r.status_code ? `HTTP ${r.status_code as number}` : (r.source as string),
            status: 'failed',
            error_message: r.message as string,
            credits_consumed: 0,
            created_at: r.created_at as string,
          })),
        ),
      );
    }

    if (wantSub) {
      tasks.push(
        recent('subscriptions', 'id, user_id, created_at, status, plans(name)').then(({ data }) =>
          ((data ?? []) as Array<Record<string, unknown>>).map((r): FeedEvent => ({
            id: `subscriptions:${r.id as string}`,
            user_id: r.user_id as string,
            category: 'subscription',
            label: (r.plans as { name?: string } | null)?.name ?? 'Plan',
            action: r.status === 'active' ? 'activated' : String(r.status),
            status: r.status as string,
            error_message: null,
            credits_consumed: 0,
            created_at: r.created_at as string,
          })),
        ),
      );
    }

    if (wantAff) {
      tasks.push(
        // Creating a link is the "activated affiliate" signal — surface it here,
        // including where they said they'll promote.
        recent('affiliate_links', 'id, sales_rep_id, created_at, code, label, promotion_channel').then(({ data }) =>
          ((data ?? []) as Array<Record<string, unknown>>).map((r): FeedEvent => ({
            id: `affiliate_links:${r.id as string}`,
            user_id: r.sales_rep_id as string,
            category: 'affiliate',
            label: r.promotion_channel
              ? `Affiliate link · promoting via ${r.promotion_channel as string}`
              : 'Affiliate link',
            action: `created (${r.code as string})`,
            status: null,
            error_message: null,
            credits_consumed: 0,
            created_at: r.created_at as string,
          })),
        ),
        recent('affiliate_requests', 'id, user_id, created_at, status').then(({ data }) =>
          ((data ?? []) as Array<Record<string, unknown>>).map((r): FeedEvent => ({
            id: `affiliate_requests:${r.id as string}`,
            user_id: r.user_id as string,
            category: 'affiliate',
            label: 'Affiliate request',
            action: String(r.status),
            status: r.status as string,
            error_message: null,
            credits_consumed: 0,
            created_at: r.created_at as string,
          })),
        ),
        recent('affiliate_sales', 'id, sales_rep_id, created_at, status, amount').then(({ data }) =>
          ((data ?? []) as Array<Record<string, unknown>>).map((r): FeedEvent => ({
            id: `affiliate_sales:${r.id as string}`,
            user_id: r.sales_rep_id as string,
            category: 'affiliate',
            label: `Affiliate sale · $${Number(r.amount ?? 0).toFixed(2)}`,
            action: String(r.status),
            status: r.status as string,
            error_message: null,
            credits_consumed: 0,
            created_at: r.created_at as string,
          })),
        ),
      );
    }

    if (wantUnsub) {
      tasks.push(
        recent('email_unsubscribes', 'id, user_id, created_at').then(({ data }) =>
          ((data ?? []) as Array<Record<string, unknown>>).map((r): FeedEvent => ({
            id: `email_unsubscribes:${r.id as string}`,
            user_id: r.user_id as string,
            category: 'unsubscribe',
            label: 'Email unsubscribe',
            action: 'unsubscribed',
            status: null,
            error_message: null,
            credits_consumed: 0,
            created_at: r.created_at as string,
          })),
        ),
      );
    }

    let merged = (await Promise.all(tasks)).flat();
    // 'feature' and 'error' share the same sources — a failed job is a feature row
    // flipped to category 'error' — so both need filtering after the merge.
    if (category === 'feature' || category === 'error') {
      merged = merged.filter((e) => e.category === category);
    }
    merged.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const total = merged.length;
    const pageRows = merged.slice((page - 1) * limit, page * limit);

    const userIds = [...new Set(pageRows.map((e) => e.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await this.db.from('profiles').select('user_id, full_name, name, email, avatar_url').in('user_id', userIds)
      : { data: [] };
    const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    const data = pageRows.map((e) => ({ ...e, profiles: pmap.get(e.user_id) ?? null }));
    return { data, total, page, limit };
  }

  // ==================== ERROR LOGS ====================

  /**
   * Paginated error stream. `grouped` collapses to one row per fingerprint with
   * an occurrence count — the view you want when triaging, since a single bug
   * usually shows up as hundreds of near-identical rows.
   */
  async getErrorLogs(
    page = 1,
    limit = 30,
    filters: { source?: string; feature?: string; userId?: string; since?: string } = {},
  ) {
    let query = this.db
      .from('error_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.source) query = query.eq('source', filters.source);
    if (filters.feature) query = query.eq('feature', filters.feature);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.since) query = query.gte('created_at', filters.since);

    const { data, error, count } = await query.range((page - 1) * limit, page * limit - 1);
    if (error) throw new InternalServerErrorException(error.message);

    return {
      data: await this.attachProfiles(data ?? []),
      total: count ?? 0,
      page,
      limit,
    };
  }

  /** One error with its full stack, plus how often this fingerprint has fired lately. */
  async getErrorLog(id: string) {
    const { data, error } = await this.db.from('error_logs').select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundException('Error log not found');

    const [{ count: last24h }, { count: allTime }, { data: recent }] = await Promise.all([
      this.db
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .eq('fingerprint', data.fingerprint)
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      this.db
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .eq('fingerprint', data.fingerprint),
      this.db
        .from('error_logs')
        .select('id, user_id, created_at, status_code')
        .eq('fingerprint', data.fingerprint)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const [withProfile] = await this.attachProfiles([data]);
    return {
      ...withProfile,
      occurrences: { last24h: last24h ?? 0, allTime: allTime ?? 0 },
      recent: recent ?? [],
      /** Distinct users hit by this bug — the "how bad is it" number. */
      affectedUsers: new Set((recent ?? []).map((r) => r.user_id).filter(Boolean)).size,
    };
  }

  /** Most frequent errors in the window, worst first. The triage list. */
  async getErrorSummary(hours = 24) {
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    const { data, error } = await this.db
      .from('error_logs')
      .select('fingerprint, name, message, feature, source, status_code, user_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(AdminService.FEED_CAP * 5);
    if (error) throw new InternalServerErrorException(error.message);

    const groups = new Map<string, {
      fingerprint: string; name: string; message: string; feature: string | null;
      source: string; status_code: number | null; count: number; users: Set<string>; lastSeen: string;
    }>();

    for (const row of data ?? []) {
      const existing = groups.get(row.fingerprint);
      if (existing) {
        existing.count += 1;
        if (row.user_id) existing.users.add(row.user_id);
        continue;
      }
      groups.set(row.fingerprint, {
        fingerprint: row.fingerprint,
        name: row.name ?? 'Error',
        message: row.message,
        feature: row.feature,
        source: row.source,
        status_code: row.status_code,
        count: 1,
        users: new Set(row.user_id ? [row.user_id] : []),
        lastSeen: row.created_at,
      });
    }

    return {
      hours,
      data: [...groups.values()]
        .map(({ users, ...rest }) => ({ ...rest, affectedUsers: users.size }))
        .sort((a, b) => b.count - a.count),
    };
  }

  private async attachProfiles<T extends { user_id?: string | null }>(rows: T[]) {
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const { data: profiles } = userIds.length
      ? await this.db.from('profiles').select('user_id, full_name, name, email, avatar_url').in('user_id', userIds)
      : { data: [] };
    const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    return rows.map((r) => ({ ...r, profiles: r.user_id ? pmap.get(r.user_id) ?? null : null }));
  }

  async logActivity(actorId: string, action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>) {
    const { error } = await this.db
      .from('activities')
      .insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, metadata });

    if (error) console.error('Failed to log activity:', error.message);
  }

  // ==================== MAILS ====================

  async getMails(page = 1, limit = 20, status?: string) {
    let query = this.db
      .from('mail_messages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count ?? 0, page, limit };
  }

  async getMail(id: string) {
    const { data, error } = await this.db
      .from('mail_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Mail not found');
    return data;
  }

  /**
   * Send a reply to a contact/inbound mail via Resend and mark it replied.
   * `html` is the fully rendered reply body (the web editor converts the admin's
   * markdown to HTML before posting).
   */
  async replyToMail(id: string, adminId: string, subject: string, html: string) {
    if (!subject?.trim() || !html?.trim()) {
      throw new BadRequestException('Subject and message are required');
    }
    if (!this.resend) throw new InternalServerErrorException('Email service not configured');

    const { data: mail, error } = await this.db
      .from('mail_messages')
      .select('from_email, subject')
      .eq('id', id)
      .single();
    if (error || !mail) throw new NotFoundException('Mail not found');

    const { error: sendErr } = await this.resend.emails.send({
      from: 'Creator AI <notifications@trycreatorai.com>',
      to: mail.from_email,
      replyTo: 'support@trycreatorai.com',
      subject,
      html: `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">${html}</div>`,
    });
    if (sendErr) throw new InternalServerErrorException('Failed to send reply');

    const { data: updated, error: updErr } = await this.db
      .from('mail_messages')
      .update({ status: 'replied', replied_at: new Date().toISOString(), replied_by: adminId })
      .eq('id', id)
      .select()
      .single();
    if (updErr) throw new BadRequestException(updErr.message);

    return { success: true, mail: updated };
  }

  async updateMailStatus(id: string, status: string, repliedBy?: string) {
    const updates: Record<string, unknown> = { status };
    if (status === 'replied' && repliedBy) {
      updates.replied_at = new Date().toISOString();
      updates.replied_by = repliedBy;
    }

    const { data, error } = await this.db
      .from('mail_messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ==================== JOB POSTS CRUD ====================

  async getJobPosts(page = 1, limit = 20, status?: string) {
    let query = this.db
      .from('job_posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count ?? 0, page, limit };
  }

  async getJobPost(id: string) {
    const { data, error } = await this.db
      .from('job_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Job post not found');
    return data;
  }

  private static readonly ALLOWED_JOB_FIELDS = new Set([
    'title', 'team', 'location', 'type', 'category', 'description', 'requirements', 'status',
  ]);

  private filterJobFields(input: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(input)) {
      if (AdminService.ALLOWED_JOB_FIELDS.has(k) && input[k] !== undefined) out[k] = input[k];
    }
    return out;
  }

  async createJobPost(job: Record<string, unknown>) {
    const filtered = this.filterJobFields(job);
    if (!filtered.title || !filtered.team || !filtered.description) {
      throw new BadRequestException('Title, team, and description are required');
    }

    const { data, error } = await this.db
      .from('job_posts')
      .insert(filtered)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateJobPost(id: string, updates: Record<string, unknown>) {
    const filtered = this.filterJobFields(updates);
    if (Object.keys(filtered).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    const { data, error } = await this.db
      .from('job_posts')
      .update(filtered)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteJobPost(id: string) {
    const { error } = await this.db
      .from('job_posts')
      .delete()
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // ==================== JOB APPLICATIONS ====================

  async getApplications(page = 1, limit = 20, status?: string) {
    let query = this.db
      .from('job_applications')
      .select('*, job_posts(title, team)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count ?? 0, page, limit };
  }

  async getApplication(id: string) {
    const { data, error } = await this.db
      .from('job_applications')
      .select('*, job_posts(title, team, location, type)')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Application not found');
    return data;
  }

  async updateApplicationStatus(id: string, status: string, reviewedBy: string, notes?: string) {
    const updates: Record<string, unknown> = {
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    };
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await this.db
      .from('job_applications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteApplication(id: string) {
    const { error } = await this.db
      .from('job_applications')
      .delete()
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // ==================== SUBSCRIPTIONS (Admin view) ====================

  async getAllSubscriptions(page = 1, limit = 20, status?: string) {
    let query = this.db
      .from('subscriptions')
      .select('*, plans(id, name, price_monthly, credits_monthly)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    // subscriptions.user_id -> auth.users, no FK to profiles, so it can't be
    // embedded. Fetch the owning profiles separately and join in JS — same
    // pattern as the affiliate admin queries.
    const userIds = [...new Set((data ?? []).map((s) => s.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await this.db.from('profiles').select('user_id, full_name, name, email, avatar_url, credits').in('user_id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    const enriched = (data ?? []).map((s) => ({
      ...s,
      profiles: profileMap.get(s.user_id) ?? null,
    }));

    return { data: enriched, total: count ?? 0, page, limit };
  }

  // ==================== AFFILIATES (Admin view) ====================

  async getAllAffiliateLinks(page = 1, limit = 20) {
    const { data, error, count } = await this.db
      .from('affiliate_links')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw new BadRequestException(error.message);

    const repIds = [...new Set((data ?? []).map((l) => l.sales_rep_id))];
    const { data: profiles } = repIds.length
      ? await this.db.from('profiles').select('user_id, full_name, email').in('user_id', repIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    const enriched = (data ?? []).map((l) => ({
      ...l,
      profiles: profileMap.get(l.sales_rep_id) ?? null,
    }));

    return { data: enriched, total: count ?? 0, page, limit };
  }

  async getAllAffiliateSales(page = 1, limit = 20) {
    const { data, error, count } = await this.db
      .from('affiliate_sales')
      .select('*, affiliate_links(code, label)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw new BadRequestException(error.message);

    const repIds = [...new Set((data ?? []).map((s) => s.sales_rep_id))];
    const { data: profiles } = repIds.length
      ? await this.db.from('profiles').select('user_id, full_name, email').in('user_id', repIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    const enriched = (data ?? []).map((s) => ({
      ...s,
      profiles: profileMap.get(s.sales_rep_id) ?? null,
    }));

    return { data: enriched, total: count ?? 0, page, limit };
  }

  async updateAffiliateSaleStatus(id: string, status: string) {
    const { data, error } = await this.db
      .from('affiliate_sales')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  private static readonly ALLOWED_LINK_FIELDS = new Set([
    'label', 'target_url', 'commission_rate', 'is_active', 'ls_affiliate_id',
  ]);

  async updateAffiliateLink(id: string, updates: Record<string, unknown>) {
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (AdminService.ALLOWED_LINK_FIELDS.has(key)) {
        filtered[key] = updates[key];
      }
    }
    if (Object.keys(filtered).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    const { data, error } = await this.db
      .from('affiliate_links')
      .update(filtered)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
