# Creator AI Web App

Next.js 15 frontend for Creator AI. App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui.

## Pages

| Route | Status | Description |
|-------|--------|-------------|
| `/` | Done | Landing page with features, pricing, how it works, CTA |
| `/login` | Done | Email/password + Google OAuth |
| `/signup` | Done | Multi-step signup with referral code support |
| `/forgot-password` | Done | OTP-based password reset |
| `/privacy` | Done | Privacy policy and terms |
| `/dashboard` | Done | Welcome hub, onboarding, recent activity |
| `/dashboard/train` | Done | AI style training with YouTube videos |
| `/dashboard/scripts` | Done | Script list with pagination |
| `/dashboard/scripts/new` | Done | Multi-step script generation form |
| `/dashboard/scripts/[id]` | Done | Script detail, edit & export as PDF |
| `/dashboard/research` | Done | Ideation list with trend snapshots |
| `/dashboard/research/new` | Done | Ideation generation form |
| `/dashboard/research/[id]` | Done | Ideation detail, opportunity scores, export |
| `/dashboard/story-builder` | Done | Story structure generator with history |
| `/dashboard/subtitles` | Done | Subtitle list & upload video |
| `/dashboard/subtitles/new` | Done | Subtitle generation form |
| `/dashboard/settings` | Done | Profile, notifications, billing |
| `/dashboard/referrals` | Done | Referral code, stats, history |
| `/dashboard/dubbing` | Coming soon | Dubbing project list |
| `/dashboard/thumbnails` | Coming soon | Thumbnail generator |
| `/dashboard/courses` | Coming soon | Course module builder |
| `/dashboard/video-generation` | Coming soon | AI video generator |

## Key Hooks

| Hook | Purpose |
|------|---------|
| `useScriptGeneration` | Script creation with SSE progress & BullMQ |
| `useIdeation` | Ideation generation with SSE progress |
| `useStoryBuilder` | Story builder with SSE progress & history |
| `useThumbnailGeneration` | Thumbnail generation flow |
| `useSettings` | User settings management |
| `useBilling` | Stripe billing & subscription info |

## Key Integrations

| Service | Purpose |
|---------|---------|
| Supabase | Auth, database, storage |
| Google Gemini AI | Scripts, ideation, training transcription |
| OpenAI GPT-4o | Subtitles, thumbnails |
| YouTube Data API | Channel connection, video metadata |
| Resend | Transactional emails |

## Setup

```bash
cp .env.example .env   # Fill in credentials
pnpm install
pnpm run dev --filter=web
```

Runs at [http://localhost:3000](http://localhost:3000).
