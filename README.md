# Creator AI

> **AI that learns your style and helps you create content faster.** Creator AI analyzes your existing YouTube videos to understand your tone, vocabulary, and structure — then generates scripts, subtitles, ideas, thumbnails, dubs, and videos — all personalized to you.

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-7289DA?style=for-the-badge&logo=discord)](https://discord.com/invite/k9sZcq2gNG)
[![GitHub Stars](https://img.shields.io/github/stars/creatorai-app/creatorai?style=for-the-badge)](https://github.com/creatorai-app/creatorai/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

[trycreatorai.com](https://trycreatorai.com) · [Changelog](https://trycreatorai.com/changelog) · [Blog](https://trycreatorai.com/blog)

## Features

- **AI Style Training** — Connect YouTube, provide 3–5 videos, and the AI watches them to learn your tone, vocabulary, and pacing
- **Script Generation** — Personalized video scripts via BullMQ worker; supports file attachments, storytelling mode, timestamps, multi-language output, and PDF export
- **Ideation** — AI-powered idea generation with live web search, trend snapshots, opportunity scoring, content angles, and sources; **Surprise me** picks a niche focus from your trained style; export as PDF/JSON
- **Story Builder** — Structured narrative generation from a topic with real-time SSE progress
- **Subtitle Generation** — Direct-to-GCS uploads (100 MB / 10 min on Starter, 2 GB / 45 min on paid plans), timed subtitles, translation, in-app editing, SRT/VTT export, and burn-in via FFmpeg
- **AI Dubbing** — Dub audio or video into 29 languages in the creator's own cloned voice; browser uploads straight to GCS, BullMQ-queued with SSE progress, cancellation, and regeneration
- **AI Video Generation** — Text-to-video, image-to-video, reference-to-video, and stateful editing via Gemini Omni Flash; async worker with cancellation and a history page
- **Thumbnail Generation** — AI thumbnails from a prompt or reference image, billed per image
- **Hannah** — Gemini-powered guide chatbot; anonymous and rate-limited on the marketing site, plan- and credit-aware inside the dashboard
- **Channel Stats** — Subscriber, view, and video counts on onboarding and connected-channel cards, with plan-based sync limits
- **Billing & Subscriptions** — Lemon Squeezy checkout, customer portal, signed webhooks, admin plan grants, and expiry reminders
- **Credit System** — Token-based credits consumed per AI operation, with the full cost prechecked before any paid vendor call
- **Referrals & Affiliates** — Referral codes for bonus credits, plus an affiliate program with commission tracking and payouts
- **Admin Dashboard** — Users, subscriptions, activity feed, error logs, job monitoring, promo codes, bulk email campaigns, affiliate management, and a blog CMS with a live SEO audit and post scheduling
- **Auth** — Email/password and Google OAuth, OTP-based password reset, email verification via Supabase Auth
- **Profile & Settings** — Avatar upload, notification preferences, billing info

### Coming Soon

- **Course Module Builder** — Structured course outlines from a topic (backend ready)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript, Zod validation |
| Database | Supabase (PostgreSQL), Row-Level Security |
| Auth | Supabase Auth (JWT), Google OAuth |
| AI | Gemini on Vertex AI — `gemini-3.6-flash` (text), `gemini-3.5-flash-lite`, `gemini-3.1-flash-image` (thumbnails), `gemini-omni-flash-preview` (video), `gemini-embedding-001` |
| Payments | Lemon Squeezy (checkout, portal, webhooks) |
| Dubbing | ElevenLabs (voice cloning + dubbing), Modal serverless GPU |
| Jobs | BullMQ + Redis (train-ai, script, ideation, story-builder, thumbnail, dubbing, video-generation, email-campaign) |
| Media | FFmpeg, Google Cloud Storage, Supabase Storage |
| Email | Resend |
| Monorepo | Turborepo + pnpm workspaces |

## Project Structure

```
creatorai/
├── apps/
│   ├── web/                          # Next.js 15 frontend
│   │   ├── app/
│   │   │   ├── blog/                 # Public blog, rendered from the database
│   │   │   ├── dashboard/
│   │   │   │   ├── train/            # AI style training
│   │   │   │   ├── scripts/          # Script generation & editing
│   │   │   │   ├── research/         # Ideation & idea research
│   │   │   │   ├── story-builder/    # Narrative structure builder
│   │   │   │   ├── subtitles/        # Subtitle generation & editing
│   │   │   │   ├── dubbing/          # Audio/video dubbing
│   │   │   │   ├── video-generation/ # AI video generation
│   │   │   │   ├── thumbnails/       # Thumbnail generation
│   │   │   │   ├── courses/          # Course builder (coming soon)
│   │   │   │   ├── admin/            # Admin: users, blogs, emails, errors, jobs…
│   │   │   │   ├── affiliate/        # Affiliate program
│   │   │   │   ├── referrals/        # Referral program
│   │   │   │   └── settings/         # User settings & billing
│   │   │   └── api/                  # Next.js API routes
│   │   ├── components/               # React components
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── lib/                      # Utilities, blog source & shared SEO rules
│   │   └── scripts/                  # seo:audit, llms:generate
│   └── api/                          # NestJS backend
│       └── src/
│           ├── auth/                 # Password reset (OTP flow)
│           ├── billing/              # Lemon Squeezy checkout, portal, webhooks
│           ├── ideation/             # AI idea generation (BullMQ)
│           ├── script/               # Script generation (BullMQ)
│           ├── story-builder/        # Story structure generation (BullMQ)
│           ├── subtitle/             # Subtitle CRUD + burn (FFmpeg)
│           ├── dubbing/              # Dubbing (ElevenLabs + Modal)
│           ├── video-generation/     # AI video generation (BullMQ)
│           ├── thumbnail/            # Thumbnail generation
│           ├── train-ai/             # AI training job queue
│           ├── hannah/               # Guide chatbot
│           ├── channel-stats/        # YouTube channel metrics
│           ├── course/               # Course module builder
│           ├── admin/                # Admin APIs incl. blog CMS
│           ├── affiliate/            # Affiliate program
│           ├── referral/             # Referral system
│           ├── email-campaign/       # Bulk email campaigns
│           ├── youtube/              # YouTube OAuth & channel data
│           ├── upload/               # File uploads
│           ├── support/              # Issue reporting
│           └── supabase/             # Supabase client module
├── packages/
│   ├── validations/                  # Shared Zod schemas, types, model & credit consts
│   ├── supabase/                     # Supabase migrations & client utilities
│   ├── workers/                      # BullMQ workers + subscription reminders
│   ├── email-templates/              # Email templates & merge tags
│   ├── config/                       # Shared constants
│   ├── ui/                           # Shared UI components
│   └── api/                          # Shared API types
├── modal/                            # Modal serverless-GPU dubbing service (Python)
├── docs/                             # Setup, hosting & design docs
├── docker-compose.yml                # Redis + worker services (dev)
├── docker-compose.prod.yml           # Redis + api + worker + web + Caddy (prod)
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
git clone https://github.com/creatorai-app/creatorai.git
cd creatorai
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

The root `.env` is the single source of truth — the API, the workers, and the web app all read from it.

```bash
cp .env.example .env
```

Fill it in with your credentials. See [`.env.example`](./.env.example) for every key and which service reads it.

<details>
<summary>Required services & API keys</summary>

| Service | Key | Required | Purpose |
|---------|-----|----------|---------|
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | Yes | Database, auth, storage |
| Google Vertex AI (Gemini) | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, ADC (`GOOGLE_APPLICATION_CREDENTIALS`) | Yes | Scripts, ideation, training, subtitles, thumbnails, video |
| Redis | `REDIS_URL` | Yes | BullMQ job queues (api + worker) |
| Google Cloud Storage | `GCS_SUBTITLE_BUCKET`, `GCS_VIDEO_BUCKET`, `GCS_DUBBING_BUCKET` | Yes | Direct media uploads, read by Vertex from `gs://` |
| Modal | `MODAL_API_URL` | Optional | Serverless-GPU dubbing service |
| Resend | `RESEND_API_KEY` | Optional | Transactional emails & campaigns |
| YouTube | `YOUTUBE_API_KEY` | Optional | Channel integration |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional | YouTube OAuth |
| Lemon Squeezy | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` | Optional | Payments & subscriptions |

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
| `pnpm run test:e2e` | Run Playwright end-to-end tests |
| `pnpm run lint` | Lint all code |
| `pnpm run type-check` | TypeScript type checking |
| `pnpm run format` | Format with Prettier |
| `pnpm run release <version>` | Bump versions in lockstep after the changelog entry is authored |
| `pnpm --filter web seo:audit` | Audit every published blog post against the SEO checklist |
| `pnpm --filter web llms:generate` | Regenerate `llms.txt` / `llms-full.txt` |

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────▶│   NestJS     │────▶│  Supabase    │
│   Frontend   │     │   Backend    │     │  (Postgres)  │
└──────┬───────┘     └──────┬───────┘     └──────────────┘
       │                    │
       │             ┌──────▼───────┐     ┌───────────────┐
       │             │   BullMQ     │────▶│  AI Workers   │
       │             │   (Redis)    │     │  (Vertex AI)  │
       │             └──────────────┘     └──────┬────────┘
       │                                         │
       └────────────▶┌──────────────┐◀───────────┘
       signed upload │     GCS      │  gs:// reads
                     └──────────────┘
```

- **Frontend** calls Next.js API routes for some AI operations and the NestJS backend for subtitles, dubbing, video generation, training, billing, and admin.
- **Backend** validates requests, enforces plan and credit limits before any paid vendor call, and enqueues long-running work to BullMQ.
- **Workers** process queued jobs (training, scripts, ideation, story builder, thumbnails, dubbing, video generation, email campaigns) with SSE progress streaming back to the client.
- **Media** is uploaded from the browser straight to GCS via signed URLs, so the API never proxies the bytes and Vertex reads them from `gs://`.
- **Supabase** handles auth, database (with RLS), and file storage.

## Documentation

| Document | Description |
|----------|-------------|
| [Requirements](./requirements.md) | Full feature specification |
| [Setup Guide](./docs/SETUP.md) | Detailed development environment setup |
| [Vertex AI Setup](./docs/vertex-ai-setup.md) | Google Cloud project, ADC, and model access |
| [Lemon Squeezy Pricing](./docs/lemonsqueezy-pricing-setup.md) | Plans, variants, and webhook wiring |
| [Hosting Guide](./docs/aws-lightsail-hosting.md) | Production deploy on AWS Lightsail with Caddy |
| [Dubbing Design](./docs/dubbing-design.md) | Dubbing pipeline architecture |
| [Video Generation Design](./docs/video-generation-design.md) | Video pipeline architecture |
| [API Docs](./apps/api/README.md) | Backend endpoints reference |
| [Web App Docs](./apps/web/README.md) | Frontend pages & routes |
| [Database Schema](./packages/supabase/README.md) | Supabase schema documentation |
| [Changelog](./CHANGELOG.md) | Release history & versioning policy |
| [Contributing Guide](./CONTRIBUTING.md) | How to contribute |
| [Code of Conduct](./CODE_OF_CONDUCT.md) | Community guidelines |

## Contributing

1. Join [Discord](https://discord.gg/k9sZcq2gNG)
2. Read the [Contributing Guide](./CONTRIBUTING.md) and [Setup Guide](./docs/SETUP.md)
3. Check issues labeled **"Good First Issue"**
4. Fork, branch, code, and submit a PR

## Community

- [Discord](https://discord.com/invite/k9sZcq2gNG) — Questions, discussions, and support
- [GitHub Issues](https://github.com/creatorai-app/creatorai/issues) — Bug reports and feature requests

## License

MIT — see [LICENSE](./LICENSE)
