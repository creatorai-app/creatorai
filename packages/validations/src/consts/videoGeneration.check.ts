/**
 * Runnable self-check for the video-generation pure logic. No framework.
 *   npx tsx packages/validations/src/consts/videoGeneration.check.ts
 */
import assert from 'node:assert';
import { canGenerateVideo, VIDEO_GENERATION_PLANS, requiredImageRange } from './videoGeneration';
import { calculateVideoGenerationCredits, getMinimumCreditsForVideoGeneration } from './credits';
import { CreateVideoGenerationSchema, EditVideoGenerationSchema } from '../schema/videoGeneration.schema';

// Plan gating: Pro/Business/Scale, case-insensitive, null-safe.
assert.equal(canGenerateVideo('Pro'), true);
assert.equal(canGenerateVideo('Business'), true);
assert.equal(canGenerateVideo('scale'), true);
assert.equal(canGenerateVideo('Starter'), false);
assert.equal(canGenerateVideo(null), false);
assert.equal(canGenerateVideo(undefined), false);
assert.deepEqual([...VIDEO_GENERATION_PLANS], ['pro', 'business', 'scale']);

// Per-mode image contracts.
assert.deepEqual(requiredImageRange('text_to_video'), { min: 0, max: 0 });
assert.deepEqual(requiredImageRange('image_to_video'), { min: 1, max: 1 });
assert.deepEqual(requiredImageRange('reference_to_video'), { min: 1, max: 3 });

// Duration-based credits: cost = ceil(seconds) × multiplier (default 85 ⇒ 8s = 680), floored at one second.
assert.equal(calculateVideoGenerationCredits(8), 680);
assert.equal(calculateVideoGenerationCredits(4), 340);
assert.equal(calculateVideoGenerationCredits(0), 85); // floor: never free
assert.equal(calculateVideoGenerationCredits(7.2), 680); // rounds up
assert.equal(getMinimumCreditsForVideoGeneration(), 85);

// Schema: applies defaults, rejects an out-of-set duration.
const parsed = CreateVideoGenerationSchema.parse({ prompt: 'a cat surfing' });
assert.equal(parsed.mode, 'text_to_video');
assert.equal(parsed.aspectRatio, '16:9');
assert.equal(parsed.durationSeconds, 8);
assert.equal(CreateVideoGenerationSchema.safeParse({ prompt: 'x y z', durationSeconds: 5 }).success, false);
assert.equal(CreateVideoGenerationSchema.safeParse({ prompt: 'ab' }).success, false); // min length 3

// Per-mode image validation.
const img = { data: 'AAAA', mimeType: 'image/png' as const };
assert.equal(CreateVideoGenerationSchema.safeParse({ prompt: 'a cat', mode: 'text_to_video', images: [img] }).success, false);
assert.equal(CreateVideoGenerationSchema.safeParse({ prompt: 'a cat', mode: 'image_to_video', images: [] }).success, false);
assert.equal(CreateVideoGenerationSchema.safeParse({ prompt: 'a cat', mode: 'image_to_video', images: [img] }).success, true);
assert.equal(CreateVideoGenerationSchema.safeParse({ prompt: 'a cat', mode: 'reference_to_video', images: [img, img, img, img] }).success, false);

// Edit instruction min length.
assert.equal(EditVideoGenerationSchema.safeParse({ instruction: 'x' }).success, false);
assert.equal(EditVideoGenerationSchema.safeParse({ instruction: 'make it night' }).success, true);

// eslint-disable-next-line no-console
console.log('video-generation self-check OK');
