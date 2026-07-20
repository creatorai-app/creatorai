import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  lemonSqueezySetup,
  createDiscount,
  listDiscounts,
} from '@lemonsqueezy/lemonsqueezy.js';
import { Resend } from 'resend';
import {
  MIN_WITHDRAWAL_AMOUNT,
  type AffiliateHubStats,
  type AffiliateEarningPoint,
  type CreatePromoCodeInput,
  type UpdatePromoCodeInput,
  type PayoutMethodInput,
  type UpdateWithdrawalInput,
  type CreateAffiliateLinkInput,
} from '@repo/validation';

interface LsAffiliateAttributes {
  store_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  share_domain: string;
  status: string;
  products: unknown;
  application_note: string;
  total_earnings: number;
  unpaid_earnings: number;
  created_at: string;
  updated_at: string;
}

interface LsAffiliateData {
  type: string;
  id: string;
  attributes: LsAffiliateAttributes;
}

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);
  private readonly resend: Resend | null = null;
  private readonly adminEmail: string;
  private lsInitialized = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) this.resend = new Resend(apiKey);
    this.adminEmail = this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL') || 'afrinxnahar@gmail.com';
  }

  private get db() {
    const client = this.supabaseService.getAdminClient();
    if (!client) throw new BadRequestException('Admin client not configured');
    return client;
  }

  private initLemonSqueezy() {
    if (this.lsInitialized) return;
    const apiKey = this.configService.get<string>('LEMONSQUEEZY_API_KEY');
    if (!apiKey) throw new BadRequestException('Lemon Squeezy not configured');
    lemonSqueezySetup({ apiKey });
    this.lsInitialized = true;
  }

  // ==================== USER: Apply to become affiliate ====================

  async submitRequest(userId: string, data: {
    full_name?: string;
    email?: string;
    website?: string;
    social_media?: string;
    audience_size?: string;
    promotion_method?: string;
    reason: string;
  }) {
    const { data: existing } = await this.db
      .from('affiliate_requests')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existing) {
      throw new BadRequestException(
        existing.status === 'pending'
          ? 'You already have a pending request'
          : 'You are already an approved affiliate',
      );
    }

    const { data: profile, error: profileError } = await this.db
      .from('profiles')
      .select('full_name, name, email')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile?.email) {
      throw new BadRequestException('Unable to load your profile information');
    }

    const fullName = profile.full_name || profile.name || profile.email;
    const email = profile.email;

    const { data: request, error } = await this.db
      .from('affiliate_requests')
      .insert({
        user_id: userId,
        full_name: fullName,
        email,
        website: data.website,
        social_media: data.social_media,
        audience_size: data.audience_size,
        promotion_method: data.promotion_method,
        reason: data.reason,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    this.notifyAdminNewApplication({
      ...data,
      full_name: fullName,
      email,
    }).catch((err) =>
      this.logger.error(`Failed to send affiliate notification: ${err}`),
    );

    return request;
  }

  private async notifyAdminNewApplication(data: {
    full_name: string;
    email: string;
    website?: string;
    social_media?: string;
    audience_size?: string;
    promotion_method?: string;
    reason: string;
  }) {
    if (!this.resend) return;

    const esc = (s?: string) =>
      (s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    await this.resend.emails.send({
      from: 'Creator AI <notifications@tryscriptai.com>',
      to: this.adminEmail,
      subject: `New Affiliate Application from ${data.full_name}`,
      html: `<div style="font-family:Arial,sans-serif;color:#333;background:#f9f9f9;padding:20px">
        <div style="background:#fff;padding:24px;border-radius:8px;max-width:560px;margin:auto">
          <h2 style="color:#4F46E5;margin-top:0">New Affiliate Application</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#888;width:140px">Name</td><td style="padding:8px 0">${esc(data.full_name)}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Email</td><td style="padding:8px 0">${esc(data.email)}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Website</td><td style="padding:8px 0">${esc(data.website)}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Social Media</td><td style="padding:8px 0">${esc(data.social_media)}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Audience Size</td><td style="padding:8px 0">${esc(data.audience_size)}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Promotion Method</td><td style="padding:8px 0">${esc(data.promotion_method)}</td></tr>
          </table>
          <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
          <p style="color:#888;font-size:13px;margin-bottom:4px"><strong>Reason</strong></p>
          <p style="white-space:pre-line;margin-top:0">${esc(data.reason)}</p>
          <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
          <p style="font-size:12px;color:#aaa">Received ${new Date().toUTCString()}</p>
        </div>
      </div>`,
    });
  }

  async getRequestStatus(userId: string) {
    const { data, error } = await this.db
      .from('affiliate_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ==================== ADMIN: Manage affiliate requests ====================

  async getRequests(page = 1, limit = 20, status?: string) {
    let query = this.db
      .from('affiliate_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count ?? 0, page, limit };
  }

  async reviewRequest(requestId: string, reviewedBy: string, action: 'approved' | 'denied' | 'pending', adminNotes?: string) {
    const { data: request, error: fetchErr } = await this.db
      .from('affiliate_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) throw new NotFoundException('Request not found');
    if (request.status === action) throw new BadRequestException(`Request is already ${action}`);

    const updates: Record<string, unknown> = {
      status: action,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    };
    if (adminNotes !== undefined) updates.admin_notes = adminNotes;

    const { data, error } = await this.db
      .from('affiliate_requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    if (action === 'approved') {
      await this.sendAffiliateApprovalEmail({
        recipientEmail: request.email,
        recipientName: request.full_name,
        adminNotes,
      });
    }

    return data;
  }

  private async sendAffiliateApprovalEmail(input: {
    recipientEmail: string;
    recipientName: string;
    adminNotes?: string;
  }) {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not configured, cannot send affiliate approval email');
      throw new InternalServerErrorException('Approval email service is not configured');
    }

    const esc = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const safeName = esc(input.recipientName || 'there');
    const message = (input.adminNotes || '').trim();
    const safeMessage = message
      ? esc(message).replace(/\n/g, '<br/>')
      : 'Your affiliate application has been approved. Our team will be in touch shortly with next steps.';

    try {
      await this.resend.emails.send({
        from: 'Creator AI Support <support@tryscriptai.com>',
        to: input.recipientEmail,
        replyTo: 'support@tryscriptai.com',
        subject: 'Your affiliate application was approved',
        html: `<div style="font-family:Arial,sans-serif;color:#333;line-height:1.6;max-width:600px;margin:auto;padding:20px">
          <h2 style="color:#4F46E5;margin-top:0">You're approved as a Creator AI affiliate</h2>
          <p>Hi ${safeName},</p>
          <p>${safeMessage}</p>
          <p style="margin-top:24px">Thanks,<br/>Creator AI Team</p>
          <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>
        </div>`,
      });
    } catch (error) {
      this.logger.error(`Failed to send affiliate approval email: ${error}`);
      throw new InternalServerErrorException('Failed to send approval email');
    }
  }

  // ==================== ADMIN: Create affiliate link for a rep ====================

  async createAffiliateLinkForRep(adminId: string, body: {
    owner_id?: string;
    sales_rep_id?: string;
    code: string;
    label?: string;
    target_url?: string;
    commission_rate?: number;
    ls_affiliate_id?: string;
  }) {
    const ownerId = body.owner_id ?? body.sales_rep_id;
    if (!ownerId) throw new BadRequestException('owner_id is required');

    const { data: owner } = await this.db
      .from('profiles')
      .select('user_id')
      .eq('user_id', ownerId)
      .single();

    if (!owner) throw new NotFoundException('User not found');

    const { data, error } = await this.db
      .from('affiliate_links')
      .insert({
        sales_rep_id: ownerId,
        code: body.code,
        label: body.label,
        target_url: body.target_url || '/',
        commission_rate: body.commission_rate ?? 20,
        ls_affiliate_id: body.ls_affiliate_id || null,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ==================== ADMIN: Fetch LS affiliates ====================

  async getLsAffiliates() {
    this.initLemonSqueezy();
    const apiKey = this.configService.get<string>('LEMONSQUEEZY_API_KEY');
    const storeId = this.configService.get<string>('LEMONSQUEEZY_STORE_ID');

    const url = storeId
      ? `https://api.lemonsqueezy.com/v1/affiliates?filter[store_id]=${storeId}`
      : 'https://api.lemonsqueezy.com/v1/affiliates';

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      this.logger.error(`LS affiliates fetch failed: ${response.status}`);
      throw new BadRequestException('Failed to fetch Lemon Squeezy affiliates');
    }

    const json = await response.json() as { data: LsAffiliateData[] };

    return (json.data || []).map((item) => ({
      id: item.id,
      user_name: item.attributes.user_name,
      user_email: item.attributes.user_email,
      share_domain: item.attributes.share_domain,
      status: item.attributes.status,
      total_earnings: item.attributes.total_earnings,
      unpaid_earnings: item.attributes.unpaid_earnings,
      created_at: item.attributes.created_at,
      updated_at: item.attributes.updated_at,
    }));
  }

  getLsAffiliateSignupUrl(): string {
    const storeId = this.configService.get<string>('LEMONSQUEEZY_STORE_ID');
    return `https://app.lemonsqueezy.com/affiliates/store/${storeId || ''}`;
  }

  // ==================== USER HUB ====================

  async getHubStats(userId: string): Promise<AffiliateHubStats> {
    const [salesRes, linksRes, withdrawalsRes] = await Promise.all([
      this.db.from('affiliate_sales').select('commission, status, mature_at, created_at').eq('sales_rep_id', userId),
      this.db.from('affiliate_links').select('click_count').eq('sales_rep_id', userId),
      this.db.from('affiliate_withdrawals').select('amount, status').eq('affiliate_id', userId),
    ]);

    const sales = salesRes.data ?? [];
    const now = Date.now();

    let pendingEarnings = 0;
    let maturedEarnings = 0;
    let totalConversions = 0;
    const buckets: Record<string, number> = {};

    for (const s of sales) {
      if (s.status === 'refunded') continue;
      const commission = Number(s.commission ?? 0);
      totalConversions += 1;
      const matured =
        s.status === 'confirmed' ||
        s.status === 'paid' ||
        (s.status === 'pending' && s.mature_at != null && new Date(s.mature_at).getTime() <= now);
      if (matured) maturedEarnings += commission;
      else pendingEarnings += commission;

      const d = new Date(s.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().split('T')[0]!;
      buckets[key] = (buckets[key] ?? 0) + commission;
    }

    let totalWithdrawn = 0;
    let reserved = 0;
    for (const w of withdrawalsRes.data ?? []) {
      const amt = Number(w.amount ?? 0);
      if (w.status === 'paid') totalWithdrawn += amt;
      else if (w.status === 'requested' || w.status === 'approved') reserved += amt;
    }

    const earnings: AffiliateEarningPoint[] = Object.entries(buckets)
      .map(([date, commission]) => ({ date, commission: this.round2(commission) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      availableBalance: Math.max(0, this.round2(maturedEarnings - totalWithdrawn - reserved)),
      pendingEarnings: this.round2(pendingEarnings),
      lifetimeEarnings: this.round2(maturedEarnings + pendingEarnings),
      totalWithdrawn: this.round2(totalWithdrawn),
      reservedBalance: this.round2(reserved),
      totalClicks: (linksRes.data ?? []).reduce((sum, l) => sum + (l.click_count ?? 0), 0),
      totalConversions,
      totalLinks: (linksRes.data ?? []).length,
      minWithdrawal: MIN_WITHDRAWAL_AMOUNT,
      earnings,
    };
  }

  async getUserLinks(userId: string) {
    const { data, error } = await this.db
      .from('affiliate_links')
      .select('*')
      .eq('sales_rep_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createUserLink(userId: string, input: CreateAffiliateLinkInput) {
    const code = await this.generateUniqueLinkCode();
    const { data, error } = await this.db
      .from('affiliate_links')
      .insert({
        sales_rep_id: userId,
        code,
        label: input.label,
        target_url: input.target_url || '/',
        commission_rate: 20,
        promotion_channel: input.promotion_channel || null,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  private static readonly USER_LINK_FIELDS = new Set(['label', 'target_url', 'is_active']);

  async updateUserLink(userId: string, id: string, updates: Record<string, unknown>) {
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (AffiliateService.USER_LINK_FIELDS.has(key)) filtered[key] = updates[key];
    }
    if (Object.keys(filtered).length === 0) throw new BadRequestException('No valid fields to update');

    const { data, error } = await this.db
      .from('affiliate_links')
      .update(filtered)
      .eq('id', id)
      .eq('sales_rep_id', userId)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Link not found');
    return data;
  }

  async deleteUserLink(userId: string, id: string) {
    const { error } = await this.db
      .from('affiliate_links')
      .delete()
      .eq('id', id)
      .eq('sales_rep_id', userId);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getUserPromoCodes(userId: string) {
    const { data, error } = await this.db
      .from('affiliate_promo_codes')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getUserSales(userId: string, page = 1, limit = 20) {
    const { data, error, count } = await this.db
      .from('affiliate_sales')
      .select('*, affiliate_links(code, label)', { count: 'exact' })
      .eq('sales_rep_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  async getPayoutMethod(userId: string) {
    const { data, error } = await this.db
      .from('affiliate_payout_methods')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async upsertPayoutMethod(userId: string, input: PayoutMethodInput) {
    const { data, error } = await this.db
      .from('affiliate_payout_methods')
      .upsert({ user_id: userId, method: input.method, details: input.details }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getUserWithdrawals(userId: string, page = 1, limit = 20) {
    const { data, error, count } = await this.db
      .from('affiliate_withdrawals')
      .select('*', { count: 'exact' })
      .eq('affiliate_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], total: count ?? 0, page, limit };
  }

  async requestWithdrawal(userId: string, amount: number) {
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new BadRequestException(`Minimum withdrawal is $${MIN_WITHDRAWAL_AMOUNT}`);
    }

    const payoutMethod = await this.getPayoutMethod(userId);
    if (!payoutMethod) {
      throw new BadRequestException('Add a payout method before requesting a withdrawal');
    }

    const stats = await this.getHubStats(userId);
    if (amount > stats.availableBalance) {
      throw new BadRequestException('Amount exceeds your available balance');
    }

    const { data, error } = await this.db
      .from('affiliate_withdrawals')
      .insert({
        affiliate_id: userId,
        amount,
        method: payoutMethod.method,
        details: payoutMethod.details,
        status: 'requested',
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ==================== ADMIN: Promo codes ====================

  async getPromoCodes(page = 1, limit = 20) {
    const { data, error, count } = await this.db
      .from('affiliate_promo_codes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw new BadRequestException(error.message);

    const ownerIds = [...new Set((data ?? []).map((p) => p.owner_id))];
    const { data: profiles } = ownerIds.length
      ? await this.db.from('profiles').select('user_id, full_name, email').in('user_id', ownerIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    const enriched = (data ?? []).map((p) => ({ ...p, profiles: profileMap.get(p.owner_id) ?? null }));
    return { data: enriched, total: count ?? 0, page, limit };
  }

  async createPromoCode(input: CreatePromoCodeInput) {
    this.initLemonSqueezy();
    const storeId = this.configService.get<string>('LEMONSQUEEZY_STORE_ID');
    if (!storeId) throw new BadRequestException('Store not configured');

    const { data: owner } = await this.db
      .from('profiles')
      .select('user_id')
      .eq('user_id', input.owner_id)
      .single();
    if (!owner) throw new NotFoundException('User not found');

    const lsAmount = input.amount_type === 'fixed' ? Math.round(input.amount * 100) : input.amount;

    const { data: discount, error: lsError } = await createDiscount({
      storeId,
      name: input.label || input.code,
      code: input.code,
      amount: lsAmount,
      amountType: input.amount_type,
    });

    if (lsError || !discount) {
      this.logger.error(`LS createDiscount failed: ${JSON.stringify(lsError)}`);
      throw new BadRequestException('Failed to create discount in Lemon Squeezy');
    }

    const { data, error } = await this.db
      .from('affiliate_promo_codes')
      .insert({
        owner_id: input.owner_id,
        code: input.code,
        ls_discount_id: String(discount.data.id),
        amount: input.amount,
        amount_type: input.amount_type,
        commission_rate: input.commission_rate,
        label: input.label,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updatePromoCode(id: string, updates: UpdatePromoCodeInput) {
    const { data, error } = await this.db
      .from('affiliate_promo_codes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Promo code not found');
    return data;
  }

  async getLsDiscounts() {
    this.initLemonSqueezy();
    const storeId = this.configService.get<string>('LEMONSQUEEZY_STORE_ID');
    const { data, error } = await listDiscounts(
      storeId ? { filter: { storeId } } : {},
    );
    if (error) throw new BadRequestException('Failed to fetch Lemon Squeezy discounts');
    return (data?.data ?? []).map((d) => ({
      id: d.id,
      name: d.attributes.name,
      code: d.attributes.code,
      amount: d.attributes.amount,
      amount_type: d.attributes.amount_type,
      status: d.attributes.status,
      created_at: d.attributes.created_at,
    }));
  }

  // ==================== ADMIN: Withdrawals ====================

  async getWithdrawals(page = 1, limit = 20, status?: string) {
    let query = this.db
      .from('affiliate_withdrawals')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    const affiliateIds = [...new Set((data ?? []).map((w) => w.affiliate_id))];
    const { data: profiles } = affiliateIds.length
      ? await this.db.from('profiles').select('user_id, full_name, email').in('user_id', affiliateIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    const enriched = (data ?? []).map((w) => ({ ...w, profiles: profileMap.get(w.affiliate_id) ?? null }));
    return { data: enriched, total: count ?? 0, page, limit };
  }

  async updateWithdrawal(id: string, processedBy: string, input: UpdateWithdrawalInput) {
    const updates: Record<string, unknown> = { status: input.status };
    if (input.admin_notes !== undefined) updates.admin_notes = input.admin_notes;
    if (input.status === 'paid') {
      updates.processed_by = processedBy;
      updates.processed_at = new Date().toISOString();
    }

    const { data, error } = await this.db
      .from('affiliate_withdrawals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Withdrawal not found');
    return data;
  }

  // ==================== Helpers ====================

  private round2(n: number): number {
    return Number(n.toFixed(2));
  }

  private async generateUniqueLinkCode(): Promise<string> {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      let code = '';
      for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
      const { data } = await this.db
        .from('affiliate_links')
        .select('id')
        .eq('code', code)
        .maybeSingle();
      if (!data) return code;
    }
    throw new InternalServerErrorException('Failed to generate unique code');
  }
}
