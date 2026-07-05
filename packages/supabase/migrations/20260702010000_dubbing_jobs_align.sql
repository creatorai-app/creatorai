-- Align dubbing_projects with the BullMQ job pipeline (see docs/dubbing-design.md).
--
-- The table was originally created for the inline (fire-and-forget) prototype.
-- This migration adds the columns the queued worker needs and widens the status
-- lifecycle. It is idempotent: safe to run whether or not the table/columns exist,
-- and safe to re-run after a partial failure.
--
-- New status lifecycle: queued -> processing -> cloning -> completed | failed
-- (legacy 'dubbing'/'dubbed' values are migrated in place below).

-- 1. Columns the queued pipeline needs (no-op if already present).
alter table public.dubbing_projects add column if not exists job_id          text;      -- BullMQ job id (SSE)
alter table public.dubbing_projects add column if not exists input_gs_uri    text;      -- gs:// URI Vertex transcribes from
alter table public.dubbing_projects add column if not exists input_url       text;      -- public GCS URL passed to the clone service
alter table public.dubbing_projects add column if not exists duration_seconds numeric;  -- source length, drives credit cost
alter table public.dubbing_projects add column if not exists error_message   text;      -- failure reason (the prototype never wrote this)

-- 2. `status` was created as a native Postgres ENUM (dubbing_status) by the dashboard,
--    not the text+CHECK pattern the rest of this schema uses (video_generation_jobs,
--    subtitle_jobs, ...). You can't UPDATE a row to a value the enum doesn't contain,
--    and ALTER TYPE ... ADD VALUE can't be used in the same transaction as the update
--    — so convert the column to text first. Guarded: a no-op if already text (re-run safe).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dubbing_projects' and column_name = 'status'
      and data_type = 'USER-DEFINED'
  ) then
    alter table public.dubbing_projects alter column status drop default;
    alter table public.dubbing_projects alter column status type text using status::text;
  end if;
end $$;

-- 3. Migrate any legacy status values from the prototype (now safe — plain text).
update public.dubbing_projects set status = 'processing' where status = 'dubbing';
update public.dubbing_projects set status = 'completed'  where status = 'dubbed';

-- 4. Replace whatever CHECK constraint exists on status with the new lifecycle.
--    Drop by discovery so an unknown dashboard-created constraint name is handled.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'dubbing_projects'
      and con.contype = 'c'
  loop
    execute format('alter table public.dubbing_projects drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.dubbing_projects
  add constraint dubbing_projects_status_check
  check (status in ('queued', 'processing', 'cloning', 'completed', 'failed'));

alter table public.dubbing_projects alter column status set default 'queued';

-- 5. The old enum type is now unreferenced (column converted to text in step 2) — drop it
--    so it doesn't linger as dead schema. IF EXISTS: no-op if already dropped or never existed.
drop type if exists public.dubbing_status;

-- 6. Index for the SSE job lookup.
create index if not exists idx_dubbing_projects_job_id on public.dubbing_projects using btree (job_id);
