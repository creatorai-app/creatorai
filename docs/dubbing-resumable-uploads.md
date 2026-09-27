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
| Languages offered | 20 (Cypher only) | **33** in total: ElevenLabs all 33, Cypher all **23** Chatterbox speaks |
| Languages per dub | 1 | Starter 1, Creator/Pro **2**, Business/Scale **3**. One output each |
| Speakers | One cloned voice for everyone | Every speaker detected and dubbed in their own cloned voice |
| Timing | Speech concatenated end to end | Each line placed back at its original time |
| Bytes before dubbing starts | The whole file (1 GB) | The audio track only (tens of MB) |
| Video upload | One request, before dubbing | Parallel parts, **while** dubbing runs |
| Dropped connection / closed tab | Start over | Continue from what GCS already has |
| Dub fails halfway | Start over, pay again | Retry resumes at the first unfinished step, per language |
| Dubbed track format | WAV (Cypher) | MP3, whichever engine made it; MP4 for video |

## The two engines

Picked on the new-dub page (`DubEngineCards`), stored on `dubbing_projects.engine`.
Constants live in `packages/validations/src/consts/dubbing.ts` (`DUB_ENGINES`,
`DUB_ENGINE_INFO`, `dubEngineLabel`).

| | Cypher (in-house dubbing) | ElevenLabs |
|---|---|---|
| Runs on | Gemini (Vertex) + Chatterbox on Modal | ElevenLabs Dubbing API |
| Languages | 23: every language Chatterbox Multilingual speaks | 33: 29 on the default route, plus Bengali, Hebrew, Norwegian and Swahili on the `dubbing_v1` route |
| Accents | None (Chatterbox copies the accent of the voice sample) | Yes, for en, es, pt, fr, zh (not on `dubbing_v1`) |
| Speakers | Our own algorithm, below | ElevenLabs' own detection |
| Price (paid plans) | 1 credit per second, per language | 1/6 credit per second, per language |
| Our cost | ~$0.054 per minute (breakdown below) | ~$0.24 per minute at list price, per language |

## Pricing: per second, per engine, per language

Both engines bill the same way: credits per second of source, per language dubbed, on
every plan. Each has its own rate (`packages/validations/src/consts/credits.ts`):

| | Cypher | ElevenLabs |
|---|---|---|
| Paid plans | `CYPHER_DUBBING_CREDIT_MULTIPLIER` = **1**/s (60/min) | `DUBBING_CREDIT_MULTIPLIER` = **1/6**/s (10/min) |
| Starter | 3/s (the trial rate, same on both) | 3/s |
| Env override (no deploy) | `CYPHER_DUBBING_CREDIT_MULTIPLIER` | `DUBBING_CREDIT_MULTIPLIER` |

`paidDubbingMultiplier(engine, env)` resolves an engine's rate with its override, and the
API (reserve), the worker (settle) and the new-dub form (estimate, via `/dubbing/access`)
all go through it, so the three cannot disagree. An override only moves the engine it names.

### How Cypher's rate was worked out

The codebase's margin rule: every feature clears 80% gross margin at the lowest price a
credit sells for (Pro annual, $0.004875), so a credit may carry at most $0.000975 of
vendor cost (`creditsForCost`). Cypher's cost per source minute, per language:

| Component | Basis | ~$/min |
|---|---|---|
| Speaker analysis | Gemini audio in (~32 tokens/s) and transcript out, `gemini-3.6-flash` at its 2027 list price ($1.50/M in, $7.50/M out; half that until the end of 2026) | 0.0078 |
| Translation | text in and out, same model | 0.0050 |
| Chatterbox on a Modal L4 | $0.000222/s GPU plus CPU and memory; measured ~1.4 GPU-seconds per second of dubbed speech; dubbed speech ~1.2x the source; one cold start and the 120 s scale-down window spread over a ~5 minute dub | 0.0360 |
| GCS egress | voice samples to Modal, the video to the worker, ~$0.12/GB | 0.0050 |
| **Total** | | **~0.054** ($0.0009/s) |

`creditsForCost(0.0009)` = **1 credit per second**. What a month buys:

