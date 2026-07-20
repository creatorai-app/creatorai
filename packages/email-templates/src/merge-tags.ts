// Per-recipient personalization for bulk campaign emails. The SAME function runs
// on the send side (worker) and the dashboard live preview, so what Afrin sees is
// exactly what goes out — the two never drift.

export interface RecipientMergeData {
  email: string;
  fullName: string | null;
  planTier: string | null;
  channelConnected: boolean;
  channelName: string | null;
  // Where the unsubscribe link points. ponytail: no unsubscribe system yet, so
  // this defaults to a mailto — swap for a real opt-out URL when one exists.
  unsubscribeUrl?: string;
}

// firstName is derived from fullName (profiles has no first/last split).
function firstNameOf(fullName: string | null): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0];
  return first || 'there';
}

// The tags an author can use in a template, with their fallbacks. Rendered as a
// reference panel in the compose UI and documented here as the one canonical list.
export const MERGE_TAGS: { tag: string; description: string; fallback: string }[] = [
  { tag: 'firstName', description: "Recipient's first name", fallback: 'there' },
  { tag: 'fullName', description: "Recipient's full name", fallback: 'there' },
  { tag: 'planTier', description: 'Current plan (Starter, Creator, …)', fallback: 'Starter' },
  { tag: 'channelName', description: 'Connected channel name', fallback: 'your channel' },
  { tag: 'email', description: "Recipient's email address", fallback: '' },
  { tag: 'unsubscribeUrl', description: 'Unsubscribe link', fallback: 'mailto:support@tryscriptai.com?subject=Unsubscribe' },
];

// Replaces every {{tag}} with the recipient's value (or the documented fallback).
// Unknown tags are left untouched so a typo is visible rather than silently blank.
export function resolveMergeTags(html: string, user: RecipientMergeData): string {
  const values: Record<string, string> = {
    firstName: firstNameOf(user.fullName),
    fullName: (user.fullName ?? '').trim() || 'there',
    planTier: user.planTier || 'Starter',
    channelName: (user.channelConnected && user.channelName) || 'your channel',
    email: user.email,
    unsubscribeUrl: user.unsubscribeUrl || 'mailto:support@tryscriptai.com?subject=Unsubscribe',
  };
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, tag: string) =>
    tag in values ? values[tag] : match,
  );
}
