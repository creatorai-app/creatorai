/**
 * Runnable self-check for the dubbing pure logic. No framework.
 *   npx tsx packages/validations/src/consts/dubbing.check.ts
 */
import assert from 'node:assert';
import {
  canDub,
  dubAudioFormat,
  dubOutputFormatOf,
  dubOutputObjects,
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
  dubbableLanguagesFor,
  maxDubLanguagesForPlan,
  dubEngineLabel,
  CHATTERBOX_LANGUAGES,
  isSupportedDubLanguage,
  DUBBING_V1_LANGUAGES,
  usesDubbingV1,
  accentsFor,
  accentsByLanguage,
  accentLabel,
  dialectsByLanguage,
  elevenLabsTargetTag,
  elevenLabsModelFor,
  ELEVENLABS_V2_LANGUAGES,
  DUB_VOICE_MODES,
  DUB_VOICE_MODE_INFO,
  DEFAULT_DUB_VOICE_MODE,
  cloningStrengthFor,
  chatterboxParamsFor,
  dubLanguageGroup,
  keytermProblem,
  normalizeKeyterms,
  DUB_KEYTERMS_MAX,
} from './dubbing';
import {
  calculateDubbingCreditsByDuration,
  getMinimumCreditsForDubbing,
  DUBBING_CREDIT_MULTIPLIER,
  STARTER_DUBBING_CREDIT_MULTIPLIER,
  dubbingMultiplierForPlan,
  formatDubbingAllowance,
} from './credits';
import { InitDubUploadSchema, RegenerateDubSchema, DubVideoPartSchema, DubOutputSchema } from '../schema/dubbing.schema';

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

// Init schema: audio/video only, positive size and duration, supported languages per engine.
const init = (over: Record<string, unknown> = {}) => InitDubUploadSchema.safeParse({
  filename: 'a.mp4', contentType: 'video/mp4', fileSize: 1000, isVideo: true, durationSeconds: 12.5,
  engine: 'cypher', targets: [{ language: 'es' }], mediaName: 'My clip', fingerprint: 'a.mp4|1000|1',
  audio: { contentType: 'audio/mp4', size: 100, extracted: true },
  ...over,
});
assert.equal(init().success, true);
assert.equal(init({ targets: [{ language: 'hi' }, { language: 'fr' }] }).success, true);
assert.equal(init({ targets: [{ language: 'bn' }] }).success, false); // no Chatterbox voice
assert.equal(init({ engine: 'elevenlabs', targets: [{ language: 'bn' }] }).success, true);
assert.equal(init({ targets: [{ language: 'xx' }] }).success, false);
assert.equal(init({ targets: [] }).success, false);
assert.equal(init({ targets: [{ language: 'es' }, { language: 'es' }] }).success, false); // duplicates
assert.equal(init({ targets: ['es', 'fr', 'de', 'it'].map((language) => ({ language })) }).success, false); // over any plan
assert.equal(init({ engine: 'murf' }).success, false);
assert.equal(init({ engine: 'elevenlabs', targets: [{ language: 'en', accent: 'british' }] }).success, true);
assert.equal(init({ targets: [{ language: 'en', accent: 'british' }] }).success, false); // Cypher has no accents
assert.equal(init({ engine: 'elevenlabs', targets: [{ language: 'en', accent: 'martian' }] }).success, false);
assert.equal(init({ contentType: 'application/pdf' }).success, false);
assert.equal(init({ durationSeconds: 0 }).success, false);
// A header-less VBR/WebM file makes the browser report Infinity. It is "positive", so
// only .finite() stops it from being priced and JSON-serialised into a null.
assert.equal(init({ durationSeconds: Infinity }).success, false);
// The string "false" must be rejected, not silently coerced to true.
assert.equal(init({ isVideo: 'false' }).success, false);
assert.equal(init({ audio: { contentType: 'text/plain', size: 100, extracted: true } }).success, false);
assert.equal(init({ audio: { contentType: 'audio/mp4', size: 0, extracted: true } }).success, false);
assert.equal(init({ fingerprint: '' }).success, false);
assert.equal(init({ durationSeconds: '42' }).success, true); // numbers coerce

