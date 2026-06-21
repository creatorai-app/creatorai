import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseClient, getSupabaseServiceEnv } from "@repo/supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ADMIN_EMAIL = process.env.CAREERS_ADMIN_EMAIL || "afrinxnahar@gmail.com";
const FROM_EMAIL = process.env.CAREERS_FROM_EMAIL || "Creator AI Careers <notifications@tryscriptai.com>";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase().slice(0, 60);
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const position = (formData.get("position") as string | null)?.trim() || "";
  const full_name = (formData.get("full_name") as string | null)?.trim() || "";
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() || "";
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const linkedin_url = (formData.get("linkedin_url") as string | null)?.trim() || "";
  const github_url = (formData.get("github_url") as string | null)?.trim() || null;
  const portfolio_url = (formData.get("portfolio_url") as string | null)?.trim() || null;
  const experience = (formData.get("experience") as string | null)?.trim() || "";
  const problem_solving = (formData.get("problem_solving") as string | null)?.trim() || "";
  const job_post_id = (formData.get("job_post_id") as string | null) || null;
  const resumeFile = formData.get("resume_file") as File | null;
  const coverLetterFile = formData.get("cover_letter_file") as File | null;

  if (!position || !full_name || !email || !experience || !linkedin_url || !problem_solving) {
    return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ success: false, error: "Invalid email address" }, { status: 400 });
  }

  for (const file of [resumeFile, coverLetterFile]) {
    if (file && file.size > 0) {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ success: false, error: "Only PDF files are allowed" }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ success: false, error: "File size must be under 5MB" }, { status: 400 });
      }
    }
  }

  try {
    const { url, key } = getSupabaseServiceEnv();
    if (!url || !key) {
      console.error("Missing Supabase service env vars");
      return NextResponse.json({ success: false, error: "Server misconfigured" }, { status: 500 });
    }
    const supabase = createSupabaseClient(url, key);
    const timestamp = Date.now();
    const safeName = sanitizeFilename(full_name);

    const upload = async (file: File | null, folder: string, suffix: string) => {
      if (!file || file.size === 0) return null;
      const path = `${folder}/${safeName}_${timestamp}_${suffix}.pdf`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await supabase.storage
        .from("job-applications")
        .upload(path, buffer, { contentType: "application/pdf", upsert: false });
      if (error) throw new Error(`Failed to upload ${suffix}: ${error.message}`);
      const { data } = supabase.storage.from("job-applications").getPublicUrl(path);
      return data.publicUrl;
    };

    const [resume_file_path, cover_letter_file_path] = await Promise.all([
      upload(resumeFile, "resumes", "resume"),
      upload(coverLetterFile, "cover-letters", "cover_letter"),
    ]);

    const { error: dbError } = await supabase.from("job_applications").insert({
      job_post_id: job_post_id || null,
      position,
      full_name,
      email,
      phone,
      linkedin_url,
      github_url,
      portfolio_url,
      resume_file_path,
      cover_letter_file_path,
      experience,
      problem_solving,
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
      return NextResponse.json({ success: false, error: "Failed to save application" }, { status: 500 });
    }

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const safe = {
        name: escapeHtml(full_name),
        email: escapeHtml(email),
        phone: escapeHtml(phone || "N/A"),
        position: escapeHtml(position),
        experience: escapeHtml(experience),
        linkedin: escapeHtml(linkedin_url),
        github: github_url ? escapeHtml(github_url) : null,
        portfolio: portfolio_url ? escapeHtml(portfolio_url) : null,
        problemSolving: escapeHtml(problem_solving),
      };

      const adminHtml = `<div style="font-family:Arial,sans-serif;color:#333;background:#f9f9f9;padding:20px;">
  <div style="background:white;padding:24px;border-radius:8px;max-width:640px;margin:0 auto;">
    <h2 style="color:#7C3AED;margin-top:0;">New Job Application</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;font-weight:bold;width:130px;">Position:</td><td style="padding:8px 0;">${safe.position}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;">Name:</td><td style="padding:8px 0;">${safe.name}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;">Email:</td><td style="padding:8px 0;"><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;">Phone:</td><td style="padding:8px 0;">${safe.phone}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;">Experience:</td><td style="padding:8px 0;">${safe.experience}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;">LinkedIn:</td><td style="padding:8px 0;"><a href="${safe.linkedin}">${safe.linkedin}</a></td></tr>
      ${safe.github ? `<tr><td style="padding:8px 0;font-weight:bold;">GitHub:</td><td style="padding:8px 0;"><a href="${safe.github}">${safe.github}</a></td></tr>` : ""}
      ${safe.portfolio ? `<tr><td style="padding:8px 0;font-weight:bold;">Portfolio:</td><td style="padding:8px 0;"><a href="${safe.portfolio}">${safe.portfolio}</a></td></tr>` : ""}
      ${resume_file_path ? `<tr><td style="padding:8px 0;font-weight:bold;">Resume:</td><td style="padding:8px 0;"><a href="${resume_file_path}">Download PDF</a></td></tr>` : ""}
      ${cover_letter_file_path ? `<tr><td style="padding:8px 0;font-weight:bold;">Cover Letter:</td><td style="padding:8px 0;"><a href="${cover_letter_file_path}">Download PDF</a></td></tr>` : ""}
    </table>
    <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
    <h3 style="color:#4F46E5;">Problem Solving</h3>
    <p style="white-space:pre-line;">${safe.problemSolving}</p>
    <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
    <p style="font-size:12px;color:#888;">Submitted on ${new Date().toLocaleString()}</p>
  </div>
</div>`;

      const applicantHtml = `<div style="font-family:Arial,sans-serif;color:#333;background:#f9f9f9;padding:20px;">
  <div style="background:white;padding:28px;border-radius:12px;max-width:560px;margin:0 auto;">
    <h2 style="color:#7C3AED;margin-top:0;">Thanks for applying, ${safe.name}!</h2>
    <p style="line-height:1.6;">We've received your application for <strong>${safe.position}</strong> at Creator AI. Our team will review it carefully and get back to you within a few days.</p>
    <div style="background:#F5F3FF;border:1px solid #E9D5FF;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#6B21A8;"><strong>What happens next?</strong></p>
      <ul style="margin:8px 0 0 0;padding-left:20px;font-size:14px;color:#4C1D95;">
        <li>We'll review your resume and responses</li>
        <li>If it's a great fit, we'll email you to schedule a call</li>
        <li>Expect an update within 5–7 business days</li>
      </ul>
    </div>
    <p style="line-height:1.6;">In the meantime, feel free to reply to this email if you have any questions.</p>
    <p style="margin-top:24px;color:#64748b;font-size:14px;">, The Creator AI Team</p>
  </div>
</div>`;

      const [adminRes, applicantRes] = await Promise.allSettled([
        resend.emails.send({
          from: FROM_EMAIL,
          to: ADMIN_EMAIL,
          replyTo: email,
          subject: `New Job Application: ${position}, ${full_name}`,
          html: adminHtml,
        }),
        resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          replyTo: ADMIN_EMAIL,
          subject: `Application received, ${position} at Creator AI`,
          html: applicantHtml,
        }),
      ]);

      if (adminRes.status === "rejected") console.error("Admin mail failed:", adminRes.reason);
      if (applicantRes.status === "rejected") console.error("Applicant mail failed:", applicantRes.reason);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Application submission error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
