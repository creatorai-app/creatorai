-- Annual Credit Refresh
-- --------------------
-- Monthly subscribers get credits via subscription_payment_success (LS fires it
-- every month). Annual subscribers only get that event once a year, so we need a
-- cron job that refreshes their credits every ~30 days.
--
-- Approach:
--   1. Add billing_interval + credits_last_refreshed_at to subscriptions.
--   2. A pg_cron job runs daily, finds annual subs whose credits haven't been
--      refreshed in 30+ days, and resets credits to the plan's monthly allowance.

-- 1. New columns ----------------------------------------------------------

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS credits_last_refreshed_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing annual subscriptions: if the subscription period spans
-- more than 60 days it is annual (monthly periods are ~30 days).
UPDATE public.subscriptions
SET billing_interval = 'annual'
WHERE current_period_end IS NOT NULL
  AND current_period_start IS NOT NULL
  AND (current_period_end::timestamp - current_period_start::timestamp) > interval '60 days';

-- Seed credits_last_refreshed_at for rows that pre-date this migration.
UPDATE public.subscriptions
SET credits_last_refreshed_at = COALESCE(current_period_start, created_at, now())
WHERE credits_last_refreshed_at IS NULL;

-- 2. Refresh function -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_annual_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT s.id   AS sub_id,
           s.user_id,
           p.credits_monthly
      FROM public.subscriptions s
      JOIN public.plans p ON p.id = s.plan_id
     WHERE s.billing_interval = 'annual'
       AND s.status IN ('active', 'on_trial', 'past_due')
       AND s.credits_last_refreshed_at < now() - interval '30 days'
  LOOP
    UPDATE public.profiles
       SET credits = rec.credits_monthly
     WHERE user_id = rec.user_id;

    UPDATE public.subscriptions
       SET credits_last_refreshed_at = now()
     WHERE id = rec.sub_id;

    RAISE LOG 'Refreshed % credits for user % (sub %)',
              rec.credits_monthly, rec.user_id, rec.sub_id;
  END LOOP;
END;
$$;

-- 3. Schedule the cron job ------------------------------------------------
-- Runs every day at 00:00 UTC. pg_cron must be enabled in the Supabase
-- dashboard (Database → Extensions → pg_cron) before applying this migration.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'refresh-annual-credits',   -- job name (idempotent — updates if exists)
  '0 0 * * *',                -- daily at midnight UTC
  $$SELECT public.refresh_annual_credits()$$
);
