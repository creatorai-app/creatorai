-- =====================================================================
-- Bump the free Starter plan's monthly credit allowance: 200 -> 500.
-- ---------------------------------------------------------------------
-- Affects the plan definition used by signup grants, the monthly/annual
-- refresh crons, admin plan assignment, and the auto-downgrade cron (all of
-- which set a user's credits to the plan's credits_monthly). The profiles.credits
-- column already defaults to 500, so this aligns the Starter plan with it.
--
-- Existing users are NOT touched here on purpose (a running user may have spent
-- down to 200) — bump them with a separate one-off run against the DB:
--   scripts/bump-existing-credits-to-500.sql
-- =====================================================================

UPDATE public.plans
SET credits_monthly = 500,
    -- features is jsonb; swap the "200 credits every month" bullet in place.
    features = replace(features::text, '200 credits', '500 credits')::jsonb
WHERE price_monthly = 0;
