import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseClient, getSupabaseServiceEnv } from "@repo/supabase";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

type ContactBody = {
  name: string;
  email: string;
  message: string;
  phone?: string;
};

async function sendContactMail(
  { name, email, message, phone }: ContactBody,
  resend: Resend,
) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone ?? '');
  const safeMessage = escapeHtml(message);

  return resend.emails.send({
    from: 'Creator AI <notifications@trycreatorai.com>',
    to: 'support@trycreatorai.com',
    replyTo: email,
    subject: 'New Contact Message',
    html: `<div style="font-family: Arial, sans-serif; color: #333; background: #f9f9f9; padding: 20px;">
        <div style="background: white; padding: 20px; border-radius: 8px;">
          <h2 style="color: #4F46E5;">New Contact Message</h2>
          <p><strong>From:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Phone:</strong> ${safePhone}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="white-space: pre-line;">${safeMessage}</p>
        </div>
      </div>`,
  });
}

export async function POST(req: NextRequest) {
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { email, message, name, phone } = body;
  if (!email || !message || !name) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const { url, key } = getSupabaseServiceEnv();
    const db = createSupabaseClient(url, key);
    const { error: dbError } = await db.from('mail_messages').insert({
      from_email: email,
      from_name: name,
      subject: `Contact: ${name}${phone ? ` (${phone})` : ''}`,
      body: message,
      status: 'unread',
    });
    if (dbError) {
      console.error('Contact form persist error:', dbError);
      return NextResponse.json({ success: false, error: 'Failed to record message' }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error: sendError } = await sendContactMail(body, resend);
    if (sendError) {
      console.error('Contact form send error:', sendError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
