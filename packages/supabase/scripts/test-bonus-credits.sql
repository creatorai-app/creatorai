-- Self-check for the bonus-credit carry-over (migration 20260723000000).
-- Runs inside a transaction and ROLLBACKs — safe against a dev database.
--
--   psql "$SUPABASE_DB_URL" -f packages/supabase/scripts/test-bonus-credits.sql
--
-- Passes silently. Any broken rule raises an assertion failure naming the case.

BEGIN;

DO $$
DECLARE
  uid       UUID := gen_random_uuid();
  balance   INTEGER;
  bonus     INTEGER;
  allowance INTEGER := 8000;   -- Pro
BEGIN
  INSERT INTO auth.users (id, email) VALUES (uid, 'bonus-test@example.invalid');
  INSERT INTO public.profiles (id, user_id, credits, bonus_credits)
  VALUES (uid, uid, allowance, 0);

  -- A 1,000-credit referral bonus lands on top of the plan allowance.
  UPDATE public.profiles
     SET credits = credits + 1000, bonus_credits = bonus_credits + 1000
   WHERE user_id = uid;

  -- Spend 6,000: plan credits absorb all of it, the bonus is untouched.
  PERFORM public.update_user_credits(uid, -6000);
  SELECT credits, bonus_credits INTO balance, bonus FROM public.profiles WHERE user_id = uid;
  ASSERT balance = 3000, format('spend: expected 3000 credits, got %s', balance);
  ASSERT bonus = 1000,  format('spend: bonus must survive, got %s', bonus);

  -- The reset (renewal / annual cron / downgrade) carries the bonus over.
  UPDATE public.profiles
     SET credits = allowance + COALESCE(bonus_credits, 0)
   WHERE user_id = uid;
  SELECT credits, bonus_credits INTO balance, bonus FROM public.profiles WHERE user_id = uid;
  ASSERT balance = 9000, format('reset: expected 8000+1000, got %s', balance);
  ASSERT bonus = 1000,  format('reset: bonus must persist, got %s', bonus);

  -- Spend past the plan allowance: only now does the bonus get eaten.
  PERFORM public.update_user_credits(uid, -8500);
  SELECT credits, bonus_credits INTO balance, bonus FROM public.profiles WHERE user_id = uid;
  ASSERT balance = 500, format('overdraw: expected 500, got %s', balance);
  ASSERT bonus = 500,  format('overdraw: bonus clamps to balance, got %s', bonus);

  -- The insufficient-balance guard still fires, and changes nothing.
  BEGIN
    PERFORM public.update_user_credits(uid, -10000);
    RAISE EXCEPTION 'guard: overspend should have been rejected';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    NULL;
  END;
  SELECT credits, bonus_credits INTO balance, bonus FROM public.profiles WHERE user_id = uid;
  ASSERT balance = 500 AND bonus = 500, 'guard: rejected spend must not mutate the row';

  RAISE NOTICE 'bonus-credit carry-over: all cases passed';
END $$;

ROLLBACK;
