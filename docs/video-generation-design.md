# Video Generation — System Design

AI video generation for Creator AI, powered by **Gemini Omni Flash** via the
**Interactions API**. Omni generates and (statefully) edits short cinematic clips —
≤10s, 720p, with synchronized audio — from a text prompt, a source image, or reference
subjects. Gated to the **Pro, Business and Scale** plans.

> **Why Omni, not Veo:** an earlier iteration of this feature ran on Veo. It was pivoted
> to `gemini-omni-flash-preview` for its conversational **stateful editing**
> (`previous_interaction_id`) and its native image-to-video / reference-to-video modes.
> Omni is reached through the same `GoogleGenAI` client as our other Gemini models
> (allowlisted for Omni on our Vertex project). Like Veo it is priced **per second of
> output video**, not per token, so credits and gating are handled differently from every
> token-billed feature. See the History section for what changed.

## 1. Where it fits (existing patterns reused)

| Concern | Reuse of | Notes |
|---|---|---|
| Async long job | **BullMQ** queue + `WorkerHost` processor (`thumbnail`, `train-ai`) | A clip takes tens of seconds — a background job, never an inline request. `concurrency: 2`. |
| AI client | `getGenAI()` Vertex `GoogleGenAI` client (`workers/.../utils/genai.ts`) | Omni uses `ai.interactions.create(...)`; the SDK typings lag the API, so `utils/omni.ts` hand-rolls the surface and casts (repo idiom, cf. `apps/api/.../genai.ts`). |
| Media storage | **GCS** (`GCS_VIDEO_BUCKET`, public-read) | Omni returns bytes/URI — the worker **downloads and uploads to GCS itself** (`utils/gcs.ts` `uploadVideoBuffer`). Unlike Veo, nothing is written straight to GCS. |
| Job table | `thumbnail_jobs` migration shape | `video_generation_jobs` — same RLS + status enum + `job_id` (BullMQ) column, plus Omni fields. |
| Producer API | `thumbnail.controller.ts` (queue + SSE) | `POST generate/edit/cancel/surprise`, `GET`, `GET :id`, `DELETE :id`, `SSE status/:jobId` via `createJobSSE`. |
| Cancellation | `train-ai` Redis-flag pattern | `video-generation:cancel:<bullJobId>`, checked between worker steps. |
| Credits | `update_user_credits` RPC + `consts/credits.ts` | **Duration-based** cost fn (Omni bills per second), not token-based. |
| Plan gating | active-subscription lookup (`SubtitleService`, `BillingService`) | Same `subscriptions → plans(name)` query; allow Pro/Business/Scale. |
| Redis client | `getRedisConnection()` in **`@repo/supabase`** | Shared, deduped, hardened (keepAlive + retry + quiet ECONNRESET). Both API and worker use it. |
| Frontend | `useThumbnailGeneration` + `useSSE`, feature list pages | Mode cards, form, history list, stateful edit page, upgrade card. |

`@google/genai` already installed. The one added dependency is
`@google-cloud/storage` in the worker package (for `uploadVideoBuffer`).

## 2. Generation modes

Three user-facing modes (three UI cards), plus a stateful edit path:

| Mode | `video_config.task` | Input | UI |
|---|---|---|---|
| Text → Video | `text_to_video` | prompt only | describe a scene from scratch |
| Image → Video | `image_to_video` | 1 image + prompt | animate a still; prompt describes motion |
| Reference → Video | `reference_to_video` | 1–3 images + prompt | stage subject images in a new scene |
| Edit (stateful) | `edit` | instruction + `previous_interaction_id` | refine a finished clip in place |

Input images ride inline as base64 in the request/job payload (source images are small;
≤3, capped ~5MB each — `MAX_VIDEO_REFERENCE_IMAGES`, `MAX_VIDEO_INPUT_IMAGE_BASE64_BYTES`).
Per-mode image contracts live in `requiredImageRange(mode)` and are enforced by the Zod
`superRefine` **and** re-checked in the service (defense in depth).

## 3. Data flow

### Generate (text / image / reference)

```
Browser (mode card + prompt [+ images])
  │  POST /video-generation/generate { prompt, mode, aspectRatio, durationSeconds, images[] }
  ▼
API: VideoGenerationController → VideoGenerationService.createJob()
  │   1. plan gate (Pro/Business/Scale)   → 403 if not eligible
  │   2. credit floor precheck            → 403 if short
  │   3. per-mode image-count check       → 400 if wrong
  │   4. insert video_generation_jobs (status='queued')
  │   5. queue.add('video-generation', { userId, videoJobId, prompt, mode, aspectRatio,
  │                 durationSeconds, images }, { jobId })  → back-write job_id
  ▼  returns { videoJobId, jobId }
Browser opens SSE  GET /video-generation/status/:jobId
  ▼
Worker: VideoGenerationProcessor.process()
  │   1. status='processing'; cancel check
  │   2. runOmniVideo(): ai.interactions.create({ model, input, response_format:{type:'video',
  │        aspect_ratio, delivery:'uri'}, generation_config:{ video_config:{ task, duration_seconds }}})
  │   3. URI delivery → poll ai.files.get until ACTIVE (cancel-checked) → ai.files.download → Buffer
  │   4. cancel check (discard if cancelled before upload/charge)
  │   5. uploadVideoBuffer(`${userId}/${videoJobId}.mp4`) → { gsUri, publicUrl }
  │   6. deduct credits (update_user_credits, by durationSeconds)
  │   7. status='completed'; video_url + video_gs_uri + interaction_id persisted
  ▼
SSE emits completed { videoUrl } → browser plays the clip
```

