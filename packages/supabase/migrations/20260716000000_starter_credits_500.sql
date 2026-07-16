-- =====================================================================
-- Bump the free Starter plan's monthly credit allowance: 200 -> 500.
-- ---------------------------------------------------------------------
-- Affects the plan definition used by signup grants, the monthly/annual
-- refresh crons, admin plan assignment, and the auto-downgrade cron (all of
-- which set a user's credits to the plan's credits_monthly).
--
-- NOTE: migration 20260622000000_signup_credits_200.sql (applied before this
-- one) lowered the profiles.credits column DEFAULT to 200 -- that default is
-- what new signups actually get (handle_new_user() inserts into profiles
-- without specifying credits). This migration restores it to 500 so the
-- column default and the Starter plan stay in sync.
--
-- Existing users are NOT touched here on purpose (a running user may have spent
-- down to 200) -- bump them with a separate one-off run against the DB:
--   packages/supabase/scripts/bump-existing-credits-to-500.sql
-- =====================================================================

ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 500;

UPDATE public.plans
SET credits_monthly = 500,
    -- features is jsonb; swap the "200 credits every month" bullet in place.
    features = replace(features::text, '200 credits', '500 credits')::jsonb
WHERE price_monthly = 0;