// Source language: optional, known, and never one of the targets.
assert.equal(init({ sourceLanguage: 'en' }).success, true);
assert.equal(init({ sourceLanguage: 'bn' }).success, true); // a source Cypher cannot dub INTO is still a fine source
assert.equal(init({ sourceLanguage: 'xx' }).success, false);
assert.equal(init({ sourceLanguage: 'es' }).success, false); // equal to the target
assert.equal(init({ sourceLanguage: 'fr', targets: [{ language: 'es' }, { language: 'fr' }] }).success, false);
assert.equal(init({ engine: 'elevenlabs', sourceLanguage: 'yue', targets: [{ language: 'zh', accent: 'cantonese' }] }).success, false);
assert.equal(init({ engine: 'elevenlabs', sourceLanguage: 'yue', targets: [{ language: 'zh', accent: 'mandarin' }] }).success, true);
// Voice mode: defaults to balanced, only the three modes.
const parsedDefault = InitDubUploadSchema.parse({
  filename: 'a.mp4', contentType: 'video/mp4', fileSize: 1000, isVideo: true, durationSeconds: 12.5,
  engine: 'cypher', targets: [{ language: 'es' }], mediaName: 'My clip', fingerprint: 'a.mp4|1000|1',
  audio: { contentType: 'audio/mp4', size: 100, extracted: true },
});
assert.equal(parsedDefault.voiceMode, 'balanced');
assert.equal(parsedDefault.keyterms, undefined);
assert.equal(init({ voiceMode: 'native' }).success, true);
assert.equal(init({ voiceMode: 'robot' }).success, false);
// Output format: optional, and only a video can come back as a video.
assert.equal(parsedDefault.outputFormat, undefined);
assert.equal(init({ outputFormat: 'wav' }).success, true);
assert.equal(init({ outputFormat: 'mp4' }).success, true);
assert.equal(init({ outputFormat: 'mp4', isVideo: false }).success, false);
assert.equal(init({ outputFormat: 'mp3', isVideo: false }).success, true);
assert.equal(init({ outputFormat: 'flac' }).success, false);
assert.equal(dubOutputFormatOf({ outputFormat: null, isVideo: true }), 'mp4');
assert.equal(dubOutputFormatOf({ isVideo: false }), 'mp3');
assert.equal(dubOutputFormatOf({ outputFormat: 'wav', isVideo: false }), 'wav');
assert.equal(dubAudioFormat('mp4'), 'mp3'); // a video's track is what gets muxed
assert.equal(dubAudioFormat(null), 'mp3');
assert.equal(dubAudioFormat('wav'), 'wav');
assert.deepEqual(dubOutputObjects('p', 'es', 'wav').audio, { objectName: 'dubbed/p/es.wav', contentType: 'audio/wav' });
assert.deepEqual(dubOutputObjects('p', 'es').audio, { objectName: 'dubbed/p/es.mp3', contentType: 'audio/mpeg' });
// Regenerate: the same settings and target rules, no file. MP4 is left to the API, which
// knows whether the video is in storage.
const regen = (extra: object = {}) => RegenerateDubSchema.safeParse({ engine: 'cypher', targets: [{ language: 'es' }], ...extra });
assert.equal(regen().success, true);
assert.equal(regen({ outputFormat: 'mp4' }).success, true);
assert.equal(regen({ targets: [{ language: 'es' }, { language: 'es' }] }).success, false);
assert.equal(regen({ sourceLanguage: 'es' }).success, false);
assert.equal(regen({ targets: [] }).success, false);
// Keyterms: validated one by one, trimmed and deduplicated, at most 50.
const withTerms = init({ keyterms: ['  Creator AI ', 'creator ai', 'Cypher', ''] });
assert.equal(withTerms.success, true);
assert.deepEqual(withTerms.success && withTerms.data.keyterms, ['Creator AI', 'Cypher']);
assert.equal(init({ keyterms: ['a'.repeat(51)] }).success, false);
assert.equal(init({ keyterms: ['one two three four five six'] }).success, false);
assert.equal(init({ keyterms: ['<script>'] }).success, false);
assert.equal(init({ keyterms: ['back\\slash'] }).success, false);
assert.equal(init({ keyterms: Array.from({ length: DUB_KEYTERMS_MAX }, (_, i) => `term ${i}`) }).success, true);
assert.equal(init({ keyterms: Array.from({ length: DUB_KEYTERMS_MAX + 1 }, (_, i) => `term ${i}`) }).success, false);
assert.equal(init({ keyterms: [...Array.from({ length: DUB_KEYTERMS_MAX }, (_, i) => `term ${i}`), 'TERM 0'] }).success, true); // a duplicate is not a 51st

