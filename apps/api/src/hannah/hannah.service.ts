import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { createGoogleAI, GEMINI_TEXT_MODEL } from '../utils/genai';
import { buildHannahSystemPrompt } from './hannah.knowledge';

export interface HannahMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class HannahService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Compact snapshot of the signed-in user's account, injected into Hannah's
   * system prompt on the dashboard route only. Counts + a few recent titles —
   * enough for "how many credits do I have?" / "what did I make last?" without
   * dumping whole documents into the prompt.
   */
  private async getUserSnapshot(userId: string): Promise<string> {
    const db = this.supabaseService.getClient();
    const count = (table: string, col = 'user_id') =>
      db.from(table).select('id', { count: 'exact', head: true }).eq(col, userId);

    const [profile, sub, scripts, thumbs, subs, videos, dubs, stories, ideas, recentScripts] =
      await Promise.all([
        db.from('profiles').select('full_name, credits, ai_trained').eq('user_id', userId).maybeSingle(),
        db.from('subscriptions').select('plans(name)').eq('user_id', userId)
          .in('status', ['active', 'on_trial', 'past_due'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        count('scripts'),
        count('thumbnail_jobs'),
        count('subtitle_jobs'),
        count('video_generation_jobs'),
        count('dubbing_projects'),
        count('story_builder_jobs'),
        count('ideation_jobs'),
        db.from('scripts').select('title, created_at').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(3),
      ]);

    const plan = (sub.data?.plans as { name?: string } | null)?.name ?? 'Starter (free)';
    const p = profile.data;
    const recent = (recentScripts.data ?? [])
      .map((s) => `"${s.title}" (${new Date(s.created_at).toLocaleDateString('en-US')})`)
      .join(', ');

    return `
=== THIS USER'S ACCOUNT (private — share only with this user, in this chat) ===
- Name: ${p?.full_name || 'not set'}
- Plan: ${plan}
- Credits remaining: ${p?.credits ?? 0}
- AI Studio trained: ${p?.ai_trained ? 'yes' : 'no — suggest /dashboard/train to unlock personalized output'}
- Activity: ${scripts.count ?? 0} scripts, ${thumbs.count ?? 0} thumbnails, ${subs.count ?? 0} subtitle jobs, ${videos.count ?? 0} video generations, ${dubs.count ?? 0} dubbing projects, ${stories.count ?? 0} story blueprints, ${ideas.count ?? 0} ideation sessions
- Recent scripts: ${recent || 'none yet'}
Use this to personalize answers ("you have X credits left", "your last script was..."). If asked something about their account that is not listed here (billing history, invoices, exact job contents), point them to the relevant dashboard page or /contact-us instead of guessing.`;
  }

  async chat(
    messages: HannahMessage[],
    context: 'public' | 'dashboard',
    userId?: string,
    audio?: { data: string; mimeType: string },
  ): Promise<{ reply: string }> {
    const ai = await createGoogleAI(this.configService);

    let systemInstruction = buildHannahSystemPrompt(context);
    if (context === 'dashboard' && userId) {
      // Snapshot failure shouldn't kill the chat — Hannah just answers unpersonalized.
      try {
        systemInstruction += await this.getUserSnapshot(userId);
      } catch { /* ignore */ }
    }

    const contents: Array<{ role: string; parts: any[] }> = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // Voice message: the audio itself is the current user turn — Gemini listens
    // and replies in text. If the client sent a placeholder text turn for it,
    // attach the audio to that turn instead of adding an empty-feeling duplicate.
    if (audio) {
      const audioPart = { inlineData: { data: audio.data, mimeType: audio.mimeType } };
      const last = contents[contents.length - 1];
      if (last && last.role === 'user') last.parts.push(audioPart);
      else contents.push({ role: 'user', parts: [audioPart] });
    }

    let result: { text?: string; candidates?: any[] };
    try {
      result = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 600,
        },
      });
    } catch {
      throw new InternalServerErrorException('Hannah is unavailable right now. Please try again.');
    }

    const reply =
      (result as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? result?.text ?? '';
    if (!reply) throw new InternalServerErrorException('Hannah returned an empty response.');

    return { reply };
  }
}
