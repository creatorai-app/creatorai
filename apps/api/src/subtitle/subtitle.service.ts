import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  type CreateSubtitleInput,
  type UpdateSubtitleInput,
  type UpdateSubtitleByIdInput,
  type SignUploadInput,
  type FinalizeUploadInput,
  type BurnSubtitleInput,
  calculateSubtitleCredits,
  hasEnoughCredits,
  getMinimumCreditsForSubtitleRequest,
  SUBTITLE_CREDIT_MULTIPLIER,
  TOKENS_PER_CREDIT,
  convertJsonToSrt,
  subtitleUploadLimitBytes,
  subtitleMaxDurationSeconds,
  formatUploadLimit,
} from '@repo/validation';
import {
  createGoogleAI,
  GEMINI_TEXT_MODEL,
  getMimeTypeFromUrl,
  configureFFmpeg,
  streamVideoToFile,
  getSignedUploadUrl,
  gcsPublicUrl,
  gcsUri,
  gcsObjectMetadata,
  deleteGcsObject,
} from '../utils';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

@Injectable()
export class SubtitleService {
  private readonly logger = new Logger(SubtitleService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private async logErrorToDB(message: string, subtitleId: string) {
    if (!subtitleId) return;
    try {
      await this.supabaseService.getClient()
        .from("subtitle_jobs")
        .update({
          status: "error",
          error_message: message.slice(0, 5000)
        })
        .eq("id", subtitleId);
    } catch (dbError) {
      this.logger.error('Failed to record error in DB', dbError);
    }
  }

  private sanitizeFileName(value: string): string {
    return value.replace(/[^\w.\-]/g, '_');
  }

  async create(input: CreateSubtitleInput, userId: string) {
    const { subtitleId, language, targetLanguage, duration } = input;

    try {
      const { data: profileData, error: profileError } = await this.supabaseService.getClient()
        .from('profiles')
        .select('credits, ai_trained, youtube_connected')
        .eq('user_id', userId)
        .single();

      if (profileError || !profileData) {
        await this.logErrorToDB('Profile not found or profile fetch failed', subtitleId);
        throw new NotFoundException('Profile not found');
      }

      if (!profileData.ai_trained && !profileData.youtube_connected) {
        await this.logErrorToDB('AI training and YouTube connection are required', subtitleId);
        throw new ForbiddenException('AI training and YouTube connection are required');
      }

      const subtitleMultiplier = this.getEnvNumber(
        'SUBTITLE_CREDIT_MULTIPLIER',
        SUBTITLE_CREDIT_MULTIPLIER,
      );
      const tokensPerCredit = this.getEnvNumber('TOKENS_PER_CREDIT', TOKENS_PER_CREDIT);
      const minCredits = getMinimumCreditsForSubtitleRequest(subtitleMultiplier);
      if (!hasEnoughCredits(profileData.credits, minCredits)) {
        await this.logErrorToDB('Insufficient credits', subtitleId);
        throw new ForbiddenException('Insufficient credits. Please upgrade your plan or earn more credits.');
      }

      const { data: subtitle, error: subtitleError } = await this.supabaseService.getClient()
        .from('subtitle_jobs')
        .select('video_url, video_gs_uri')
        .eq('user_id', userId)
        .eq('id', subtitleId)
        .single();

      if ((subtitleError && subtitleError.code !== 'PGRST116') || !subtitle?.video_gs_uri) {
        await this.logErrorToDB('Subtitle lookup failed or video_gs_uri missing', subtitleId);
        throw new NotFoundException('Subtitle lookup error');
      }

      const video_url = subtitle.video_url;
      const video_gs_uri = subtitle.video_gs_uri;
      const ai = await createGoogleAI(this.configService);

      const isAutoDetect = !language || language.toLowerCase() === 'auto detect' || language.toLowerCase() === 'auto';
      const languageInstruction = isAutoDetect
        ? "Automatically detect the language being spoken and transcribe in that language."
        : `Transcribe the audio in ${language}.`;

      const hasTargetLanguage = targetLanguage && targetLanguage.toLowerCase() !== 'none' && targetLanguage.toLowerCase() !== 'same';
      const targetLanguageInstruction = hasTargetLanguage
        ? `After transcription, translate all subtitle text to ${targetLanguage}. Maintain the same timestamps but provide the translated text.`
        : "Provide subtitles in the original/detected language without translation.";

      const prompt = `
You are an expert, highly-accurate subtitle transcription service.
Your task is to transcribe the provided audio file and generate precise, time-stamped subtitles.

**LANGUAGE INSTRUCTION:** ${languageInstruction}

**TARGET LANGUAGE INSTRUCTION:** ${targetLanguageInstruction}

**CRITICAL RULES:**
1.  **Format:** Your entire response MUST be a valid JSON object with two keys: "detected_language" (string) and "subtitles" (array). Do NOT include any text, headers, or markdown formatting (like \`\`\`json) before or after the object.
2.  **Language Detection:** The "detected_language" field MUST contain the full name of the language detected in the audio (e.g., "English", "Spanish", "Hindi", "French", etc.).
3.  **Translation:** ${hasTargetLanguage ? `Translate all subtitle text to ${targetLanguage} while keeping timestamps accurate. The subtitle text should be in ${targetLanguage}, not the original language.` : 'Provide subtitles in the detected/original language.'}
4.  **Timestamps:** Timestamps MUST be in the exact \`HH:MM:SS.mmm\` format (hours:minutes:seconds.milliseconds).
5.  **Punctuation:** Include correct punctuation (commas, periods, question marks) for readability.
6.  **Silence:** Do NOT generate subtitle entries for periods of silence.
7.  **Non-Speech:** (Optional) Transcribe significant non-speech sounds in brackets, e.g., [MUSIC], [LAUGHTER], [APPLAUSE].
8.  **Accuracy:** Transcribe the audio verbatim. Do not paraphrase or correct the speaker's grammar. ${hasTargetLanguage ? `When translating, maintain the meaning and tone of the original speech.` : ''}
9.  **SUBTITLE LENGTH:** Keep each subtitle entry SHORT and concise. Each subtitle should contain a maximum of 1-2 short sentences or 5-10 words. Break longer sentences into multiple subtitle entries with appropriate timestamps. This ensures subtitles are readable and don't cover the entire screen. Think of comfortable reading speed - viewers should be able to read the subtitle in 2-3 seconds.

10. **Title:** Generate a short, descriptive title (max 60 characters) summarizing the main topic of the video based on the transcribed content. The title should be concise and meaningful.

**Output Example:**
{
  "detected_language": "English",
  "title": "Introduction to Machine Learning Basics",
  "subtitles": [
    { "start": "00:00:01.200", "end": "00:00:04.100", "text": "${hasTargetLanguage ? `[Translated text in ${targetLanguage}]` : 'Hello everyone, and welcome.'}" },
    { "start": "00:00:04.350", "end": "00:00:07.000", "text": "${hasTargetLanguage ? `[Translated text in ${targetLanguage}]` : 'Today we\'re going to discuss...'}" },
    { "start": "00:00:07.100", "end": "00:00:08.000", "text": "[MUSIC]" }
  ]
}
`;

      const fileType = getMimeTypeFromUrl(video_url);

      // Vertex AI reads the media directly from GCS via its gs:// URI (no inline bytes,
      // no Files API). This lifts the old ~50MB inline ceiling to GCS's 2GB object limit.
      const parts = [
        { text: prompt },
        {
          fileData: {
            fileUri: video_gs_uri,
            mimeType: fileType,
          },
        },
      ];

      let result: any;
      try {
        result = await ai.models.generateContent({
          model: GEMINI_TEXT_MODEL,
          contents: [{ role: "user", parts }],
        });
      } catch (geminiError) {
        this.logger.error('Gemini API error', geminiError);
        await this.logErrorToDB(`Gemini API error: ${geminiError}`, subtitleId);
        throw new InternalServerErrorException('Failed to generate subtitles from Gemini API');
      }

      let subtitlesData;
      try {
        const rawText = result.text;
        const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        subtitlesData = JSON.parse(cleanedText);

        if (!subtitlesData.detected_language || !subtitlesData.subtitles || !subtitlesData.title) {
          throw new Error('Invalid response structure from Gemini');
        }
      } catch (parseError) {
        await this.logErrorToDB(`Failed to parse Gemini JSON: ${String(parseError)}`, subtitleId);
        this.logger.error('Failed to parse JSON from Gemini', parseError);
        throw new InternalServerErrorException('Failed to parse subtitle data');
      }

      const subtitlesJson = subtitlesData.subtitles;
      const detectedLanguage = subtitlesData.detected_language;
      const generatedTitle = (subtitlesData.title as string)?.slice(0, 60);

      const { data, error: subtitleInsertError } = await this.supabaseService.getClient()
        .from("subtitle_jobs")
        .update({
          subtitles_json: subtitlesJson,
          status: "done",
          language: language,
          detected_language: detectedLanguage,
          target_language: targetLanguage,
          duration: duration,
          title: generatedTitle,
        })
        .eq("id", subtitleId)
        .eq("user_id", userId)
        .select()
        .single();

      if (subtitleInsertError) {
        await this.logErrorToDB(`Failed to update subtitles: ${subtitleInsertError.message}`, subtitleId);
        throw new InternalServerErrorException('Failed to update subtitles');
      }

      const totalTokens = result?.usageMetadata?.totalTokenCount ?? 0;
      const creditsConsumed = calculateSubtitleCredits(
        { totalTokens },
        { tokensPerCredit, multiplier: subtitleMultiplier },
      );

      if (!hasEnoughCredits(profileData.credits, creditsConsumed)) {
        await this.logErrorToDB('Insufficient credits for token usage', subtitleId);
        throw new ForbiddenException('Insufficient credits for this operation.');
      }

      const { error: updateError } = await this.supabaseService.getClient()
        .rpc('update_user_credits', {
          user_uuid: userId,
          credit_change: -creditsConsumed,
        });

      if (updateError) {
        this.logger.error('Error updating credits', updateError);
        if (updateError.message?.includes('Insufficient credits')) {
          throw new ForbiddenException('Insufficient credits for this operation.');
        }
        throw new InternalServerErrorException('Failed to update credits');
      }

      await this.supabaseService.getClient()
        .from('subtitle_jobs')
        .update({ credits_consumed: creditsConsumed, total_tokens: totalTokens })
        .eq('id', subtitleId);

      return {
        success: true,
        detected_language: detectedLanguage,
        target_language: hasTargetLanguage ? targetLanguage : detectedLanguage,
        creditsConsumed,
        totalTokens,
      };
    } catch (error) {
      throw error;
    }
  }

  async findAll(userId: string) {
    const { data: subtitleData, error: subtitleError } = await this.supabaseService.getClient()
      .from('subtitle_jobs')
      .select("*")
      .eq("user_id", userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (subtitleError) {
      throw new InternalServerErrorException('Error fetching subtitle');
    }

    return subtitleData;
  }

  async findOne(id: string, userId: string) {
    const { data: subtitleData, error: subtitleError } = await this.supabaseService.getClient()
      .from('subtitle_jobs')
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (subtitleError) {
      if (subtitleError.code === 'PGRST116') {
        throw new NotFoundException('Subtitle not found');
      }
      throw new InternalServerErrorException('Error fetching subtitle');
    }

    return {
      success: true,
      subtitle: subtitleData
    };
  }

  async update(input: UpdateSubtitleInput, userId: string) {
    const { subtitle_json, subtitle_id } = input;

    if (!Array.isArray(subtitle_json)) {
      throw new BadRequestException('Invalid subtitle format');
    }

    const srtContent = convertJsonToSrt(subtitle_json);

    const { error: updateError } = await this.supabaseService.getClient()
      .from("subtitle_jobs")
      .update({
        subtitles_json: subtitle_json
      })
      .eq("id", subtitle_id)
      .eq("user_id", userId);

    if (updateError) {
      this.logger.error('Failed to update subtitles', updateError);
      throw new InternalServerErrorException('Failed to update subtitles');
    }

    return {
      success: true,
      message: 'Subtitles updated successfully',
      subtitles: subtitle_json,
      srt: srtContent
    };
  }

  async remove(id: string, userId: string) {
    try {
      const { data: subtitleData, error: subtitleError } = await this.supabaseService.getClient()
        .from('subtitle_jobs')
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select('video_gs_uri')
        .single();

      if (subtitleError && subtitleError.code !== 'PGRST116') {
        this.logger.error('Subtitle lookup error', subtitleError);
        throw new NotFoundException('Subtitle lookup error');
      }

      if (subtitleData?.video_gs_uri) {
        // gs://bucket/<objectName> → <objectName>
        const objectName = subtitleData.video_gs_uri.split('/').slice(3).join('/');
        if (objectName) {
          await deleteGcsObject(this.configService, objectName).catch((e) =>
            this.logger.error(`Failed to delete GCS object ${objectName}`, e),
          );
        }
      }

      return {
        success: true,
        message: 'Subtitle removed successfully',
      };

    } catch (error) {
      throw new InternalServerErrorException('Error removing subtitle');
    }

  }

  async updateSubtitles(id: string, input: UpdateSubtitleByIdInput, userId: string) {
    const { subtitle_json } = input;
    if (!Array.isArray(subtitle_json)) {
      throw new BadRequestException('Invalid subtitle format');
    }
    const srtContent = convertJsonToSrt(subtitle_json);
    const { error: updateError } = await this.supabaseService.getClient()
      .from("subtitle_jobs")
      .update({ subtitles_json: subtitle_json })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) {
      this.logger.error('Failed to update subtitles', updateError);
      throw new InternalServerErrorException('Failed to update subtitles');
    }
    return {
      success: true,
      message: 'Subtitles updated successfully',
      subtitles: subtitle_json,
      srt: srtContent
    };
  }

  /**
   * Plan-based upload limits. Starter (free) is throttled on BOTH size (100MB) and
   * duration (10 min); paid plans get 2GB and the 45-min Gemini ceiling.
   *
   * The active plan is the most-recent active subscription (same source as getBillingInfo /
   * the billing UI). `subscriptions` is the single source of truth for the current plan —
   * there is no plan column on `profiles`.
   */
  private async getUploadLimits(userId: string): Promise<{ maxBytes: number; maxDurationSeconds: number; isPaid: boolean }> {
    const { data: subscription } = await this.supabaseService.getClient()
      .from('subscriptions')
      .select('plans(price_monthly)')
      .eq('user_id', userId)
      .in('status', ['active', 'on_trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const priceMonthly = Number((subscription?.plans as { price_monthly?: number } | null)?.price_monthly ?? 0);
    const isPaid = priceMonthly > 0;

    return {
      maxBytes: subtitleUploadLimitBytes(isPaid),
      maxDurationSeconds: subtitleMaxDurationSeconds(isPaid),
      isPaid,
    };
  }

  /** Exposed so the uploader can show the correct limits and pre-validate before uploading. */
  async getUploadLimit(userId: string) {
    const { maxBytes, maxDurationSeconds } = await this.getUploadLimits(userId);
    return { success: true, maxBytes, maxDurationSeconds };
  }

  // isUpgradeable: free plans can lift the cap by upgrading; paid plans are at the
  // Gemini ceiling, so phrase the rejection as a hard maximum, not an upsell.
  private parseDuration(duration: string, maxDurationSeconds: number, isUpgradeable: boolean): number {
    const parsed = parseFloat(duration);
    if (isNaN(parsed)) {
      throw new BadRequestException('Invalid duration format');
    }
    if (parsed > maxDurationSeconds) {
      const mins = Math.round(maxDurationSeconds / 60);
      throw new BadRequestException(
        isUpgradeable
          ? `Video duration exceeds ${mins} minutes on your current plan. Please upgrade to upload longer videos.`
          : `Video duration exceeds the maximum supported length of ${mins} minutes.`,
      );
    }
    return parsed;
  }

  private uploadSizeError(maxBytes: number, isUpgradeable: boolean): PayloadTooLargeException {
    return new PayloadTooLargeException(
      isUpgradeable
        ? `This video exceeds your plan's ${formatUploadLimit(maxBytes)} upload limit. Please upgrade to upload larger videos.`
        : `This video exceeds the maximum ${formatUploadLimit(maxBytes)} upload size.`,
    );
  }

  /**
   * Step 1: issue a signed URL the browser PUTs the file straight to GCS with — the
   * API server never touches the bytes, so multi-GB uploads don't blow up its memory.
   */
  async signUpload(input: SignUploadInput, userId: string) {
    const { filename, contentType, fileSize, duration } = input;

    if (!/^video\//.test(contentType)) {
      throw new BadRequestException('Unsupported video format. Please upload a valid video file.');
    }

    // Reject oversize / over-length BEFORE issuing the URL, so a throttled plan wastes no upload.
    const { maxBytes, maxDurationSeconds, isPaid } = await this.getUploadLimits(userId);
    this.parseDuration(duration, maxDurationSeconds, !isPaid);
    if (fileSize > maxBytes) {
      throw this.uploadSizeError(maxBytes, !isPaid);
    }

    const safeOriginalName = this.sanitizeFileName(filename);
    const objectName = `${userId}/${Date.now()}_${safeOriginalName}`;

    const uploadUrl = await getSignedUploadUrl(this.configService, objectName, contentType);
    return { success: true, uploadUrl, objectName, contentType };
  }

  /**
   * Step 2: after the browser uploads, verify the object's REAL size server-side
   * (the signed URL can't enforce it), then create the job. Rejects + deletes oversize.
   */
  async finalizeUpload(input: FinalizeUploadInput, userId: string) {
    const { objectName, filename, duration, scriptId } = input;

    // Prevent finalizing someone else's object — the signed URL was scoped to this prefix.
    if (!objectName.startsWith(`${userId}/`)) {
      throw new ForbiddenException('Object does not belong to user');
    }

    const { maxBytes, maxDurationSeconds, isPaid } = await this.getUploadLimits(userId);
    const parsedDuration = this.parseDuration(duration, maxDurationSeconds, !isPaid);

    let size: number;
    try {
      ({ size } = await gcsObjectMetadata(this.configService, objectName));
    } catch {
      throw new BadRequestException('Uploaded file not found in storage');
    }

    // Re-check the REAL size against the plan limit — the signed URL can't enforce it,
    // and the size sent at sign time was unverified.
    if (size > maxBytes) {
      await deleteGcsObject(this.configService, objectName).catch(() => null);
      throw this.uploadSizeError(maxBytes, !isPaid);
    }

    const publicUrl = gcsPublicUrl(this.configService, objectName);
    const gsUri = gcsUri(this.configService, objectName);

    const { data, error: subtitleInsertError } = await this.supabaseService
      .getClient()
      .from('subtitle_jobs')
      .insert({
        user_id: userId,
        video_path: publicUrl,
        video_url: publicUrl,
        video_gs_uri: gsUri,
        duration: parsedDuration,
        filename: filename,
        script_id: scriptId || null,
      })
      .select()
      .single();

    if (subtitleInsertError) {
      await deleteGcsObject(this.configService, objectName).catch(() => null);
      this.logger.error(
        `Subtitle job creation failed after upload: userId=${userId}, message=${subtitleInsertError.message}, code=${subtitleInsertError.code ?? 'n/a'}`,
      );
      throw new InternalServerErrorException('Failed to create subtitle job');
    }

    return { success: true, subtitleId: data.id };
  }

  /**
   * Burns subtitles into the video and returns the output file path plus a cleanup fn.
   * Returns a path (not a Buffer) so the controller can STREAM a multi-GB result back
   * instead of loading it all into RAM. Caller MUST call cleanup() when done streaming.
   */
  async burnSubtitle(input: BurnSubtitleInput): Promise<{ outputPath: string; cleanup: () => Promise<void> }> {
    const { videoUrl, subtitles } = input;

    const tmpDir = path.join(os.tmpdir(), 'video_processing');
    await fs.mkdir(tmpDir, { recursive: true });

    const videoPath = path.join(tmpDir, `input_${Date.now()}.mp4`);
    const srtPath = path.join(tmpDir, `subs_${Date.now()}.srt`);
    const outputPath = path.join(tmpDir, `output_${Date.now()}.mp4`);

    const cleanupSources = () =>
      Promise.allSettled([
        fs.unlink(videoPath).catch(() => null),
        fs.unlink(srtPath).catch(() => null),
      ]);
    const cleanup = async () => {
      await Promise.allSettled([cleanupSources(), fs.unlink(outputPath).catch(() => null)]);
    };

    try {
      // Stream the source to disk instead of buffering it — a 2GB video would OOM the server.
      await streamVideoToFile(videoUrl, videoPath);
      const srtContent = convertJsonToSrt(subtitles);
      await fs.writeFile(srtPath, srtContent, 'utf-8');

      const ffmpeg = configureFFmpeg();

      const safeSubtitlePath = srtPath
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:');

      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions(['-c:v', 'libx264', '-c:a', 'copy'])
          .videoFilter(`subtitles='${safeSubtitlePath}'`)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      });

      await cleanupSources(); // output stays until the controller streams it
      return { outputPath, cleanup };
    } catch (error) {
      await cleanup();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to burn subtitles: ${errorMessage}`);
      if (errorMessage.includes('ENOENT') || errorMessage.toLowerCase().includes('ffmpeg')) {
        throw new InternalServerErrorException(
          'Video processing dependency is missing (FFmpeg). Please contact support or try again later.',
        );
      }
      throw new InternalServerErrorException('Failed to process video with subtitles');
    }
  }

  private getEnvNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
