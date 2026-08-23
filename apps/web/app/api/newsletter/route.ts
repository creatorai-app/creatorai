import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { success: false, error: "Email is required" },
      { status: 400 }
    );
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);

    const { error } = await resend.emails.send({
      from: "Creator AI <notifications@trycreatorai.com>",
      to: "support@trycreatorai.com",
      replyTo: email,
      subject: "📰 New Newsletter Subscription",
      html: `<div style="font-family: Arial, sans-serif; color: #333; background: #f9f9f9; padding: 20px;">
        <div style="background: white; padding: 20px; border-radius: 8px;">
          <h2 style="color: #4F46E5;">📰 New Newsletter Subscriber</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subscribed at:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </div>`,
    });

    if (error) {
      console.error("Error sending newsletter subscription:", error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}
