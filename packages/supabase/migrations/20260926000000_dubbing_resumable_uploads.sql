-- Dubbing: split resumable uploads, an engine choice, several languages per dub and
-- per-speaker voices (see docs/dubbing-resumable-uploads.md).
--
-- A project is one upload. The browser sends the audio track first (a GCS resumable
-- session) and the original video afterwards (an XML API multipart upload). Each target
-- language is a row in dubbing_outputs, dubbed and charged on its own. Every step is
-- recorded so a closed tab, a dropped connection or a failed job resumes where it stopped.
--
-- Project lifecycle: uploading -> queued -> processing -> cloning -> (awaiting_video) -> completed | failed

alter table public.dubbing_projects add column if not exists engine             text;     -- cypher | elevenlabs; null on older dubs
alter table public.dubbing_projects add column if not exists audio_object       text;     -- object the dub reads (audio track, or the whole file)
alter table public.dubbing_projects add column if not exists audio_session_uri  text;     -- GCS resumable session for the audio upload
alter table public.dubbing_projects add column if not exists audio_size         bigint;
alter table public.dubbing_projects add column if not exists audio_content_type text;
alter table public.dubbing_projects add column if not exists audio_extracted    boolean not null default false; -- true: audio was pulled out of a video in the browser
alter table public.dubbing_projects add column if not exists video_object       text;     -- original video, uploaded in parts
alter table public.dubbing_projects add column if not exists video_upload_id    text;     -- XML API multipart upload id
alter table public.dubbing_projects add column if not exists video_part_size    bigint;
alter table public.dubbing_projects add column if not exists video_size         bigint;
alter table public.dubbing_projects add column if not exists video_content_type text;
alter table public.dubbing_projects add column if not exists video_status       text;     -- null (no separate video) | uploading | uploaded
alter table public.dubbing_projects add column if not exists source_fingerprint text;     -- name|size|lastModified of the picked file, checked on resume
alter table public.dubbing_projects add column if not exists analysis           jsonb;    -- Cypher: speakers and timed utterances, built window by window

alter table public.dubbing_projects drop constraint if exists dubbing_projects_engine_check;
alter table public.dubbing_projects
  add constraint dubbing_projects_engine_check
  check (engine is null or engine in ('cypher', 'elevenlabs'));

alter table public.dubbing_projects drop constraint if exists dubbing_projects_video_status_check;
alter table public.dubbing_projects
  add constraint dubbing_projects_video_status_check
  check (video_status is null or video_status in ('uploading', 'uploaded'));

alter table public.dubbing_projects drop constraint if exists dubbing_projects_status_check;
alter table public.dubbing_projects
  add constraint dubbing_projects_status_check
  check (status in ('uploading', 'queued', 'processing', 'cloning', 'awaiting_video', 'completed', 'failed'));

-- One row per target language. No foreign key: dubbing_projects.project_id carries no
-- unique index, and the API deletes a project's outputs itself.
create table if not exists public.dubbing_outputs (
  id               uuid primary key default gen_random_uuid(),
  project_id       text not null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  language         text not null,
  accent           text,
  status           text not null default 'pending'
                   check (status in ('pending', 'dubbing', 'awaiting_video', 'completed', 'failed')),
  translation      jsonb,             -- Cypher: translated line per utterance, aligned with the project's analysis
  segment_count    integer,
  segments_done    integer not null default 0,
  vendor_dub_id    text,              -- ElevenLabs dub id, so a resumed run follows it instead of paying twice
  dubbed_audio_url text,              -- the dubbed track (playable before the video mux)
  dubbed_url       text,              -- the finished file
  credits_consumed integer not null default 0,
  error_message    text,
  created_at       timestamptz not null default now(),
  unique (project_id, language)
);

create index if not exists idx_dubbing_outputs_user_id on public.dubbing_outputs using btree (user_id);

alter table public.dubbing_outputs enable row level security;

drop policy if exists "Allow select for own dubbing outputs" on public.dubbing_outputs;
create policy "Allow select for own dubbing outputs"
on public.dubbing_outputs
as permissive
for select
to authenticated
using ((user_id = auth.uid()));
