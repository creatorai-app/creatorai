// Video generation (Gemini Omni Flash) options and plan gating.
//
// Omni Flash generates ≤10s 720p clips with audio via the Interactions API. It is
// priced PER SECOND of output (~$0.10/s), so — unlike token-billed features — credits
// are duration-based and the feature is gated to paid plans (Pro / Business / Scale).

export const VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const;
export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number];

// Omni caps output at 10s. Expose a small fixed set — never free-typed seconds. The
// processor passes this to the model's video_config and it drives the credit cost.
export const VIDEO_DURATION_SECONDS = [4, 6, 8] as const;
export type VideoDurationSeconds = (typeof VIDEO_DURATION_SECONDS)[number];

export const DEFAULT_VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
export const DEFAULT_VIDEO_DURATION_SECONDS: VideoDurationSeconds = 8;

// The three generation modes surfaced as separate cards in the UI. 'edit' is not a
// user-selected mode — it's the stateful-editing path (previous_interaction_id) reached
// from an already-generated video, so it's kept out of the create-mode enum.
export const VIDEO_GENERATION_MODES = ['text_to_video', 'image_to_video', 'reference_to_video'] as const;
export type VideoGenerationMode = (typeof VIDEO_GENERATION_MODES)[number];
export const DEFAULT_VIDEO_GENERATION_MODE: VideoGenerationMode = 'text_to_video';

// image_to_video uses one guide image; reference_to_video composes up to three subject
// references. Omni ignores >3 references, so cap here and reject early.
export const MAX_VIDEO_REFERENCE_IMAGES = 3;
export const VIDEO_INPUT_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type VideoInputImageMimeType = (typeof VIDEO_INPUT_IMAGE_MIME_TYPES)[number];
// Guard the JSON body: base64 inflates ~33%, so ~7MB of base64 ≈ a ~5MB source image.
export const MAX_VIDEO_INPUT_IMAGE_BASE64_BYTES = 7 * 1024 * 1024;

// Plan gating is by plan NAME — there is no tier column; the active plan is the
// most-recent active `subscriptions` row joined to `plans` (see BillingService).
// Redis key prefix the API sets and the worker polls to cancel an in-flight job.
export const VIDEO_GEN_CANCEL_PREFIX = 'video-generation:cancel:';

export const VIDEO_GENERATION_PLANS = ['pro', 'business', 'scale'] as const;

export function canGenerateVideo(planName?: string | null): boolean {
  if (!planName) return false;
  return VIDEO_GENERATION_PLANS.includes(planName.toLowerCase() as (typeof VIDEO_GENERATION_PLANS)[number]);
}

// How many input images each mode expects — used for both client UX and server validation.
export function requiredImageRange(mode: VideoGenerationMode): { min: number; max: number } {
  switch (mode) {
    case 'image_to_video':
      return { min: 1, max: 1 };
    case 'reference_to_video':
      return { min: 1, max: MAX_VIDEO_REFERENCE_IMAGES };
    case 'text_to_video':
    default:
      return { min: 0, max: 0 };
  }
}
