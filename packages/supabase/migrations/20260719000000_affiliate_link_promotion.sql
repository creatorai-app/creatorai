-- Capture where an affiliate plans to promote Creator AI, collected when they
-- generate a link. Surfaced in the admin affiliate views and activity feed.
ALTER TABLE IF EXISTS "public"."affiliate_links"
  ADD COLUMN IF NOT EXISTS "promotion_channel" text;
