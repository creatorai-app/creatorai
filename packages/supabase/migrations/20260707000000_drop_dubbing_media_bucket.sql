-- Dubbing output moved from Supabase Storage to GCS (the GCS_DUBBING_BUCKET that already
-- holds the input). Supabase's free tier caps objects at 50MB, which a dubbed MP4 blows
-- past — see docs/dubbing-design.md. Modal now uploads the result straight to GCS via a
-- signed PUT URL, so the `dubbing_media` bucket and its policies are dead weight.
--
-- Idempotent: safe to run whether or not the bucket/policies still exist.

drop policy if exists "Authenticated users can delete from dubbing_media" on storage.objects;
drop policy if exists "Authenticated users can read own uploads (for upsert)" on storage.objects;
drop policy if exists "Authenticated users can upload to dubbing_media" on storage.objects;
drop policy if exists "Authenticated users can upsert to dubbing_media" on storage.objects;

-- Remove any leftover objects, then the bucket (delete would fail if the bucket is non-empty).
delete from storage.objects where bucket_id = 'dubbing_media';
delete from storage.buckets where id = 'dubbing_media';
