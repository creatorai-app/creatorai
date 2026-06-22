-- Reduce initial signup credits from 500 to 200 to match the Starter plan.
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 200;
