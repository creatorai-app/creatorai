import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { Webhook } from "svix";
import { createSupabaseClient, getSupabaseServiceEnv } from "@repo/supabase";

const OWN_DOMAIN = "tryscriptai.com";
const SUPPORT_INBOX = "support@tryscriptai.com";

const resend = new Resend(process.env.RESEND_API_KEY!);

function parseAddress(raw: string | undefined | null): { name?: string; email: string } {
  if (!raw) return { email: "" };
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1]?.trim();
    return { name: name || undefined, email: match[2]!.trim().toLowerCase() };
  }
  return { email: raw.trim().toLowerCase() };
}

type InboundEvent = {
  type: string;
  data: {
    email_id: string;
    from: string;
    to?: string[];
    subject?: string;
    created_at?: string;
  };
};

export async function POST(request: NextRequest) {
  const body = await request.text();

  if (process.env.RESEND_WEBHOOK_SECRET) {
    try {
      const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET);
      wh.verify(body, {
        "svix-id": request.headers.get("svix-id") ?? "",
        "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
        "svix-signature": request.headers.get("svix-signature") ?? "",
      });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const event = JSON.parse(body) as InboundEvent;
  if (event.type !== "email.received") {
    return NextResponse.json({ received: true });
  }

  const { email_id, from, to, subject } = event.data;
  const sender = parseAddress(from);
  const recipients = (to ?? []).map((a) => parseAddress(a).email).filter(Boolean);

  // Loop guard: drop anything originating from our own domain (self-sent / forward artifacts).
  if (!sender.email || sender.email.endsWith(`@${OWN_DOMAIN}`)) {
    console.warn(`[resend-webhook] dropped self-origin email id=${email_id} from=${sender.email}`);
    return NextResponse.json({ received: true, skipped: "self-origin" });
  }

  if (!recipients.includes(SUPPORT_INBOX)) {
    return NextResponse.json({ received: true, skipped: "not-support" });
  }

  try {
    // Fetch full inbound content (webhook payload has only metadata per Resend docs).
    const { data: email } = await resend.emails.receiving.get(email_id);
    // Prefer the HTML body so the admin dashboard can render the email with its
    // real design (like Resend does); fall back to plain text when there's no HTML.
    const bodyText =
      (email as { text?: string | null; html?: string | null } | null)?.html?.trim() ||
      (email as { text?: string | null; html?: string | null } | null)?.text?.trim() ||
      "";

    const { url, key } = getSupabaseServiceEnv();
    const db = createSupabaseClient(url, key);

    const { error } = await db.from("mail_messages").insert({
      from_email: sender.email,
      from_name: sender.name ?? null,
      subject: subject ?? "(no subject)",
      body: bodyText || "(empty body)",
      status: "unread",
    });

    if (error) {
      console.error("[resend-webhook] failed to persist inbound mail:", error);
      return NextResponse.json({ error: "persist-failed" }, { status: 500 });
    }
  } catch (err) {
    console.error("[resend-webhook] processing error:", err);
    return NextResponse.json({ error: "processing-error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