// Outputs carry an optional timeline and warnings; older rows have neither.
const baseOutput = { language: 'es', status: 'completed', segmentsDone: 0, creditsConsumed: 1 };
assert.equal(DubOutputSchema.safeParse(baseOutput).success, true);
assert.equal(DubOutputSchema.safeParse({
  ...baseOutput,
  timeline: [{ id: '0', speaker: 'S1', start: 0, end: 1.5, sourceText: 'Hi', translation: 'Hola', dubStart: 0, dubEnd: 1.2 }],
  warnings: [{ type: 'voices_not_permitted', speakerIds: ['S2'], message: 'replaced' }],
}).success, true);
assert.equal(DubOutputSchema.safeParse({ ...baseOutput, timeline: [{ id: '0', speaker: 'S1', start: 0 }] }).success, false);

// Part numbers: GCS multipart allows 1..10000; we plan uploads to at most 1000 parts.
assert.equal(DubVideoPartSchema.safeParse({ partNumber: 1 }).success, true);
assert.equal(DubVideoPartSchema.safeParse({ partNumber: 0 }).success, false);
assert.equal(DubVideoPartSchema.safeParse({ partNumber: 1001 }).success, false);

// Cancel prefix is stable — the API sets it, the worker polls it.
assert.equal(DUBBING_CANCEL_PREFIX, 'dubbing:cancel:');

// The label table keeps every language ever dubbed, so history pages can still name a
// dub made under an older backend.
// ElevenLabs' whole Dubbing v2 table (94 rows less the duplicate cmn) plus Bengali on v1.
assert.equal(supportedLanguages.length, 94);
assert.equal(ELEVENLABS_V2_LANGUAGES.length, 93);
const languageCodes = supportedLanguages.map((l) => l.value);
assert.equal(new Set(languageCodes).size, languageCodes.length, 'duplicate language code');
for (const code of ['en', 'es', 'ar', 'uk', 'ta', 'fil', 'ms', 'sv', 'zh', 'bn', 'yue', 'dgo', 'nso', 'war', 'bo', 'ug']) {
  assert.equal(languageCodes.includes(code as never), true, `missing ${code}`);
}

// Cypher's picker is that table narrowed to what Chatterbox speaks. A code outside it must
// not be selectable OR acceptable: Chatterbox does not refuse an unknown language_id, it
// synthesizes something wrong.
const cypherCodes = dubbableLanguagesFor('cypher').map((l) => l.value);
for (const code of cypherCodes) {
  assert.equal(CHATTERBOX_LANGUAGES.includes(code), true, `${code} is offered but Chatterbox cannot speak it`);
  assert.equal(isSupportedDubLanguage(code, 'cypher'), true, `${code} is offered but the API would reject it`);
}
for (const code of ['bn', 'bg', 'cs', 'fil', 'hr', 'id', 'ro', 'sk', 'ta', 'uk', 'yue', 'af', 'vi', 'zu']) {
  assert.equal(isSupportedDubLanguage(code, 'cypher'), false, `${code} has no Chatterbox voice and must not be accepted`);
  assert.equal(cypherCodes.includes(code as never), false, `${code} must not be offered on Cypher`);
  // ...but ElevenLabs speaks all of them.
  assert.equal(isSupportedDubLanguage(code, 'elevenlabs'), true, `${code} should be offered on ElevenLabs`);
}
// Chatterbox Multilingual speaks 23 languages (model card), and Cypher offers every one.
assert.equal(cypherCodes.length, 23);
assert.deepEqual([...cypherCodes].sort(), [...CHATTERBOX_LANGUAGES].sort());
assert.equal(dubbableLanguagesFor('elevenlabs').length, supportedLanguages.length);
assert.equal(isSupportedDubLanguage('en'), true); // defaults to Cypher
assert.equal(isSupportedDubLanguage('bn'), false);
assert.equal(isSupportedDubLanguage('xx', 'elevenlabs'), false);

