-- ---------------------------------------------------------------------
-- One-off: bring existing users up to the new 500-credit Starter allowance.
-- Run this ONCE, directly in the Supabase SQL editor (Dashboard -> SQL Editor).
-- It is NOT a migration (data backfill, not schema), so it won't auto-run.
--
-- Targets only users still sitting on an old default balance (10 or 200) so it
-- never overwrites someone who has legitimately spent down to a random number.
-- ---------------------------------------------------------------------

-- 1. Preview who will change (run this first to sanity-check the count):
-- SELECT count(*) FROM public.profiles WHERE credits IN (10, 200);

-- 2. Apply the bump:
UPDATE public.profiles
SET credits = 500
WHERE credits IN (10, 200);

-- 3. Verify (should return 0 rows still on the old balances):
-- SELECT count(*) FROM public.profiles WHERE credits IN (10, 200);
