-- Persist Gemini token usage per subtitle job so the UI can show consumption per
-- generation (matches the total_tokens column other features already use).
alter table "public"."subtitle_jobs"
  add column if not exists "total_tokens" integer not null default 0;