### Edit (stateful)

```
Browser (finished clip → "Regenerate / edit" → /dashboard/video-generation/:id/edit)
  │  POST /video-generation/:id/edit { instruction }
  ▼
Service.editJob(): plan+credit gate → load source (must be completed + have interaction_id)
  │  insert new job { mode:'edit', parent_job_id:source.id }  → enqueue with
  │  previousInteractionId = source.interaction_id
  ▼
Worker: runOmniVideo({ task:'edit', prompt:instruction, previousInteractionId }) → new clip.
```

Each edit is its **own** job/row (never overwrites the source), so edits can be chained.

### Cancel

`POST /video-generation/cancel/:jobId`. Still-queued → `job.remove()` + row set `cancelled`.
Active → set Redis flag `video-generation:cancel:<jobId>` (EX 3600); the worker throws
`VideoCancelledError` at its next checkpoint (before generate, during file polling, and
after generation before upload/charge) and sets status `cancelled` — no credits charged.

### Surprise me

`POST /video-generation/surprise { mode }` reads the creator's trained `user_style`
(`tone`, `visual_style`, `themes`, `humor_style`, `narrative_structure`) and asks the text
model for one on-brand, shootable prompt (falls back to a generic cinematic prompt when
untrained). **Not** plan-gated — it lets locked users feel the feature before the paywall.
The client types the result into the prompt box character-by-character.

## 4. Model, cost & credits

Model id centralized in `consts/gemini.ts`, env-overridable:

```ts
export const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || 'gemini-omni-flash-preview';
```

**Cost reality:** Omni ≈ **$0.10/sec** of 720p output → an 8s clip ≈ **$0.80**. Duration is
a small fixed set (`VIDEO_DURATION_SECONDS = [4, 6, 8]`, ≤10s cap), passed to
`video_config.duration_seconds` and used for billing.

```ts
// consts/credits.ts — derived from the ≥80% margin rule (creditsForCost($0.10/s) = 84 → 85)
export const VIDEO_GENERATION_CREDIT_MULTIPLIER = 85; // credits per second of video (~$0.10/s)
export function calculateVideoGenerationCredits(durationSeconds, multiplier = 85) {
  return Math.max(multiplier, Math.ceil(durationSeconds) * multiplier);
}
export function getMinimumCreditsForVideoGeneration(multiplier = 85) { return multiplier; }
```

`85 credits/sec` ⇒ an 8s clip = **680 credits** (~80% gross margin at the floor plan price).
Credits are deducted in the worker **after** a successful upload, so cancelled/failed jobs
cost nothing. Tune via `VIDEO_GENERATION_CREDIT_MULTIPLIER` without a redeploy.

## 5. Plan gating

Gate by **plan name** — the active plan is the most-recent active `subscriptions` row
joined to `plans` (same source as `BillingService`):

```ts
// consts/videoGeneration.ts
export const VIDEO_GENERATION_PLANS = ['pro', 'business', 'scale'] as const;
export function canGenerateVideo(planName?: string | null): boolean {
  return !!planName && VIDEO_GENERATION_PLANS.includes(planName.toLowerCase() as never);
}
```

Server-side check in `VideoGenerationService.assertCanGenerate()` is authoritative (plan +
credit floor). The **UI is fully unlocked** so anyone can explore the modes; the gate fires
on Generate (`GET /video-generation/access` drives a `PRO` badge on the mode cards, a lock
on the Generate button, and the upgrade modal). Editing model-generated clips works in all
regions; only editing *uploaded* footage is restricted in EEA/CH/UK (not used here).

## 6. Storage

Omni returns the clip inline (≤4MB) or as a Files URI. We request `delivery: 'uri'` (720p
clips exceed the inline cap), poll `files.get` until `ACTIVE`, download, then upload to GCS:

- Object: `gs://$GCS_VIDEO_BUCKET/<userId>/<videoJobId>.mp4` (one object per job; edits are
  separate jobs, so a source is never overwritten).
- Playback URL: `https://storage.googleapis.com/<bucket>/<object>` (bucket public-read).
- Cleanup on delete: `deleteVideoGcsUri(configService, video_gs_uri)`.

The Vertex/ADC service account needs `roles/storage.objectAdmin` on the bucket.

## 7. Data model — `video_generation_jobs`

Key columns (see `migrations/20260702000000_video_generation_jobs.sql`):

