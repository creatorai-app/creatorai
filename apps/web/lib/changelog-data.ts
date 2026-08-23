export type ChangeType = "added" | "changed" | "fixed" | "removed" | "security";

export type ReleaseTag = "major" | "minor" | "patch";

export interface ChangelogEntry {
  type: ChangeType;
  description: string;
}

export interface ChangelogRelease {
  /** Semver version, e.g. "1.0.0". Must match root package.json at release time. */
  version: string;
  /** ISO date: "YYYY-MM-DD". */
  date: string;
  /** Semver bump category. Drives the colored badge on the UI. */
  tag: ReleaseTag;
  /** Optional marketing title for the release. */
  title?: string;
  /** Short intro paragraph shown at the top of the release card. */
  summary?: string;
  /** Grouped change entries shown under the summary. */
  changes: ChangelogEntry[];
}

/**
 * Single source of truth for the public /changelog page.
 * Keep in sync with the root CHANGELOG.md. Newest release at index 0.
 */
export const releases: ChangelogRelease[] = [
  {
    version: "1.5.0",
    date: "2026-08-23",
    tag: "minor",
    title: "New home, and a real blog behind the scenes",
    summary:
      "Creator AI moves to trycreatorai.com. The blog gets a proper editor with a live SEO check, scheduled publishing and a named author, and dubbing now tells you what a dub costs before it runs.",
    changes: [
      { type: "added", description: "Blog posts are now written and edited in one place, with a live SEO check while you write instead of a report afterwards." },
      { type: "added", description: "Scheduled publishing: give a post a future date and it goes live on its own; past dates place it correctly in the archive." },
      { type: "added", description: "Posts now carry a named author with a photo, bio and links, so you can see who is behind a recommendation." },
      { type: "added", description: "A small footer on every dashboard page with a rotating creator quote." },
      { type: "added", description: "New guides covering tool comparisons, alternatives and end-to-end workflows." },
      { type: "changed", description: "Creator AI now lives at trycreatorai.com, with @joincreatorai on X. Old links redirect." },
      { type: "changed", description: "The blog was consolidated from 55 posts to 44 hubs, with real pricing and performance numbers from our own usage. Every retired URL redirects to its replacement." },
      { type: "fixed", description: "Dubbing could fail with \"Insufficient credits\" partway through. The full cost is now checked and shown up front, and a pricing mistake that overcharged some dubs is corrected." },
      { type: "fixed", description: "Each blog post now describes only itself to search engines, instead of the entire blog." },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-08-15",
    tag: "minor",
    title: "Ideation refresh & admin visibility",
    summary:
      "Ideation gets a cleaner page and a Surprise me button that picks a niche from your trained style. Behind the scenes, the admin dashboard can now see who is active and what is failing.",
    changes: [
      { type: "added", description: "Surprise me on Ideation: suggests a niche focus from your trained channel style instead of static example chips." },
      { type: "added", description: "Admin presence tracking, so the dashboard shows who is currently using Creator AI." },
      { type: "added", description: "Error logging across the API and every worker, with unhandled failures recorded for admin review." },
      { type: "added", description: "Promo code lifecycle management in the admin dashboard." },
      { type: "added", description: "Ten new guides covering ideation, content calendars, script generators, Spotter Studio alternatives, subtitle accuracy and auto-caption fixes." },
      { type: "changed", description: "The Ideation page is now titled Ideation rather than Research, with the same how-it-works layout as AI Studio and a full-card auto mode." },
      { type: "fixed", description: "Annual affiliate commission was calculated from the monthly price." },
      { type: "fixed", description: "Embedded blog videos failed Google's watch-page check, so they never appeared as video results." },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-07-31",
    tag: "minor",
    title: "Dubbing, video generation & Hannah",
    summary:
      "The largest release so far, and the one that catches this changelog up: audio dubbing and AI video generation both went live, Hannah arrived to answer questions, and the whole platform moved to Vertex AI. Everything shipped between the pricing rebuild and the end of July is listed here.",
    changes: [
      { type: "added", description: "AI audio dubbing: upload audio or video, pick a language, get it back in a clone of the original speaker's voice. Progress streams live and jobs can be cancelled or regenerated. Paid plans, up to 500MB per upload." },
      { type: "added", description: "AI video generation on Gemini Omni Flash, with text-to-video, image-to-video and reference-to-video modes plus follow-up editing. Pro, Business and Scale." },
      { type: "added", description: "Hannah, an AI guide that answers questions about features, pricing and your own account, on both the public site and the dashboard. Supports voice messages and keeps chat history." },
      { type: "added", description: "Channel stats: subscribers, views and video counts on the dashboard, with plan-based sync limits." },
      { type: "added", description: "Public prompt guide at /prompt-guide." },
      { type: "added", description: "Subtitles now upload directly to cloud storage with plan-based duration and size limits, and show credits consumed per generation." },
      { type: "added", description: "Admin: subscription management with fixed validity periods, automatic downgrade on expiry and reminder emails at 7 days, 3 days and 24 hours." },
      { type: "added", description: "Admin: user activity feed, subscription history, segmented bulk email campaigns, and real revenue reporting from Lemon Squeezy webhooks." },
      { type: "added", description: "A clear out-of-credits dialog when AI training fails, linking to both referrals and billing." },
      { type: "changed", description: "Explore-first dashboard: every feature is browsable, and generation is gated at the button with a modal instead of locking whole pages." },
      { type: "changed", description: "AI Training now genuinely analyses your videos. It previously read only the title and description, so every style profile has been rebuilt on real video analysis." },
      { type: "changed", description: "Dubbing switched to ElevenLabs' built-in voice cloning and gained accent selection." },
      { type: "changed", description: "All AI generation moved from Google AI Studio to Vertex AI, on the newer Gemini 3.5 Flash text model." },
      { type: "changed", description: "Credit costs recalibrated per feature against real vendor rates. Thumbnails now bill per image." },
      { type: "changed", description: "Public pages load roughly twice as fast, with first-load JavaScript halved and render-blocking CSS removed." },
      { type: "changed", description: "The signup confirmation email is now branded Creator AI instead of the unstyled Script AI default." },
      { type: "changed", description: "Video generation and audio dubbing are no longer marked coming soon." },
      { type: "fixed", description: "Referral and purchase bonus credits were wiped at every plan renewal. Bonuses now survive resets and are spent last." },
      { type: "fixed", description: "Admin revenue showed $0.00 despite active subscriptions, because no Lemon Squeezy payment was ever recorded." },
      { type: "fixed", description: "Dubbed videos over 50MB failed to save." },
      { type: "fixed", description: "Channel stats empty state rendered an icon with no call to action." },
      { type: "fixed", description: "Redis connection drops on idle and intermittent production build failures." },
      { type: "removed", description: "The legacy sales-rep portal. Affiliate sales now live under Affiliates." },
      { type: "removed", description: "Premium lock on Ideation exports." },
      { type: "security", description: "Hannah is split by trust boundary: the public bot is anonymous, rate limited per IP and never sees account data, while the dashboard bot is authenticated and injects your account context server-side rather than trusting the browser." },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-16",
    tag: "minor",
    title: "More free credits",
    summary:
      "The free Starter plan now includes 500 credits every month, up from 200, so you can try more of Creator AI before upgrading.",
    changes: [
      { type: "changed", description: "Starter (free) plan monthly credits increased from 200 to 500. Existing free users are topped up automatically." },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-06-19",
    tag: "minor",
    title: "New pricing & a fairer referral program",
    summary:
      "Every feature is now available on every plan, including the free Starter plan. Plans differ only by monthly credits, with optional annual billing that saves 20%. The referral program now rewards real purchases instead of sign-ups.",
    changes: [
      { type: "added", description: "Five plans: Starter (free, 200 credits), Creator ($24/mo, 3,000), Pro ($49/mo, 8,000), Business ($299/mo, 50,000), and Scale ($599/mo, 150,000)." },
      { type: "added", description: "Annual billing on Creator and Pro, save 20% ($19/mo and $39/mo billed yearly)." },
      { type: "added", description: "Public Referral Program page explaining the give-1,000-get-1,000 model." },
      { type: "changed", description: "Every feature is now unlocked on every plan, no feature is gated behind a higher tier." },
      { type: "changed", description: "Referral rewards: earn 1,000 credits when a referred friend makes their first purchase (they get 1,000 too). No more sign-up bonuses." },
      { type: "removed", description: "Premium feature gates on Story Builder modes and Ideation comparison metrics." },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-23",
    tag: "major",
    title: "Creator AI 1.0 | General Availability",
    summary:
      "First stable public release. Creator AI graduates from beta with a consolidated feature set, hardened infra, RBAC-backed admin tooling, and a complete monetization and affiliate stack.",
    changes: [
      { type: "added", description: "Affiliate program with sales-rep settings, approvals, and signup email notifications." },
      { type: "added", description: "Careers module, job postings, applications, and admin CRUD." },
      { type: "added", description: "Admin and Sales-Rep dashboards with role-based access control." },
      { type: "added", description: "Premium gating on Story Builder and Ideation." },
      { type: "added", description: "One-time 200 credits on signup; 250 credits per successful referral." },
      { type: "added", description: "Audio dubbing powered by the VoxCPM model." },
      { type: "added", description: "SEO metadata, sitemap, robots, and Open Graph across public pages." },
      { type: "added", description: "Resend webhook integration for transactional email lifecycle events." },
      { type: "added", description: "Swagger API docs and end-to-end Swagger tests for the backend." },
      { type: "added", description: "Unit and E2E test suites across API services." },
      { type: "added", description: "Public changelog page and CHANGELOG.md." },
      { type: "changed", description: "Redesigned dashboard layout, landing page, and pricing CTAs." },
      { type: "changed", description: "All shared components moved into the @repo/ui workspace package." },
      { type: "changed", description: "Redis connection consolidated into API and Worker containers." },
      { type: "changed", description: "Hardened validation and typed error messages across services." },
      { type: "changed", description: "Recalculated credit consumption for fair per-feature billing." },
      { type: "fixed", description: "Email loop on Resend webhooks." },
      { type: "fixed", description: "Job application submission bug." },
      { type: "fixed", description: "Thumbnail generation, deletion, and SSE payloads now include image URLs." },
      { type: "fixed", description: "Story generation and story-builder edge cases." },
      { type: "fixed", description: "Referrer credit double-attribution." },
      { type: "fixed", description: "Modal freezing on the ideation flow." },
      { type: "fixed", description: "Railway/Docker build errors and @repo/config main/types paths." },
      { type: "security", description: "RBAC enforcement on admin and sales-rep routes; tighter Zod-backed request validation." },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-04-07",
    tag: "minor",
    title: "Deployment & Pipelines",
    summary:
      "Railway + Vercel deployment wiring, split API/Worker containers, and the first SSE pipeline for thumbnails.",
    changes: [
      { type: "added", description: "Railway and Vercel deployment configs, split Dockerfiles for API and Worker." },
      { type: "added", description: "YouTube channel video fetch with forMine support." },
      { type: "added", description: "Thumbnail SSE pipeline." },
      { type: "changed", description: "Refactored dashboard and feature connectivity." },
      { type: "changed", description: "Migrated from single Dockerfile to multi-service containers." },
      { type: "fixed", description: "Production build errors on Railway." },
      { type: "fixed", description: "Peer dependency resolution issues." },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-03-11",
    tag: "minor",
    title: "Initial Beta",
    summary:
      "The first public beta of Creator AI with the core creator toolkit end to end.",
    changes: [
      { type: "added", description: "AI Studio, Script Writing, Video Ideas, Story Builder, Thumbnails, Subtitles." },
      { type: "added", description: "Landing page, pricing, blog, contact, privacy, and terms." },
      { type: "added", description: "Supabase auth + SSR, LemonSqueezy billing, BullMQ worker for long jobs." },
    ],
  },
];

export const latestRelease = releases[0];
