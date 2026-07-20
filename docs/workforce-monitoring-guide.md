# Workforce Monitoring & Work Management — Build Guide

**Module:** `workforce` (internal team monitoring + personal work management)
**Target:** Creator AI admin panel (`apps/web/app/dashboard/admin/*`, `apps/api/src/*`)
**Inspiration:** WorkComposer (time tracking, screenshots, app/URL monitoring, activity scoring, attendance/shifts/billing)
**Author of this guide:** design spec for Afrin

---

## 0. How to read this guide

This is both a **product spec** (what each page does) and a **technical build guide** (schema, endpoints, jobs) written to match the conventions already in your repo. Nothing here invents a new stack — it extends what you have:

| You already have | The workforce module reuses it for |
|---|---|
| `profiles.role` enum (`user`, `admin`, `sales_rep`) | Adding `manager` + `employee` roles |
| `is_admin()` / `get_user_role()` SQL helpers, RLS on every table | Team-scoped row security |
| `activities` audit table | Logging every monitoring/admin action |
| `RolesGuard` + `@Roles()` decorator + `SupabaseAuthGuard` | Protecting all new endpoints |
| NestJS modular controllers/services (`apps/api/src/admin`) | New `time-tracking`, `monitoring`, `attendance` modules |
| BullMQ queues (`packages/workers`) | Screenshot processing, timesheet rollups, activity scoring |
| Next.js App Router admin pages + `admin/layout.tsx` | New admin sub-sections |
| Supabase Storage + signed URLs | Screenshot storage |
| Timestamped SQL migrations in `packages/supabase/migrations` | All new tables |