| Column | Purpose |
|---|---|
| `prompt` | prompt, or the edit instruction for `mode='edit'` |
| `mode` | `text_to_video` \| `image_to_video` \| `reference_to_video` \| `edit` |
| `status` | `queued` \| `processing` \| `completed` \| `failed` \| `cancelled` |
| `aspect_ratio` | `16:9` \| `9:16` |
| `duration_seconds` | 4 / 6 / 8 (drives credit cost) |
| `input_image_count` | how many inputs the request carried |
| `interaction_id` | Omni interaction handle — the stateful-edit anchor |
| `parent_job_id` | source clip when this row is an edit (`ON DELETE SET NULL`) |
| `video_url` / `video_gs_uri` | public playback URL / gs:// ref for cleanup |
| `credits_consumed`, `error_message`, `job_id` (BullMQ) | bookkeeping / SSE |

RLS: owner-only select/insert/update/delete; the worker writes via the service-role key.

## 8. Files

**packages/validations**
- `consts/gemini.ts` — `GEMINI_VIDEO_MODEL` (Omni).
- `consts/credits.ts` — multiplier `50`, `calculateVideoGenerationCredits`, `getMinimumCreditsForVideoGeneration`.
- `consts/videoGeneration.ts` — aspect ratios, durations, `VIDEO_GENERATION_MODES`, `requiredImageRange`, image limits/mime types, `VIDEO_GENERATION_PLANS` (+ `pro`), `canGenerateVideo`, `VIDEO_GEN_CANCEL_PREFIX`.
- `schema/videoGeneration.schema.ts` — `CreateVideoGenerationSchema` (prompt, mode, aspectRatio, durationSeconds, images[], superRefine), `EditVideoGenerationSchema`, `SurpriseVideoPromptSchema`, `VideoInputImageSchema`.

**packages/supabase**
- `migrations/20260702000000_video_generation_jobs.sql`.
- `index.ts` — shared, hardened `getRedisConnection()` (deduped from the old per-app `redis.ts`).

**packages/workers/src**
- `processor/video-generation.processor.ts` — orchestration, cancel checks, GCS upload, credit deduction.
- `processor/utils/omni.ts` — `runOmniVideo()` (interactions call, file poll/download, error normalization).
- `processor/utils/gcs.ts` — `uploadVideoBuffer()`.
- `worker.module.ts` — `forRootAsync` connection; queue + processor registered.

**apps/api/src/video-generation**
- `video-generation.controller.ts` — `access`, `surprise`, `generate`, `:id/edit`, `cancel/:jobId`, list, `:id`, delete, `SSE status/:jobId`.
- `video-generation.service.ts` — gating, credit precheck, `createJob`, `editJob`, `cancelJob`, `surprisePrompt`, list/get/delete (+GCS cleanup).
- `video-generation.module.ts`; registered in `app.module.ts` (Bull `forRootAsync`).

**apps/web**
- `app/dashboard/video-generation/page.tsx` — mode cards + form (right) + how-it-works (left) + upgrade modal.
- `app/dashboard/video-generation/[id]/edit/page.tsx` — stateful edit page (chainable).
- `app/dashboard/video-generation/history/page.tsx` — separate "My Videos" listing (search + cards).
- `components/dashboard/video-generation/*` — `VideoModeCards`, `VideoGenerationForm`, `VideoGenerationHistory`, `VideoHowItWorksGuide`, `VideoUpgradeCard`.
- `hooks/useVideoGeneration.ts` — state, SSE, surprise-me typewriter, cancel.
- `lib/api/getVideoGenerations.ts` — access, get, edit, delete.
- `app/prompt-guide/{page,layout}.tsx` — public, SEO-optimized prompt guide (opens in a new tab from the dashboard how-it-works section); linked in `sitemap.ts`.

**Env / infra**
- `GCS_VIDEO_BUCKET` (public-read + CORS), optional `GEMINI_VIDEO_MODEL`, `VIDEO_GENERATION_CREDIT_MULTIPLIER`.
- Vertex service account: `roles/storage.objectAdmin` on the bucket.

## 9. Known limitations / runtime caveats

- **SDK typings** don't yet describe `interactions`; `utils/omni.ts` casts. Drop the local
  interface when a typed SDK ships.
- **Omni on Vertex** and the `duration_seconds` field are assumed per the allowlist; if the
  live API rejects either, they're the first suspects (both are one-line adjustments).
- **Base64 inputs** ride in the BullMQ payload (≤3 × ~5MB). Fine for this low-throughput
  paid feature; move to GCS staging if payloads bite.
- Progress is coarse during the (blocking) generate call — it creeps only while the output
  file finalizes (`utils/omni.ts`: 3s poll, ~2 min ceiling).

## 10. History (was Veo)

Originally built on Veo (`veo-3.0-generate-001`) with text-to-video only, Veo writing
straight to GCS, a `200 credits/sec` cost, negative-prompt + audio-toggle fields, and
Business/Scale gating. Superseded by Omni Flash, which added the image/reference modes and
stateful editing, moved the upload into the worker, dropped negative-prompt/audio-toggle
(unsupported), recut credits to `85/sec` (≥80% margin), and opened the feature to Pro.

## 11. Out of scope (add when needed)

- Multi-clip stitching / B-roll / caption overlays — v1 ships single ≤10s clips.
- Script/Story-Builder cross-links (`script_id` column exists; wiring later).
- Resumable/large image uploads via GCS staging (see limitations).