// Dialects are ElevenLabs v2-only: Chatterbox copies the voice sample's accent, and
// dubbing_v1 takes no region tag.
for (const code of languageCodes) {
  assert.deepEqual(accentsFor(code, 'cypher'), [], `${code} offers dialects Chatterbox cannot honour`);
}
assert.equal(accentsFor('en', 'elevenlabs').length, 4);
assert.deepEqual(accentsFor('bn', 'elevenlabs'), []);
assert.deepEqual(accentsFor('de', 'elevenlabs'), []);
assert.deepEqual(accentsFor('ar', 'elevenlabs').map((a) => a.value), ['egyptian']);
// Indian English has no v2 dialect: gone from the menu, still named on old dubs.
assert.equal(accentsFor('en', 'elevenlabs').some((a) => a.value === 'indian'), false);
assert.equal(accentLabel('en', 'indian'), 'Indian');
assert.equal(accentLabel('en', 'british'), 'British');
assert.equal(accentLabel('en', 'martian'), null);
assert.equal(accentLabel('en', null), null);
assert.equal(accentsByLanguage.en?.some((a) => a.value === 'indian'), true);

// Every stored accent maps to a v2 target tag, and every tag is one v2 lists.
const V2_DIALECT_TAGS = ['ar-EG', 'zh-TW', 'en-AU', 'en-CA', 'en-GB', 'en-US', 'fr-CA', 'fr-FR', 'pt-BR', 'pt-PT', 'es-AR', 'es-CL', 'es-ES', 'es-MX'];
const expectedTags: [string, string, string][] = [
  ['en', 'american', 'en-US'], ['en', 'british', 'en-GB'], ['en', 'australian', 'en-AU'], ['en', 'canadian', 'en-CA'],
  ['en', 'indian', 'en'],
  ['es', 'castilian', 'es-ES'], ['es', 'latin american', 'es-MX'], ['es', 'argentinian', 'es-AR'], ['es', 'chilean', 'es-CL'],
  ['pt', 'brazilian', 'pt-BR'], ['pt', 'european', 'pt-PT'],
  ['fr', 'french', 'fr-FR'], ['fr', 'canadian', 'fr-CA'],
  ['zh', 'mandarin', 'zh'], ['zh', 'taiwanese', 'zh-TW'], ['zh', 'cantonese', 'yue'],
  ['ar', 'egyptian', 'ar-EG'],
];
for (const [language, accent, tag] of expectedTags) {
  assert.equal(elevenLabsTargetTag(language, accent), tag, `${language}/${accent}`);
}
for (const dialects of Object.values(dialectsByLanguage)) {
  for (const d of dialects ?? []) {
    assert.equal(V2_DIALECT_TAGS.includes(d.tag) || ELEVENLABS_V2_LANGUAGES.includes(d.tag), true, `${d.tag} is not a v2 target`);
  }
}
assert.equal(elevenLabsTargetTag('es'), 'es');
assert.equal(elevenLabsTargetTag('es', null), 'es');
assert.equal(elevenLabsTargetTag('en', 'martian'), 'en'); // unknown: plain language
assert.equal(elevenLabsTargetTag('bn', 'british'), 'bn'); // v1 never gets a region tag

assert.equal(dubEngineLabel('cypher'), 'Cypher (in-house dubbing)');
assert.equal(dubEngineLabel('elevenlabs'), 'ElevenLabs');

