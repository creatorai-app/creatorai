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
  STARTER_MAX_DUB_BYTES,
  PAID_MAX_DUB_SECONDS,
  PAID_MAX_DUB_BYTES,
  DUBBING_V1_MAX_SECONDS,
  DUBBING_V1_MAX_BYTES,
  maxDubSecondsForPlan,
  maxDubBytesForPlan,
  isDubDurationAllowed,
  isDubSizeAllowed,
  formatDubDuration,
  supportedLanguages,
  dubbableLanguages,
  CHATTERBOX_LANGUAGES,
  isSupportedDubLanguage,
  DUBBING_V1_LANGUAGES,
  usesDubbingV1,
  accentsFor,
} from './dubbing';
import {
  calculateDubbingCreditsByDuration,
  getMinimumCreditsForDubbing,
  DUBBING_CREDIT_MULTIPLIER,
  STARTER_DUBBING_CREDIT_MULTIPLIER,
  dubbingMultiplierForPlan,
  formatDubbingAllowance,
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

// Caps: Starter gets 500MB / 45 min, paid plans get ElevenLabs' own API ceiling of
// 3GB / 180 min. An unknown/missing plan must fail CLOSED (treated as Starter).
assert.equal(maxDubSecondsForPlan('Starter'), STARTER_MAX_DUB_SECONDS);
assert.equal(maxDubSecondsForPlan('starter'), 45 * 60);
assert.equal(maxDubSecondsForPlan('Creator'), PAID_MAX_DUB_SECONDS);
assert.equal(maxDubSecondsForPlan('scale'), 180 * 60);
assert.equal(maxDubSecondsForPlan(null), STARTER_MAX_DUB_SECONDS);
assert.equal(maxDubSecondsForPlan(undefined), STARTER_MAX_DUB_SECONDS);
assert.equal(maxDubBytesForPlan('starter'), STARTER_MAX_DUB_BYTES);
assert.equal(maxDubBytesForPlan('Pro'), PAID_MAX_DUB_BYTES);
assert.equal(maxDubBytesForPlan(null), STARTER_MAX_DUB_BYTES); // fails closed
assert.equal(STARTER_MAX_DUB_BYTES < PAID_MAX_DUB_BYTES, true);

assert.equal(isDubDurationAllowed('Starter', 45 * 60), true); // exactly at the cap is fine
assert.equal(isDubDurationAllowed('Starter', 45 * 60 + 0.5), false);
assert.equal(isDubDurationAllowed('Starter', 3 * 3600), false);
assert.equal(isDubDurationAllowed('Pro', 6000), true);
assert.equal(isDubDurationAllowed('Pro', 180 * 60 + 1), false); // the vendor ceiling still binds
assert.equal(isDubDurationAllowed(null, 45 * 60 + 1), false); // fails closed
assert.equal(isDubSizeAllowed('starter', STARTER_MAX_DUB_BYTES), true);
assert.equal(isDubSizeAllowed('starter', STARTER_MAX_DUB_BYTES + 1), false);
assert.equal(isDubSizeAllowed('Business', STARTER_MAX_DUB_BYTES + 1), true);
assert.equal(isDubSizeAllowed('Business', PAID_MAX_DUB_BYTES + 1), false);

// The dubbing_v1 route is a smaller endpoint (1GB / 45 min) and must tighten a paid
// plan's cap, never widen a Starter one.
for (const code of DUBBING_V1_LANGUAGES) {
  assert.equal(maxDubSecondsForPlan('Pro', code), DUBBING_V1_MAX_SECONDS);
  assert.equal(maxDubBytesForPlan('Pro', code), DUBBING_V1_MAX_BYTES);
  assert.equal(maxDubSecondsForPlan('starter', code), STARTER_MAX_DUB_SECONDS);
  assert.equal(maxDubBytesForPlan('starter', code), STARTER_MAX_DUB_BYTES); // 500MB < 1GB
  assert.equal(isDubDurationAllowed('Pro', DUBBING_V1_MAX_SECONDS + 1, code), false);
  assert.equal(isDubDurationAllowed('Pro', DUBBING_V1_MAX_SECONDS + 1), true); // same clip, other language
}
// A language on the default route is held to the plan cap, not the v1 one.
assert.equal(maxDubSecondsForPlan('Pro', 'es'), PAID_MAX_DUB_SECONDS);
assert.equal(maxDubBytesForPlan('Pro', 'es'), PAID_MAX_DUB_BYTES);

assert.equal(formatDubDuration(45 * 60), '45 min');
assert.equal(formatDubDuration(180 * 60), '3 hrs');
assert.equal(formatDubDuration(3600), '1 hr');
assert.equal(formatDubDuration(90), '2 min');

// Duration-based credits: cost = ceil(seconds) × multiplier, floored at one second.
assert.equal(calculateDubbingCreditsByDuration(60, 3), 180);
assert.equal(calculateDubbingCreditsByDuration(59.2, 3), 180); // rounds up
assert.equal(calculateDubbingCreditsByDuration(0, 3), 3); // floor: never free
assert.equal(calculateDubbingCreditsByDuration(1, 3), 3);
assert.equal(getMinimumCreditsForDubbing(3), 3);
assert.equal(getMinimumCreditsForDubbing(), 1); // sub-1 rate still costs a whole credit

// Credits are an integer DB column. A fractional rate (10 credits/min) must never
// produce a fractional charge — the balance RPC would truncate or reject it.
for (const seconds of [1, 7, 61, 91, 3599, 18000]) {
  const cost = calculateDubbingCreditsByDuration(seconds, DUBBING_CREDIT_MULTIPLIER);
  assert.equal(Number.isInteger(cost), true, `fractional credits for ${seconds}s: ${cost}`);
  assert.equal(cost >= 1, true, `free dub at ${seconds}s`);
}

// The rate is set so Creator's fixed 3,000 credits buy a full 5 hours of dubbing.
// If this fails, the promo no longer matches what the plan actually grants.
assert.equal(calculateDubbingCreditsByDuration(5 * 60 * 60, DUBBING_CREDIT_MULTIPLIER) <= 3000, true);
assert.equal(calculateDubbingCreditsByDuration(60, DUBBING_CREDIT_MULTIPLIER), 10); // 10 credits/min

// Starter pays its own rate. The clip cap and the price must agree about who is on the
// free tier, so this mirrors maxDubSecondsForPlan case for case.
assert.equal(dubbingMultiplierForPlan('Starter'), STARTER_DUBBING_CREDIT_MULTIPLIER);
assert.equal(dubbingMultiplierForPlan('starter'), STARTER_DUBBING_CREDIT_MULTIPLIER);
assert.equal(dubbingMultiplierForPlan(null), STARTER_DUBBING_CREDIT_MULTIPLIER); // fails closed
assert.equal(dubbingMultiplierForPlan(undefined), STARTER_DUBBING_CREDIT_MULTIPLIER);
assert.equal(dubbingMultiplierForPlan('Creator'), DUBBING_CREDIT_MULTIPLIER);
assert.equal(dubbingMultiplierForPlan('scale'), DUBBING_CREDIT_MULTIPLIER);
for (const plan of ['Starter', 'starter', null, undefined, 'Creator', 'scale']) {
  assert.equal(
    maxDubSecondsForPlan(plan) === STARTER_MAX_DUB_SECONDS,
    dubbingMultiplierForPlan(plan) === STARTER_DUBBING_CREDIT_MULTIPLIER,
    `cap and rate disagree about ${String(plan)}`,
  );
}

// Starter's 500-credit grant, not its 45-minute clip cap, is what keeps the free tier
// a trial: at 3 credits/sec it buys under three minutes of dubbing in total. If this
// ever inverts, the clip cap becomes the only thing standing between a free account
// and 45 minutes of pure COGS.
const starterRate = dubbingMultiplierForPlan('starter');
assert.equal(calculateDubbingCreditsByDuration(60, starterRate), 180); // 3 credits/sec
assert.equal(calculateDubbingCreditsByDuration(STARTER_MAX_DUB_SECONDS, starterRate) > 500, true);
assert.equal(Math.floor(500 / starterRate) < STARTER_MAX_DUB_SECONDS, true);

// Advertised allowances — these are the numbers on the pricing page.
assert.equal(formatDubbingAllowance(3000, 'Creator'), '5.0 hrs');
assert.equal(formatDubbingAllowance(8000, 'Pro'), '13.3 hrs');
assert.equal(formatDubbingAllowance(50000, 'Business'), '83.3 hrs');
assert.equal(formatDubbingAllowance(100000, 'Scale'), '166.7 hrs');
assert.equal(formatDubbingAllowance(500, 'Starter'), '2.8 min');

// Sign-upload schema: audio/video only, positive size and duration required.
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: 12.5,
  }).success,
  true, // targetLanguage is optional
);
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: 12.5,
    targetLanguage: 'hi',
  }).success,
  true,
);
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: 12.5,
    targetLanguage: 'bn',
  }).success,
  false, // labelled for history, but the live backend has no Bengali voice
);
assert.equal(
  SignDubUploadSchema.safeParse({
    filename: 'a.mp3', contentType: 'audio/mpeg', fileSize: 1000, isVideo: false, durationSeconds: 12.5,
    targetLanguage: 'xx',
  }).success,
  false, // an unknown code would pick the wrong backend's cap
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

// The label table keeps every language ever dubbed, so history pages can still name a
// dub made under an older backend.
assert.equal(supportedLanguages.length, 30);
const languageCodes = supportedLanguages.map((l) => l.value);
assert.equal(new Set(languageCodes).size, languageCodes.length, 'duplicate language code');
for (const code of ['en', 'es', 'ar', 'uk', 'ta', 'fil', 'ms', 'sv', 'zh', 'bn']) {
  assert.equal(languageCodes.includes(code as never), true, `missing ${code}`);
}

// The picker is that table narrowed to what the live backend (Chatterbox, via Modal)
// speaks. A code outside it must not be selectable OR acceptable: Chatterbox does not
// refuse an unknown language_id, it synthesizes something wrong.
const dubbableCodes = dubbableLanguages.map((l) => l.value);
for (const code of dubbableCodes) {
  assert.equal(CHATTERBOX_LANGUAGES.includes(code), true, `${code} is offered but Chatterbox cannot speak it`);
  assert.equal(isSupportedDubLanguage(code), true, `${code} is offered but the API would reject it`);
}
for (const code of ['bn', 'bg', 'cs', 'fil', 'hr', 'id', 'ro', 'sk', 'ta', 'uk']) {
  assert.equal(isSupportedDubLanguage(code), false, `${code} has no Chatterbox voice and must not be accepted`);
  assert.equal(dubbableCodes.includes(code as never), false, `${code} must not be offered`);
}
assert.equal(dubbableCodes.length, 20);
assert.equal(isSupportedDubLanguage('en'), true);
assert.equal(isSupportedDubLanguage('xx'), false);

// Chatterbox takes no target accent, so no language may offer an accent menu.
for (const code of languageCodes) {
  assert.deepEqual(accentsFor(code), [], `${code} offers accents the backend cannot honour`);
}

// The dubbing_v1 routing table is dormant with ElevenLabs, but it still feeds the
// duration/size caps, so it must stay coherent.
assert.equal(usesDubbingV1('bn'), true);
assert.equal(usesDubbingV1('es'), false);
for (const code of DUBBING_V1_LANGUAGES) {
  assert.equal(languageCodes.includes(code as never), true, `${code} routes via v1 but has no label`);
}
for (const { value, label } of supportedLanguages) {
  assert.equal(/^[a-z]{2,3}$/.test(value), true, `not an ISO code: ${value}`);
  assert.equal(label.trim().length > 0, true, `missing label for ${value}`);
}

console.log('dubbing self-check OK');
