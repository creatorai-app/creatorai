-- video_generation_jobs: Async Gemini Omni Flash video generation requests + results.
--
-- Omni Flash (Interactions API) returns the generated clip as bytes/URI; the worker
-- downloads it and uploads it to the public GCS bucket named by GCS_VIDEO_BUCKET.
-- video_url is the public GCS URL (playback); video_gs_uri is the gs:// reference
-- (cleanup). interaction_id is Omni's stateful handle — it lets a later job edit this
-- clip in place via previous_interaction_id; parent_job_id records that edit lineage.
--
-- Feature is gated to the Pro/Business/Scale plans in application code
-- (canGenerateVideo); there is no plan column here.

create table "public"."video_generation_jobs" (
    "id"               uuid        not null default extensions.uuid_generate_v4(),
    "user_id"          uuid        not null,
    "prompt"           text        not null,
    "mode"             text        not null default 'text_to_video'
                       check (mode in ('text_to_video', 'image_to_video', 'reference_to_video', 'edit')),
    "status"           text        not null default 'queued'
                       check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    "aspect_ratio"     text        not null default '16:9'
                       check (aspect_ratio in ('16:9', '9:16')),
    "duration_seconds" integer     not null default 8,
    "input_image_count" integer    not null default 0,
    "model"            text,                                     -- Omni model id used

    "video_url"        text,                                     -- public GCS URL (playback)
    "video_gs_uri"     text,                                     -- gs:// reference (cleanup)
    "interaction_id"   text,                                     -- Omni interaction id (stateful edit handle)
    "parent_job_id"    uuid,                                     -- source clip when this job is an edit

    "script_id"        uuid,                                     -- optional source script link
    "error_message"    text,
    "credits_consumed" integer     not null default 0,
    "job_id"           text,                                     -- BullMQ job ID for SSE polling
    "created_at"       timestamptz not null default now(),
    "updated_at"       timestamptz not null default now()
);

alter table "public"."video_generation_jobs" enable row level security;

-- Indexes
create unique index video_generation_jobs_pkey    on public.video_generation_jobs using btree (id);
create index idx_video_generation_jobs_user_id    on public.video_generation_jobs using btree (user_id);
create index idx_video_generation_jobs_status     on public.video_generation_jobs using btree (status);
create index idx_video_generation_jobs_created_at on public.video_generation_jobs using btree (created_at);

-- Constraints
alter table "public"."video_generation_jobs"
  add constraint "video_generation_jobs_pkey" PRIMARY KEY using index "video_generation_jobs_pkey";
alter table "public"."video_generation_jobs"
  add constraint "video_generation_jobs_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- Edits point back at the clip they refine; deleting the source detaches the edit.
alter table "public"."video_generation_jobs"
  add constraint "video_generation_jobs_parent_job_id_fkey"
  FOREIGN KEY (parent_job_id) REFERENCES public.video_generation_jobs(id) ON DELETE SET NULL;

-- RLS policies (row-level; the worker writes via the service-role key which bypasses RLS)
create policy "select_own" on "public"."video_generation_jobs" for select to authenticated using (user_id = auth.uid());
create policy "insert_own" on "public"."video_generation_jobs" for insert to authenticated with check (user_id = auth.uid());
create policy "update_own" on "public"."video_generation_jobs" for update to authenticated using (user_id = auth.uid());
create policy "delete_own" on "public"."video_generation_jobs" for delete to authenticated using (user_id = auth.uid());
