import { z } from 'zod';
import {
  accentsFor,
  DEFAULT_DUB_VOICE_MODE,
  DUB_ENGINES,
  DUB_KEYTERMS_MAX,
  DUB_VOICE_MODES,
  elevenLabsTargetTag,
  isKnownDubLanguage,
  isSupportedDubLanguage,
  keytermProblem,
  normalizeKeyterms,
} from '../consts/dubbing';

const mediaContentType = z
  .string()
  .refine((t) => /^(audio|video)\//.test(t), { message: 'Only audio or video files are supported' });

// Step 1: register the dub and open its uploads. The API plan-gates, prices and size-checks
// the ORIGINAL file here, before a byte is uploaded, then returns a resumable session for
// the audio track and (for a video) a multipart upload for the original.
export const InitDubUploadSchema = z
  .object({
    filename: z.string().min(1).max(200),
    contentType: mediaContentType,
    fileSize: z.coerce.number().int().positive(),
    // Real boolean only: z.coerce.boolean() would turn the string "false" into true.
    isVideo: z.boolean(),
    // .finite(): a browser that can't read a header reports Infinity for the duration,
    // which JSON.stringify turns into null. Reject it rather than price off it.
    durationSeconds: z.coerce.number().positive({ message: 'Duration is required' }).finite(),
    engine: z.enum(DUB_ENGINES),
    // One output per language. The per-plan count (1 to 3) is enforced by the API, which
    // knows the plan; 3 here is the ceiling on any plan.
    targets: z
      .array(z.object({ language: z.string().min(1), accent: z.string().max(40).optional() }))
      .min(1, { message: 'Pick at least one language' })
      .max(3, { message: 'Pick at most three languages' }),
    mediaName: z.string().min(1, { message: 'Media name is required' }).max(100),
    // name|size|lastModified of the picked file, so a resume can refuse a different file.
    fingerprint: z.string().min(1).max(400),
    audio: z.object({
      contentType: mediaContentType,
      size: z.coerce.number().int().positive(),
      // false: the browser could not pull the audio out, so the whole file is the "audio".
      extracted: z.boolean(),
    }),
    // The language spoken in the source. Omitted means "detect it": ElevenLabs and
    // Gemini both do, and ElevenLabs reports what it found on the source transcript.
    sourceLanguage: z
      .string()
      .min(1)
      .refine(isKnownDubLanguage, { message: 'Unsupported source language' })
      .optional(),
    voiceMode: z.enum(DUB_VOICE_MODES).default(DEFAULT_DUB_VOICE_MODE),
    // Names and terms to keep as they are. Checked one by one against ElevenLabs' rules,
    // then trimmed and deduplicated, so what is stored is exactly what is sent.
    keyterms: z
      .array(z.string().max(200))
      .max(DUB_KEYTERMS_MAX * 2, { message: `Add at most ${DUB_KEYTERMS_MAX} names and terms` })
      .superRefine((terms, ctx) => {
        terms.forEach((term, i) => {
          const problem = term.trim() ? keytermProblem(term) : null;
          if (problem) ctx.addIssue({ code: 'custom', path: [i], message: problem });
        });
      })
      .transform(normalizeKeyterms)
      .refine((terms) => terms.length <= DUB_KEYTERMS_MAX, { message: `Add at most ${DUB_KEYTERMS_MAX} names and terms` })
      .optional(),
  })
  .superRefine((input, ctx) => {
    const seen = new Set<string>();
    input.targets.forEach(({ language, accent }, i) => {
      // Checked against the chosen engine: Cypher speaks fewer languages than ElevenLabs.
      if (!isSupportedDubLanguage(language, input.engine)) {
        ctx.addIssue({ code: 'custom', path: ['targets', i, 'language'], message: 'Unsupported target language' });
      }
      if (seen.has(language)) {
        ctx.addIssue({ code: 'custom', path: ['targets', i, 'language'], message: 'Each language can be picked once' });
      }
      seen.add(language);
      if (accent && !accentsFor(language, input.engine).some((a) => a.value === accent)) {
        ctx.addIssue({ code: 'custom', path: ['targets', i, 'accent'], message: 'Unsupported accent' });
      }
      // Dubbing a language into itself is not a dub. Compared on what would actually be
      // asked for, so Chinese with the Cantonese dialect counts as Cantonese.
      if (input.sourceLanguage && [language, elevenLabsTargetTag(language, accent)].includes(input.sourceLanguage)) {
        ctx.addIssue({ code: 'custom', path: ['targets', i, 'language'], message: 'Pick a target other than the source language' });
      }
    });
  });

export const DubVideoPartSchema = z.object({
  partNumber: z.coerce.number().int().min(1).max(1000),
});

export const DubAudioSessionSchema = z.object({
  size: z.coerce.number().int().positive().optional(),
});

export const DUB_STATUSES = ['uploading', 'queued', 'processing', 'cloning', 'awaiting_video', 'completed', 'failed'] as const;
export const DUB_OUTPUT_STATUSES = ['pending', 'dubbing', 'awaiting_video', 'completed', 'failed'] as const;

/**
 * One line of a dub's timeline, the same shape whichever engine made it: Cypher fills it
 * from its own analysis, translation and placements, ElevenLabs from its source and
 * target transcripts. Times are seconds from the start of the source. `dubStart` and
 * `dubEnd` are where the dubbed line actually plays when that differs (Cypher only).
 * `id` is stable per line (ElevenLabs' segment id, or the Cypher line index), which is
 * what editing a line would address later.
 */
export const DubTimelineSegmentSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  start: z.number(),
  end: z.number(),
  sourceText: z.string(),
  translation: z.string().nullable(),
  dubStart: z.number().optional(),
  dubEnd: z.number().optional(),
});

