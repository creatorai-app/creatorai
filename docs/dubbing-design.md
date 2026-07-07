# Audio Dubbing — System Design

Voice-preserving dubbing for Creator AI: a creator uploads audio (or video), we
transcribe + translate the speech with **Gemini on Vertex AI**, clone the
speaker's voice, and synthesize the translation **in their own voice** in the
target language. Gated to **all paid plans** (Creator, Pro, Business, Scale) —
only Starter (free) is excluded.

> Pipeline = Vertex (transcribe + translate, already used everywhere) →
> serverless GPU voice clone (Modal) → store result. No single Google product
> does identity-preserving cross-lingual TTS; the true open models that do
> (XTTS, Meta Seamless) are non-commercial-licensed, so the clone step is a
> self-hosted **MIT-licensed** model behind an HTTP endpoint. See §5.

## 0. What already exists (and why it must change)

There is a **working prototype** in `apps/api/src/dubbing/` (`dubbing.service.ts`,
`dubbing.controller.ts`, `dubbing.module.ts`) plus a `dubbing_projects` table. It
already does: Gemini
transcribe+translate, ffmpeg audio extraction, a call to a Modal `/dub`
endpoint (VoxCPM), and credit deduction.

It is a **v0 prototype, not a scalable paid feature.** The gaps that this design
closes:

| Prototype today | Problem for a paid, scalable feature | Fix |
|---|---|---|
| `void this.processDub(...)` — fire-and-forget **inside the API process** | A worker restart/crash silently loses the job. No retry, no isolation, buffers media in API RAM. | Move to a **BullMQ `dubbing` queue + worker**, exactly like `video-generation.processor.ts`. |
| **No plan gate** — any user with 10 credits can dub | Feature must be Pro/Business/Scale only | `canDub(planName)` gate, server-authoritative (mirror `canGenerateVideo`). |
| Gemini fed **inline base64, 50MB cap** | Long/large media rejected; base64 inflates RAM ~33% | Upload to **GCS**, let Vertex read the `gs://` URI directly (lifts to 2GB — same move already made for subtitles). |
| **Flat 10-credit** cost per dub | GPU cost scales with audio length; flat pricing loses money at scale | **Duration-based** credits (per second of audio). |
| SSE polls the DB status every 2.5s | Diverges from the BullMQ SSE every other feature uses | Reuse `createJobSSE` off the BullMQ job. |
| VoxCPM (EN/ZH-leaning) | Weak for 23-language cross-lingual dubbing | Swap the model behind Modal to **Chatterbox Multilingual (MIT, 23 langs)**. Endpoint contract unchanged. |
| Video in → **audio-only** out | "Same video in another language" needs video out | v1.5 stage: mux dubbed audio back over the video (§8). |

## 1. Where it fits (existing patterns reused)

| Concern | Reuse of | Notes |
|---|---|---|
| Async long job | **BullMQ** queue + `WorkerHost` (`video-generation`, `thumbnail`) | Clone step is a 30s–3min GPU call — must be a background job, never inline in the API. |
| Direct upload | `SubtitleService.signUpload` / `finalizeUpload` (signed GCS PUT) | Browser PUTs straight to GCS; API never touches the bytes. Plan-based size/duration caps enforced here. |
| Transcribe + translate | `SubtitleService.create` Gemini call via `gs://` `fileData` | Vertex reads media from GCS — no inline 50MB ceiling. Same `createGoogleAI` client. |
| Voice clone (GPU) | existing Modal `/dub` endpoint | Serverless GPU, pay-per-second, autoscales to zero — ideal for bursty dubbing load. |
| SSE progress | `createJobSSE` (`common/sse`) | Worker `job.updateProgress()` → browser. Replaces the DB-poll SSE. |
| Credits | `update_user_credits` RPC + `calculateDubbingCredits` | Change to duration-based (§5). |
| Plan gating | `getActivePlanName` in `VideoGenerationService` | Same `subscriptions → plans(name)` query; allow Pro/Business/Scale. |
| Storage | `GCS_DUBBING_BUCKET` (input + output) | Both on GCS. Input needs `gs://` for Vertex; output goes there too — Supabase's 50MB free-tier cap rejects dubbed MP4s. Modal PUTs the output straight to GCS so the worker never holds the bytes. |

