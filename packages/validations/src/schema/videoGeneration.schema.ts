import { z } from 'zod';
import {
  VIDEO_ASPECT_RATIOS,
  VIDEO_DURATION_SECONDS,
  VIDEO_GENERATION_MODES,
  VIDEO_INPUT_IMAGE_MIME_TYPES,
  MAX_VIDEO_REFERENCE_IMAGES,
  MAX_VIDEO_INPUT_IMAGE_BASE64_BYTES,
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_GENERATION_MODE,
  requiredImageRange,
} from '../consts/videoGeneration';

// A single input image passed inline as base64 (no separate upload round-trip — source
// images are small). `data` is the raw base64 payload WITHOUT the data-URL prefix.
export const VideoInputImageSchema = z.object({
  data: z
    .string()
    .min(1, 'Image data is required')
    .max(MAX_VIDEO_INPUT_IMAGE_BASE64_BYTES, 'Image is too large (max ~5MB)'),
  mimeType: z.enum(VIDEO_INPUT_IMAGE_MIME_TYPES),
});
export type VideoInputImage = z.infer<typeof VideoInputImageSchema>;

export const CreateVideoGenerationSchema = z
  .object({
    prompt: z
      .string()
      .min(3, 'Prompt must be at least 3 characters')
      .max(2000, 'Prompt must not exceed 2000 characters'),
    mode: z.enum(VIDEO_GENERATION_MODES).default(DEFAULT_VIDEO_GENERATION_MODE),
    aspectRatio: z.enum(VIDEO_ASPECT_RATIOS).default(DEFAULT_VIDEO_ASPECT_RATIO),
    durationSeconds: z.coerce
      .number()
      .int()
      .refine((n) => (VIDEO_DURATION_SECONDS as readonly number[]).includes(n), {
        message: `Duration must be one of: ${VIDEO_DURATION_SECONDS.join(', ')} seconds`,
      })
      .default(DEFAULT_VIDEO_DURATION_SECONDS),
    images: z.array(VideoInputImageSchema).max(MAX_VIDEO_REFERENCE_IMAGES).optional().default([]),
    scriptId: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    // Each mode has a hard image-count contract — enforce it server-side, not just in the UI.
    const { min, max } = requiredImageRange(val.mode);
    const count = val.images?.length ?? 0;
    if (count < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images'],
        message:
          val.mode === 'image_to_video'
            ? 'Image-to-video needs one source image.'
            : 'Reference-to-video needs at least one reference image.',
      });
    }
    if (count > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images'],
        message: max === 0 ? 'Text-to-video does not take images.' : `At most ${max} images allowed.`,
      });
    }
  });

export type CreateVideoGenerationInput = z.infer<typeof CreateVideoGenerationSchema>;

// Stateful editing: refine an already-generated clip in-place via the model's
// previous_interaction_id. The target job is a path param; this is just the instruction.
export const EditVideoGenerationSchema = z.object({
  instruction: z
    .string()
    .min(3, 'Edit instruction must be at least 3 characters')
    .max(2000, 'Edit instruction must not exceed 2000 characters'),
});
export type EditVideoGenerationInput = z.infer<typeof EditVideoGenerationSchema>;

// "Surprise me" prompt generator — optional seed nudge for variety across clicks.
export const SurpriseVideoPromptSchema = z.object({
  mode: z.enum(VIDEO_GENERATION_MODES).default(DEFAULT_VIDEO_GENERATION_MODE),
});
export type SurpriseVideoPromptInput = z.infer<typeof SurpriseVideoPromptSchema>;
