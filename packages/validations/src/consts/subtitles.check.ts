/**
 * Runnable self-check for the subtitle language logic. No framework.
 *   npx tsx packages/validations/src/consts/subtitles.check.ts
 */
import assert from 'node:assert';
import {
  SUBTITLE_TRANSCRIBE_LANGUAGES,
  subtitleLanguages,
  isSupportedSubtitleLanguage,
  isSupportedSubtitleTarget,
  SUBTITLE_RESPONSE_SCHEMA,
} from './subtitles';

// The count the pricing page and the public pages quote. If this changes, that copy is stale.
assert.equal(subtitleLanguages.length, 70);

// Every offered language is documented by Google AND has a label — never a bare code.
for (const lang of subtitleLanguages) {
  assert.ok(SUBTITLE_TRANSCRIBE_LANGUAGES.includes(lang.value), `${lang.value} not documented`);
  assert.ok(lang.label && lang.label !== lang.value, `${lang.value} has no label`);
}

// The seven documented codes with no label are excluded rather than shown as codes.
const offered = new Set(subtitleLanguages.map((l) => l.value));
assert.deepEqual(
  SUBTITLE_TRANSCRIBE_LANGUAGES.filter((c) => !offered.has(c)).sort(),
  ['kea', 'km', 'ln', 'mt', 'or', 'rup', 'sr'],
);

// Trust boundary: sentinels pass on the side that defines them, and nowhere else.
assert.equal(isSupportedSubtitleLanguage('auto'), true);
assert.equal(isSupportedSubtitleLanguage('same'), false);
assert.equal(isSupportedSubtitleTarget('same'), true);
assert.equal(isSupportedSubtitleTarget('auto'), false);

// Real codes pass; undocumented and junk do not.
assert.equal(isSupportedSubtitleLanguage('en'), true);
assert.equal(isSupportedSubtitleTarget('bn'), true);
assert.equal(isSupportedSubtitleLanguage('wo'), false, 'Wolof is dubbable but not documented for transcription');
assert.equal(isSupportedSubtitleLanguage('English'), false, 'labels are not codes');
assert.equal(isSupportedSubtitleLanguage(''), false);

// The response schema has to demand every field the processor reads back.
assert.deepEqual([...SUBTITLE_RESPONSE_SCHEMA.required], ['detected_language', 'title', 'subtitles']);
assert.deepEqual(
  [...SUBTITLE_RESPONSE_SCHEMA.properties.subtitles.items.required],
  ['start', 'end', 'text'],
);

console.log(`subtitles.check: OK (${subtitleLanguages.length} languages)`);