No new dependencies. `@nestjs/bullmq`, `@google/genai`, `@google-cloud/storage`,
`fluent-ffmpeg` are all already installed and used.

## 2. Data flow

```
Browser (Pro / Business / Scale)
  │  1. POST /dubbing/sign-upload { filename, contentType, fileSize, isVideo, durationSeconds }
  │        → API plan-gates + caps → returns { uploadUrl, objectName }
  │  2. PUT file → GCS (signed URL, direct, no API in the byte path)
  │  3. POST /dubbing { objectName, targetLanguage, isVideo, mediaName, durationSeconds }
  ▼
API: DubbingController → DubbingService.createDub()
  │   a. plan gate  → 403 if not Pro/Business/Scale
  │   b. verify GCS object + real size/duration (mirror finalizeUpload)
  │   c. credit precheck (duration floor) → 403 if short
  │   d. insert dubbing_projects (status='queued')
  │   e. queue.add('dubbing', { userId, projectId, inputGsUri, targetLanguage, isVideo, durationSeconds }, { jobId })
  ▼  returns { projectId, jobId }
Browser opens SSE  GET /dubbing/status/:jobId   (createJobSSE)
  ▼
Worker: DubbingProcessor.process()          [packages/workers]
  │   1. status='processing'  (progress 5)
  │   2. Gemini (Vertex, gs:// fileData): transcribe + translate → target text   (progress 30)
  │   3. status='cloning'; POST Modal { text, reference_url, output_put_url }    (progress 80)
  │        Modal clones + synthesizes, (if isVideo) muxes over the original,
  │        and PUTs the result straight to GCS via the signed URL (worker holds no bytes)
  │   4. deduct duration-based credits; dubbed_url = the GCS public URL
  │   5. status='completed', dubbed_url persisted                               (progress 100)
  ▼
SSE emits completed → browser plays the dubbed media
```

Failure at any stage → `status='failed'`, `error_message` persisted, SSE emits
`failed`. BullMQ `attempts: 1` (same default as the other queues — no
auto-retry of a paid GPU call; the user re-submits).

## 3. Model & cost

### The clone model (behind Modal)

The endpoint contract (`POST MODAL_API_URL` with `text` + `reference` audio →
dubbed audio) stays; only the model loaded in the Modal image changes. Modal
gives each deployed web endpoint its own dedicated hostname — `MODAL_API_URL`
is that exact printed URL, not a base URL with a `/dub` path appended.

- **Recommended: Chatterbox Multilingual** (Resemble AI) — **MIT license**,
  23 languages, 5-second zero-shot clone, built-in watermarking (helps the
  consent/deepfake story). Commercial-safe to ship.
- Current: VoxCPM — fine for a demo, weak cross-lingual. Swap it.
- Rejected: Coqui XTTS-v2 and Meta SeamlessExpressive are technically better at
  cross-lingual but are **non-commercial licensed** — cannot ship in a paid
  product.

### Why Modal, not AWS/GCP GPU

Dubbing load is spiky (a Pro user dubs a few clips, then nothing for hours).
Modal is **serverless GPU billed per-second, scales to zero** — you pay only
while a clone runs. A dedicated GCP/AWS GPU VM bills 24/7 whether used or not.

> **On the $100 AWS credit:** not worth architecting around. $100 ≈ a few dozen
> GPU-hours — too little to base a serving tier on, and S3 output is useless
> here because Vertex reads `gs://` only (see the S3-vs-GCS note). Keep the GPU
> on Modal; keep media on GCS/Supabase. Spend the AWS credit elsewhere.

### Credits (duration-based)

Cost scales with audio length (GPU time ∝ seconds of speech), so bill by the
second, not a flat 10:

```ts
// consts/credits.ts — replace the flat externalCreditsUsed model
export const DUBBING_CREDIT_MULTIPLIER = 15; // credits per second of source audio
export function calculateDubbingCreditsByDuration(
  durationSeconds: number,
  multiplier = DUBBING_CREDIT_MULTIPLIER,
): number {
  return Math.max(multiplier, Math.ceil(durationSeconds) * multiplier);
}
export function getMinimumCreditsForDubbing(multiplier = DUBBING_CREDIT_MULTIPLIER): number {
  return multiplier; // one-second floor for the enqueue precheck
}
```

