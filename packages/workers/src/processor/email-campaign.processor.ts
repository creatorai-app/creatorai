import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { createSupabaseClient, getSupabaseServiceEnv, SupabaseClient } from '@repo/supabase';
import { resolveMergeTags } from '@repo/email-templates';

interface EmailCampaignJobData {
  templateId: string;
  fromLine: string; // "Display Name <email@domain>"
  fromAddress: string;
  subject: string;
  baseHtml: string;
  htmlOverride: string | null;
  recipientIds: string[];
  segmentFilter: unknown;
  sentBy: string;
}

interface Recipient {
  id: string;
  email: string;
  fullName: string | null;
  planTier: string | null;
  channelConnected: boolean;
  channelName: string | null;
  unsubscribeUrl: string;
}

function frontendBaseUrl(): string {
  return process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_PROD_URL || 'https://tryscriptai.com'
    : process.env.FRONTEND_DEV_URL || 'http://localhost:3000';
}

const RESEND_BATCH_LIMIT = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Processor('email-campaign')
export class EmailCampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailCampaignProcessor.name);
  private readonly db: SupabaseClient;
  private readonly resend: Resend | null;

  constructor() {
    super();
    const { url, key } = getSupabaseServiceEnv();
    this.db = createSupabaseClient(url, key);
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async process(job: Job<EmailCampaignJobData>): Promise<void> {
    const data = job.data;
    if (!this.resend) throw new Error('RESEND_API_KEY missing — cannot send campaign');

    const recipients = await this.resolveRecipients(data.recipientIds);
    if (!recipients.length) throw new Error('No resolvable recipients for campaign');

    const batchIds: string[] = [];
    const errors: { chunkSize: number; error: string }[] = [];

    for (const group of chunk(recipients, RESEND_BATCH_LIMIT)) {
      try {
        const res = await this.resend.batch.send(
          group.map((user) => ({
            from: data.fromLine,
            to: user.email,
            subject: resolveMergeTags(data.subject, user),
            html: resolveMergeTags(data.baseHtml, user), // personalized per recipient
          })),
        );
        if (res.error) throw new Error(res.error.message);
        for (const m of res.data?.data ?? []) if (m?.id) batchIds.push(m.id);
      } catch (err) {
        errors.push({ chunkSize: group.length, error: err instanceof Error ? err.message : String(err) });
        this.logger.error(`Campaign chunk failed (${group.length}): ${String(err)}`);
      }
      await sleep(600); // stay under Resend's default rate limit between batches
    }

    const status = errors.length === 0 ? 'sent' : batchIds.length > 0 ? 'partial_failure' : 'failed';

    const { error: logErr } = await this.db.from('email_sends').insert({
      template_id: data.templateId,
      from_address: data.fromAddress,
      segment_filter: data.segmentFilter,
      recipient_ids: data.recipientIds,
      recipient_count: recipients.length,
      custom_html_used: !!data.htmlOverride,
      custom_html: data.htmlOverride,
      resend_batch_ids: batchIds,
      status,
      error_details: errors.length ? errors : null,
      sent_by: data.sentBy,
    });
    if (logErr) this.logger.error(`Failed to log email_send: ${logErr.message}`);

    // Total failure → throw so BullMQ retries the whole job.
    if (status === 'failed') throw new Error('All campaign batches failed');
    this.logger.log(`Campaign sent: ${recipients.length} recipients, status=${status}`);
  }

  // Resolve confirmed ids to the fields merge tags need (no segment filtering —
  // the list is already final).
  private async resolveRecipients(ids: string[]): Promise<Recipient[]> {
    if (!ids.length) return [];
    const { data: profiles } = await this.db
      .from('profiles')
      .select('user_id, full_name, name, email')
      .in('user_id', ids)
      .not('email', 'is', null);
    if (!profiles?.length) return [];

    const userIds = profiles.map((p) => p.user_id as string);
    const [{ data: channels }, { data: subs }, { data: unsubs }] = await Promise.all([
      this.db.from('youtube_channels').select('user_id, channel_name').in('user_id', userIds),
      this.db.from('subscriptions').select('user_id, plans(name)').eq('status', 'active').in('user_id', userIds),
      this.db.from('email_unsubscribes').select('user_id').in('user_id', userIds),
    ]);

    const channelByUser = new Map<string, string | null>(
      (channels ?? []).map((c) => [c.user_id as string, (c.channel_name as string) ?? null]),
    );
    const planByUser = new Map<string, string | null>(
      (subs ?? []).map((s) => [s.user_id as string, (s.plans as { name?: string })?.name ?? null]),
    );
    // Guard: never email someone who opted out, even if their id is on the list.
    const unsubscribed = new Set((unsubs ?? []).map((u) => u.user_id as string));
    const skipped = userIds.filter((id) => unsubscribed.has(id)).length;
    if (skipped) this.logger.log(`Skipping ${skipped} unsubscribed recipient(s)`);

    const base = frontendBaseUrl();
    return profiles
      .filter((p) => !unsubscribed.has(p.user_id as string))
      .map((p) => ({
      id: p.user_id as string,
      email: p.email as string,
      fullName: (p.full_name as string) ?? (p.name as string) ?? null,
      planTier: planByUser.get(p.user_id as string) ?? null,
      channelConnected: channelByUser.has(p.user_id as string),
      channelName: channelByUser.get(p.user_id as string) ?? null,
      // user_id (a UUID), not the email, so no PII in the link.
      unsubscribeUrl: `${base}/unsubscribe?u=${p.user_id as string}`,
    }));
  }
}