// Languages per dub: Starter 1, Creator/Pro 2, Business/Scale 3. Unknown fails closed.
assert.equal(maxDubLanguagesForPlan('Starter'), 1);
assert.equal(maxDubLanguagesForPlan(null), 1);
assert.equal(maxDubLanguagesForPlan('Creator'), 2);
assert.equal(maxDubLanguagesForPlan('pro'), 2);
assert.equal(maxDubLanguagesForPlan('Business'), 3);
assert.equal(maxDubLanguagesForPlan('SCALE'), 3);

// Several targets: Bengali (the one dubbing_v1 language) tightens the whole dub.
assert.equal(maxDubSecondsForPlan('Pro', ['es', 'bn']), DUBBING_V1_MAX_SECONDS);
assert.equal(maxDubBytesForPlan('Pro', ['bn']), DUBBING_V1_MAX_BYTES);
assert.equal(maxDubSecondsForPlan('Pro', ['es', 'fr']), PAID_MAX_DUB_SECONDS);

// Only Bengali is on dubbing_v1; everything else ElevenLabs dubs runs on v2.
assert.deepEqual([...DUBBING_V1_LANGUAGES], ['bn']);
assert.equal(usesDubbingV1('bn'), true);
assert.equal(usesDubbingV1('es'), false);
assert.equal(elevenLabsModelFor('bn'), 'dubbing_v1');
assert.equal(elevenLabsModelFor('es'), 'dubbing_v2');
assert.equal(ELEVENLABS_V2_LANGUAGES.includes('bn'), false, 'Bengali is not a v2 language');
assert.equal(new Set(ELEVENLABS_V2_LANGUAGES).size, ELEVENLABS_V2_LANGUAGES.length, 'duplicate v2 code');
assert.equal(ELEVENLABS_V2_LANGUAGES.includes('cmn'), false, 'cmn duplicates zh');
for (const code of ELEVENLABS_V2_LANGUAGES) {
  assert.equal(languageCodes.includes(code as never), true, `${code} is on v2 but has no label`);
}
for (const code of DUBBING_V1_LANGUAGES) {
  assert.equal(languageCodes.includes(code as never), true, `${code} routes via v1 but has no label`);
}
// ElevenLabs offers the whole label table: every v2 language plus Bengali.
assert.equal(dubbableLanguagesFor('elevenlabs').length, ELEVENLABS_V2_LANGUAGES.length + DUBBING_V1_LANGUAGES.length);
for (const { value, label } of supportedLanguages) {
  assert.equal(/^[a-z]{2,3}$/.test(value), true, `not an ISO code: ${value}`);
  assert.equal(label.trim().length > 0, true, `missing label for ${value}`);
}

// Hebrew, Norwegian and Swahili moved to v2, so they get the plan's own caps now.
for (const code of ['he', 'no', 'sw']) {
  assert.equal(usesDubbingV1(code), false, `${code} is on dubbing_v2`);
  assert.equal(maxDubSecondsForPlan('Pro', [code], 'elevenlabs'), PAID_MAX_DUB_SECONDS);
  assert.equal(maxDubBytesForPlan('Pro', [code], 'elevenlabs'), PAID_MAX_DUB_BYTES);
  assert.equal(isSupportedDubLanguage(code, 'cypher'), true);
  assert.equal(isSupportedDubLanguage(code, 'elevenlabs'), true);
}
// The v1 ceiling is an ElevenLabs limit only; Cypher cannot dub Bengali anyway.
assert.equal(maxDubSecondsForPlan('Pro', ['bn'], 'cypher'), PAID_MAX_DUB_SECONDS);

// Voice modes: three, balanced by default, labelled as the form shows them.
assert.deepEqual([...DUB_VOICE_MODES], ['like_me', 'balanced', 'native']);
assert.equal(DEFAULT_DUB_VOICE_MODE, 'balanced');
assert.equal(DUB_VOICE_MODE_INFO.like_me.label, 'Keep my voice and accent');
assert.equal(DUB_VOICE_MODE_INFO.balanced.label, 'Balanced');
assert.equal(DUB_VOICE_MODE_INFO.native.label, 'Sound native');
for (const mode of DUB_VOICE_MODES) {
  for (const engine of ['cypher', 'elevenlabs'] as const) {
    const help = DUB_VOICE_MODE_INFO[mode].help[engine];
    assert.equal(help.length > 0 && !help.includes('\u2014'), true, `${mode}/${engine} help is empty or uses an em dash`);
  }
}

