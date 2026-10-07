# Dubbing: engines, languages, speakers and resumable uploads

How a dub gets from the user's disk to one finished file per language, who speaks in it,
and what happens when something breaks halfway. This replaces the single signed `PUT`
of the whole file and the single-language, single-voice pipeline described in
[dubbing-design.md](dubbing-design.md).

## What changed, in short

| | Before | Now |
|---|---|---|
| Engine | Gemini + Modal only | **Cypher (in-house dubbing)** or **ElevenLabs**, picked per dub, on every plan |
| Price | One rate | Per engine, per second, per language: Cypher 1 credit/s, ElevenLabs 1/6 credit/s (Starter 3/s on both) |
| Languages offered | 20 (Cypher only) | **94** in total: ElevenLabs all 94, Cypher all **23** Chatterbox speaks |
| ElevenLabs route | One legacy `POST /v1/dubbing` per language | One **project** per dub on `dubbing_v2` (plus `dubbing_v1` for Bengali), one language target per language |
| Voice | Fixed | **Voice mode** (keep my voice and accent / balanced / sound native), **dialects** on ElevenLabs, **names and terms** kept as they are |
| Music and effects (Cypher) | Lost: the dub was speech only | Kept: the voices are separated from the background and the dub is mixed back over it |
| Languages per dub | 1 | Starter 1, Creator/Pro **2**, Business/Scale **3**. One output each |
| Speakers | One cloned voice for everyone | Every speaker detected and dubbed in their own cloned voice |
| Timing | Speech concatenated end to end | Each line placed back at its original time, word-timed where forced alignment holds up, each turn fitted to its slot |
| Timeline | None | Every language shows its lines: time, speaker, original, translation |
| Bytes before dubbing starts | The whole file (1 GB) | The audio track only (tens of MB) |
| Video upload | One request, before dubbing | Parallel parts, **while** dubbing runs |
| Dropped connection / closed tab | Start over | Continue from what GCS already has |
| Dub fails halfway | Start over, pay again | Retry resumes at the first unfinished step, per language |
| Output | WAV (Cypher), MP4 for video | Picked per dub: **video (MP4)**, or **audio only, MP3 or WAV**, whichever engine made it |

## The two engines

Picked on the new-dub page (`DubEngineCards`), stored on `dubbing_projects.engine`.
Constants live in `packages/validations/src/consts/dubbing.ts` (`DUB_ENGINES`,
`DUB_ENGINE_INFO`, `dubEngineLabel`).

| | Cypher (in-house dubbing) | ElevenLabs |
|---|---|---|
| Runs on | Gemini (Vertex) + Chatterbox on Modal | ElevenLabs Dubbing API |
| Languages | 23: every language Chatterbox Multilingual speaks | 94: the whole Dubbing v2 table (93), plus Bengali on `dubbing_v1` |
| Dialects | None (Chatterbox copies the accent of the voice sample) | v2 dialects for en, es, pt, fr, zh, ar (none for Bengali) |
| Voice mode | Only once the Cypher TTS v2 service is live (Chatterbox `cfg_weight`) | Always (Dubbing v2 cloning strength) |
| Speakers | Our own algorithm, below | ElevenLabs' own detection |
| Price (paid plans) | 1 credit per second, per language | 1/6 credit per second, per language |
| Our cost | ~$0.054 per minute (breakdown below) | ~$0.24 per minute at list price, per language |

## Pricing: per second, per language, the same on both engines

Credits per second of source, per language dubbed, on every plan, at one rate whichever
engine runs the dub (`packages/validations/src/consts/credits.ts`). A plan buys the same
hours on Cypher and ElevenLabs; only the languages differ.

| | Rate |
|---|---|
| Paid plans | `DUBBING_CREDIT_MULTIPLIER` = **1/6**/s (10/min) |
| Starter | 3/s (the trial rate) |

Both are hard-coded, with no env override, until the ElevenLabs grant ends.
`dubbingMultiplierForPlan` resolves the rate, and the API (reserve), the worker (settle)
and the new-dub form (estimate, via `/dubbing/access`) all go through it, so the three
cannot disagree. What a month buys:

| Plan | Credits | Dubbing |
|---|---|---|
| Starter | 500 | 2.8 min |
| Creator | 3,000 | 5.0 hrs |
| Pro | 8,000 | 13.3 hrs |
| Business | 50,000 | 83.3 hrs |
| Scale | 100,000 | 166.7 hrs |

Plan caps on clip length and size are the same on both engines too. The one exception is
ElevenLabs' own limit on its dubbing_v1 model (Bengali): 1GB and 45 minutes.

### What Cypher costs us

Per source minute, per language:

| Component | Basis | ~$/min |
|---|---|---|
| Speaker analysis | Gemini audio in (~32 tokens/s) and transcript out, `gemini-3.6-flash` at its 2027 list price ($1.50/M in, $7.50/M out; half that until the end of 2026) | 0.0078 |
| Translation | text in and out, same model | 0.0050 |
| Chatterbox on a Modal L4 | $0.000222/s GPU plus CPU and memory; measured ~1.4 GPU-seconds per second of dubbed speech; dubbed speech ~1.2x the source; one cold start and the 120 s scale-down window spread over a ~5 minute dub | 0.0360 |
| GCS egress | voice samples to Modal, the video to the worker, ~$0.12/GB | 0.0050 |
| **Total** | | **~0.054** |

With `ELEVENLABS_API_KEY` set, a Cypher dub also calls ElevenLabs stem separation and
forced alignment once per minute of source (not per language), on top of this.

At the shared rate the 10 credits a paid minute costs cover about $0.009, so Cypher runs
at a loss per minute, as ElevenLabs does at list price outside its grant. That was a
product decision (2026-10-02): one price, so the choice of engine is about languages.
Raising `DUBBING_CREDIT_MULTIPLIER` in code raises both.

## ElevenLabs: the dubbing project API

