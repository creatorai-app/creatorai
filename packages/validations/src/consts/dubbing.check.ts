/**
 * Runnable self-check for the dubbing pure logic. No framework.
 *   npx tsx packages/validations/src/consts/dubbing.check.ts
 */
import assert from 'node:assert';
import { canDub, DUBBING_PLANS, DUBBING_CANCEL_PREFIX } from './dubbing';
import {
  calculateDubbingCreditsByDuration,
  getMinimumCreditsForDubbing,
  DUBBING_CREDIT_MULTIPLIER,
} from './credits';
import { SignDubUploadSchema, CreateDubSchema } from '../schema/dubbing.schema';

// Plan gating: every paid plan, only Starter excluded; case-insensitive, null-safe.
assert.equal(canDub('Creator'), true);
assert.equal(canDub('pro'), true);
assert.equal(canDub('Business'), true);
assert.equal(canDub('SCALE'), true);
assert.equal(canDub('Starter'), false);
assert.equal(canDub(null), false);
assert.equal(canDub(undefined), false);
assert.equal(canDub(''), false);
assert.deepEqual([...DUBBING_PLANS], ['creator', 'pro', 'business', 'scale']);

// Duration-based credits: cost = ceil(seconds) × multiplier, floored at one second.
assert.equal(calculateDubbingCreditsByDuration(60, 15), 900);
assert.equal(calculateDubbingCreditsByDuration(59.2, 15), 900); // rounds up
assert.equal(calculateDubbingCreditsByDuration(0, 15), 15); // floor: never free
assert.equal(calculateDubbingCreditsByDuration(1, 15), 15);
assert.equal(getMinimumCreditsForDubbing(15), 15);
assert.equal(getMinimumCreditsForDubbing(), DUBBING_CREDIT_MULTIPLIER);

// Sign-upload schema: audio/video only, positive size and duration required.
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: 12.5,
  }).success,
  true,
);
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.pdf', contentType: 'application/pdf', fileSize: 1000, isVideo: false, durationSeconds: 10,
  }).success,
  false, // not audio/* or video/*
);
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: 0,
  }).success,
  false, // duration must be positive
);

// Create schema: objectName-based (no raw client URL); numbers coerce, booleans don't.
const created = CreateDubSchema.parse({
  objectName: 'user-1/dubbing/123_a.mp3',
  targetLanguage: 'es',
  isVideo: false,
  mediaName: 'My clip',
  durationSeconds: '42',
});
assert.equal(created.isVideo, false);
assert.equal(created.durationSeconds, 42);
// The string "false" must be rejected, not silently coerced to true.
assert.equal(
  CreateDubSchema.safeParse({
    objectName: 'user-1/dubbing/123_a.mp3', targetLanguage: 'es', isVideo: 'false', mediaName: 'x', durationSeconds: 5,
  }).success,
  false,
);
assert.equal(CreateDubSchema.safeParse({ targetLanguage: 'es', isVideo: false, mediaName: 'x', durationSeconds: 5 }).success, false); // objectName required

// Cancel prefix is stable — the API sets it, the worker polls it.
assert.equal(DUBBING_CANCEL_PREFIX, 'dubbing:cancel:');

console.log('dubbing self-check OK');
