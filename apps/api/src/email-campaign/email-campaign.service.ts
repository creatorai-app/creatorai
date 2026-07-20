import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseService } from '../supabase/supabase.service';

// Full record the dashboard renders per checkbox AND the worker uses for merge
// tags. Returned by getUsersBySegment — the single source of truth for who
// matches a segment (the send never re-derives from the filter).
export interface RecipientRecord {
  id: string; // profiles.user_id — the id everything else keys on
  email: string;
  fullName: string | null;
  planTier: string | null;
  channelConnected: boolean;
  channelName: string | null;
  modelTrained: boolean;
}

export interface SegmentFilter {
  channelConnected?: boolean;
  modelTrained?: boolean;
  planTier?: string; // matches plans.name case-insensitively
  signupBeforeDays?: number;
}

@Injectable()
export class EmailCampaignService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @InjectQueue('email-campaign') private readonly queue: Queue,
  ) {}

  private get db() {
    const client = this.supabaseService.getAdminClient();
    if (!client) throw new BadRequestException('Admin client is not configured');
    return client;
  }

  // ---- Templates (Phase 6: auto-load on category switch) ----
  async getTemplates(category?: string) {
    let query = this.db
      .from('email_templates')
      .select('id, category, name, subject, html, default_segment, default_from_address, is_active')
      .eq('is_active', true)
      .order('name');
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createTemplate(input: {
    category: string;
    name?: string;
    subject: string;
    html: string;
    defaultFromAddress?: string;
  }) {
    if (!input.category || !input.subject?.trim() || !input.html?.trim()) {
      throw new BadRequestException('Category, subject and HTML are required');
    }
    const { data, error } = await this.db
      .from('email_templates')
      .insert({
        category: input.category,
        name: input.name?.trim() || input.subject.trim(),
        subject: input.subject,
        html: input.html,
        default_from_address: input.defaultFromAddress ?? null,
      })
      .select('id, category, name, subject, html, default_segment, default_from_address, is_active')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateTemplate(id: string, updates: { subject?: string; html?: string }) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof updates.subject === 'string') patch.subject = updates.subject;
    if (typeof updates.html === 'string') patch.html = updates.html;
    const { data, error } = await this.db
      .from('email_templates')
      .update(patch)
      .eq('id', id)
      .select('id, category, name, subject, html, default_segment, default_from_address, is_active')
      .single();
    if (error || !data) throw new NotFoundException('Template not found');
    return data;
  }

  async getFromAddresses() {
    const { data, error } = await this.db
      .from('email_from_addresses')
      .select('id, email, display_name')
      .eq('is_active', true)
      .order('display_name');
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // ---- Segment (Phase 2): full records, single source of truth ----
  async getUsersBySegment(filter: SegmentFilter): Promise<RecipientRecord[]> {
    let query = this.db
      .from('profiles')
      .select('user_id, full_name, name, email, ai_trained, created_at')
      .not('email', 'is', null);

    if (typeof filter.modelTrained === 'boolean') {
      query = query.eq('ai_trained', filter.modelTrained);
    }
    if (filter.signupBeforeDays && filter.signupBeforeDays > 0) {
      const cutoff = new Date(Date.now() - filter.signupBeforeDays * 86400000).toISOString();
      query = query.lte('created_at', cutoff);
    }

    const { data: profiles, error } = await query;
    if (error) throw new BadRequestException(error.message);
    if (!profiles?.length) return [];

    const userIds = profiles.map((p) => p.user_id as string);

    // No FK from these tables to profiles, so hydrate with JS joins (same pattern
    // as the admin user list).
    const [{ data: channels }, { data: subs }] = await Promise.all([
      this.db.from('youtube_channels').select('user_id, channel_name').in('user_id', userIds),
      this.db
        .from('subscriptions')
        .select('user_id, plans(name)')
        .eq('status', 'active')
        .in('user_id', userIds),
    ]);

    const channelByUser = new Map<string, string | null>(
      (channels ?? []).map((c) => [c.user_id as string, (c.channel_name as string) ?? null]),
    );
    const planByUser = new Map<string, string | null>(
      (subs ?? []).map((s) => [s.user_id as string, (s.plans as { name?: string })?.name ?? null]),
    );

    let records: RecipientRecord[] = profiles.map((p) => ({
      id: p.user_id as string,
      email: p.email as string,
      fullName: (p.full_name as string) ?? (p.name as string) ?? null,
      planTier: planByUser.get(p.user_id as string) ?? null,
      channelConnected: channelByUser.has(p.user_id as string),
      channelName: channelByUser.get(p.user_id as string) ?? null,
      modelTrained: Boolean(p.ai_trained),
    }));

    // channelConnected + planTier can't be filtered at the DB level (JS joins), so
    // apply them here — same source list either way.
    if (typeof filter.channelConnected === 'boolean') {
      records = records.filter((r) => r.channelConnected === filter.channelConnected);
    }
    if (filter.planTier) {
      const want = filter.planTier.toLowerCase();
      records = records.filter((r) => (r.planTier ?? '').toLowerCase() === want);
    }
    return records;
  }

  // ---- Send (Phase 4/5): validate, persist edits, enqueue ----
  async sendCampaign(input: {
    templateId: string;
    fromAddress: string;
    recipientIds: string[];
    subject?: string;
    html?: string;
    edited?: boolean;
    segmentFilter?: SegmentFilter;
    sentBy: string;
  }) {
    if (!input.recipientIds?.length) {
      throw new BadRequestException('No recipients selected');
    }
    const { data: template, error: tErr } = await this.db
      .from('email_templates')
      .select('id, subject, html')
      .eq('id', input.templateId)
      .single();
    if (tErr || !template) throw new NotFoundException('Template not found');

    const { data: from, error: fErr } = await this.db
      .from('email_from_addresses')
      .select('email, display_name, is_active')
      .eq('email', input.fromAddress)
      .single();
    if (fErr || !from || !from.is_active) {
      throw new BadRequestException('Invalid from address');
    }

    // The editor is the source of truth: persist the current subject/html back to
    // the template so the edit sticks, and send exactly what was on screen.
    const subject = input.subject ?? template.subject;
    const html = input.html ?? template.html;
    if (input.edited) {
      await this.updateTemplate(template.id, { subject, html });
    }

    const bullJobId = `email-campaign-${input.sentBy}-${Date.now()}`;
    await this.queue.add(
      'send-campaign',
      {
        templateId: template.id,
        fromLine: `${from.display_name} <${from.email}>`,
        fromAddress: from.email,
        subject,
        baseHtml: html,
        htmlOverride: input.edited ? html : null,
        recipientIds: input.recipientIds,
        segmentFilter: input.segmentFilter ?? null,
        sentBy: input.sentBy,
      },
      {
        jobId: bullJobId,
        // Retry transient Resend/network failures; validation already happened above.
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return { jobId: bullJobId, recipientCount: input.recipientIds.length };
  }

  async getCampaign(id: string) {
    const { data, error } = await this.db
      .from('email_sends')
      .select('*, email_templates(name, category, subject)')
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('Campaign not found');

    // Resolve the stored recipient ids to names/emails for the detail view.
    const ids = (data.recipient_ids as string[]) ?? [];
    const { data: profiles } = ids.length
      ? await this.db
          .from('profiles')
          .select('user_id, full_name, name, email')
          .in('user_id', ids)
      : { data: [] };
    const recipients = (profiles ?? []).map((p) => ({
      id: p.user_id as string,
      email: p.email as string,
      fullName: (p.full_name as string) ?? (p.name as string) ?? null,
    }));

    return { ...data, recipients };
  }

  async getHistory(page = 1, limit = 20) {
    const { data, error, count } = await this.db
      .from('email_sends')
      .select(
        'id, from_address, recipient_count, custom_html_used, status, sent_at, sent_by, email_templates(name, category)',
        { count: 'exact' },
      )
      .order('sent_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], total: count ?? 0, page, limit };
  }
}
