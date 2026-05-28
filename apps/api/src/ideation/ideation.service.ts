import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseService } from '../supabase/supabase.service';
import {
  hasEnoughCredits,
  getMinimumCreditsForIdeation,
  IDEATION_CREDIT_MULTIPLIER,
  getIdeationLimitsForPlan,
} from '@repo/validation';
import { BillingService } from '../billing/billing.service';
import { PDFDocument, PDFPage, PDFImage, rgb, StandardFonts, PDFFont } from 'pdf-lib';

const MAX_NICHE_FOCUS_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 1000;

interface TextSegment { text: string; isBold: boolean }

const PAGE = { width: 595.28, height: 841.89 };
const MARGINS = { top: 60, bottom: 60, left: 50, right: 50 };
const COLORS = {
  black: rgb(0, 0, 0),
  darkGray: rgb(0.2, 0.2, 0.2),
  mediumGray: rgb(0.3, 0.3, 0.3),
  purple: rgb(0.45, 0.27, 0.82),
};

@Injectable()
export class IdeationService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly billingService: BillingService,
    @InjectQueue('ideation') private readonly queue: Queue,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async createJob(userId: string, input: {
    context?: string;
    nicheFocus?: string;
    ideaCount?: number;
    autoMode?: boolean;
  }) {
    const billing = await this.billingService.getBillingInfo(userId);
    const planLimits = getIdeationLimitsForPlan(billing.currentPlan?.name);
    const requestedCount = input.ideaCount ?? (planLimits.maxIdeas === 1 ? 1 : Math.min(3, planLimits.maxIdeas));
    const ideaCount = Math.min(planLimits.maxIdeas, Math.max(1, requestedCount));

    if (requestedCount > planLimits.maxIdeas) {
      throw new ForbiddenException(
        `Your ${billing.currentPlan?.name ?? 'Starter'} plan allows up to ${planLimits.maxIdeas} idea${planLimits.maxIdeas === 1 ? '' : 's'} per run.`,
      );
    }

    if (input.nicheFocus && input.nicheFocus.length > MAX_NICHE_FOCUS_LENGTH) {
      throw new BadRequestException(`Niche focus must be under ${MAX_NICHE_FOCUS_LENGTH} characters`);
    }
    if (input.context && input.context.length > MAX_CONTEXT_LENGTH) {
      throw new BadRequestException(`Context must be under ${MAX_CONTEXT_LENGTH} characters`);
    }

    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('credits, ai_trained')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) throw new NotFoundException('Profile not found');
    if (!profile.ai_trained) {
      throw new ForbiddenException('AI training is required before generating ideas. Train your AI first.');
    }
    const ideationMultiplier = this.getEnvNumber(
      'IDEATION_CREDIT_MULTIPLIER',
      IDEATION_CREDIT_MULTIPLIER,
    );
    const minCredits = getMinimumCreditsForIdeation(ideationMultiplier);
    if (!hasEnoughCredits(profile.credits, minCredits)) {
      throw new ForbiddenException(`Insufficient credits. Need at least ${minCredits}, have ${profile.credits}.`);
    }

    const { count } = await this.supabase
      .from('ideation_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'processing']);

    if (count && count > 0) {
      throw new ConflictException('You already have an ideation job in progress. Please wait for it to complete.');
    }

    const { data: job, error: jobError } = await this.supabase
      .from('ideation_jobs')
      .insert({
        user_id: userId,
        context: input.context || null,
        niche_focus: input.nicheFocus || null,
        idea_count: ideaCount,
        auto_mode: input.autoMode ?? false,
        status: 'pending',
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new InternalServerErrorException('Failed to create ideation job');
    }

    const bullJobId = `ideation-${userId}-${Date.now()}`;
    await this.queue.add(
      'generate-ideas',
      {
        userId,
        ideationJobId: job.id,
        context: input.context || '',
        nicheFocus: input.nicheFocus || '',
        ideaCount,
        autoMode: input.autoMode ?? false,
      },
      {
        jobId: bullJobId,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    await this.supabase
      .from('ideation_jobs')
      .update({ job_id: bullJobId })
      .eq('id', job.id);

    return {
      id: job.id,
      jobId: bullJobId,
      status: 'pending',
      message: 'Ideation job queued. Ideas are being generated.',
    };
  }

  async listJobs(userId: string, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('ideation_jobs')
      .select('id, status, niche_focus, idea_count, auto_mode, credits_consumed, error_message, created_at, updated_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new InternalServerErrorException('Failed to fetch ideation jobs');
    return { data, total: count || 0, page, limit };
  }

  async getJob(id: string, userId: string) {
    const { data, error } = await this.supabase
      .from('ideation_jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) throw new NotFoundException('Ideation job not found');
    return data;
  }

  async deleteJob(id: string, userId: string) {
    const { error } = await this.supabase
      .from('ideation_jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new InternalServerErrorException('Failed to delete ideation job');
    return { success: true };
  }

  async getProfileStatus(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('ai_trained, credits')
      .eq('user_id', userId)
      .single();

    if (error || !data) throw new NotFoundException('Profile not found');
    return { aiTrained: data.ai_trained ?? false, credits: data.credits ?? 0 };
  }

  async exportJson(id: string, userId: string) {
    const { data, error } = await this.supabase
      .from('ideation_jobs')
      .select('result, trend_snapshot, niche_focus, created_at')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .single();

    if (error || !data) throw new NotFoundException('Completed ideation job not found');
    return data;
  }

  private async embedLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
    const candidates = [
      path.resolve(process.cwd(), 'apps/web/public/dark-logo.png'),
      path.resolve(__dirname, '../../../../apps/web/public/dark-logo.png'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return pdfDoc.embedPng(fs.readFileSync(p));
      } catch { /* skip */ }
    }
    return null;
  }

  private drawPageFooter(
    page: PDFPage,
    fonts: { regular: PDFFont; oblique: PDFFont },
    pageNum: number,
    totalPages: number,
  ) {
    const footerY = MARGINS.bottom - 30;
    const brand = 'Generated by Creator AI';
    const pageText = `Page ${pageNum} of ${totalPages}`;
    page.drawText(brand, { x: MARGINS.left, y: footerY, font: fonts.oblique, size: 8, color: rgb(0.55, 0.55, 0.55) });
    const pageTextWidth = fonts.regular.widthOfTextAtSize(pageText, 8);
    page.drawText(pageText, { x: PAGE.width - MARGINS.right - pageTextWidth, y: footerY, font: fonts.regular, size: 8, color: rgb(0.55, 0.55, 0.55) });
    page.drawLine({
      start: { x: MARGINS.left, y: footerY + 12 },
      end: { x: PAGE.width - MARGINS.right, y: footerY + 12 },
      thickness: 0.4, color: rgb(0.85, 0.85, 0.85),
    });
  }

  async exportPdf(id: string, userId: string): Promise<{ pdfBytes: Uint8Array; filename: string }> {
    const { data: record, error } = await this.supabase
      .from('ideation_jobs')
      .select('result, trend_snapshot, niche_focus, created_at')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .single();

    if (error || !record?.result) throw new NotFoundException('Completed ideation job not found');

    const pdfDoc = await PDFDocument.create();
    const fonts = {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      oblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    };
    const logo = await this.embedLogo(pdfDoc);

    const result = record.result as any;
    const title = record.niche_focus || 'Ideation Report';
    pdfDoc.setTitle(title);
    pdfDoc.setCreator('Creator AI');

    const pages: PDFPage[] = [];
    const state = {
      page: pdfDoc.addPage([PAGE.width, PAGE.height]),
      y: PAGE.height - MARGINS.top,
    };
    pages.push(state.page);

    const ensureSpace = (h: number) => {
      if (state.y - h < MARGINS.bottom) {
        state.page = pdfDoc.addPage([PAGE.width, PAGE.height]);
        pages.push(state.page);
        state.y = PAGE.height - MARGINS.top;
      }
    };

    const drawText = (text: string, opts: { font: PDFFont; size: number; x: number; lineHeight: number; color?: any }) => {
      const { font, size, x, lineHeight, color = COLORS.darkGray } = opts;
      const maxW = PAGE.width - x - MARGINS.right;
      let line = '';
      for (const word of text.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > maxW) {
          if (line) { ensureSpace(lineHeight); state.page.drawText(line, { x, y: state.y, font, size, color }); state.y -= lineHeight; }
          line = word;
        } else { line = test; }
      }
      if (line) { ensureSpace(lineHeight); state.page.drawText(line, { x, y: state.y, font, size, color }); state.y -= lineHeight; }
    };

    // --- Brand header ---
    const logoSize = 28;
    if (logo) {
      const dims = logo.scaleToFit(logoSize, logoSize);
      state.page.drawImage(logo, { x: MARGINS.left, y: state.y - dims.height + 6, width: dims.width, height: dims.height });
    }
    const brandX = logo ? MARGINS.left + logoSize + 10 : MARGINS.left;
    state.page.drawText('Creator AI', { x: brandX, y: state.y - 6, font: fonts.bold, size: 16, color: COLORS.purple });

    const dateStr = new Date(record.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const dateWidth = fonts.regular.widthOfTextAtSize(dateStr, 9);
    state.page.drawText(dateStr, { x: PAGE.width - MARGINS.right - dateWidth, y: state.y - 4, font: fonts.regular, size: 9, color: COLORS.mediumGray });
    state.y -= 35;

    state.page.drawLine({
      start: { x: MARGINS.left, y: state.y },
      end: { x: PAGE.width - MARGINS.right, y: state.y },
      thickness: 1.5, color: COLORS.purple,
    });
    state.y -= 30;

    // --- Title ---
    drawText(title, { font: fonts.bold, size: 20, x: MARGINS.left, lineHeight: 26, color: COLORS.black });
    state.y -= 5;
    drawText(`${(result.ideas || []).length} ideas generated`, { font: fonts.oblique, size: 10, x: MARGINS.left, lineHeight: 14, color: COLORS.mediumGray });
    state.y -= 20;

    // --- Ideas ---
    const ideas = result.ideas || [];
    for (let i = 0; i < ideas.length; i++) {
      const idea = ideas[i];

      ensureSpace(30);
      drawText(`Idea ${i + 1} — ${idea.title}`, { font: fonts.bold, size: 14, x: MARGINS.left, lineHeight: 18, color: COLORS.purple });
      state.y -= 5;

      if (idea.whyItWorks) {
        drawText('Why This Works:', { font: fonts.bold, size: 11, x: MARGINS.left + 10, lineHeight: 15, color: COLORS.black });
        drawText(idea.whyItWorks, { font: fonts.regular, size: 10, x: MARGINS.left + 20, lineHeight: 14 });
        state.y -= 5;
      }

      if (idea.hookAngle) {
        drawText('Hook Angle:', { font: fonts.bold, size: 11, x: MARGINS.left + 10, lineHeight: 15, color: COLORS.black });
        drawText(idea.hookAngle, { font: fonts.regular, size: 10, x: MARGINS.left + 20, lineHeight: 14 });
        state.y -= 5;
      }

      if (idea.targetKeywords?.length) {
        drawText(`Keywords: ${idea.targetKeywords.join(', ')}`, { font: fonts.regular, size: 10, x: MARGINS.left + 10, lineHeight: 14 });
      }

      if (idea.suggestedFormat) {
        drawText(`Format: ${idea.suggestedFormat}`, { font: fonts.regular, size: 10, x: MARGINS.left + 10, lineHeight: 14 });
      }

      if (idea.talkingPoints?.length) {
        drawText('Talking Points:', { font: fonts.bold, size: 11, x: MARGINS.left + 10, lineHeight: 15, color: COLORS.black });
        for (const point of idea.talkingPoints) {
          drawText(`• ${point}`, { font: fonts.regular, size: 10, x: MARGINS.left + 20, lineHeight: 14 });
        }
        state.y -= 5;
      }

      drawText(`Opportunity Score: ${idea.opportunityScore}/100 | Trend: ${idea.trendMomentum}`, {
        font: fonts.bold, size: 10, x: MARGINS.left + 10, lineHeight: 14, color: COLORS.purple,
      });

      state.y -= 15;
    }

    // --- Footer on all pages ---
    for (let i = 0; i < pages.length; i++) {
      this.drawPageFooter(pages[i], fonts, i + 1, pages.length);
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `ideation_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    return { pdfBytes, filename };
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