Every new ElevenLabs dub runs on the dubbing **project** API
([create project](https://elevenlabs.io/docs/api-reference/dubbing/create-project)).
The legacy `POST /v1/dubbing` is only followed for dubs already started on it
(`vendor_dub_id = dub:<id>`); nothing new is sent there. The code is in
`packages/workers/src/processor/utils/elevenlabs-dubbing.ts`, the flow in
`dubWithElevenLabs` / `dubElevenLabsModel` in the processor.

```
per dub, per model (dubbing_v2, and dubbing_v1 only when Bengali is picked)
  find a live project with reference = <our projectId>[#generation]     (a lost create's answer)
  or POST /v1/dubbing/project  multipart: source_url, model_id, reference,
                               source_language (if the user picked one), keyterms (one field per term)
  -> store its id on dubbing_projects.vendor_projects[model]           BEFORE any target
  (v2 with no source language: wait for `ready`, read the detected language off the source transcript)
  per language without a stored target:
     find a live target for the language, or
     POST /v1/dubbing/project/{id}/language  JSON: target_language (base code or v2 dialect tag),
                                                   voice_settings: { cloning_strength } (v2 only)
     -> store project:<projectId>:<languageId> on dubbing_outputs.vendor_dub_id
  per language: poll the target (queued -> processing -> completed | stale | failed)
     re-read it for a fresh outputs.lossless_audio (signed, 1 hour), download, convert to MP3
     read the source and target transcripts -> the language's timeline; store warnings
```

What each rule is for:

- **Charging.** Creating a project charges one language up front, which the first target
  uses. So a project is stored before anything else, a resume never creates a second
  one, and before creating a project or a target the worker looks for one this dub
  already made (`findProjectByReference`, `findLanguageTarget`), in case a create went
  through but its answer never arrived. Regenerate bumps `vendor_projects.generation`,
  which is part of the reference, so a fresh start never finds the old project.
- **Failures.** A failed project or target carries an `error`, and ElevenLabs publishes it
  two ways: the API reference pages say `{ message_type, error }`, the OpenAPI spec
  `{ code, message, retryable }`. The reason is read from whichever is there (`message`,
  then `error`, then `code`); the old code read only `error.message` of the first shape
  and always said "no reason given". A target that failed with `project_failed` (as its
  `code` or its `error`) reads the project for the real cause. A failed project is forgotten (a retry makes a new one); a failed
  target only clears that language's target (a retry adds one to the same project).
- **`stale`** means a target has an output that no longer matches an edited transcript.
  Nothing here edits transcripts (editing and regenerating are Enterprise only), so it is
  taken as done and logged.
- **Concurrency.** Self-serve workspaces run 3 dubbing jobs at once per model (Enterprise
  10). A 429 or a body naming `too_many_concurrent_requests` / `system_busy` is waited out
  with jittered backoff (5 s doubling to a minute) until the dub's deadline (90 minutes,
  or 1.5 times the source length), checking for a cancel before and after every wait. It
  never fails or refunds a language by itself. Reads also survive 5xx and dropped
  connections; creates do not retry those, since they may have gone through.
- **Warnings.** `voices_not_permitted` (a speaker got a replacement voice) is stored on the
  output and shown on the dub page. Warnings are keyed on `type`, never on the message.
- **Source URL.** A project returns before ElevenLabs fetches the source, so the URL must
  stay readable for hours. The bucket is public-read, so the public URL does;
  `vendorSourceUrl` in the processor is the one place to switch to long-lived signed URLs.
- **Timeline.** After a language is delivered, both transcripts are read and mapped to the
  shared timeline shape (below). A transcript that cannot be read leaves the timeline
  empty and is logged; it never fails a delivered dub.

### Why only Bengali is on dubbing_v1

A project is fixed to one model and every target inherits it. Dubbing v2 is the default
and the better model (it has the cloning strength control and the dialect tags), and its
language table covers every language offered here except Bengali, which only the v1
table lists. So Bengali gets its own `dubbing_v1` project (no dialect, no cloning
strength, the smaller 1 GB / 45 min cap), and everything else, Hebrew, Norwegian and
Swahili included, is on v2 with the plan's own caps. A dub with Bengali and another
language is two ElevenLabs projects.

## Languages, dialects and voice

All in `packages/validations/src/consts/dubbing.ts`; public pages read the counts from
`dubbableLanguagesFor`.

| | Cypher | ElevenLabs |
|---|---|---|
| Languages | 23 (`CHATTERBOX_LANGUAGES`) | 94: `ELEVENLABS_V2_LANGUAGES` (93) plus `DUBBING_V1_LANGUAGES` (`bn`) |
| Only here | none | the other 71, from Afrikaans to Zulu |

`ELEVENLABS_V2_LANGUAGES` is the whole Dubbing v2 table from
[the dubbing overview](https://elevenlabs.io/docs/overview/capabilities/dubbing) as of
27 Sep 2026: 94 rows, less `cmn` (Mandarin Chinese), which would duplicate `zh`. The v1
table has 86 rows; Bengali is the only one of them not on v2.

The new-dub menu shows the chosen engine's count and lists, greyed out, the languages
only the other engine speaks. Cantonese is its own language on v2 (`yue`).

**Dialects** (ElevenLabs v2 only). The stored `accent` values are kept and mapped to v2
target tags in one place, `elevenLabsTargetTag`:

| Language | Stored value | Tag |
|---|---|---|
| English | american / british / australian / canadian | en-US / en-GB / en-AU / en-CA |
| English | indian (retired: no v2 dialect; label kept for history) | en |
| Spanish | castilian / latin american / argentinian / chilean | es-ES / es-MX / es-AR / es-CL |
| Portuguese | brazilian / european | pt-BR / pt-PT |
| French | french / canadian | fr-FR / fr-CA |
| Chinese | mandarin / taiwanese / cantonese | zh / zh-TW / yue |
| Arabic | egyptian | ar-EG |

**Voice mode** (`DUB_VOICE_MODES`, default `balanced`), stored on the project:

| Mode | Label | ElevenLabs cloning strength (0 to 10) | Chatterbox (TTS v2 only) |
|---|---|---|---|
| `like_me` | Keep my voice and accent | 9 | cfg_weight 0.5, exaggeration 0.5 |
| `balanced` | Balanced | 7 (ElevenLabs' default) | cfg_weight 0.5, exaggeration 0.5 |
| `native` | Sound native | 4 | cfg_weight 0 (drops the sample's accent), exaggeration 0.5 |

`cloningStrengthFor` takes one off when the source and target are in different groups
(Latin-script European, Cyrillic, Arabic-script, Indic, CJK, Southeast Asian, African;
`DUB_LANGUAGE_GROUPS`), clamps to 0..10, and makes no adjustment for an unknown source or
a language in no group. These are starting values, to tune by ear. The form shows the
voice mode on ElevenLabs always, and on Cypher only when `/dubbing/access` reports it
(`CYPHER_TTS_V2_URL` set on the API), since the frozen Modal app takes no voice controls.

**Source language** (optional, "Detect automatically" by default) and **names and terms**
(up to 50; each at most 50 characters and 5 words, none of `<>{}[]\`; trimmed and
deduplicated) are stored on the project. ElevenLabs gets them as `source_language` and
`keyterms`; Cypher gives Gemini the source language and keeps the terms untranslated.

## Output format

Picked on the new-dub page (`DubOutputFormatPicker`), sent as `outputFormat`, stored on
`dubbing_projects.output_format` (`DUB_OUTPUT_FORMATS` in `packages/validations`).

| | What comes back | Video uploaded |
|---|---|---|
| `mp4` (default for a video) | The video with the dubbed track muxed in (the MP3 track is kept for the mux) | Yes, alongside the dub |
| `mp3` (default for audio) | The dubbed track, MP3 (`libmp3lame -q:a 2`) | No |
| `wav` | The dubbed track, 16-bit PCM WAV | No |

Only a video can come back as a video; the schema refuses `mp4` for an audio file. An
audio-only dub of a video uploads just its extracted audio track and is an audio dub from
then on: `is_video` is false (no mux, no subtitles), so `is_video` means "the dub is a
video", not "the source was". `video_size` still holds the original's size, which caps a
re-extracted track on resume. The format sets the extension the worker encodes to
(`trackCodecArgs`): Cypher's mix and ElevenLabs' download are written straight to WAV,
never transcoded from MP3. Dubs from before the choice have a null `output_format`:
`dubOutputFormatOf` reads them as MP4 for a video, MP3 otherwise. A WAV track runs about
10 MB per minute at 44.1 kHz stereo, so a 3-hour dub is close to 2 GB.

## Several languages in one dub

One project (the upload), one row in `dubbing_outputs` per language. Each language:

- is priced as its own dub: `cost × languages`, checked at init and reserved at start;
- is dubbed, delivered and failed on its own. One language failing refunds only that
  language; the others finish normally;
- gets its own files: `dubbed/<projectId>/<language>.mp3` (or `.wav`), and `.mp4` for a video dub.

The per-plan limit is `maxDubLanguagesForPlan`: Starter 1, Creator 2, Pro 2, Business 3,
Scale 3 (unknown plans get 1). The API enforces it; the page shows it
(`DubLanguageTargets`). When several languages are picked, the plan's duration and size
caps are tightened by the strictest of them (Bengali's `dubbing_v1` model: 1 GB / 45 min).

Cypher dubs the languages one after another (each line is a GPU call, and running
languages side by side would only start more containers). ElevenLabs dubs them in parallel.

## Cypher's speaker algorithm

Chatterbox clones one voice per call and knows nothing about who is talking. So before
dubbing, Cypher works out who speaks when and gives each speaker their own voice sample.

### Why timing does not come from Gemini

The first design asked Gemini for each line's start and end. Measured against recordings
with known timings (synthetic two-voice dialogues built with ffmpeg's `flite`):

| Test | Lines found | Speakers right | Timestamp error |
|---|---|---|---|
| 30 s, 5 lines | 5 / 5 | yes | up to 2.8 s |
| 3.2 min, 24 lines, seconds as numbers | 24 / 24 | yes | mean 30 s, max 61 s |
| same, `MM:SS` strings | 24 / 24 | yes | mean 22 s, max 44 s |

Gemini is reliable about **who said what, in order**, and unreliable about **when**: its
times are compressed and drift further the longer the audio. Wrong times would cut other
people's speech into a speaker's voice sample and put dubbed lines seconds away from the
picture. Google's dedicated `gemini-3.5-transcribe` model has word timestamps, but it is
documented only for the Interactions API (not Vertex) and caps diarized audio at 30 minutes.

### What Cypher does instead: the audio is the clock

`packages/workers/src/processor/utils/` (`dub-segments.ts`, `cypher-analysis.ts`,
`cypher-align.ts`, `cypher-fit.ts`, `elevenlabs-audio.ts`, `cypher-tts.ts`) and the
Cypher section of the processor. Every stage stores its result on
`dubbing_projects.analysis` or in GCS before the next starts, so a failure resumes at the
next step. Stages marked *optional* need `ELEVENLABS_API_KEY` and fall back without
failing the dub.

1. **Map the speech on the mix.** One ffmpeg `silencedetect` pass (`detectSpeech`, preset
   `mix`: -35 dB, 0.3 s pauses) gives every stretch of sound.
2. **Cut windows at pauses.** ~10-minute windows (`planWindows`), each boundary on the
   longest pause within a minute of where it would fall.
3. **Separate the voices from the music** *(optional)*. Each window goes to ElevenLabs
   stem separation (`two_stems_v1`), asking for `pcm_44100`, then `mp3_44100_192`, then
   `mp3_44100_128` when the tier refuses a format (the format used is logged and stored).
   The ZIP is unpacked in a stream; the vocal stem is the file whose name says "vocal",
   the background the other one, and anything else means no stems. Each window's stems
   are padded or cut to exactly its length and stored, then joined into
   `work/stems/vocals.flac` and `background.flac`. Fallback: `analysis.stems.status =
   failed` (tried once more on the next run while the analysis is unfinished) or
   `skipped` (no key), and Cypher works on the mix as before.
4. **Re-map the speech on the vocals.** With a vocal stem, the speech map is redone on it
   (preset `vocals`: -40 dB, 0.25 s), so music under the speech no longer hides the
   pauses. A vocal stem with no speech (a music-only file) fails the dub, with a refund.
5. **Ask Gemini who said what** per window, listening to the vocal stem when there is one,
   told the source language when the user gave it (`analyzeWindow`). Lines are placed on
   the speech by pauses (`alignToSpeech`, unchanged).
6. **Time every word** *(optional)*. Each window's audio and its lines (joined by
   newlines) go to ElevenLabs forced alignment; the words are mapped back to lines in
   order (`mapAlignmentToLines`; characters for unspaced scripts such as Chinese,
   Japanese and Thai). A window takes the new times only when every line was found and
   the overall loss is under `CYPHER_ALIGNMENT_MAX_LOSS` (default 1.5; every window's loss
   is logged, to tune it). Otherwise it keeps the pause placement.
   `analysis.alignment.windows[w].timingSource` says which one each window uses.
7. **Cut a voice sample per speaker** from the vocal stem at 24 kHz (`pickReferenceLines`,
   `assignVoices`): the speaker's longest clean lines, **best first** (Chatterbox builds
   its prompt from the first 6 to 10 s of the sample and only averages the rest), skipping
   lines within 0.3 s of another speaker's (likely overlap), up to about 45 s. A speaker
   with under 3 s of clean speech borrows the main voice; if nobody has 3 s, everyone gets
   the first 2 minutes. Samples live under `work/voices/v2/`.
8. **Translate with a time budget** (`translateLines`): each line goes with its speaker and
   its length in seconds, and the prompt asks for a line that fits that time at a natural
   pace, keeps names, brands and every keyterm untranslated, and keeps the tone. Each batch
   of 80 sees the last 5 translated lines before it. Saved after every batch.
9. **Build turns** (`buildTurns`): consecutive lines of one speaker, never across a pause
   over 1.5 s, at most **300 characters** (the chunk size of the Modal app itself, so no
   call glues sentences together). Each turn carries its source end and the time it has
   before the next one starts (`available`).
10. **Speak and fit each turn** (`synthesizeTurn`): synthesize, trim the silence at both
    ends, measure; speed up with `atempo` up to `CYPHER_MAX_TEMPO` (default 1.15); if it
    still overruns by more than 0.3 s, Gemini shortens the line once (`shortenLine`) and it
    is spoken again. A take over 2.5 times the expected length for its text is a runaway:
    one retry, then it is cut to its slot plus 0.5 s. Each fitted turn is stored as PCM with
    a record `{ turnText, speaker, text, rawSeconds, fittedSeconds, tempo, shortened }`; a
    resume reuses a stored turn only if its record matches the turn it is about to speak.
11. **Assemble** (`assembleTurns`): each turn at its original time, or straight after the
    one before if that ran long (`placeOnTimeline`). If the last turns would run past the
    end of the source they are sped up within the same cap (`compressTail`), and anything
    still over is cut.
12. **Match the loudness and mix.** The original voices' integrated loudness (EBU R128 on
    the vocal stem, or on the source without one) is measured once; the dubbed speech is
    moved to it (at most 20 dB either way), mixed over the background stem with
    `amix ... normalize=0` at 44.1 kHz stereo, limited (`alimiter`, auto-level off) and
    encoded as MP3. Without stems it is the speech alone, at the matched loudness.

Speech comes from `cypherTtsFromEnv`: the Cypher TTS v2 service when `CYPHER_TTS_V2_URL`
is set (it takes the voice mode's `cfg_weight` and `exaggeration`), otherwise the frozen
Modal app with its old contract, unchanged.

Every ffmpeg command is built by a pure function (`silenceDetectArgs`, `stemToFlacArgs`,
`fitTurnArgs`, `loudnessArgs`, `mixArgs`, `muxArgs`, ...) tested as data in
`ffmpeg.spec.ts`, and run against real media in `ffmpeg.check.ts`.

Measured before these changes, on the same test recordings:

- 3.2 min, 24 lines: every line placed within 0.5 s of its true start, all speakers right.
- 30 s end to end, real Gemini and the real Modal endpoint: 2 speakers, 2 voice samples,
  5 turns each dubbed in the right voice, each turn within about 0.3 s of its original
  start. The first Modal call was a 97 s cold start, the rest 7 to 9 s each.

### Mux

For a video, each language's MP3 is muxed over the original (`-c:v copy`, AAC 192k,
`+faststart`), padded with silence (`apad` + `-shortest`). The dubbed track should run as
long as the video (ElevenLabs' always does, Cypher's does once it has a background); a
gap over 0.5 s is logged as a warning.

## Timelines

Every language stores `dubbing_outputs.timeline`, one entry per line, the same shape for
both engines (`DubTimelineSegment` in `packages/validations`):

```ts
{ id, speaker, start, end, sourceText, translation, dubStart?, dubEnd? }
```

Times are seconds from the start of the source. ElevenLabs fills it from its source and
target transcripts (`id` is ElevenLabs' segment id, `speaker` its `speaker_id`); Cypher
from its lines, translations and final placements (`id` is the line index, and
`dubStart`/`dubEnd` say where the dub of that line actually plays). A line with no
translation has `translation: null`. The dub page shows it as a collapsible list per
language; clicking a row plays the dub from that line. Nothing edits a timeline yet: the
ids are what an editor would address later (ElevenLabs segment edits and regeneration
are Enterprise only).

## Uploads: audio first, video alongside, both resumable

```
Browser                                   API                              GCS / worker
───────                                   ───                              ────────────
pick file, engine, languages
extract audio track (Mediabunny, no re-encode)
POST /dubbing/uploads ───────────────────▶ plan, languages, size, balance
                                           project row + one output per language
                                           resumable session (audio) ────▶ session URI
                                           multipart upload (video)  ────▶ uploadId
PUT audio ─────────────────────────────────────────────────────────────▶ session URI
POST /dubbing/:id/start ─────────────────▶ verify audio, reserve cost × languages,
                                           queue job ─────────────────────▶ worker: per language,
video parts, 4 at a time:                                                   Cypher or ElevenLabs
  POST /upload/video-part ───────────────▶ sign one part URL                 -> dubbed MP3
  PUT part ───────────────────────────────────────────────────────────▶
POST /upload/video-complete ─────────────▶ ListParts, verify, complete ─────▶ mux each language
                                                                            (or park on awaiting_video
                                                                             until the upload completes)
```

### Audio first

`apps/web/lib/dubbing-upload.ts` → `extractAudioTrack()` copies the audio track out of
the video with [Mediabunny](https://mediabunny.dev) (`video: { discard: true }`, no
re-encode). AAC goes into M4A, Opus and Vorbis into WebM; Gemini on Vertex accepts both.
The library loads with a dynamic `import()` (its own ~545 KB chunk), so it costs nothing
until someone dubs a video. If the browser cannot read the file, the whole file is
uploaded as the audio, and the worker handles it the old way. Audio files are never extracted.

Checked: an 11.6 MB, 60 s MP4 became a 974 KB audio-only M4A, AAC copied, exactly 60.0 s.
Two extractions are not byte-identical, which is why a resumed extraction always gets a
fresh session instead of appending to the old one.

### Resumable audio upload

The API creates the GCS resumable session server-side (`createResumableSession`) and
passes the browser's `Origin`: GCS decides a session's CORS headers from the request that
created it. The browser sends the audio in one request (fastest, per GCS). On a dropped
connection it asks the API how many bytes GCS persisted and sends the rest with
`Content-Range`; the browser never reads GCS's `Range` header. Expired sessions (a week)
are replaced.

### Parallel multipart video upload

[XML API multipart](https://docs.cloud.google.com/storage/docs/multipart-uploads), after the
dub has started:

- parts of at least 16 MiB, grown so no upload needs more than 1000 (3 GB = 192 parts);
- 4 in flight, each on a URL signed just before it is sent;
- GCS is the source of truth: resume and completion call `ListParts`, and a part only
  counts at exactly its expected size; completion checks the final object's size;
- each part retried 4 times; one part failing for good pauses the upload, nothing sent is lost.

If the video is not in when the dubbed audio is ready, the dub parks on `awaiting_video`
with a conditional update (`WHERE video_status = 'uploading'`). The API's completion flips
`video_status` first and only then picks up an `awaiting_video` dub, so exactly one side
runs the mux.

## Resuming and retrying

| What broke | What the user sees | What happens |
|---|---|---|
| Connection drop during an upload | Nothing, or "Video upload paused" with **Resume upload** | Retries with backoff; resume sends only what GCS lacks |
| Tab closed during an upload | Dub page: **View progress**, then pick the same file | Audio re-sent, then the dub starts; video sends only missing parts |
| One language failed | Its card says so, "not charged"; **Retry** | Only unfinished languages run again; finished ones are untouched |
| Dub failed before a language's audio was ready | **Retry** | That language is charged again (the failure refunded it); translation, dubbed turns and the ElevenLabs dub id are kept |
| Mux failed after the audio was ready | **Retry** | Charged again (the failure refunded it); only the mux runs |

The dub's page only shows its details, status and finished media. **Retry** and **View
progress** open the generation page (`/dashboard/dubbing/new?dub=<id>`, plus `&retry=1`
for a retry), which resumes or follows the dub there.

Cypher's speaker analysis is saved after every window, each language's translation after
every batch, and each dubbed turn as it lands, so a retry resumes inside a language, not
at its start. A resume refuses a different file (`source_fingerprint`: name, size, last modified).

## Regenerating

**Regenerate** on a dub's page opens `/dashboard/dubbing/new?from=<id>`: the same media,
dubbed again with any engine, languages, output format and voice. The previous dub's
settings are the starting point. Nothing is uploaded.

- **The source is reused, never copied.** The new dub is a row of its own with
  `source_project_id` set to the original dub, and its source columns (`audio_object`,
  `input_gs_uri`, `video_object`, ...) point at the original's objects. The worker reads
  the source from those columns and writes its scratch files under the new dub's own
  prefix, so it needed no change.
- **One media, many dubs.** Regenerating a regenerated dub goes back to the original, so
  every dub of a media hangs off one row. The list shows one row per media (with the
  newest dub's status and a dub count); the details page shows the original beside the
  dub picked, side by side from `lg` and stacked below it, and every dub of the media.
- **Delete.** A regenerated dub deletes only its outputs and its own prefix. Deleting the
  original deletes every dub regenerated from it, then the source. Either is refused while
  a dub of the media is running.
- **MP4 needs the video in storage.** An audio-only dub of a video uploaded only its
  extracted audio, so its media can be regenerated to MP3 or WAV only: MP4 shows, but
  disabled, with the reason. A media whose audio could not be extracted uploaded the whole
  file, which is the video, so MP4 is offered.
- **A new dub, a new charge.** Plan, languages, length, size and balance are checked against
  the stored duration and size, and the dub starts right away (`startDub`). If it cannot
  start, the new row is removed: nothing was charged.
- **Cypher reuses the original's speaker analysis** when it is finished and the dub is told
  the same spoken language, so Gemini does not listen to the same audio again. Only the
  original's: its stems and voice samples live under its prefix, which outlives every dub
  regenerated from it.
- A media whose upload never finished cannot be regenerated.

## Credits

- Priced per engine: see Pricing above.
- Checked (not charged) at `POST /uploads`: `cost × languages`.
- Reserved at `POST /:id/start`, per language. A conditional update stops two tabs from starting twice.
- Settled by the worker against the ffprobe duration, for all languages at once.
- **Per language, paid only when it finishes.** A language that fails at any step (the
  mux and a cancelled or expired wait for the video included) is refunded in full; a
  retry charges it again and reuses what it already had. Unfinished media is not handed out.
- Each output's `credits_consumed` is the charge it holds, so every refund gives back
  exactly what its rows hold, whoever reserved it.
- A dub whose job died without settling (a worker crash, a database outage) is settled
  when the stalled job is detected, or else the next time the dub is read.

## Statuses

Project: `uploading → queued → processing → cloning → (awaiting_video) → completed | failed`.
A project is `failed` when any language failed (the others keep their results); the job
itself only fails when every language did.

Output (per language): `pending → dubbing → (awaiting_video) → completed | failed`.

## Database

Migrations `packages/supabase/migrations/20260926000000_dubbing_resumable_uploads.sql`,
`20260928000000_dubbing_voice_mode_and_timelines.sql` and
`20261004000000_dubbing_output_format.sql` and `20261005000000_dubbing_regenerate.sql`.

`dubbing_projects` gains:

| Column | Purpose |
|---|---|
| `engine` | `cypher` or `elevenlabs` (null on dubs from before the choice) |
| `audio_object`, `audio_size`, `audio_content_type`, `audio_extracted`, `audio_session_uri` | The audio the dub reads and its upload session |
| `video_object`, `video_upload_id`, `video_part_size`, `video_size`, `video_content_type`, `video_status` | The multipart video upload |
| `source_fingerprint` | Refuses a different file on resume |
| `analysis` | Cypher: speech map, windows, speakers, placed lines; since version 2 also `stems`, `alignment`, `loudness` |
| `source_language` | What the source is spoken in; null means detect it |
| `voice_mode` | `like_me`, `balanced` (default) or `native` |
| `keyterms` | Names and terms kept as they are (`text[]`, default empty). The web app no longer asks for them; the API still accepts them |
| `vendor_projects` | ElevenLabs project per model: `{ dubbing_v2, dubbing_v1 }`, plus `generation` on dubs from the removed ElevenLabs regenerate |
| `output_format` | `mp4`, `mp3` or `wav`; null on dubs from before the choice |
| `source_project_id` | The original dub a regenerated one belongs to; null on an original. Indexed, not a foreign key (`project_id` is not unique) |

New table `dubbing_outputs`: `language`, `accent`, `status`, `translation` (Cypher),
`segment_count` / `segments_done`, `vendor_dub_id` (ElevenLabs), `dubbed_audio_url`,
`dubbed_url`, `credits_consumed`, `error_message`, and since the second migration
`timeline` and `warnings`. Unique per project and language, owner-only
RLS select. No foreign key: `dubbing_projects.project_id` has no unique index, and adding one
could fail on existing data, so the API deletes a project's outputs itself.

Older dubs (one language on the project row) still show and download: the API presents
them as one output, and gives them an output row the first time they are run again.

## API

Removed: `POST /dubbing/sign-upload`, `POST /dubbing`.

| Route | Does |
|---|---|
| `GET /dubbing/access` | Now also returns `maxLanguages`, and `creditsPerSecond` per engine (`{ cypher, elevenlabs }`) |
| `POST /dubbing/uploads` | Takes `engine`, `targets: [{ language, accent? }]` and `outputFormat`; checks plan, languages, size, balance; creates the project and its outputs; opens both uploads |
| `GET /dubbing/:id/upload` | Upload progress from GCS |
| `POST /dubbing/:id/upload/audio-session` | Fresh audio session |
| `POST /dubbing/:id/start` | Verifies the audio, reserves every language, queues the job (idempotent) |
| `POST /dubbing/:id/upload/video-part` | Signed URL for one part |
| `POST /dubbing/:id/upload/video-complete` | Assembles the parts; queues the mux if a dub is waiting |
| `POST /dubbing/:id/resume` | Retry the unfinished languages from where they stopped |
| `POST /dubbing/:id/cancel` | Cancel whatever the dub is doing: stop its job, end a wait for the video (refunded), or discard a dub that never started |
| `POST /dubbing/:id/regenerate` | Dub the media again with `engine`, `targets`, `outputFormat`, `sourceLanguage`, `voiceMode`; reuses the stored source and starts right away. Returns `{ projectId, jobId }` |
| `GET /dubbing/:id` | Now returns `engine`, `speakerCount`, `outputs` (one per language), `sourceProjectId`, `durationSeconds`, `sourceIsVideo` and `sourceHasVideo` |
| `GET /dubbing/:id/group` | Every dub of the media, from any of them: the original first, then each regenerated dub |
| `GET /dubbing` | One row per media: originals only, each with `languages` across all its dubs, `dub_count`, and the newest dub's status |

Removed: the old ElevenLabs regenerate (it had no UI once the dub's page became read-only;
see Regenerating for its replacement). Unchanged: stop, status SSE (now without media URLs:
it is unauthenticated). Delete now also removes the outputs and `dubbed/<projectId>/`, and
on an original every dub regenerated from it.

## Storage layout

```
<userId>/dubbing/<projectId>/
  audio.m4a | audio.webm            extracted audio (or the original file itself)
  <original file name>              original video (multipart)
  work/analysis/window-000.flac     Cypher: windows Gemini listens to
  work/stems/window-000-vocals.flac Cypher: each window's stems, as they land
  work/stems/vocals.flac            Cypher: the voices, joined
  work/stems/background.flac        Cypher: music and effects, joined
  work/voices/v2/S1.wav ...         Cypher: one voice sample per speaker (best line first, 24 kHz)
  work/<language>/turn-0000.pcm     Cypher: dubbed turns, fitted
  work/<language>/turn-0000.json    Cypher: each turn's record (text, tempo, shortened)
dubbed/<projectId>/<language>.mp3   dubbed track (every dub; .wav when picked)
dubbed/<projectId>/<language>.mp4   dubbed video
```

## Changes you need to make

### Google Cloud Storage

**1. CORS (required).** The bucket's CORS still lists the old domain
(`https://tryscriptai.com`), not `https://trycreatorai.com`. Checked live: a preflight from
`https://trycreatorai.com` gets no `Access-Control-Allow-Origin`, so browser uploads from
production are refused today, old flow included.

```bash
cat > cors.json <<'EOF'
[{
  "origin": ["https://trycreatorai.com", "http://localhost:3000"],
  "method": ["GET", "PUT"],
  "responseHeader": ["Content-Type", "Content-Range", "Range", "ETag", "x-goog-resumable"],
  "maxAgeSeconds": 3600
}]
EOF
gcloud storage buckets update gs://creator-ai-dubbing --cors-file=cors.json
```

`www.trycreatorai.com` redirects to the apex (`Caddyfile`), so it is not listed. Add any
preview or staging origin. (The video bucket, `GCS_VIDEO_BUCKET`, lists the same old domain.)

**2. Lifecycle (required).** A `Delete` rule does not touch unfinished multipart uploads,
and their parts are billed until completed or aborted. `--lifecycle-file` replaces every
rule, so this keeps the existing `staging/` one:

```bash
cat > lifecycle.json <<'EOF'
{"lifecycle": {"rule": [
  {"action": {"type": "Delete"}, "condition": {"age": 1, "matchesPrefix": ["staging/"]}},
  {"action": {"type": "AbortIncompleteMultipartUpload"}, "condition": {"age": 7}}
]}}
EOF
gcloud storage buckets update gs://creator-ai-dubbing --lifecycle-file=lifecycle.json
```

**3. IAM: no change.** `roles/storage.objectAdmin` already includes `storage.multipartUploads.*`.

**4. Public read: keep.** Modal fetches voice samples and ElevenLabs fetches the audio by public URL.

### Environment

- `ELEVENLABS_API_KEY` must be set for the **worker** (`packages/workers/.env` in
  production). It is set locally; the worker only needs it once someone picks ElevenLabs.
- `MODAL_API_URL`, `GOOGLE_*` and `GCS_DUBBING_BUCKET`: unchanged.
- `ELEVENLABS_API_KEY` on the **worker** now also turns on Cypher's stem separation and
  forced alignment. A scoped key needs dubbing, speech to text / forced alignment, and
  music (stem separation) access.
- `CYPHER_ALIGNMENT_MAX_LOSS` (worker, optional, default `1.5`): the highest forced
  alignment loss a window's word timing is used at. Every window's loss is logged.
- `CYPHER_MAX_TEMPO` (worker, optional, default `1.15`, clamped to 1..1.5): the most a
  dubbed turn is sped up to fit its slot.
- `CYPHER_TTS_V2_URL` and `CYPHER_TTS_V2_TOKEN` (worker): the Cypher TTS v2 service base
  URL and its bearer token. Leave unset until the service is deployed; the frozen Modal
  app is used meanwhile. Set `CYPHER_TTS_V2_URL` on the **API** too, to show the voice
  mode on Cypher. See `services/cypher-tts/README.md`.
- `SMOKE_ELEVENLABS=1` (a developer machine only): lets `packages/workers/scripts/dubbing-smoke.ts` run.

### Deploy

1. Apply the migrations (`supabase db push` or your usual flow):
   `20260926000000_dubbing_resumable_uploads.sql` (schema),
   `20260927000000_blog_dubbing_language_count.sql` (blog copy, 29 to 33 languages),
   `20260928000000_dubbing_voice_mode_and_timelines.sql` (schema: the worker reads the new
   columns, so this must be in before the worker is deployed) and
   `20260928000100_blog_dubbing_language_count_94.sql` (blog copy, 33 to 94),
   `20261004000000_dubbing_output_format.sql` and `20261005000000_dubbing_regenerate.sql`
   (schema: the API reads both new columns on every dub read, so they must be in before it
   is deployed).
2. Regenerate `llms.txt` once the blog migrations are in, so the two comparison-table rows
   it quotes pick up the new count: `pnpm --filter web llms:generate`. (The header line was
   already moved to 94 by hand in this change; the generator writes the same line.)
3. Apply the CORS and lifecycle config above.
4. Deploy API, worker and web together (new routes, new job shape, new response shape).
5. Modal: nothing to deploy. `modal/dubbing_app.py` is untouched. The Cypher TTS v2
   service (`services/cypher-tts`, `modal/dubbing_app_v2.py`) is deployed separately,
   whenever a GPU host is picked; see its README.

## Public pages

Every public number about dubbing is read from the constants, not typed in, so a price
or language change updates the pages with it:

- **Pricing page and landing pricing cards**: one "Dubbing" row, hours or minutes per
  plan (`dubbingAllowanceFor(plan)`), the same on either engine.
- **Settings, usage panel**: the user's own plan's dubbing hours.
- **`/features/dubbing`**: language counts per engine, both engines, multiple speakers,
  the shared hours, and FAQs on languages and speakers.
- **Signup page, new-dub page, engine cards**: language counts. The new-dub page shows
  the credits a file will cost once it is picked.
- **`llms.txt` / `llms-full.txt`**: the generator's header now quotes the counts and the
  every-plan pricing, and no longer claims a 60-second Starter cap.
- **Blog**: migrations move "29 languages" to 33, then to 94, in the two comparison tables
  and the dubbing CTA. Sentences about other tools' language counts are unchanged.

Still to decide: the dubbing CTA on six posts is titled "Dub a 60-second video now" and
says "The free plan dubs up to 60 seconds per video". Starter's cap is 45 minutes per
clip now, and its 500 credits cover about 2.8 minutes, so the offer understates what the
free plan does. It is marketing copy, so it was left for a decision.

## Testing

Automated (`pnpm test`, plus the two self-checks):

- `packages/validations/src/consts/dubbing.check.ts`: engines and language counts, Bengali
  as the only v1 language, the caps it tightens, dialect tags for every stored accent
  (including the retired `indian`), voice modes, cloning strength (modes, near and far
  pairs, unknown source, clamping), Chatterbox parameters, and the init schema's
  `sourceLanguage`, `voiceMode` and `keyterms` rules
  (`npx tsx packages/validations/src/consts/dubbing.check.ts`).
- `packages/workers/src/processor/utils/elevenlabs-dubbing.spec.ts`: the exact project form
  (and no `target_language`), target JSON with and without `voice_settings`, the fallback
  when voice settings are refused, every project and target status including `stale`,
  reasons read from `error.error`, 429 / concurrency backoff and a cancel during it, a
  fresh signed URL before each download and after an expired one, legacy `dub:` rows,
  transcript-to-timeline mapping, and the lookups for lost creates.
- `packages/workers/src/processor/dubbing.processor.spec.ts`: ElevenLabs end to end against
  an in-memory database: one project stored before any target, resume after the project
  and after one of several targets, Bengali plus another language as two projects, a
  concurrency error that does not refund, a transcript failure that does not fail a
  delivered dub, failed targets and projects, cancel, legacy dubs, repricing.
- `packages/workers/src/processor/dubbing.processor.cypher.spec.ts`: Cypher end to end:
  stems, speech on the vocals, alignment, voice samples from the vocals, the mix over the
  background; each fallback (stems failing or unidentifiable, no key, alignment loss);
  older analyses upgraded without new Gemini calls; music-only, silent and audio-less
  files failing with a refund; runaway and shortened turns; resume reuse; cancel.
- `cypher-align.spec.ts`, `cypher-fit.spec.ts`, `dub-segments.spec.ts`,
  `cypher-analysis.spec.ts`, `elevenlabs-audio.spec.ts`, `cypher-tts.spec.ts`,
  `ffmpeg.spec.ts`: the pure logic and the argument builders.
- `packages/workers/src/processor/utils/ffmpeg.check.ts`: every ffmpeg command against real
  media (needs ffmpeg): both speech presets, raw PCM stems, joining, trimming, atempo,
  loudness, the mix and the mux (`npx tsx packages/workers/src/processor/utils/ffmpeg.check.ts`).
- `apps/api/src/dubbing/dubbing.service.spec.ts`: the new fields stored, resume keeping the
  project and re-charging what failed, refunds on cancel and on a job that died unsettled,
  only finished media in `getDub`, timelines, voice mode engines in `/access`.
- `apps/web/components/__tests__/dubbing-options.test.tsx`: the voice mode picker, the
  timeline and its seek.
- `services/cypher-tts/test_server.py`: request validation with the model replaced
  (`python -m pytest -q` in that folder).

Against the real ElevenLabs API, with a key (spends credits: one language, one stem
separation, one alignment):

```bash
SMOKE_ELEVENLABS=1 ELEVENLABS_API_KEY=... \
  npx tsx packages/workers/scripts/dubbing-smoke.ts ./clip.mp4 --target es --source en --mode balanced --keyterm "Creator AI"
```

Manual, after the migrations and bucket changes:

1. Cypher, a video with two or more people over music, two languages: "Speakers: N", each
   person in their own voice, **the music still there**, each language's timeline filled.
2. ElevenLabs, same video, English (British) and Spanish (Mexico), voice mode "Sound
   native": two dialects heard; the timeline shows ElevenLabs' lines.
3. ElevenLabs with Bengali and Spanish: two ElevenLabs projects (worker log), both dubbed.
4. Hebrew on ElevenLabs with a 60-minute clip on a paid plan: accepted (v2 cap, not 45 min).
5. A spoken language that equals a target: the form greys it out; the API refuses it.
6. A clip that says a brand name: the dub keeps it untranslated (Cypher's prompts keep
   names of people, brands, products and places by default).
7. On Starter, a second language cannot be added; on Creator, a third cannot.
8. The language menu shows each engine's count and greys out the other engine's languages.
9. Mid video upload, close the tab; on the dub's page press **View progress**, pick the same
   file and it continues.
10. Stop the worker mid-dub, restart it, press **Retry**: the log resumes at "line k of N",
    and on ElevenLabs no second project appears in the ElevenLabs dashboard.
11. A music-only file: fails with "No speech was found", not charged.

## Known limits

- **Upload speed is still the user's bandwidth.** The video uploads while the dub runs,
  which hides most of the wait but does not shrink it.
- **Music under the speech** is handled by the vocal stem when stem separation works;
  without it (no key, a refused request), music still hides the pauses and lines are
  spread by their share of the text.
- **Stem separation input size** on a long source: each 10-minute window is sent as
  44.1 kHz FLAC (tens of MB). If ElevenLabs refuses that size, Cypher falls back to the mix.
- **The language table** in `ELEVENLABS_V2_LANGUAGES` is a copy of ElevenLabs' v2 table.
  When ElevenLabs adds a language, add its code there and its label in
  `supportedLanguages`, and copy the blog count migration with the new number.
- **Overlapping speech** is attributed to one speaker per line.
- **Speaker ids across windows** rely on Gemini matching voices to earlier descriptions.
  Within one 10-minute window it is consistent; a recording with many similar voices
  could mix two of them up across windows.
- **Worker disk**: the mux downloads the video and writes one output at a time (up to
  2 × 3 GB per job, two jobs at a time).
- **Lip sync**: timing follows the original, but a translation that runs longer pushes
  the lines after it back.