Precheck the floor before enqueue (fast 403); the worker deducts the real
duration-based cost after a successful clone — never charge for a failed job.
Tune `DUBBING_CREDIT_MULTIPLIER` via env, no redeploy. (Numbers illustrative —
calibrate against a measured Modal cost-per-second once Chatterbox is loaded.)

## 4. Plan gating (all paid plans — only Starter excluded)

Plans are Starter (free) · **Creator ($24)** · **Pro ($49)** · **Business ($299)** ·
**Scale ($599)**. Dubbing is included in every paid plan. Gate by plan **name**
(there is no tier column — the active plan is the most-recent active
`subscriptions` row):

```ts
// consts/dubbing.ts
export const DUBBING_PLANS = ['creator', 'pro', 'business', 'scale'] as const;
export function canDub(planName?: string | null): boolean {
  if (!planName) return false;
  return DUBBING_PLANS.includes(planName.toLowerCase() as (typeof DUBBING_PLANS)[number]);
}
```

Server-side check in `DubbingService.signUpload`/`createDub` is authoritative;
the client gate (`GET /dubbing/access`) is UX only — the new-dub page shows an
upgrade card to Starter users.

## 5. Storage

- **Input** → dedicated GCS bucket **`GCS_DUBBING_BUCKET`** (separate from
  subtitles so retention/cleanup can diverge). Vertex transcribes from the
  `gs://` URI; Modal fetches the public URL as the voice reference. The shared
  `gcs.ts` helpers take an optional `bucket` argument, so no code duplication.
  See §9.1 for the bucket setup guide.
- **Output** → same **`GCS_DUBBING_BUCKET`**. The API mints a long-lived signed PUT
  URL at enqueue; Modal uploads the dubbed file straight to it, so the worker never
  holds the bytes (a dubbed MP4 can be hundreds of MB). Supabase Storage was dropped —
  its 50MB free-tier cap rejects dubbed video.
- Delete cleans up both GCS objects (input + output) on `DELETE /dubbing/:id`.

## 5b. Cancellation (train-ai pattern)

`POST /dubbing/stop/:jobId`:
- **queued** job → removed from BullMQ outright, row marked `failed`
  (`Cancelled by user`).
- **active** job → Redis flag `dubbing:cancel:<jobId>` (TTL 1h); the worker
  checks it **between stages** (before Gemini, before Modal, before
  upload/credits) and aborts. Credits are only deducted after the last
  checkpoint, so a cancelled dub never charges.

The UI shows a **Cancel Dubbing** button while a job is in flight; on cancel
the SSE stream ends `failed` and the client shows "Dubbing cancelled — no
credits were charged."

## 6. Files to add / change

**packages/validations**
- `consts/dubbing.ts` — `DUBBING_PLANS`, `canDub`, `DUBBING_CREDIT_MULTIPLIER`,
  `calculateDubbingCreditsByDuration`, `getMinimumCreditsForDubbing`, allowed
  target languages / accents list.
- `consts/credits.ts` — deprecate flat `calculateDubbingCredits` in favor of the
  duration fn (keep the old export until callers migrate).
- `schema/dubbing.schema.ts` — `SignDubUploadSchema`, `CreateDubSchema`
  (objectName, targetLanguage, isVideo, mediaName, durationSeconds) + inferred
  types. Replace the hand-written Swagger body in the controller.
- barrel exports in `consts/index.ts`, `schema/index.ts`.

**packages/supabase**
- `migrations/<ts>_dubbing_jobs_align.sql` — add to `dubbing_projects`:
  `job_id text` (BullMQ), `input_gs_uri text`, `duration_seconds int`,
  and widen the status check to
  `('queued','processing','cloning','completed','failed')`. Keep RLS as-is
  (worker uses service-role key).

