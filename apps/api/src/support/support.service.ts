import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { SupabaseService } from '../supabase/supabase.service';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

@Injectable()
export class SupportService {
  private readonly resend: Resend | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) this.resend = new Resend(apiKey);
  }

  async reportIssue(subject: string, email: string, body: string) {
    if (!subject || !email || !body) {
      throw new BadRequestException('Missing required fields');
    }
    if (!this.resend) throw new InternalServerErrorException('Email service not configured');

    // Persist to admin dashboard first — delivery independent of email provider outage.
    const { error: dbError } = await this.supabaseService
      .getClient()
      .from('mail_messages')
      .insert({ from_email: email, subject, body, status: 'unread' });
    if (dbError) {
      throw new InternalServerErrorException('Failed to record issue report');
    }

    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeBody = escapeHtml(body);

    const { data, error } = await this.resend.emails.send({
      from: 'Creator AI <notifications@trycreatorai.com>',
      to: 'support@trycreatorai.com',
      replyTo: email,
      subject,
      html: `<div style="font-family: Arial, sans-serif; color: #333; background: #f9f9f9; padding: 20px;">
        <div style="background: white; padding: 20px; border-radius: 8px;">
          <h2 style="color: #4F46E5;">New Issue Reported</h2>
          <p><strong>From:</strong> ${safeEmail}</p>
          <p><strong>Subject:</strong> ${safeSubject}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="white-space: pre-line;">${safeBody}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #888;">Sent on ${new Date().toLocaleString()}</p>
        </div>
      </div>`,
    });

    if (error) throw new InternalServerErrorException('Failed to send issue report');
    return { success: true, data };
  }
}
