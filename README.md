# Creator AI

> **AI that learns your style and helps you create content faster.** Creator AI analyzes your existing YouTube videos to understand your tone, vocabulary, and structure — then generates scripts, subtitles, ideas, stories, and more — all personalized to you.

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-7289DA?style=for-the-badge&logo=discord)](https://discord.com/invite/k9sZcq2gNG)
[![GitHub Stars](https://img.shields.io/github/stars/scriptaiapp/scriptai?style=for-the-badge)](https://github.com/scriptaiapp/scriptai/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

## Features

- **AI Style Training** — Connect YouTube, provide 3–5 videos, and the AI learns your unique tone, vocabulary, and pacing
- **Script Generation** — Personalized video scripts via BullMQ worker; supports file attachments, storytelling mode, timestamps, multi-language output, and PDF export
- **Ideation** — AI-powered idea generation with live web search, trend snapshots, opportunity scoring, content angles, and sources; export as PDF/JSON
- **Story Builder** — Structured narrative generation from a topic with real-time SSE progress
- **Subtitle Generation** — Upload video (max 200 MB / 10 min), auto-generate timed subtitles, translate, edit in-app, export as SRT/VTT, burn into video via FFmpeg
- **Audio/Video Dubbing** — Dub media into 24+ languages via Murf.ai with real-time progress
- **Billing & Subscriptions** — Stripe-powered checkout, customer portal, webhook handling, and plan management
- **Credit System** — Token-based credits consumed per AI operation, tracked automatically
- **Referral Program** — Unique referral codes, track referrals, earn bonus credits
- **Auth** — Email/password and Google OAuth, OTP-based password reset, email verification via Supabase Auth
- **Profile & Settings** — Avatar upload, notification preferences, billing info

### Coming Soon

- **Thumbnail Generator** — AI-generated thumbnail descriptions (backend ready)
- **Course Module Builder** — Structured course outlines from a topic (backend ready)
- **AI Video Generator** — Page placeholder at `/dashboard/video-generation`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript, Zod validation |
| Database | Supabase (PostgreSQL), Row-Level Security |
| Auth | Supabase Auth (JWT), Google OAuth |
| AI | Google Gemini 3.5 Flash on Vertex AI, OpenAI GPT-4o |
| Payments | Stripe (Checkout, Billing Portal, Webhooks) |
| Dubbing | Murf.ai |
| Jobs | BullMQ + Redis (train-ai, script, ideation, story-builder queues) |
| Media | FFmpeg, Supabase Storage |
| Email | Resend |
| Monorepo | Turborepo + pnpm workspaces |

## Project Structure

```
creatorai/
├── apps/
│   ├── web/                          # Next.js 15 frontend
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   │   ├── train/            # AI style training
│   │   │   │   ├── scripts/          # Script generation & editing
│   │   │   │   ├── research/         # Ideation & idea research
│   │   │   │   ├── story-builder/    # Narrative structure builder
│   │   │   │   ├── subtitles/        # Subtitle generation & editing
│   │   │   │   ├── dubbing/          # Audio/video dubbing
│   │   │   │   ├── thumbnails/       # Thumbnail generator (coming soon)
│   │   │   │   ├── courses/          # Course builder (coming soon)
│   │   │   │   ├── video-generation/ # Video generator (coming soon)
│   │   │   │   ├── settings/         # User settings & billing
│   │   │   │   └── referrals/        # Referral program
│   │   │   └── api/                  # Next.js API routes
│   │   ├── components/               # React components
│   │   ├── hooks/                    # Custom React hooks
│   │   └── lib/                      # Utilities & API helpers
│   └── api/                          # NestJS backend
│       └── src/
│           ├── auth/                 # Password reset (OTP flow)
│           ├── billing/              # Stripe checkout, portal, webhooks
│           ├── ideation/             # AI idea generation (BullMQ)
│           ├── script/               # Script generation (BullMQ)
│           ├── story-builder/        # Story structure generation (BullMQ)
│           ├── subtitle/             # Subtitle CRUD + burn (FFmpeg)
│           ├── dubbing/              # Dubbing via Murf.ai
│           ├── train-ai/             # AI training job queue
│           ├── thumbnail/            # Thumbnail generation
│           ├── course/               # Course module builder
│           ├── referral/             # Referral system
│           ├── youtube/              # YouTube OAuth & channel data
│           ├── upload/               # File uploads
│           ├── support/              # Issue reporting
│           └── supabase/             # Supabase client module
├── packages/
│   ├── validations/                  # Shared Zod schemas, types & credit utils
│   ├── supabase/                     # Supabase migrations & client utilities
│   ├── workers/                      # BullMQ workers (train-ai, script, ideation, story-builder)
│   ├── email-templates/              # Email templates (OTP, welcome)
│   ├── config/                       # Shared constants
│   ├── ui/                           # Shared UI components
│   └── api/                          # Shared API types
├── docs/
│   └── SETUP.md                      # Detailed development setup guide
├── docker-compose.yml                # Redis + worker services
└── turbo.json                        # Turborepo pipeline config
```

## Quick Start

### Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org/)
- **pnpm** — `npm install -g pnpm`
- **Git** — [git-scm.com](https://git-scm.com/)
- **Docker** (optional) — for Redis via `docker compose`

### 1. Clone & Install

```bash
git clone https://github.com/scriptaiapp/scriptai.git
cd scriptai
pnpm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Get your Database URL from **Settings > Database > Connection String**
3. Apply the schema:

```bash
pnpx supabase login
pnpx supabase db push --db-url <your-supabase-db-url>
```

### 3. Configure Environment

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
cp packages/workers/.env.example packages/workers/.env
```

Edit each `.env` file with your credentials. See the `.env.example` files for required keys.

<details>
<summary>Required services & API keys</summary>

| Service | Key | Required | Purpose |
|---------|-----|----------|---------|
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | Yes | Database, auth, storage |
| Google Vertex AI (Gemini) | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, ADC (`GOOGLE_APPLICATION_CREDENTIALS`) | Yes | Script generation, ideation, training, transcription, thumbnails |
| Redis | `REDIS_URL` | Yes | BullMQ job queues (api + worker) |
| OpenAI | `OPENAI_API_KEY` | Optional | Subtitle generation |
| Resend | `RESEND_API_KEY` | Optional | Transactional emails |
| YouTube | `YOUTUBE_API_KEY` | Optional | Channel integration |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional | YouTube OAuth |
| Murf.ai | `MURF_API_KEY` | Optional | Audio/video dubbing |
| Stripe | via billing module config | Optional | Payments & subscriptions |

</details>

### 4. Start Development

```bash
# Start Redis (if using Docker)
docker compose up -d

# Start all dev servers (frontend + backend + worker)
pnpm run dev

# Or start individually
pnpm run dev --filter=web     # Frontend only — http://localhost:3000
pnpm run dev --filter=api     # Backend only  — http://localhost:8000
```

| Service | URL |
|---------|-----|
| Frontend | [http://localhost:3000](http://localhost:3000) |
| Backend API | [http://localhost:8000](http://localhost:8000) |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start all dev servers (Turborepo) |
| `pnpm run dev --filter=web` | Start frontend only |
| `pnpm run dev --filter=api` | Start backend only |
| `pnpm run build` | Build all packages and apps |
| `pnpm run test` | Run tests |
| `pnpm run lint` | Lint all code |
| `pnpm run type-check` | TypeScript type checking |
| `pnpm run format` | Format with Prettier |

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────▶│   NestJS     │────▶│  Supabase    │
│   Frontend   │     │   Backend    │     │  (Postgres)  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐     ┌──────────────┐
                     │   BullMQ     │────▶│  AI Workers   │
                     │   (Redis)    │     │  (Gemini/GPT) │
                     └──────────────┘     └──────────────┘
```

- **Frontend** calls Next.js API routes for AI operations (scripts, ideation) and the NestJS backend for subtitles, dubbing, training, and billing.
- **Backend** validates requests, manages auth, and enqueues long-running AI tasks to BullMQ.
- **Workers** process queued jobs (training, script generation, ideation, story builder) with SSE progress streaming back to the client.
- **Supabase** handles auth, database (with RLS), and file storage.

## Documentation

| Document | Description |
|----------|-------------|
| [Requirements](./requirements.md) | Full feature specification |
| [Setup Guide](./docs/SETUP.md) | Detailed development environment setup |
| [API Docs](./apps/api/README.md) | Backend endpoints reference |
| [Web App Docs](./apps/web/README.md) | Frontend pages & routes |
| [Database Schema](./packages/supabase/README.md) | Supabase schema documentation |
| [Contributing Guide](./CONTRIBUTING.md) | How to contribute |
| [Code of Conduct](./CODE_OF_CONDUCT.md) | Community guidelines |

## Contributing

1. Join [Discord](https://discord.gg/k9sZcq2gNG)
2. Read the [Contributing Guide](./CONTRIBUTING.md) and [Setup Guide](./docs/SETUP.md)
3. Check issues labeled **"Good First Issue"**
4. Fork, branch, code, and submit a PR

## Community

- [Discord](https://discord.com/invite/k9sZcq2gNG) — Questions, discussions, and support
- [GitHub Issues](https://github.com/scriptaiapp/scriptai/issues) — Bug reports and feature requests

## License

MIT — see [LICENSE](./LICENSE)
