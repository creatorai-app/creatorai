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

    return { data, total: count ?? 0, page, limit };
  }

  async getUser(userId: string) {
    const { data, error } = await this.db
      .from('profiles')
      .select('*, subscriptions(*), usage_credits(*)')
      .eq('user_id', userId)
      .single();

    if (error || !data) throw new NotFoundException('User not found');
    return data;
  }

  private static readonly ALLOWED_USER_FIELDS = new Set([
    'full_name', 'name', 'email', 'credits', 'role', 'avatar_url',
  ]);

  async updateUser(userId: string, updates: Record<string, unknown>) {
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (AdminService.ALLOWED_USER_FIELDS.has(key)) {
        filtered[key] = updates[key];
      }
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
