-- Dubbing: regenerate a dub from the media already in storage.
--
-- dubbing_projects
--   source_project_id  the original dub this one was regenerated from; null on an original.
--                      A regenerated dub points at the original's source objects instead of
--                      copying them, so deleting it never touches them; deleting the original
--                      deletes every dub regenerated from it, then the source. project_id is
--                      not unique on this table, so this is not a foreign key (dubbing_outputs
--                      references project_id the same way).

alter table public.dubbing_projects add column if not exists source_project_id text;

create index if not exists idx_dubbing_projects_source_project_id
  on public.dubbing_projects using btree (source_project_id)
  where source_project_id is not null;
