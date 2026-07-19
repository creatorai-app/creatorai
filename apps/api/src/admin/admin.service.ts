import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Admin client is not configured');
    }
    return client;
  }

  // ==================== DASHBOARD STATS ====================

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
    ] = await Promise.all([
      this.db.from('profiles').select('id', { count: 'exact', head: true }),
      this.db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      this.db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      this.db.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      this.db.from('affiliate_sales').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
      this.db.from('affiliate_sales').select('amount').in('status', ['confirmed', 'paid']),
      this.db.from('mail_messages').select('id', { count: 'exact', head: true }).eq('status', 'unread'),
      this.db.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      this.db.from('affiliate_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const totalRevenue = revenueRes.data?.reduce((sum, r) => sum + Number(r.amount || 0), 0) ?? 0;

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

    const { data: profile, error: credErr } = await this.db
      .from('profiles')
      .update({ credits: plan.credits_monthly })
      .eq('user_id', userId)
      .select()
      .single();
    if (credErr) throw new BadRequestException(credErr.message);

    return { success: true, credits: plan.credits_monthly, subscription: newSub, profile };
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
    let query = this.db
      .from('blog_posts')
      .select('*, profiles!blog_posts_author_fkey(full_name, email)', { count: 'exact' })
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

  async createBlog(authorId: string, blog: {
    title: string;
    slug: string;
    excerpt?: string;
    content: string;
    cover_image_url?: string;
    category?: string;
    tags?: string[];
    status?: string;
    featured?: boolean;
  }) {
    const { data, error } = await this.db
      .from('blog_posts')
      .insert({
        ...blog,
        author_id: authorId,
        published_at: blog.status === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateBlog(id: string, updates: Record<string, unknown>) {
    if (updates.status === 'published') {
      updates.published_at = new Date().toISOString();
    }

    const { data, error } = await this.db
      .from('blog_posts')
      .update(updates)
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

  async getActivities(page = 1, limit = 50, entityType?: string) {
    let query = this.db
      .from('activities')
      .select('*, profiles!activities_actor_fkey(full_name, email, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count ?? 0, page, limit };
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
