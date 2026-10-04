-- Dubbing: what the dub hands back, picked per dub (see docs/dubbing-resumable-uploads.md).
--
-- dubbing_projects
--   output_format  mp4 | mp3 | wav. mp4 is a video source with the dubbed track muxed in;
--                  mp3 and wav are the dubbed track alone. is_video is true only for mp4.
--                  Null on dubs from before the choice: mp4 when is_video, mp3 otherwise.

alter table public.dubbing_projects add column if not exists output_format text;

alter table public.dubbing_projects drop constraint if exists dubbing_projects_output_format_check;
alter table public.dubbing_projects
  add constraint dubbing_projects_output_format_check
  check (output_format is null or output_format in ('mp4', 'mp3', 'wav'));
