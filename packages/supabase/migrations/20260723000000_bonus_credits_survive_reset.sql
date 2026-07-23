-- =====================================================================
-- Bonus credits survive the monthly/annual reset
-- ---------------------------------------------------------------------
-- Problem: every reset path overwrote profiles.credits with the plan's
-- allowance, so referral rewards and purchase bonuses were silently wiped
-- at the next renewal (or the daily refresh_annual_credits cron).
--
-- Model: profiles.credits stays the ONE spendable balance — every reader
-- and every deduction site keeps working untouched. profiles.bonus_credits
-- is a tag on that balance: "this much of it came from a bonus and is
-- reset-protected". Two rules keep it honest:
--
--   spend  -> credits -= n, then bonus_credits = LEAST(bonus_credits, credits)
--             Plan credits drain first; bonus only shrinks once the balance
--             has fallen to it. So an unspent bonus survives the month.
--   reset  -> credits = plan_allowance + bonus_credits  (bonus untouched)
--
-- Invariant: 0 <= bonus_credits <= credits, always.
--
-- NOTE: bonus_credits starts at 0 for everyone. profiles.referral_credits
-- is a LIFETIME earned counter (never decremented), so backfilling from it
-- would re-grant credits users already spent. Bonuses accrue from here on.
-- =====================================================================

-- 1. The protected-balance tag ---------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_credits INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.bonus_credits IS
  'Portion of profiles.credits that came from referrals/bonuses and is carried '
  'across plan resets. Always <= credits. Spent last (see update_user_credits).';

-- 2. Spend: drain plan credits first, clamp the bonus tag -------------------
-- Same signature and same insufficient-balance behaviour as before, so the
-- six worker processors and the API callers need no changes.

CREATE OR REPLACE FUNCTION public.update_user_credits(user_uuid uuid, credit_change integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF credit_change < 0 THEN
    -- Deduction: ensure sufficient balance.
    -- On the RHS `credits` is the pre-update value, so `credits + credit_change`
    -- is the new balance. Clamping bonus to it means the bonus is only eaten
    -- once plan credits are exhausted.
    UPDATE profiles
    SET credits = credits + credit_change,
        bonus_credits = LEAST(COALESCE(bonus_credits, 0), credits + credit_change),
        updated_at = NOW()
    WHERE user_id = user_uuid
      AND credits + credit_change >= 0;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient credits' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- Addition: always allowed. Plain top-up — callers that mean "this is a
    -- BONUS" bump bonus_credits themselves (see award_referral_credits).
    UPDATE profiles
    SET credits = credits + credit_change,
        updated_at = NOW()
    WHERE user_id = user_uuid;
  END IF;
END;
$function$;

-- 3. Referral reward is a bonus -> tag it as protected ----------------------
-- Identical to 20260619000100 except bonus_credits also moves.

CREATE OR REPLACE FUNCTION public.award_referral_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  credits_to_award INTEGER := 1000;
  referrer_profile_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    referrer_profile_id := NEW.referrer_id;

    UPDATE public.profiles
       SET credits          = COALESCE(credits, 0) + credits_to_award,
           bonus_credits    = COALESCE(bonus_credits, 0) + credits_to_award,
           referral_credits = COALESCE(referral_credits, 0) + credits_to_award,
           total_referrals  = COALESCE(total_referrals, 0) + 1,
           updated_at       = NOW()
     WHERE id = referrer_profile_id;

    IF NEW.credits_awarded IS NULL OR NEW.credits_awarded = 0 THEN
      NEW.credits_awarded := credits_to_award;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Annual refresh cron: allowance + carried bonus -------------------------

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
       SET credits = rec.credits_monthly + COALESCE(bonus_credits, 0)
     WHERE user_id = rec.user_id;

    UPDATE public.subscriptions
       SET credits_last_refreshed_at = now()
     WHERE id = rec.sub_id;

    RAISE LOG 'Refreshed % credits (+ carried bonus) for user % (sub %)',
              rec.credits_monthly, rec.user_id, rec.sub_id;
  END LOOP;
END;
$$;

-- 5. Expiry downgrade cron: Starter allowance + carried bonus ---------------
-- A bonus was earned, not rented — losing the plan must not burn it.

CREATE OR REPLACE FUNCTION public.downgrade_expired_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  starter RECORD;
  rec     RECORD;
BEGIN
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
       SET credits = starter.credits_monthly + COALESCE(bonus_credits, 0)
     WHERE user_id = rec.user_id;

    RAISE LOG 'Downgraded user % to Starter (expired sub %)', rec.user_id, rec.sub_id;
  END LOOP;
END;
$$;
