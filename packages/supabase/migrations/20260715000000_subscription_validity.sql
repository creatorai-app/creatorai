-- =====================================================================
-- Subscription validity + auto-downgrade + expiry reminders
-- ---------------------------------------------------------------------
-- Admins can grant a paid plan for a fixed validity (1/2/3/6/12 months).
-- setUserPlan() stamps current_period_end = now + validity. When that date
-- passes the plan auto-downgrades to Starter (free). Before it passes, the
-- worker emails + shows an in-app reminder at 7d / 3d / 24h out.
--
-- Only ADMIN-GRANTED subs (ls_subscription_id IS NULL, current_period_end
-- set) are auto-downgraded here. Real Lemon Squeezy subscriptions are driven
-- by LS webhooks and must never be touched by this job.
-- =====================================================================

-- 1. Reminder ledger ------------------------------------------------------
-- One row per (subscription, period_end, milestone). Drives both the email
-- (emailed_at) and the in-app modal (seen_at IS NULL => still show it). The
-- unique constraint makes the worker's daily insert idempotent.

CREATE TABLE IF NOT EXISTS public.subscription_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  period_end      TIMESTAMPTZ NOT NULL,
  milestone       TEXT NOT NULL CHECK (milestone IN ('7d', '3d', '24h')),
  emailed_at      TIMESTAMPTZ,
  seen_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_end, milestone)
);

CREATE INDEX IF NOT EXISTS subscription_reminders_user_unseen_idx
  ON public.subscription_reminders (user_id)
  WHERE seen_at IS NULL;

-- Service role does everything (API + worker use the service key). No anon
-- access — the browser reads reminders through the API, never directly.
ALTER TABLE public.subscription_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_subscription_reminders" ON public.subscription_reminders;
CREATE POLICY "service_role_all_subscription_reminders"
  ON public.subscription_reminders
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Auto-downgrade function ---------------------------------------------
-- Mirrors refresh_annual_credits(): find expired admin-granted subs, cancel
-- them, drop the user onto Starter and reset credits to Starter's allowance.

CREATE OR REPLACE FUNCTION public.downgrade_expired_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  starter        RECORD;
  rec            RECORD;
BEGIN
  -- Starter = the free plan (price 0). Prefer price over name so a rename
  -- can't break downgrades (same rule billing.service.getStarterPlan uses).
  SELECT id, credits_monthly INTO starter
    FROM public.plans
   WHERE price_monthly = 0
   ORDER BY credits_monthly DESC
   LIMIT 1;

  IF starter.id IS NULL THEN
    RAISE LOG 'downgrade_expired_subscriptions: no free/Starter plan found, skipping';
    RETURN;
  END IF;

  FOR rec IN
    SELECT s.id AS sub_id, s.user_id
      FROM public.subscriptions s
     WHERE s.ls_subscription_id IS NULL          -- admin-granted only
       AND s.status = 'active'
       AND s.plan_id <> starter.id
       AND s.current_period_end IS NOT NULL
       AND s.current_period_end < now()
  LOOP
    UPDATE public.subscriptions
       SET status = 'canceled'
     WHERE id = rec.sub_id;

    INSERT INTO public.subscriptions
      (user_id, plan_id, status, billing_interval,
       credits_last_refreshed_at, current_period_start, current_period_end)
    VALUES
      (rec.user_id, starter.id, 'active', 'monthly',
       now(), now(), NULL);

    UPDATE public.profiles
       SET credits = starter.credits_monthly
     WHERE user_id = rec.user_id;

    RAISE LOG 'Downgraded user % to Starter (expired sub %)', rec.user_id, rec.sub_id;
  END LOOP;
END;
$$;

-- 3. Schedule (daily 00:05 UTC — just after the annual credit refresh) -----
-- pg_cron must be enabled (Database -> Extensions -> pg_cron) before applying.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'downgrade-expired-subscriptions',
  '5 0 * * *',
  $$SELECT public.downgrade_expired_subscriptions()$$
);
