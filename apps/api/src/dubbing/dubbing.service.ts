import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, interval, switchMap, map, from, takeWhile } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateDubInput, DubResponse, DubbingProgress } from '@repo/validation';
import { calculateDubbingCredits, hasEnoughCredits } from '@repo/validation';
import { createGoogleAI, GEMINI_TEXT_MODEL, fetchVideoAsBuffer, configureFFmpeg } from '../utils';
import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

const MIN_DUBBING_CREDITS = 10;
// Vertex AI takes media bytes inline (no Files API). base64 inflates size ~33%.
const MAX_INLINE_BYTES = 50 * 1024 * 1024; // 50MB raw → ~67MB base64

@Injectable()
export class DubbingService {
  private readonly logger = new Logger(DubbingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async createDub(input: CreateDubInput, userId: string): Promise<{ projectId: string }> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (!profile || !hasEnoughCredits(profile.credits, MIN_DUBBING_CREDITS)) {
      throw new ForbiddenException('Insufficient credits for dubbing.');
    }

    const modalUrl = this.configService.get<string>('MODAL_API_URL');
    if (!modalUrl) {
      throw new BadRequestException('Dubbing service is not configured');
    }

    const projectId = crypto.randomUUID();

    const { error } = await this.supabase.from('dubbing_projects').insert({
      project_id: projectId,
      user_id: userId,
      original_media_url: input.mediaUrl,
      target_language: input.targetLanguage,
      is_video: input.isVideo,
      media_name: input.mediaName,
      status: 'dubbing',
      credits_consumed: 0,
    });

    if (error) throw new InternalServerErrorException('Failed to create dubbing project');

    void this.processDub(projectId, input, userId, modalUrl);

    return { projectId };
  }

  streamDubbingStatus(projectId: string): Observable<MessageEvent> {
    return interval(2500).pipe(
      switchMap(() => from(this.getProgress(projectId))),
      map((progress) => ({ data: JSON.stringify(progress) }) as MessageEvent),
      takeWhile((event) => {
        const data: DubbingProgress = JSON.parse((event as MessageEvent & { data: string }).data);
        return !data.finished;
      }, true),
    );
  }

  async listDubs(userId: string, pageSize = 100) {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(pageSize);

    if (error) throw new InternalServerErrorException('Failed to fetch dubs');
    return data;
  }

  async getDub(userId: string, projectId: string): Promise<DubResponse> {
    const { data, error } = await this.supabase
      .from('dubbing_projects')
      .select('project_id, dubbed_url, original_media_url, target_language, status, credits_consumed, is_video, created_at, media_name')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();

    if (error || !data) {
      throw new BadRequestException('Dub not found or access denied');
    }

    return {
      projectId: data.project_id,
      originalMediaUrl: data.original_media_url,
      dubbedUrl: data.dubbed_url,
      status: data.status,
      creditsConsumed: data.credits_consumed,
      isVideo: data.is_video,
      createdAt: data.created_at,
      targetLanguage: data.target_language,
      mediaName: data.media_name,
    };
  }

  async deleteDub(userId: string, projectId: string): Promise<void> {
    const { error } = await this.supabase
      .from('dubbing_projects')
      .delete()
      .eq('user_id', userId)
      .eq('project_id', projectId);

    if (error) throw new BadRequestException('Dub not found or access denied');
  }

  // --- Background pipeline ---

  private async getProgress(projectId: string): Promise<DubbingProgress> {
    const { data } = await this.supabase
      .from('dubbing_projects')
      .select('status, credits_consumed')
      .eq('project_id', projectId)
      .single();

    if (!data) {
      return { state: 'failed', progress: 0, message: 'Project not found', finished: true };
    }

    switch (data.status) {
      case 'dubbing':
        return { state: 'processing', progress: 30, message: 'Transcribing and translating audio...' };
      case 'cloning':
        return { state: 'processing', progress: 65, message: 'Generating dubbed audio...' };
      case 'dubbed':
        return { state: 'completed', progress: 100, message: 'Dubbing complete!', finished: true, creditsUsed: data.credits_consumed };
      case 'failed':
        return { state: 'failed', progress: 0, message: 'Dubbing failed. Please try again.', finished: true };
      default:
        return { state: 'processing', progress: 15, message: 'Starting...' };
    }
  }

