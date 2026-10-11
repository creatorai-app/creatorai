-- Subtitle generation moves from an inline API call to the BullMQ `subtitle` queue, the
-- same shape every other feature already uses. The SSE status endpoint looks the job up
-- by its BullMQ id, so the row has to carry it (thumbnail_jobs.job_id does the same).
--
-- `status` needs no change: its CHECK already allows queued/processing/done/failed/error.

alter table "public"."subtitle_jobs"
  add column if not exists "job_id" text;

create index if not exists idx_subtitle_jobs_job_id
  on public.subtitle_jobs(job_id)
  where job_id is not null;

-- Written by the service since the title was added to the Gemini response, but never in a
-- migration — present in the live database only. Added here so a fresh environment matches.
alter table "public"."subtitle_jobs"
  add column if not exists "title" text;