| Plan | Credits | ElevenLabs | Cypher |
|---|---|---|---|
| Starter | 500 | 2.8 min | 2.8 min |
| Creator | 3,000 | 5.0 hrs | 50.0 min |
| Pro | 8,000 | 13.3 hrs | 2.2 hrs |
| Business | 50,000 | 83.3 hrs | 13.9 hrs |
| Scale | 100,000 | 166.7 hrs | 27.8 hrs |

ElevenLabs looks more generous only because its rate is the grant-funded promo that
`credits.ts` documents: at list price it runs well below the margin target, and its
comment there explains how to raise it when the grant ends. At list prices Cypher costs
us about a quarter of what ElevenLabs does. If Cypher should be the cheaper option for
users, lower `CYPHER_DUBBING_CREDIT_MULTIPLIER`; the public pages follow the constants.

### ElevenLabs and speakers (research)

From the [create dubbing API](https://elevenlabs.io/docs/api-reference/dubbing/create) and
[dubbing overview](https://elevenlabs.io/docs/capabilities/dubbing):

- `num_speakers`: "Set to 0 to automatically detect the number of speakers". We send 0.
- It detects "multiple speakers, even with overlapping speech", up to 32 per file.
- Voice cloning is on by default, per speaker (`disable_voice_cloning` would use library voices instead).
- `target_lang` takes one language, so N languages are N dubs. They run in parallel on ElevenLabs.
- API limits: 3 GB and 180 minutes per source, the same as our paid caps.
- The dubbed file comes back as MP3 or MP4 ([get audio](https://elevenlabs.io/docs/api-reference/dubbing/audio/get)). We always convert it to MP3.

So ElevenLabs needed no speaker work from us.

### ElevenLabs models and languages (research)

ElevenLabs now documents two dubbing models ([languages](https://elevenlabs.io/docs/help-center/product/dubbing/which-languages-are-supported-in-dubbing)):
Dubbing v2 (alpha, 104 languages, the default in their app) and Dubbing v1 (88 languages,
"the same languages as the Eleven v3 model", Bengali among them). The plain
`POST /v1/dubbing` route this code calls does not document which model it runs; what is
known is that it has served our 29 languages in production and refused Bengali. So:

- the 29 stay on `POST /v1/dubbing`;
- Bengali, Hebrew, Norwegian and Swahili go through the project API pinned to
  `model_id=dubbing_v1` (`DUBBING_V1_LANGUAGES`), which the v1 table lists for all four.
  That route caps at 1 GB / 45 min and takes no accent, and only on ElevenLabs:
  `maxDubSecondsForPlan(plan, languages, engine)` does not hold a Cypher dub in
  Norwegian to an ElevenLabs route limit.

Chatterbox Multilingual's [model card](https://huggingface.co/ResembleAI/chatterbox) lists 23
languages; Cypher previously offered 20 because Hebrew, Norwegian and Swahili had no label.
All 23 are offered now, and every one is also on ElevenLabs, so the total is 33. The code is in
`packages/workers/src/processor/utils/elevenlabs-dubbing.ts` (moved out of the processor,
where it sat unused while Cypher was the only engine). The dub id is saved on the output
row the moment it is created, so a resumed run follows that dub instead of paying for a
second one. If ElevenLabs itself reports the dub failed, the id is cleared so a retry starts fresh.

## Several languages in one dub

One project (the upload), one row in `dubbing_outputs` per language. Each language:

- is priced as its own dub: `cost × languages`, checked at init and reserved at start;
- is dubbed, delivered and failed on its own. One language failing refunds only that
  language; the others finish normally;
- gets its own files: `dubbed/<projectId>/<language>.mp3` and `.mp4`.

The per-plan limit is `maxDubLanguagesForPlan`: Starter 1, Creator 2, Pro 2, Business 3,
Scale 3 (unknown plans get 1). The API enforces it; the page shows it
(`DubLanguageTargets`). When several languages are picked, the plan's duration and size
caps are tightened by the strictest of them (Bengali's `dubbing_v1` route: 1 GB / 45 min).

Cypher dubs the languages one after another (each line is a GPU call, and running
languages side by side would only start more Modal containers). ElevenLabs dubs them in parallel.

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

`packages/workers/src/processor/utils/dub-segments.ts` and `cypher-analysis.ts`:

1. **Map the speech.** One ffmpeg `silencedetect` pass over the audio track (`detectSpeech`)
   gives every stretch of sound between pauses of 0.3 s or more, with exact times.
2. **Cut windows at pauses.** The source is analysed in ~10-minute windows
   (`planWindows`), each boundary moved to the longest pause within a minute of where it
   would fall, so no word is split between windows.
3. **Ask Gemini who said what.** For each window, Gemini returns the speakers and the
   lines in order, speaker and text only, no times (`analyzeWindow`). It is given the
   speakers heard in earlier windows (id plus a short voice description) so one person
   keeps one id across the recording.
4. **Place every line on the speech** (`alignToSpeech`). Consecutive lines of one speaker
   form a turn. A dynamic programme splits the window's stretches of speech into one
   consecutive group per turn, choosing the split whose group lengths best match each
   turn's share of the text. Every turn boundary lands on a real pause, which is where
   speakers change. Within a turn, its sentences are spread over the turn's own speech by
   their share of the text.
5. **Cut a voice sample per speaker** (`pickReferenceLines`, `assignVoices`). Each speaker's
   longest lines, trimmed 0.15 s at each edge, up to about 45 s, joined into one WAV. A
   speaker with under 3 s of usable speech (an interjection, a misattribution) borrows the
   voice of whoever speaks most. If nobody has 3 s, everyone gets the first 2 minutes.
6. **Translate line by line** (`translateLines`), in batches of 80, saved after every batch.
7. **Dub turn by turn** (`buildTurns`). Consecutive lines of one speaker, less than 1.5 s
   apart and under 1,500 characters together, are one Modal call using that speaker's
   sample. Each result is stored as raw 16-bit PCM, so its byte count is its exact duration.
8. **Assemble on the timeline** (`placeOnTimeline`). Each turn starts at its original
   time, or straight after the previous turn if that one ran long (translations often
   do), never overlapping. Gaps are silence. The track is encoded to MP3.

Measured on the same test recordings:

- 3.2 min, 24 lines: every line placed within 0.5 s of its true start, all speakers right.
- 30 s end to end, real Gemini and the real Modal endpoint: 2 speakers, 2 voice samples,
  5 turns each dubbed in the right voice, each turn within about 0.3 s of its original
  start; longer Spanish lines pushed the later ones back (7.28 s instead of 6.44 s)
  without overlap. The first Modal call was a 97 s cold start, the rest 7 to 9 s each.

The Modal app is unchanged. Called without `output_put_url`, its existing endpoint
returns the WAV bytes, and each call simply gets a different `reference_url` per speaker.

### Mux

For a video, each language's MP3 is muxed over the original (`-c:v copy`, `+faststart`).
The dubbed audio is padded with silence to the video's length (`apad` + `-shortest`),
because a dub now ends at its last spoken line and a silent or music-only ending would
otherwise be cut off.

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
| Tab closed during an upload | Dub page: **Finish uploading** (pick the same file) | Audio re-sent, then the dub starts; video sends only missing parts |
| One language failed | Its card says so, "not charged"; **Retry from where it stopped** | Only unfinished languages run again; finished ones are untouched |
| Dub failed before a language's audio was ready | **Retry** | That language is charged again (the failure refunded it); translation, dubbed turns and the ElevenLabs dub id are kept |
| Mux failed after the audio was ready | Its dubbed audio plays; **Retry** | Free; only the mux runs again |
| Regenerate | Same button as before | Every language from scratch, speakers detected again |

Cypher's speaker analysis is saved after every window, each language's translation after
every batch, and each dubbed turn as it lands, so a retry resumes inside a language, not
at its start. A resume refuses a different file (`source_fingerprint`: name, size, last modified).

## Credits

- Priced per engine: see Pricing above.
- Checked (not charged) at `POST /uploads`: `cost × languages`.
- Reserved at `POST /:id/start`, per language. A conditional update stops two tabs from starting twice.
- Settled by the worker against the ffprobe duration, for all languages at once.
- **Per language, earned once its dubbed audio exists.** A language failing before that
  is refunded; after it (the mux), the charge stands and the retry that finishes the mux is free.

## Statuses

Project: `uploading → queued → processing → cloning → (awaiting_video) → completed | failed`.
A project is `failed` when any language failed (the others keep their results); the job
itself only fails when every language did.

Output (per language): `pending → dubbing → (awaiting_video) → completed | failed`.

## Database

Migration `packages/supabase/migrations/20260926000000_dubbing_resumable_uploads.sql`.

`dubbing_projects` gains:

| Column | Purpose |
|---|---|
| `engine` | `cypher` or `elevenlabs` (null on dubs from before the choice) |
| `audio_object`, `audio_size`, `audio_content_type`, `audio_extracted`, `audio_session_uri` | The audio the dub reads and its upload session |
| `video_object`, `video_upload_id`, `video_part_size`, `video_size`, `video_content_type`, `video_status` | The multipart video upload |
| `source_fingerprint` | Refuses a different file on resume |
| `analysis` | Cypher: speech map, windows, speakers, placed lines |

New table `dubbing_outputs`: `language`, `accent`, `status`, `translation` (Cypher),
`segment_count` / `segments_done`, `vendor_dub_id` (ElevenLabs), `dubbed_audio_url`,
`dubbed_url`, `credits_consumed`, `error_message`. Unique per project and language, owner-only
RLS select. No foreign key: `dubbing_projects.project_id` has no unique index, and adding one
could fail on existing data, so the API deletes a project's outputs itself.

Older dubs (one language on the project row) still show and download: the API presents
them as one output, and gives them an output row the first time they are run again.

## API

Removed: `POST /dubbing/sign-upload`, `POST /dubbing`.

| Route | Does |
|---|---|
| `GET /dubbing/access` | Now also returns `maxLanguages`, and `creditsPerSecond` per engine (`{ cypher, elevenlabs }`) |
| `POST /dubbing/uploads` | Takes `engine` and `targets: [{ language, accent? }]`; checks plan, languages, size, balance; creates the project and its outputs; opens both uploads |
| `GET /dubbing/:id/upload` | Upload progress from GCS |
| `POST /dubbing/:id/upload/audio-session` | Fresh audio session |
| `POST /dubbing/:id/start` | Verifies the audio, reserves every language, queues the job (idempotent) |
| `POST /dubbing/:id/upload/video-part` | Signed URL for one part |
| `POST /dubbing/:id/upload/video-complete` | Assembles the parts; queues the mux if a dub is waiting |
| `POST /dubbing/:id/resume` | Retry the unfinished languages from where they stopped |
| `GET /dubbing/:id` | Now returns `engine`, `speakerCount` and `outputs` (one per language) |
| `GET /dubbing` | Each dub now carries `languages` (one query for all outputs, not one per dub) |

Unchanged: regenerate, stop, status SSE, delete (which now also removes the outputs and
`dubbed/<projectId>/`).

## Storage layout

```
<userId>/dubbing/<projectId>/
  audio.m4a | audio.webm            extracted audio (or the original file itself)
  <original file name>              original video (multipart)
  work/analysis/window-000.flac     Cypher: windows Gemini listens to
  work/voices/S1.wav ...            Cypher: one voice sample per speaker
  work/<language>/turn-0000.pcm     Cypher: dubbed turns
dubbed/<projectId>/<language>.mp3   dubbed track (every dub)
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
- `CYPHER_DUBBING_CREDIT_MULTIPLIER` (optional, API **and** worker): overrides Cypher's
  per-second rate. Leave unset to use the default of 1. Set it in both places or the
  reserve and the settle will disagree.
- `MODAL_API_URL`, `GOOGLE_*` and `GCS_DUBBING_BUCKET`: unchanged.

### Deploy

1. Apply the migrations (`supabase db push` or your usual flow):
   `20260926000000_dubbing_resumable_uploads.sql` (schema) and
   `20260927000000_blog_dubbing_language_count.sql` (blog copy, 29 to 33 languages).
2. Regenerate `llms.txt` once the blog migration is in, so the two comparison-table rows
   it quotes pick up the new count: `pnpm --filter web llms:generate`.
3. Apply the CORS and lifecycle config above.
4. Deploy API, worker and web together (new routes, new job shape, new response shape).
5. Modal: nothing to deploy. `modal/dubbing_app.py` is untouched.

## Public pages

Every public number about dubbing is read from the constants, not typed in, so a price
or language change updates the pages with it:

- **Pricing page and landing pricing cards**: one "Dubbing with ..." row per engine,
  hours or minutes per plan (`dubbingAllowanceFor(plan, engine)`).
- **Settings, usage panel**: the user's own plan, both engines.
- **`/features/dubbing`**: language counts per engine, both engines, multiple speakers,
  per-engine hours, and FAQs on languages and speakers.
- **Signup page, new-dub page, engine cards**: language counts (engine cards also show
  credits per minute for the user's plan).
- **`llms.txt` / `llms-full.txt`**: the generator's header now quotes the counts and the
  every-plan pricing, and no longer claims a 60-second Starter cap.
- **Blog**: a migration moves "29 languages" to 33 in the two comparison tables and the
  dubbing CTA. Sentences about other tools' language counts are unchanged.

Still to decide: the dubbing CTA on six posts is titled "Dub a 60-second video now" and
says "The free plan dubs up to 60 seconds per video". Starter's cap is 45 minutes per
clip now, and its 500 credits cover about 2.8 minutes, so the offer understates what the
free plan does. It is marketing copy, so it was left for a decision.

## Testing

Automated:

- `apps/api/src/dubbing/dubbing.service.spec.ts` (62 tests): plan and language limits
  (Starter 1, Creator/Pro 2, Business/Scale 3), per-language pricing, stricter caps with
  a `dubbing_v1` language, one output row per language, start idempotency and the two-tab
  race, per-language refunds on queue failure and cancel, resume re-charging only
  undelivered languages, regenerate resetting everything, older single-language dubs,
  multipart completion checks, delete cleanup.
- `packages/workers/src/processor/utils/dub-segments.spec.ts` (25 tests): silence-log
  parsing, window planning at pauses, alignment (turns on pauses, sentences within turns,
  no line starting in a pause, the no-pause fallback), turns, timeline placement, voice
  samples, voice assignment, sentence splitting.
- `packages/workers/src/processor/utils/cypher-analysis.spec.ts`: merging windows.
- `packages/validations/src/consts/dubbing.check.ts`: engines, languages per engine
  (23 and 33), `dubbing_v1` routing and its ElevenLabs-only caps, accents, per-plan
  limits, per-engine rates and env overrides, the published allowances, the init schema
  (`npx tsx packages/validations/src/consts/dubbing.check.ts`).
- The API spec also checks each engine's rate in `/access`, that an env override moves
  only its own engine, that an ElevenLabs dub reserves at the ElevenLabs rate, and that a
  Cypher dub in Norwegian is not held to the ElevenLabs route cap.

Against the real services (throwaway `__upload-self-test/` and `__cypher-self-test/`
prefixes, deleted after): multipart upload, abort, resumable session and resume, CORS
preflights, Gemini speaker analysis and translation, and the Cypher end-to-end run above.

Manual, after the migration and bucket changes:

1. Cypher, a video with two or more people, two languages: the detail page shows
   "Speakers: N", and each language has every person in their own voice.
2. ElevenLabs, same video, an English target with an accent.
3. On Starter, a second language cannot be added; on Creator, a third cannot.
4. The engine cards show 23 and 33 languages and each engine's credits per minute; the
   cost badge changes when you switch engine.
5. Mid video upload, close the tab; the list shows "Upload unfinished"; pick the same
   file on the dub's page and it continues from the missing parts.
6. Stop the worker mid-dub, restart it, press **Retry**: the log resumes at "line k of N".

## Known limits

- **Upload speed is still the user's bandwidth.** The video uploads while the dub runs,
  which hides most of the wait but does not shrink it.
- **Music under the speech** hides the pauses the speaker timing relies on. Lines are then
  spread by their share of the text, which is less exact; speaker attribution still comes
  from Gemini.
- **Overlapping speech** is attributed to one speaker per line.
- **Speaker ids across windows** rely on Gemini matching voices to earlier descriptions.
  Within one 10-minute window it is consistent; a recording with many similar voices
  could mix two of them up across windows.
- **Worker disk**: the mux downloads the video and writes one output at a time (up to
  2 × 3 GB per job, two jobs at a time).
- **Lip sync**: timing follows the original, but a translation that runs longer pushes
  the lines after it back.
