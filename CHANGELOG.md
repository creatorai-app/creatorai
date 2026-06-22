# Changelog

All notable changes to **Creator AI** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning policy

`MAJOR.MINOR.PATCH`

- **MAJOR** – breaking changes to public APIs, SDKs, DB schema, or user-facing contracts.
- **MINOR** – new features, non-breaking enhancements.
- **PATCH** – backwards-compatible bug fixes, perf, docs, chores.

The canonical version lives in the root [`package.json`](./package.json) and is mirrored in `apps/web` and `apps/api`. Every release gets a tag `vX.Y.Z` and a GitHub Release. The public-facing changelog page ([/changelog](https://tryscriptai.com/changelog)) is sourced from `apps/web/lib/changelog-data.ts` — keep it in sync with this file.

How to cut a release:

1. Update `apps/web/lib/changelog-data.ts` with the new release entry (top of the array).
2. Mirror the entry into this file under a new `## [X.Y.Z]` heading.
3. Bump versions in the root and app `package.json`s.
4. Commit: `chore(release): vX.Y.Z`.
5. Tag: `git tag vX.Y.Z && git push --tags`.
6. Create a GitHub Release from the tag — paste the section from this file as the body.

---

## [Unreleased]

### Added
- Placeholder for upcoming features.

---

## [1.0.0] – 2026-04-23

First stable public release. Creator AI graduates from beta to 1.0 with a consolidated feature set, hardened infra, and a complete monetization + affiliate stack.

### Added
- **Affiliate program** with custom sales-rep settings, approval flow, and signup email notifications.
- **Careers module** — application/job schema, admin CRUD for managing job postings, public apply flow.
- **Admin & Sales-Rep dashboards** with role-based access control (RBAC).
- **Premium gating** on Story Builder and Ideation features.
- **One-time 200 credits** granted on signup; 250 credits awarded per successful referral.
- **Audio dubbing** backed by VoxCPM model.
- **SEO**: metadata, sitemap, robots, Open Graph/Twitter cards across public pages.
- **Resend webhook** integration for transactional email lifecycle events.
- **Swagger API docs** and end-to-end Swagger tests for the backend.
- **Unit and E2E test suites** across API services.
- **Public changelog page** at `/changelog` and this `CHANGELOG.md`.

### Changed
- Redesigned the dashboard layout and landing page (new reviews section, refreshed hero/pricing CTAs).
- Moved all shared components into the `@repo/ui` workspace package.
- Consolidated Redis connection into API and Worker containers.
- Hardened validation and error handling across services with proper typed messages.
- Recalculated credit consumption model for fair per-feature billing.

### Fixed
- Email loop on Resend webhooks.
- Job application submission bug.
- Thumbnail generation, deletion, and SSE responses (image URLs now included in status events).
- Story generation and story-building edge cases.
- Referrer credit double-attribution.
- Modal freezing on ideation flow.
- Railway/Docker build errors and `@repo/config` `main`/`types` paths.

### Security
- RBAC enforcement on admin and sales-rep routes.
- Tightened auth guards and request validation with Zod schemas.

---

## [0.2.0] – 2026-04-07

### Added
- Railway + Vercel deployment configs, split Dockerfiles for API and Worker.
- YouTube channel video fetch with `forMine` support.
- Thumbnail SSE pipeline.

### Changed
- Refactored dashboard; improved connectivity between features.
- Migrated from single Dockerfile to multi-service containers.

### Fixed
- Production build errors on Railway.
- Peer dependency resolution issues.

---

## [0.1.0] – 2026-03-11

### Added
- Initial beta: AI Studio, Script Writing, Video Ideas, Story Builder, Thumbnails, Subtitles.
- Landing page, pricing, blog, contact, privacy, terms.
- Supabase auth + SSR, LemonSqueezy billing, BullMQ worker for long jobs.

[Unreleased]: https://github.com/scriptaiapp/scriptai/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/scriptaiapp/scriptai/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/scriptaiapp/scriptai/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/scriptaiapp/scriptai/releases/tag/v0.1.0