  private async processDub(projectId: string, input: CreateDubInput, userId: string, modalUrl: string): Promise<void> {
    try {
      const mediaBuffer = await fetchVideoAsBuffer(input.mediaUrl);

      const referenceAudio = input.isVideo
        ? await this.extractAudio(mediaBuffer)
        : mediaBuffer;

      const translatedText = await this.transcribeAndTranslate(mediaBuffer, input.isVideo, input.targetLanguage);

      await this.updateStatus(projectId, 'cloning');

      const dubbedAudio = await this.callModalDub(modalUrl, translatedText, referenceAudio);

      const filePath = `dubbed/${projectId}.wav`;
      const { error: uploadError } = await this.supabase.storage
        .from('dubbing_media')
        .upload(filePath, dubbedAudio, { contentType: 'audio/wav', upsert: true });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: urlData } = this.supabase.storage
        .from('dubbing_media')
        .getPublicUrl(filePath);

      const creditsConsumed = calculateDubbingCredits({ externalCreditsUsed: 1 });

      await this.supabase.rpc('update_user_credits', {
        user_uuid: userId,
        credit_change: -creditsConsumed,
      });

      await this.supabase
        .from('dubbing_projects')
        .update({ status: 'dubbed', dubbed_url: urlData.publicUrl, credits_consumed: creditsConsumed })
        .eq('project_id', projectId);

      this.logger.log(`Dubbing complete: ${projectId}`);
    } catch (error) {
      this.logger.error(`Dubbing failed: ${projectId}`, error);
      await this.updateStatus(projectId, 'failed');
    }
  }

  private async updateStatus(projectId: string, status: string) {
    await this.supabase
      .from('dubbing_projects')
      .update({ status })
      .eq('project_id', projectId);
  }

  // --- Gemini transcription + translation ---

  private async transcribeAndTranslate(mediaBuffer: Buffer, isVideo: boolean, targetLanguage: string): Promise<string> {
    const ai = await createGoogleAI(this.configService);
    const mimeType = isVideo ? 'video/mp4' : 'audio/mpeg';

    if (mediaBuffer.length > MAX_INLINE_BYTES) {
      throw new BadRequestException('Media file is too large to process. Please use a shorter or smaller file.');
    }

    // Vertex AI: send media bytes inline (the Files API is not available on Vertex).
    const result = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: `Transcribe the spoken audio from this file, then translate the full transcript into ${targetLanguage}. Return ONLY the translated text as a single continuous paragraph. No timestamps, no formatting, no labels — just the translated text.` },
          { inlineData: { data: mediaBuffer.toString('base64'), mimeType } },
        ],
      }],
    });

    const text = result.text?.trim();
    if (!text) throw new Error('Empty transcription/translation result from Gemini');
    return text;
  }

  // --- Audio extraction (video → audio via ffmpeg) ---

  private async extractAudio(videoBuffer: Buffer): Promise<Buffer> {
    const videoPath = path.join(os.tmpdir(), `vid_${Date.now()}.mp4`);
    const audioPath = path.join(os.tmpdir(), `aud_${Date.now()}.wav`);
    await fs.writeFile(videoPath, videoBuffer);

    try {
      const ffmpeg = configureFFmpeg();
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .noVideo()
          .audioCodec('pcm_s16le')
          .audioFrequency(16000)
          .audioChannels(1)
          .format('wav')
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .save(audioPath);
      });
      return await fs.readFile(audioPath);
    } finally {
      await Promise.allSettled([fs.unlink(videoPath), fs.unlink(audioPath)]);
    }
  }

  // --- Modal VoxCPM API call ---

  private async callModalDub(modalUrl: string, text: string, referenceAudio: Buffer): Promise<Buffer> {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('reference', new Blob([new Uint8Array(referenceAudio)]), 'reference.wav');

    const response = await fetch(`${modalUrl}/dub`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Modal API error ${response.status}: ${errBody}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('audio') || contentType.includes('octet-stream')) {
      return Buffer.from(await response.arrayBuffer());
    }

    const json = await response.json() as Record<string, unknown>;
    for (const key of ['audio_base64', 'audio', 'data']) {
      if (typeof json[key] === 'string') return Buffer.from(json[key] as string, 'base64');
    }

    throw new Error('Unexpected response format from Modal dubbing API');
  }
}
