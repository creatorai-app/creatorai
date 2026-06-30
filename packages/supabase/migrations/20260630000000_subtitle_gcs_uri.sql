-- Subtitle media moved to GCS: store the gs:// URI so Vertex can read the file directly
-- (Vertex fileData accepts gs:// only, not an HTTPS URL). video_url keeps the public HTTPS
-- URL used by the editor's video player and the burn endpoint.
alter table "public"."subtitle_jobs"
  add column if not exists "video_gs_uri" text;