**Important architectural note.** WorkComposer-style monitoring (screenshots, app/URL capture, keyboard/mouse activity) **cannot be done from a web app alone** — the browser has no access to other apps or the OS. You need a **desktop agent** (a small Electron/native app installed on each employee's machine) that captures data and POSTs it to your NestJS API. The admin panel is the *dashboard* over that data. Section 4 covers the agent. Everything an employee doesn't need a desktop app for (manual timers, viewing own timesheets, your own task management) lives in the web app.

---

## 1. Roles & permission model

### 1.1 Extend the existing role enum

Your enum today is `('user', 'admin', 'sales_rep')`. Add two workforce roles. Keep `user` (paying customers of Creator AI) completely separate from workforce roles — a workforce user is *your staff*, not a product customer.

```sql
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'employee';
```

Also update the TS union in `apps/api/src/guards/roles.guard.ts`:

```ts
export type UserRole = 'user' | 'admin' | 'sales_rep' | 'manager' | 'employee';
```

### 1.2 The three workforce roles

| Role | Who | Sees |
|---|---|---|
| **Owner / Admin** (`admin`) | You, Afrin | Everything across all teams: every employee's time, screenshots, apps, activity, attendance, billing, plus org settings. Also has a **personal workspace** for your own work. |
| **Manager** (`manager`) | Team leads | Only members of teams they own. Same monitoring views as admin but scoped to their team. Cannot change org settings, billing rates for other teams, or role assignments. |
| **Employee** (`employee`) | Staff being tracked | Only **their own** data: own timesheets, own screenshots (transparency mode), own activity, own tasks. Cannot see teammates. |

### 1.3 Teams

Monitoring must be team-scoped, so introduce a lightweight org structure:

```
organization (implicit — single org = your company)
  └── team (has one manager, many members)
        └── member (an employee assigned to the team)
```

### 1.4 Permission matrix

| Capability | Admin | Manager (own team) | Employee (self) |
|---|:--:|:--:|:--:|
| View live "who's working now" | All | Team | Self |
| View/scrub screenshots | ✅ | ✅ | ✅ (own only) |
| Delete/flag a screenshot | ✅ | ✅ | Request only |
| Configure capture interval / blur | ✅ | Team default | ❌ |
| View app/URL logs | ✅ | ✅ | Self |
| Edit productivity categories | ✅ | Propose | ❌ |
| Approve/edit timesheets | ✅ | ✅ | Submit only |
| Manage shifts & schedules | ✅ | ✅ | View own |
| Set billing rates | ✅ | Team | ❌ |
| Export payroll CSV | ✅ | Team | Own |
| Assign roles / invite staff | ✅ | ❌ | ❌ |
| Personal task workspace | ✅ | ✅ | ✅ |

Enforce this in **two layers** (same as your current code): RLS policies in Postgres (defense in depth) **and** `@Roles()` + a team-scope check in the NestJS service.

---

## 2. Data model (migration-ready)

New migration file, following your naming: `packages/supabase/migrations/20260713000000_workforce_module.sql`. Below are the core tables. All get `ENABLE ROW LEVEL SECURITY`, indexes, and `handle_updated_at()` triggers exactly like your existing tables.

### 2.1 Teams & membership

```sql
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- team-level capture defaults
  screenshot_interval_secs int NOT NULL DEFAULT 600,   -- 10 min
  screenshot_random boolean NOT NULL DEFAULT true,
  blur_screenshots boolean NOT NULL DEFAULT false,
  idle_timeout_secs int NOT NULL DEFAULT 300,          -- 5 min
  tracking_mode text NOT NULL DEFAULT 'automatic'
    CHECK (tracking_mode IN ('automatic','manual','silent')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  billable_rate numeric(10,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  is_active boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (team_id, user_id)
);
```

### 2.2 Time tracking

```sql
-- One row per continuous work session (start → stop)
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'automatic'
    CHECK (source IN ('automatic','manual','silent','offline_sync')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,                       -- null = currently running
  duration_secs int GENERATED ALWAYS AS
    (EXTRACT(EPOCH FROM (ended_at - started_at))::int) STORED,
  is_billable boolean DEFAULT true,
  is_idle boolean DEFAULT false,
  activity_score numeric(5,2),                -- 0–100, rolled up from activity_samples
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Raw keyboard/mouse activity, one row per minute of a session
CREATE TABLE public.activity_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sampled_at timestamptz NOT NULL,
  keystrokes int DEFAULT 0,
  mouse_clicks int DEFAULT 0,
  mouse_distance int DEFAULT 0,
  activity_pct numeric(5,2) DEFAULT 0,        -- computed engagement for the minute
  is_idle boolean DEFAULT false
);
```

### 2.3 Screenshots

```sql
CREATE TABLE public.screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  storage_path text NOT NULL,                 -- Supabase Storage key (private bucket)
  thumbnail_path text,
  is_blurred boolean DEFAULT false,
  active_app text,                            -- foreground app at capture time
  active_url text,
  activity_pct numeric(5,2),
  flagged boolean DEFAULT false,
  deleted_by uuid,                            -- audit: who removed it
  created_at timestamptz DEFAULT now()
);
```
Store originals in a **private** Supabase Storage bucket (`workforce-screenshots`); serve to the panel only via short-lived signed URLs. Never make this bucket public.

### 2.4 App & website monitoring

```sql
CREATE TABLE public.app_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name text NOT NULL,
  window_title text,
  url text,
  domain text,
  started_at timestamptz NOT NULL,
  duration_secs int NOT NULL DEFAULT 0,
  category text                               -- resolved from productivity_rules
    CHECK (category IN ('productive','neutral','unproductive','uncategorized'))
);

-- Admin-defined classification rules
CREATE TABLE public.productivity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,  -- null = org-wide default
  match_type text NOT NULL CHECK (match_type IN ('app','domain')),
  pattern text NOT NULL,                      -- e.g. 'youtube.com', 'Photoshop'
  category text NOT NULL CHECK (category IN ('productive','neutral','unproductive')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_id, match_type, pattern)
);
```

### 2.5 Attendance, shifts & projects

```sql
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  status text NOT NULL DEFAULT 'present'
    CHECK (status IN ('present','late','absent','half_day','on_leave')),
  work_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  client_name text,
  default_billable_rate numeric(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','review','done')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date date,
  estimated_secs int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 2.6 Timesheets (approval layer)

```sql
CREATE TABLE public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_secs int DEFAULT 0,
  billable_secs int DEFAULT 0,
  total_amount numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','rejected','paid')),
  submitted_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 2.7 Dashboard stats view

Mirror your existing `admin_dashboard_stats` view with a workforce one:

```sql
CREATE OR REPLACE VIEW public.workforce_dashboard_stats AS
SELECT
  (SELECT count(*) FROM team_members WHERE is_active) AS active_members,
  (SELECT count(*) FROM time_entries WHERE ended_at IS NULL) AS currently_working,
  (SELECT COALESCE(sum(duration_secs),0) FROM time_entries
     WHERE started_at::date = current_date) AS secs_tracked_today,
  (SELECT round(avg(activity_score),1) FROM time_entries
     WHERE started_at > now() - interval '7 days') AS avg_activity_7d,
  (SELECT count(*) FROM timesheets WHERE status = 'submitted') AS pending_timesheets,
  (SELECT count(*) FROM attendance
     WHERE work_date = current_date AND status = 'late') AS late_today;
```

### 2.8 RLS policy pattern

Add a helper (mirrors your `is_admin()`):

```sql
CREATE OR REPLACE FUNCTION public.manages_team(t uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM teams WHERE id = t AND manager_id = auth.uid());
$$;
```

Then every table gets three policy shapes:

```sql
-- Employee sees own rows
CREATE POLICY "own rows" ON public.time_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- Manager sees their team's rows
CREATE POLICY "team rows" ON public.time_entries FOR SELECT TO authenticated
  USING (manages_team(team_id));
-- Admin sees all
CREATE POLICY "admin all" ON public.time_entries FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
```

---

## 3. Page-by-page breakdown

All admin/manager pages live under `apps/web/app/dashboard/admin/workforce/`. Employee-facing pages live under `apps/web/app/dashboard/my-work/` (visible to everyone). Each page below lists **purpose → UI/components → data shown → endpoints → logic**.

### 3.1 Workforce Overview (landing)
`/dashboard/admin/workforce` — role: admin, manager

- **Purpose:** the "command center" — who's working right now, today's totals, alerts.
- **UI:** stat cards (active members, currently working, hours tracked today, avg activity, pending timesheets, late arrivals); a live "Now working" list with avatar, current task, live activity %, last screenshot thumbnail; a 7-day activity trend chart; alerts feed (idle too long, no screenshot, missed shift).
- **Data:** `workforce_dashboard_stats` view + `time_entries WHERE ended_at IS NULL`.
- **Endpoints:** `GET /workforce/stats`, `GET /workforce/live`.
- **Logic:** poll `/live` every 30–60s (or Supabase Realtime subscription on `time_entries`). Manager version filters by `manages_team`.

### 3.2 Team & People management
`/dashboard/admin/workforce/team` — role: admin (full), manager (own team, read + limited)

- **Purpose:** create teams, invite staff, assign roles, set billable rates.
- **UI:** teams list → team detail with member table (name, role, team, rate, status, last active); "Invite member" modal (email + role + team); per-member drawer to set `billable_rate`, deactivate, reassign team.
- **Data:** `teams`, `team_members` joined to `profiles`.
- **Endpoints:** `GET/POST /workforce/teams`, `GET/PUT /workforce/teams/:id`, `POST /workforce/teams/:id/members`, `PUT /workforce/members/:id`, `POST /workforce/invite`.
- **Logic:** reuse your existing `invited_users` + Resend email flow. On accept, create `profiles.role = 'employee'` and a `team_members` row. Log to `activities` (`action: 'member_invited'`).

### 3.3 Time Tracking views

#### 3.3a Live timers / sessions
`/dashboard/admin/workforce/time` — admin, manager
- **Purpose:** see and audit all running + recent sessions.
- **UI:** filterable table (member, project/task, source badge [auto/manual/silent], start, duration ticking, billable toggle, activity %); manual "stop" override for admins; day/week/custom range picker.
- **Endpoints:** `GET /workforce/time-entries?userId&teamId&from&to&status`, `PATCH /workforce/time-entries/:id` (edit/stop/mark billable).

#### 3.3b Employee's own timer
`/dashboard/my-work/timer` — employee (and you)
- **Purpose:** manual/automatic timer control for people who track their own time.
- **UI:** big Start/Stop button, project + task dropdown, "add time manually" form (for retroactive entry), today's log, week total.
- **Endpoints:** `POST /time/start`, `POST /time/stop`, `POST /time/manual`.
- **Logic — the three modes (WorkComposer parity):**
  - **Automatic:** desktop agent opens a `time_entry` when the machine boots / work activity begins; no button needed.
  - **Manual:** employee explicitly starts/stops here, or enters hours retroactively (`source='manual'`).
  - **Silent/Stealth:** agent runs with no tray UI; entries created server-side, employee has no start/stop control. **Legal gate:** only enable where you have documented consent — see §7.
  - **Offline:** agent buffers entries + samples locally (SQLite/JSON) and replays them to `POST /time/sync` (`source='offline_sync'`) when connectivity returns; dedupe on `(user_id, started_at)`.

### 3.4 Screenshots
`/dashboard/admin/workforce/screenshots` — admin, manager; own-only view at `/dashboard/my-work/screenshots`

- **Purpose:** visual proof-of-work review.
- **UI:** timeline/grid gallery grouped by member and hour; each tile shows thumbnail, timestamp, active app, activity %; click → lightbox with full image, prev/next, "flag" and "delete" (admin) actions; filters by member/date/flagged; a per-member "filmstrip" scrubber across a day.
- **Data:** `screenshots` + signed URLs.
- **Endpoints:** `GET /workforce/screenshots?userId&date`, `GET /workforce/screenshots/:id/url` (returns 60s signed URL), `POST /workforce/screenshots/:id/flag`, `DELETE /workforce/screenshots/:id`.
- **Logic / config:** interval and randomness come from `teams.screenshot_interval_secs` + `screenshot_random`. **Blurring** (`teams.blur_screenshots`) is applied by the screenshot worker (§6) before storage on premium/sensitive teams. Encrypt at rest (Supabase Storage is encrypted; add AES-256 app-layer if you need envelope encryption) and only ever transit over TLS. Enterprise "bring your own storage" (S3/Azure/SFTP) = a per-team storage-target config that the worker writes to instead of Supabase.

### 3.5 App & Website Monitoring
`/dashboard/admin/workforce/apps` — admin, manager; own view under my-work

- **Purpose:** where the hours actually went, and how productive.
- **UI:** stacked bar of productive/neutral/unproductive per member per day; top apps list; top domains list; a per-member timeline of app switches; a **"Categorize"** panel where admin drags an uncategorized app/domain into productive/neutral/unproductive (writes a `productivity_rules` row).
- **Data:** `app_usage` aggregated; `productivity_rules` for classification.
- **Endpoints:** `GET /workforce/apps?userId&from&to`, `GET /workforce/apps/uncategorized`, `POST /workforce/productivity-rules`, `PUT/DELETE /workforce/productivity-rules/:id`.
- **Logic:** on ingest, the API resolves each `app_usage` row's `category` by matching against `productivity_rules` (team rule wins over org default; unmatched = `uncategorized`). Re-running a rule can backfill recent rows via a job.

### 3.6 Activity & Productivity
`/dashboard/admin/workforce/activity` — admin, manager; own view under my-work

- **Purpose:** engagement scoring, idle/break detection, focus trends.
- **UI:** activity heatmap (member × hour), focus-score leaderboard (use carefully — see §7 on morale), idle-vs-active donut, break log; per-member drill-down showing minute-by-minute `activity_pct`.
- **Data:** `activity_samples` rolled up into `time_entries.activity_score`.
- **Endpoints:** `GET /workforce/activity?userId&from&to`.
- **Logic:** activity % per minute = normalized function of keystrokes + clicks + mouse distance, capped at 100. Idle detection: if no input for `teams.idle_timeout_secs`, agent marks samples `is_idle=true` and either pauses the timer (auto mode) or prompts the user. A scoring job (§6) computes `time_entries.activity_score` = time-weighted mean of non-idle sample activity.

### 3.7 Attendance & Shifts
`/dashboard/admin/workforce/attendance` — admin, manager; own view under my-work

- **Purpose:** scheduling and clock-in compliance.
- **UI:** weekly shift calendar (drag to create/edit shifts); attendance table (member, date, clock-in, clock-out, status, hours) with late/absent flags; "assign shift" modal; leave/absence marking.
- **Data:** `shifts`, `attendance`.
- **Endpoints:** `GET/POST /workforce/shifts`, `PUT/DELETE /workforce/shifts/:id`, `GET /workforce/attendance?from&to`, `PATCH /workforce/attendance/:id`.
- **Logic:** first `time_entry` of a work date sets `clock_in`; compare to matching shift's `scheduled_start` → `late` if beyond grace period; no entry on a scheduled day → `absent`. A nightly cron (you already run cron per `annual_credit_refresh_cron`) reconciles attendance rows.

### 3.8 Billing & Rates
`/dashboard/admin/workforce/billing` — admin (full), manager (team)

- **Purpose:** turn tracked time into money.
- **UI:** rate management (per member, per project); billable-vs-nonbillable summary; revenue-by-project/client; per-member cost.
- **Data:** `team_members.billable_rate`, `projects.default_billable_rate`, `time_entries.is_billable + duration_secs`.
- **Endpoints:** `GET /workforce/billing/summary?from&to&projectId`.
- **Logic:** amount = Σ(billable duration × applicable rate). Rate resolution order: task/project rate → member rate → team default. Support multiple currencies via `team_members.currency`.

### 3.9 Reports & Timesheets
`/dashboard/admin/workforce/reports` — admin, manager; submission view for employees

- **Purpose:** the exportable, payroll-ready layer (WorkComposer's Overview / Attendance / Timeframe reports).
- **UI:** report type tabs — **Overview** (totals per member), **Attendance** (clock logs), **Timeframe** (custom range activity); each with member/team/project/date filters, a data table, and **Export CSV** (+ PDF, since you already have PDF export in scripts/ideation). A **Timesheets** sub-tab shows the approval queue: employee submits → manager/admin approves/rejects → mark paid.
- **Data:** aggregates across `time_entries`, `attendance`, `timesheets`.
- **Endpoints:** `GET /workforce/reports/overview`, `/attendance`, `/timeframe` (all take filters + `?format=csv|pdf`); `POST /workforce/timesheets/:id/submit|approve|reject`.
- **Logic:** reuse your existing PDF/export utilities. CSV columns should map cleanly to external payroll (member, email, period, total hrs, billable hrs, rate, amount, status).

### 3.10 Personal Work Management (your own work)
`/dashboard/my-work` — everyone, but this is the piece you asked for to manage **your own** work alongside the team.

- **Purpose:** a personal task + time cockpit so you (and each employee) manage day-to-day work, not just get monitored.
- **UI:** a Kanban/List board over `tasks` (todo → in progress → review → done); a "My day" panel with today's time total, running timer, and assigned tasks; a personal calendar of shifts/due dates; quick "log time to task" action.
- **Data:** `tasks` where `assignee_id = me`, `time_entries` where `user_id = me`, `projects`.
- **Endpoints:** `GET /tasks?assignee=me`, `POST/PUT /tasks`, `PATCH /tasks/:id/status`, plus the timer endpoints from §3.3b.
- **Logic:** starting a timer from a task auto-links `time_entry.task_id`, so your personal tracking flows into the same reports as the team. This is what makes the panel serve "both my employees and my own work" from one data model.

### 3.11 Settings & Monitoring policy
`/dashboard/admin/workforce/settings` — admin

- **Purpose:** org-wide monitoring configuration + consent controls.
- **UI:** default capture interval, blur on/off, idle timeout, which modes are allowed per team, data-retention window, storage target (Supabase vs BYO S3/Azure/SFTP), and a **consent register** (who acknowledged monitoring, when).
- **Endpoints:** `GET/PUT /workforce/settings`, `GET /workforce/consent`, `POST /workforce/consent`.
- **Logic:** these values cascade into `teams.*` defaults; retention drives a purge job (§6).

---

## 4. The desktop agent (the missing half)

The panel is only as good as the data feeding it. Build a lightweight agent per OS (Windows, macOS, Linux — WorkComposer supports all three).

- **Recommended:** Electron + native modules, or Tauri (Rust) for a smaller footprint. Reuse your TypeScript skills with Electron.
- **What it captures:**
  - Foreground app + window title (OS APIs: `active-win` npm module works cross-platform).
  - Active browser URL (browser extension companion or accessibility APIs; URL capture is the fiddliest part).
  - Screenshots at the configured interval (`screenshot-desktop` npm module).
  - Keyboard/mouse *counts* (not keystrokes' content — count only, for privacy) via OS input hooks.
  - Idle time (system idle APIs).
- **How it talks to your API:** authenticate the agent with a **device token** (issue per member from Settings). Batch-POST every 1–5 min to new ingest endpoints:
  - `POST /agent/heartbeat` — is the session alive, current app.
  - `POST /agent/samples` — array of `activity_samples`.
  - `POST /agent/app-usage` — array of `app_usage`.
  - `POST /agent/screenshot` — multipart image → API hands to screenshot worker.
  - `POST /agent/sync` — offline replay buffer.
- **Config pull:** agent calls `GET /agent/config` on launch to get its team's interval/blur/idle/mode.
- **Security:** device tokens are revocable; all traffic TLS; the agent should show a visible indicator in non-silent modes.

Guard these `/agent/*` endpoints with a **device-token guard** (a sibling to your `SupabaseAuthGuard`), not the user JWT guard.

---

## 5. API surface summary (NestJS modules)

Create these modules under `apps/api/src/`, each with `*.module.ts`, `*.controller.ts`, `*.service.ts` following your `admin` module exactly (Swagger tags, `@UseGuards(SupabaseAuthGuard, RolesGuard)`, `@Roles(...)`):

| Module | Owns |
|---|---|
| `workforce-team` | teams, members, invites |
| `time-tracking` | time_entries, manual/auto/sync, timers |
| `monitoring` | screenshots, app_usage, productivity_rules, activity |
| `attendance` | shifts, attendance |
| `billing-rates` | rates, billing summary |
| `timesheets` | submit/approve/export |
| `workforce-tasks` | projects, tasks (personal + team) |
| `agent-ingest` | `/agent/*` device-token endpoints |

Every write action calls your existing `activities` logger so the admin audit trail (which already has a page at `/dashboard/admin/activities`) automatically covers workforce actions too.

---

## 6. Background jobs (BullMQ, `packages/workers`)

You already run queues (`train-ai`, `script`, `ideation`, `story-builder`). Add:

| Queue | Trigger | Work |
|---|---|---|
| `screenshot-process` | agent uploads image | resize→thumbnail, optional blur, encrypt, store, insert `screenshots` row |
| `activity-rollup` | time entry closes (or every 5 min) | compute `activity_score` from `activity_samples` |
| `productivity-classify` | app_usage ingest / rule change | resolve `category` against `productivity_rules`, backfill |
| `attendance-reconcile` | nightly cron | build `attendance` rows from `time_entries` + `shifts`, flag late/absent |
| `timesheet-rollup` | period end / on submit | sum durations + amounts into `timesheets` |
| `retention-purge` | daily cron | delete screenshots/samples older than the retention window |

---

## 7. Privacy, consent & compliance (do not skip)

Employee monitoring is legally sensitive and varies by jurisdiction. Build these in from day one, not later:

- **Consent & notice.** Many regions (EU/UK GDPR, parts of the US, etc.) require employees be *informed* they're monitored, and sometimes require a lawful basis / DPIA. Keep the consent register (§3.11) and timestamp acknowledgements.
- **Silent/stealth mode is the riskiest feature.** In several jurisdictions covert monitoring is unlawful without specific justification. Gate it behind an explicit admin acknowledgement and default it **off**.
- **Data minimization.** Capture input *counts*, never keystroke *content*. Offer screenshot blur for teams handling customer PII. Set a sane default retention (e.g., 90 days) and purge.
- **Access control.** Screenshots and activity are the most sensitive — enforce own/team/admin RLS strictly and log every view of another person's screenshot to `activities`.
- **Transparency to employees.** Give employees the my-work views of their *own* data. Transparency reduces the morale hit that surveillance tooling notoriously causes; treat activity scores as workload signals, not punishment triggers.
- **Encryption.** TLS in transit (already standard on your stack); private buckets + encryption at rest for screenshots; consider app-layer AES-256 for BYO-storage enterprise mode.

This guide is engineering-oriented and isn't legal advice — before you enable monitoring on real staff, get the consent/notice language reviewed for the countries your employees are in.

---

## 8. Suggested build phasing

Ship in slices; each phase is independently useful.

**Phase 1 — Foundations (no desktop agent yet).**
Roles + teams migration; `time-tracking` + `workforce-tasks` modules; the my-work personal cockpit (§3.10) and manual timers (§3.3b); Workforce Overview (§3.1) and Team management (§3.2). This alone gives you self + team task/time management through the web app.

**Phase 2 — Attendance, billing & reports.**
Shifts/attendance (§3.7), rates/billing (§3.8), timesheets + CSV/PDF export (§3.9). Now it's payroll-capable.

**Phase 3 — The desktop agent + passive monitoring.**
Build the agent (§4); add `agent-ingest`, `monitoring` module, activity samples + scoring (§3.6), app/URL monitoring (§3.5). Automatic and offline modes go live.

**Phase 4 — Screenshots & advanced.**
Screenshot capture/worker/gallery (§3.4), blur, BYO storage, retention purge, silent mode (with the §7 gates). This is the heaviest on storage and compliance, so it's last.

---

## 9. Quick reference — new files to create

```
packages/supabase/migrations/
  20260713000000_workforce_module.sql        # §2 all tables + RLS + view + helpers

apps/api/src/
  workforce-team/    time-tracking/    monitoring/
  attendance/        billing-rates/    timesheets/
  workforce-tasks/   agent-ingest/                       # §5

packages/workers/src/
  screenshot-process.worker.ts   activity-rollup.worker.ts
  productivity-classify.worker.ts attendance-reconcile.worker.ts
  timesheet-rollup.worker.ts      retention-purge.worker.ts   # §6

apps/web/app/dashboard/admin/workforce/
  page.tsx  team/  time/  screenshots/  apps/
  activity/ attendance/ billing/ reports/ settings/       # §3.1–3.9, 3.11
apps/web/app/dashboard/my-work/
  page.tsx  timer/  screenshots/                          # §3.10, employee views

agent/                                                     # separate Electron/Tauri app, §4
```

Every one of these follows a pattern already present in your repo — so the module should feel native to Creator AI, not bolted on.
