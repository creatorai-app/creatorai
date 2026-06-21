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
      { type: "added", description: "One-time 500 credits on signup; 250 credits per successful referral." },
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