**apps/api/src/dubbing/**
- `dubbing.module.ts` — add `BullModule.registerQueue({ name: 'dubbing' })`,
  `ConfigModule`.
- `dubbing.service.ts` — **remove `processDub` (the whole inline pipeline moves
  to the worker)**; add `signUpload`, plan gate, GCS verify, duration precheck,
  enqueue, `getAccess`. Keep `listDubs`/`getDub`/`deleteDub` (+ GCS cleanup).
- `dubbing.controller.ts` — add `POST /dubbing/sign-upload`, `GET /dubbing/access`;
  switch `Sse('status/:jobId')` to `createJobSSE`; validate bodies with the Zod
  pipe instead of inline Swagger schemas.

**packages/workers/src/**
- `processor/dubbing.processor.ts` — `@Processor('dubbing', { concurrency: 2 })`;
  the pipeline from §2 (Gemini gs:// transcribe+translate → ffmpeg reference →
  Modal clone → optional video mux → upload → deduct credits). Mirror
  `video-generation.processor.ts` structure (progress, `updateJob`, env helpers).
- `worker.module.ts` — register `DubbingProcessor` + `{ name: 'dubbing' }`.
- reuse `processor/utils/genai.ts` (`getGenAI`) and the ffmpeg helper.

**apps/web/**
- `app/dashboard/dubbing/page.tsx` — uploader + target-language picker +
  history + player; upgrade card when `!canDub`.
- `components/dashboard/dubbing/*` — upload form, history list, player, upgrade card.
- `hooks/useDubbing.ts` — sign→PUT→create + `useSSE` for progress/result
  (mirror the subtitle uploader + `useVideoGeneration`).
- `lib/api/getDubs.ts` — list fetch.

**Env / infra**
- `MODAL_API_URL` (already referenced) → point at the Chatterbox Modal app.
- `GCS_DUBBING_BUCKET` (or reuse `GCS_SUBTITLE_BUCKET`), `DUBBING_CREDIT_MULTIPLIER`.
- Modal app: load Chatterbox Multilingual, expose `POST /dub`.

## 7. Build order (each step independently compilable)

1. **validations** — plan gating, duration credits, schema, language list. (No runtime deps.)
2. **migration** — align `dubbing_projects` (job_id, input_gs_uri, duration, status enum).
3. **Modal** — swap VoxCPM → Chatterbox behind the same `/dub` contract; verify with a curl.
4. **worker processor** — the pipeline (the core; carries the one non-trivial branch).
5. **api** — service (gate + sign + enqueue) + controller (+ createJobSSE) + module wiring.
6. **frontend** — page, uploader, hook, upgrade card.
7. **env + copy** — buckets, multiplier, fix the plan `features` marketing copy.

The worker processor is the only non-trivial logic → it gets a small runnable
self-check (assert the Modal response decodes to non-empty audio; assert credits
= `ceil(seconds) * multiplier`).

## 9. Local testing guide

### 9.1 One-time setup — GCS dubbing bucket

Dubbing has its own bucket. Create it once (replace `creator-ai-dubbing` and the
service-account email with yours):

```bash
# 1. Create the bucket (same project/region as Vertex)
gcloud storage buckets create gs://creator-ai-dubbing \
  --project=creator-ai-498712 --location=us-central1 \
  --uniform-bucket-level-access

# 2. Public read (playback + Modal fetches the reference by URL)
gcloud storage buckets add-iam-policy-binding gs://creator-ai-dubbing \
  --member=allUsers --role=roles/storage.objectViewer

# 3. Let the Vertex service account write/read/delete objects
gcloud storage buckets add-iam-policy-binding gs://creator-ai-dubbing \
  --member="serviceAccount:<vertex-sa>@creator-ai-498712.iam.gserviceaccount.com" \
  --role=roles/storage.objectAdmin

# 4. CORS so the browser can PUT to the signed URL
cat > cors.json <<'EOF'
[{"origin": ["http://localhost:3000"], "method": ["PUT", "GET"],
  "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600}]
EOF
gcloud storage buckets update gs://creator-ai-dubbing --cors-file=cors.json
```

> Signed URLs require the SA key file (`GOOGLE_APPLICATION_CREDENTIALS`) or
> `iam.serviceAccounts.signBlob` on an attached SA — same requirement as the
> subtitle uploader.

The dubbed output lands in the same `GCS_DUBBING_BUCKET` (Modal PUTs it there via the
signed URL) — no separate output bucket to provision.

### 9.2 One-time setup — Modal + env + DB

```bash
pip install modal && modal setup
modal deploy modal/dubbing_app.py          # prints the /dub endpoint URL
```

Root `.env`:

```
GCS_DUBBING_BUCKET=creator-ai-dubbing
MODAL_API_URL=https://<workspace>--creator-ai-dubbing-dub.modal.run
# DUBBING_CREDIT_MULTIPLIER=15
```

Apply the migration (adds `job_id`, `input_gs_uri`, `input_url`,
`duration_seconds`, new status enum):

```bash
supabase db push        # or your usual migration flow
```

Give the test user a **paid plan** (Creator or higher — the most-recent active
`subscriptions` row) and enough `profiles.credits` (60s clip ≈ 900 credits at
the default 15/sec).

### 9.3 Run the stack

```bash
pnpm --filter api dev              # NestJS API :8000
pnpm --filter @repo/workers dev    # BullMQ worker
pnpm --filter web dev              # Next.js :3000
```

### 9.4 Automated tests

```bash
# Pure-logic self-check (plan gate incl. Creator, duration credits, schemas)
npx tsx packages/validations/src/consts/dubbing.check.ts

# API service tests (gate, sign-upload limits, enqueue, cancellation)
cd apps/api && npx jest src/dubbing
```

### 9.5 Swagger (manual API testing)

Open `http://localhost:8000/api/docs` (Swagger UI). The `dubbing` tag documents all
endpoints with request bodies. Flow: `POST /dubbing/sign-upload` → PUT the file
to `uploadUrl` (curl/Postman, matching Content-Type) → `POST /dubbing` →
watch `GET /dubbing/status/{jobId}` (SSE) → `GET /dubbing/{id}`.

| Endpoint | Purpose |
|---|---|
| `GET /dubbing/access` | plan gate check (`allowed`, `plan`) |
| `POST /dubbing/sign-upload` | signed GCS PUT URL (403 on Starter) |
| `POST /dubbing` | verify object + enqueue (returns `projectId`, `jobId`) |
| `POST /dubbing/stop/{jobId}` | cancel queued/active job |
| `SSE /dubbing/status/{jobId}` | progress stream |
| `GET /dubbing` / `GET /dubbing/{id}` / `DELETE /dubbing/{id}` | list / detail / delete |

### 9.6 End-to-end UI checklist

1. **Starter user** → `/dashboard/dubbing/new` shows the "Available on paid
   plans" upgrade card; `POST /dubbing/sign-upload` returns 403.
2. **Creator (or higher) user** → form is unlocked. Upload a short MP3/MP4,
   name it, pick a language, hit **Dub**.
3. Progress: upload % → `5` (queued) → `30` (translated) → `80` (cloned) →
   `100`; success toast; Preview tab plays the audio.
4. **Cancellation**: start a dub, click **Cancel Dubbing** while processing →
   "Cancellation requested" → job ends with "Dubbing cancelled — no credits
   were charged"; `dubbing_projects.status='failed'`,
   `error_message='Dubbing cancelled by user'`; `profiles.credits` unchanged.
5. Completed dub: credits deducted (`credits_consumed = ceil(sec)×15`), list
   page shows the project, detail page previews original + dubbed, delete
   removes the row and the GCS input object.
6. Failure surfaces: stop the worker and submit → job sits queued (cancel
   works); kill `MODAL_API_URL` → job fails at ~30% with the Modal error in
   `error_message` and a failure toast.

## 10. Out of scope for v1 (add when needed)

- **Lip-sync for video.** v1.5 muxes dubbed audio over the original video track,
  which drifts when translated speech is a different length than the source
  (translations run longer/shorter). True sync needs segment-level time-alignment
  or a lip-sync model (Wav2Lip / LatentSync). Ship audio-out first, then video-mux,
  then sync.
- **Multi-speaker diarization** — one reference voice per dub in v1. Per-speaker
  cloning later.
- **Consent capture** — Chatterbox watermarks output; an explicit "I have rights
  to this voice" attestation on upload is a fast-follow for the deepfake/ToS story.
- **Script/Story-Builder cross-links** (`script_id`) — column can exist, wiring later.
- **Cancellation mid-clone** — the `train-ai` Redis-flag pattern is ready to bolt on.
```
