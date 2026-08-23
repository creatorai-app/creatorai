import type { SupabaseClient } from '@supabase/supabase-js';

export interface ErrorReport {
  /** Where it happened — 'api' for a request, 'worker' for a background job. */
  source: 'api' | 'worker';
  /** Product area: 'ideation', 'dubbing', 'thumbnail'… Used for grouping and the email subject. */
  feature?: string | null;
  userId?: string | null;
  error: unknown;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  /** Anything else worth having at 3am: job id, plan, input sizes. Never secrets. */
  context?: Record<string, unknown>;
}

/** Alert at most once per fingerprint per window, so a bad deploy sends one email. */
const ALERT_COOLDOWN_MINUTES = 30;
const MAX_STACK = 8000;
const MAX_MESSAGE = 2000;

/** Same knob and same default the affiliate notifications already use. */
function alertRecipient(): string {
  return process.env.ADMIN_NOTIFICATION_EMAIL || 'afrinxnahar@gmail.com';
}

/**
 * Collapse the variable parts of a message so the same bug hashes to one
 * fingerprint: uuids, numbers, quoted values, urls and hex blobs.
 */
function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/["'`][^"'`]{0,120}["'`]/g, '<str>')
    .replace(/\b[0-9a-f]{16,}\b/g, '<hex>')
    .replace(/\d+/g, '<n>')
    .slice(0, 300);
}

/** FNV-1a — no node:crypto, so this file stays safe for every consumer of the package. */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function describe(error: unknown): { name: string; message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: (error.message || String(error)).slice(0, MAX_MESSAGE),
      stack: error.stack ? error.stack.slice(0, MAX_STACK) : null,
    };
  }
  if (typeof error === 'object' && error !== null) {
    const asRecord = error as Record<string, unknown>;
    const message = typeof asRecord.message === 'string' ? asRecord.message : JSON.stringify(error);
    return { name: String(asRecord.name ?? 'UnknownError'), message: message.slice(0, MAX_MESSAGE), stack: null };
  }
  return { name: 'UnknownError', message: String(error).slice(0, MAX_MESSAGE), stack: null };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Record a user-facing failure and, unless the same fingerprint already alerted
 * inside the cooldown, email the details.
 *
 * Never throws and never rejects — observability must not be able to break the
 * request or job it is observing. Await it only where you do not mind the
 * latency; callers on hot paths should fire and forget.
 */
export async function reportError(supabase: SupabaseClient, report: ErrorReport): Promise<void> {
  try {
    const { name, message, stack } = describe(report.error);
    const route = report.route ?? null;
    const feature = report.feature ?? null;
    const fingerprint = hash([report.source, name, normalizeMessage(message), route ?? feature ?? ''].join('|'));

    const occurrences = await countRecent(supabase, fingerprint);
    const shouldAlert = await needsAlert(supabase, fingerprint);

    const { data, error: insertError } = await supabase
      .from('error_logs')
      .insert({
        fingerprint,
        source: report.source,
        feature,
        user_id: report.userId ?? null,
        name,
        message,
        stack,
        route,
        method: report.method ?? null,
        status_code: report.statusCode ?? null,
        context: report.context ?? {},
        alerted_at: shouldAlert ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[error-log] insert failed:', insertError.message);
      return;
    }

    if (shouldAlert) {
      await sendAlert({
        id: data?.id as string | undefined,
        fingerprint,
        occurrences: occurrences + 1,
        name,
        message,
        stack,
        report,
      });
    }
  } catch (e) {
    console.error('[error-log] reporting failed:', e instanceof Error ? e.message : e);
  }
}

async function countRecent(supabase: SupabaseClient, fingerprint: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('error_logs')
    .select('id', { count: 'exact', head: true })
    .eq('fingerprint', fingerprint)
    .gte('created_at', since);
  return count ?? 0;
}

async function needsAlert(supabase: SupabaseClient, fingerprint: string): Promise<boolean> {
  const since = new Date(Date.now() - ALERT_COOLDOWN_MINUTES * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('error_logs')
    .select('id')
    .eq('fingerprint', fingerprint)
    .gte('alerted_at', since)
    .limit(1);
  return !data?.length;
}

async function sendAlert(input: {
  id?: string;
  fingerprint: string;
  occurrences: number;
  name: string;
  message: string;
  stack: string | null;
  report: ErrorReport;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[error-log] RESEND_API_KEY unset — alert not sent');
    return;
  }

  // Dynamic import keeps resend out of any bundle that merely imports this package.
  const mod = await (Function('return import("resend")')() as Promise<{
    Resend: new (key: string) => { emails: { send: (o: Record<string, unknown>) => Promise<unknown> } };
  }>);
  const resend = new mod.Resend(apiKey);

  const { report } = input;
  const scope = report.feature ?? report.route ?? report.source;
  const rows: Array<[string, string]> = [
    ['Source', report.source],
    ['Feature', report.feature ?? '—'],
    ['Route', report.route ? `${report.method ?? ''} ${report.route}`.trim() : '—'],
    ['Status', report.statusCode ? String(report.statusCode) : '—'],
    ['User', report.userId ?? 'anonymous'],
    ['Fingerprint', input.fingerprint],
    ['Seen (24h)', String(input.occurrences)],
    ['Time', new Date().toISOString()],
  ];

  const contextEntries = Object.entries(report.context ?? {});
  const contextBlock = contextEntries.length
    ? `<h3 style="margin:24px 0 8px;font-size:14px;color:#334155;">Context</h3>
       <pre style="background:#0f172a;color:#e2e8f0;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${escapeHtml(
         JSON.stringify(Object.fromEntries(contextEntries), null, 2),
       )}</pre>`
    : '';

  const stackBlock = input.stack
    ? `<h3 style="margin:24px 0 8px;font-size:14px;color:#334155;">Stack</h3>
       <pre style="background:#0f172a;color:#e2e8f0;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${escapeHtml(
         input.stack,
       )}</pre>`
    : '';

  try {
    await resend.emails.send({
      from: 'Creator AI <notifications@trycreatorai.com>',
      to: alertRecipient(),
      subject: `[Creator AI error] ${scope}: ${input.name} — ${input.message.slice(0, 90)}`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:20px;">
        <div style="background:#fff;padding:24px;border-radius:10px;max-width:760px;margin:0 auto;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#dc2626;">User-facing error</p>
          <h2 style="margin:0 0 16px;font-size:18px;">${escapeHtml(input.name)}</h2>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.5;">${escapeHtml(input.message)}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            ${rows
              .map(
                ([label, value]) =>
                  `<tr><td style="padding:6px 0;color:#64748b;width:130px;">${label}</td><td style="padding:6px 0;">${escapeHtml(
                    value,
                  )}</td></tr>`,
              )
              .join('')}
          </table>
          ${contextBlock}
          ${stackBlock}
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
            Further alerts for this fingerprint are muted for ${ALERT_COOLDOWN_MINUTES} minutes.
            Full history: Admin → Errors.
          </p>
        </div>
      </div>`,
    });
  } catch (e) {
    console.error('[error-log] alert email failed:', e instanceof Error ? e.message : e);
  }
}