// Cloning strength: 9 / 7 / 4, one lower across language groups, 0..10.
assert.equal(cloningStrengthFor({ voiceMode: 'like_me', sourceLanguage: 'en', targetLanguage: 'es' }), 9);
assert.equal(cloningStrengthFor({ voiceMode: 'balanced', sourceLanguage: 'en', targetLanguage: 'fr' }), 7);
assert.equal(cloningStrengthFor({ voiceMode: 'native', sourceLanguage: 'de', targetLanguage: 'it' }), 4);
assert.equal(cloningStrengthFor({ voiceMode: 'like_me', sourceLanguage: 'en', targetLanguage: 'ja' }), 8);
assert.equal(cloningStrengthFor({ voiceMode: 'balanced', sourceLanguage: 'hi', targetLanguage: 'en-GB' }), 6); // dialect tag
assert.equal(cloningStrengthFor({ voiceMode: 'native', sourceLanguage: 'ru', targetLanguage: 'ar-EG' }), 3);
assert.equal(cloningStrengthFor({ voiceMode: 'balanced', sourceLanguage: 'zh', targetLanguage: 'yue' }), 7); // both CJK
assert.equal(cloningStrengthFor({ voiceMode: 'balanced', targetLanguage: 'ja' }), 7); // unknown source
assert.equal(cloningStrengthFor({ voiceMode: 'balanced', sourceLanguage: null, targetLanguage: 'ja' }), 7);
assert.equal(cloningStrengthFor({ voiceMode: 'balanced', sourceLanguage: 'el', targetLanguage: 'ja' }), 7); // Greek: no group
assert.equal(dubLanguageGroup('es-MX'), 'latin_european');
assert.equal(dubLanguageGroup('xx'), null);
for (const mode of DUB_VOICE_MODES) {
  for (const [from, to] of [['en', 'ja'], ['ja', 'en'], ['sw', 'ru'], [null, 'en']]) {
    const strength = cloningStrengthFor({ voiceMode: mode, sourceLanguage: from, targetLanguage: to! });
    assert.equal(strength >= 0 && strength <= 10 && Number.isInteger(strength), true, `strength out of range: ${strength}`);
  }
}

// Chatterbox: cfg_weight 0 removes the reference's accent (native); 0.5 otherwise.
assert.deepEqual(chatterboxParamsFor({ voiceMode: 'like_me' }), { cfg_weight: 0.5, exaggeration: 0.5 });
assert.deepEqual(chatterboxParamsFor({ voiceMode: 'balanced' }), { cfg_weight: 0.5, exaggeration: 0.5 });
assert.deepEqual(chatterboxParamsFor({ voiceMode: 'native' }), { cfg_weight: 0, exaggeration: 0.5 });

// Keyterms follow ElevenLabs' rules: 50 chars, 5 words, no <>{}[]\.
assert.equal(keytermProblem('Creator AI'), null);
assert.equal(keytermProblem('  Creator   AI  '), null);
assert.equal(keytermProblem('a'.repeat(50)), null);
assert.notEqual(keytermProblem('a'.repeat(51)), null);
assert.equal(keytermProblem('one two three four five'), null);
assert.notEqual(keytermProblem('one two three four five six'), null);
for (const bad of ['<b>', 'a{b}', 'x[1]', 'back\\slash', 'a>b']) {
  assert.notEqual(keytermProblem(bad), null, `${bad} should be refused`);
}
assert.notEqual(keytermProblem('   '), null);
assert.deepEqual(normalizeKeyterms([' Creator AI ', 'creator  ai', 'Cypher', '', 'Cypher']), ['Creator AI', 'Cypher']);


console.log('dubbing self-check OK');