/**
 * Something about a finished dub worth telling the user. Today only ElevenLabs'
 * `voices_not_permitted`: those speakers were dubbed in a replacement voice.
 */
export const DubWarningSchema = z.object({
  type: z.string(),
  speakerIds: z.array(z.string()).optional(),
  message: z.string().optional(),
});

/** One language of a dub. */
export const DubOutputSchema = z.object({
  language: z.string(),
  accent: z.string().nullish(),
  status: z.enum(DUB_OUTPUT_STATUSES),
  dubbedUrl: z.string().nullish(),
  dubbedAudioUrl: z.string().nullish(),
  segmentsDone: z.number(),
  segmentCount: z.number().nullish(),
  creditsConsumed: z.number(),
  errorMessage: z.string().nullish(),
  timeline: z.array(DubTimelineSegmentSchema).nullish(),
  warnings: z.array(DubWarningSchema).nullish(),
});

export const DubResponseSchema = z.object({
  projectId: z.string(),
  // null on dubs made before the engine choice existed.
  engine: z.enum(DUB_ENGINES).nullish(),
  status: z.enum(DUB_STATUSES),
  videoStatus: z.enum(['uploading', 'uploaded']).nullish(),
  // Cypher only: how many distinct voices the speaker analysis found.
  speakerCount: z.number().nullish(),
  originalMediaUrl: z.string().nullish(),
  jobId: z.string().nullish(),
  errorMessage: z.string().nullish(),
  creditsConsumed: z.number().nullish(),
  isVideo: z.boolean(),
  createdAt: z.string(),
  mediaName: z.string().nullish(),
  // Null when the source language was left to be detected.
  sourceLanguage: z.string().nullish(),
  voiceMode: z.enum(DUB_VOICE_MODES).nullish(),
  keyterms: z.array(z.string()).nullish(),
  outputs: z.array(DubOutputSchema),
});

export type InitDubUploadInput = z.infer<typeof InitDubUploadSchema>;
export type DubVideoPartInput = z.infer<typeof DubVideoPartSchema>;
export type DubAudioSessionInput = z.infer<typeof DubAudioSessionSchema>;
export type DubOutput = z.infer<typeof DubOutputSchema>;
export type DubResponse = z.infer<typeof DubResponseSchema>;
export type DubStatus = DubResponse['status'];
export type DubOutputStatus = DubOutput['status'];
export type DubTarget = InitDubUploadInput['targets'][number];
export type DubTimelineSegment = z.infer<typeof DubTimelineSegmentSchema>;
export type DubWarning = z.infer<typeof DubWarningSchema>;

/** What a resume needs: how far each upload got, straight from GCS. */
export interface DubUploadState {
  projectId: string;
  status: DubStatus;
  fingerprint: string | null;
  audio: {
    size: number;
    extracted: boolean;
    uploadedBytes: number;
    complete: boolean;
  };
  video: {
    size: number;
    partSize: number;
    partCount: number;
    uploadedParts: number[];
    status: 'uploading' | 'uploaded';
  } | null;
}

/** Returned by init: where the browser sends each file. */
export interface DubUploadTargets {
  projectId: string;
  audio: { sessionUri: string };
  video: { partSize: number; partCount: number } | null;
}
