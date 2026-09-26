import { z } from 'zod';

export const THUMBNAIL_RATIOS = ['16:9', '9:16', '1:1', '4:3'] as const;

// The source a thumbnail request came from — a script, a story blueprint, or one
// idea inside an ideation job. Shared by /generate and /surprise so both resolve
// the same server-side content context.
const ThumbnailSourceShape = {
  scriptId: z.string().uuid().optional(),
  storyBuilderId: z.string().uuid().optional(),
  ideationId: z.string().uuid().optional(),
  ideaIndex: z.coerce.number().int().min(0).optional(),
};

export const CreateThumbnailSchema = z.object({
  prompt: z
    .string()
    .min(3, 'Prompt must be at least 3 characters')
    .max(2000, 'Prompt must not exceed 2000 characters'),
  context: z
    .string()
    .max(2000, 'Context must not exceed 2000 characters')
    .optional()
    .or(z.literal('')),
  ratio: z.enum(THUMBNAIL_RATIOS).default('16:9'),
  generateCount: z.coerce.number().int().min(1).max(5).default(3),
  videoLink: z.string().url('Invalid video URL').optional().or(z.literal('')),
  personalized: z.coerce.boolean().optional().default(true),
  ...ThumbnailSourceShape,
});

// "Surprise me" prompt generator — seeded by the source the creator came from
// plus whatever they typed into Additional Context.
export const SurpriseThumbnailPromptSchema = z.object({
  context: z.string().max(2000).optional().or(z.literal('')),
  ...ThumbnailSourceShape,
});

export type ThumbnailRatio = (typeof THUMBNAIL_RATIOS)[number];
export type CreateThumbnailInput = z.infer<typeof CreateThumbnailSchema>;
export type SurpriseThumbnailPromptInput = z.infer<typeof SurpriseThumbnailPromptSchema>;
