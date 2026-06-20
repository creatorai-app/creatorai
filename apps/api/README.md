# Creator AI — API

NestJS backend for Creator AI. Handles scripts, ideation, subtitles, dubbing, story builder, AI training, billing, and auth.

## Endpoints

All endpoints (except health and Stripe webhook) are prefixed with `/api/v1` and require a Supabase JWT in the `Authorization: Bearer <token>` header, validated by `SupabaseAuthGuard`.

### Auth (`/api/v1/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/forgot-password` | Send OTP to email |
| POST | `/verify-otp` | Verify 6-digit OTP |
| POST | `/reset-password` | Reset password with verified OTP |

### Scripts (`/api/v1/script`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/generate` | Queue script generation job (BullMQ), supports file uploads |
| GET | `/` | List user's scripts |
| GET | `/:id` | Get single script |
| GET | `/:id/export` | Export script as PDF |
| PATCH | `/:id` | Update script title & content |
| DELETE | `/:id` | Delete script |
| SSE | `/status/:jobId` | Real-time generation progress stream |

### Ideation (`/api/v1/ideation`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Queue ideation job (BullMQ) |
| GET | `/` | List ideation jobs (paginated) |
| GET | `/profile-status` | Check user AI training status |
| GET | `/:id` | Get single ideation job |
| GET | `/:id/export/pdf` | Export ideation as PDF |
| GET | `/:id/export/json` | Export ideation as JSON |
| DELETE | `/:id` | Delete ideation job |
| SSE | `/status/:jobId` | Real-time ideation progress stream |

### Story Builder (`/api/v1/story-builder`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/generate` | Queue story builder job (BullMQ) |
| GET | `/` | List story builder jobs |
| GET | `/profile-status` | Check user AI training status |
| GET | `/:id` | Get single story builder job |
| DELETE | `/:id` | Delete story builder job |
| SSE | `/status/:jobId` | Real-time generation progress stream |

### Subtitles (`/api/v1/subtitle`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Generate subtitles with Gemini AI |
| GET | `/` | List user's subtitle jobs |
| POST | `/upload` | Upload video (max 200 MB) |
| PATCH | `/` | Update subtitle JSON |
| GET | `/:id` | Get single subtitle job |
| PATCH | `/:id` | Update subtitle by ID |
| DELETE | `/:id` | Delete subtitle job and file |
| POST | `/burn` | Burn subtitles into video (FFmpeg) |

### Dubbing (`/api/v1/dubbing`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create dubbing project (Murf.ai) |
| GET | `/` | List dubbing projects (paginated) |
| GET | `/status/:projectId` | SSE stream for dubbing progress |
| GET | `/:id` | Get dubbing project |
| DELETE | `/:id` | Delete dubbing project |

### AI Training (`/api/v1/train-ai`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Queue training job (BullMQ) |
| GET | `/status/:jobId` | SSE stream for training progress |

### Billing (`/api/v1/billing`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/plans` | List available subscription plans |
| GET | `/info` | Get user's billing info |
| POST | `/checkout` | Create Stripe Checkout session |
| POST | `/portal` | Create Stripe Customer Portal session |

### Stripe Webhook (`/api/v1/stripe`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook` | Handle Stripe webhook events |

Handled events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/api/v1/test-db` | Database connection test |

## Job Queues (BullMQ)

| Queue | Purpose |
|-------|---------|
| `train-ai` | AI style training from YouTube videos |
| `script` | Script generation with style personalization |
| `ideation` | Idea research with web search |
| `story-builder` | Narrative structure generation |

All queues stream progress to the client via SSE.

## Key Integrations

| Service | Purpose |
|---------|---------|
| Supabase | Database, auth, storage |
| Google Gemini (Vertex AI) | Script generation, ideation, training, transcription |
| Murf.ai | Audio/video dubbing |
| Stripe | Subscriptions, checkout, billing portal |
| BullMQ + Redis | Job queue for async AI operations |
| FFmpeg | Video processing & subtitle burning |
| Resend | OTP and transactional emails |

## Setup

```bash
cp .env.example .env   # Fill in credentials
pnpm install
pnpm run dev --filter=api
```

Runs at [http://localhost:8000](http://localhost:8000).
