-- Dubbing: what the creator tells us about the source, one ElevenLabs project per model,
-- and a timeline per language (see docs/dubbing-resumable-uploads.md).
--
-- dubbing_projects
--   source_language  what the source is spoken in; null means detect it
--   voice_mode       like_me | balanced | native: how close each cloned voice stays to the
--                    original (ElevenLabs cloning strength, Chatterbox cfg_weight)
--   keyterms         names and terms kept as they are (brands, people, products)
--   vendor_projects  ElevenLabs project id per model, { "dubbing_v2": "...", "dubbing_v1": "...",
--                    "generation": n }, stored before any language target is created so a
--                    resumed run never pays for a second project. `generation` counts
--                    regenerates and is part of the project's ElevenLabs `reference`.
--
-- dubbing_outputs
--   timeline  one entry per line: { id, speaker, start, end, sourceText, translation, dubStart?, dubEnd? }
--   warnings  e.g. [{ "type": "voices_not_permitted", "speakerIds": [...] }]
--
-- Every column is nullable or defaulted, so rows written before this keep working.

alter table public.dubbing_projects add column if not exists source_language text;
alter table public.dubbing_projects add column if not exists voice_mode      text not null default 'balanced';
alter table public.dubbing_projects add column if not exists keyterms        text[] not null default '{}';
alter table public.dubbing_projects add column if not exists vendor_projects jsonb;

alter table public.dubbing_projects drop constraint if exists dubbing_projects_voice_mode_check;
alter table public.dubbing_projects
  add constraint dubbing_projects_voice_mode_check
  check (voice_mode in ('like_me', 'balanced', 'native'));

alter table public.dubbing_outputs add column if not exists timeline jsonb;
alter table public.dubbing_outputs add column if not exists warnings jsonb;

comment on column public.dubbing_outputs.vendor_dub_id is
  'ElevenLabs language target, project:<projectId>:<languageId>, or dub:<dubbingId> for dubs started on the legacy /v1/dubbing route';
