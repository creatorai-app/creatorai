import { z } from 'zod';
import { isSupportedDubLanguage } from '../consts/dubbing';

// Step 1: ask the API for a signed URL to PUT the source media straight to GCS.
// The API plan-gates and enforces size before issuing the URL.
export const SignDubUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z
    .string()
    .refine((t) => /^(audio|video)\//.test(t), { message: 'Only audio or video files are supported' }),
  fileSize: z.coerce.number().int().positive(),
  // Real boolean only — z.coerce.boolean() would turn the string "false" into true.
  isVideo: z.boolean(),
  // .finite(): a browser that can't read a header reports Infinity for the duration,
  // which JSON.stringify turns into null — reject it here rather than pricing off it.
  durationSeconds: z.coerce.number().positive({ message: 'Duration is required' }).finite(),
});

// Step 2: after the browser uploaded to GCS, create the dubbing job from the
// verified object. No raw URL from the client — the API derives it from objectName.
export const CreateDubSchema = z.object({
  objectName: z.string().min(1, { message: 'objectName is required' }),
  // Checked against the offered list, not just non-empty: the language decides which
  // ElevenLabs backend the worker uses, and an unknown code would pick the wrong one.
  targetLanguage: z
    .string()
    .min(1, { message: 'Target language is required' })
    .refine(isSupportedDubLanguage, { message: 'Unsupported target language' }),
  targetAccent: z.string().max(40).optional(),
  isVideo: z.boolean(),
  mediaName: z.string().min(1, { message: 'Media name is required' }).max(100),
  durationSeconds: z.coerce.number().positive({ message: 'Duration is required' }).finite(),
});

// Output/response schema
export const DubResponseSchema = z.object({
  projectId: z.string(),
  dubbedUrl: z.string().optional(),
  originalMediaUrl: z.string().optional(),
  status: z.enum(['queued', 'processing', 'cloning', 'completed', 'failed']),
  creditsConsumed: z.number().optional(),
  isVideo: z.boolean(),
  createdAt: z.string(),
  targetLanguage: z.string(),
  mediaName: z.string().optional(),
});

export type SignDubUploadInput = z.infer<typeof SignDubUploadSchema>;
export type CreateDubInput = z.infer<typeof CreateDubSchema>;
export type DubResponse = z.infer<typeof DubResponseSchema>;
