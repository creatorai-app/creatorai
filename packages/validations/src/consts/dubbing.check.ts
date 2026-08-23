/**
 * Runnable self-check for the dubbing pure logic. No framework.
 *   npx tsx packages/validations/src/consts/dubbing.check.ts
 */
import assert from 'node:assert';
import {
  canDub,
  DUBBING_PLANS,
  DUBBING_CANCEL_PREFIX,
  STARTER_MAX_DUB_SECONDS,
  maxDubSecondsForPlan,
  isDubDurationAllowed,
  supportedLanguages,
  isSupportedDubLanguage,
  DUBBING_V1_LANGUAGES,
  usesDubbingV1,
  accentsFor,
} from './dubbing';
import {
  calculateDubbingCreditsByDuration,
  getMinimumCreditsForDubbing,
  DUBBING_CREDIT_MULTIPLIER,
} from './credits';
import { SignDubUploadSchema, CreateDubSchema } from '../schema/dubbing.schema';

// Plan gating: EVERY plan can dub now (Starter included) — the limit is duration,
// not access. Case-insensitive, null-safe.
assert.equal(canDub('Creator'), true);
assert.equal(canDub('pro'), true);
assert.equal(canDub('Business'), true);
assert.equal(canDub('SCALE'), true);
assert.equal(canDub('Starter'), true);
assert.equal(canDub('starter'), true);
assert.equal(canDub(null), false); // no active plan at all → still blocked
assert.equal(canDub(undefined), false);
assert.equal(canDub(''), false);
assert.deepEqual([...DUBBING_PLANS], ['starter', 'creator', 'pro', 'business', 'scale']);

// Duration cap: Starter is capped, every paid plan is uncapped. An unknown/missing
// plan must fail CLOSED (treated as Starter), never open.
assert.equal(maxDubSecondsForPlan('Starter'), STARTER_MAX_DUB_SECONDS);
assert.equal(maxDubSecondsForPlan('starter'), 60);
assert.equal(maxDubSecondsForPlan('Creator'), null);
assert.equal(maxDubSecondsForPlan('scale'), null);
assert.equal(maxDubSecondsForPlan(null), STARTER_MAX_DUB_SECONDS);
assert.equal(maxDubSecondsForPlan(undefined), STARTER_MAX_DUB_SECONDS);

assert.equal(isDubDurationAllowed('Starter', 60), true); // exactly at the cap is fine
assert.equal(isDubDurationAllowed('Starter', 60.5), false);
assert.equal(isDubDurationAllowed('Starter', 600), false);
assert.equal(isDubDurationAllowed('Pro', 6000), true);
assert.equal(isDubDurationAllowed(null, 61), false); // fails closed

// Duration-based credits: cost = ceil(seconds) × multiplier, floored at one second.
assert.equal(calculateDubbingCreditsByDuration(60, 3), 180);
assert.equal(calculateDubbingCreditsByDuration(59.2, 3), 180); // rounds up
assert.equal(calculateDubbingCreditsByDuration(0, 3), 3); // floor: never free
assert.equal(calculateDubbingCreditsByDuration(1, 3), 3);
assert.equal(getMinimumCreditsForDubbing(3), 3);
assert.equal(getMinimumCreditsForDubbing(), DUBBING_CREDIT_MULTIPLIER);

// A Starter user's 500 credits must buy two full-length trial dubs at the cap.
assert.equal(calculateDubbingCreditsByDuration(STARTER_MAX_DUB_SECONDS, DUBBING_CREDIT_MULTIPLIER) * 2 <= 500, true);

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
// A header-less VBR/WebM file makes the browser report Infinity. It is "positive", so
// only .finite() stops it from being priced and JSON-serialised into a null.
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: Infinity,
  }).success,
  false,
);
assert.equal(
  CreateDubSchema.safeParse({
    objectName: 'staging/user-1/dubbing/123_a.mp3', targetLanguage: 'es', isVideo: false, mediaName: 'x',
    durationSeconds: Infinity,
  }).success,
  false,
);

// Create schema: objectName-based (no raw client URL); numbers coerce, booleans don't.
const created = CreateDubSchema.parse({
  objectName: 'staging/user-1/dubbing/123_a.mp3',
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

// The dropdown must mirror what the dubbing API accepts: a language neither backend
// takes is a 400 the user cannot act on.
assert.equal(supportedLanguages.length, 30);
const languageCodes = supportedLanguages.map((l) => l.value);
assert.equal(new Set(languageCodes).size, languageCodes.length, 'duplicate language code');
assert.equal(languageCodes.includes('no' as never), false, 'Norwegian is flash-v2.5 only');
for (const code of ['en', 'es', 'ar', 'uk', 'ta', 'fil', 'ms', 'sv', 'zh', 'bn']) {
  assert.equal(languageCodes.includes(code as never), true, `missing ${code}`);
}
assert.equal(isSupportedDubLanguage('bn'), true);
assert.equal(isSupportedDubLanguage('xx'), false);

// Routing: only the listed languages take the project/dubbing_v1 route, and every one
// of them must be offered in the dropdown — a code in one list and not the other is a
// language that either cannot be picked or gets sent to the endpoint that refuses it.
assert.equal(usesDubbingV1('bn'), true);
assert.equal(usesDubbingV1('es'), false);
assert.equal(usesDubbingV1('hi'), false);
for (const code of DUBBING_V1_LANGUAGES) {
  assert.equal(languageCodes.includes(code as never), true, `${code} routes via v1 but is not offered`);
  // dubbing_v1 has no target_accent, so an accent menu there would be a lie.
  assert.deepEqual(accentsFor(code), [], `${code} routes via v1 and cannot offer accents`);
}
for (const { value, label } of supportedLanguages) {
  assert.equal(/^[a-z]{2,3}$/.test(value), true, `not an ISO code: ${value}`);
  assert.equal(label.trim().length > 0, true, `missing label for ${value}`);
}

console.log('dubbing self-check OK');
