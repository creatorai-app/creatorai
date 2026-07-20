import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, getSupabaseServiceEnv } from "@repo/supabase";

// Captures an unsubscribe. Keyed by user_id (a UUID from the email link), never
// the email itself — no PII travels in the URL. Upsert so re-clicks are harmless.
export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ success: false, error: "Missing user" }, { status: 400 });
  }

  try {
    const { url, key } = getSupabaseServiceEnv();
    const supabase = createSupabaseClient(url, key);

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .single();

    const { error } = await supabase
      .from("email_unsubscribes")
      .upsert(
        { user_id: userId, email: profile?.email ?? null, created_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return NextResponse.json({ success: false, error: "Failed to unsubscribe" }, { status: 500 });
  }
}
