-- Creator plan: $24 -> $20 monthly, $19 -> $16/mo annual ($192/yr), keeping the
-- 20% annual discount. Credits are unchanged at 3,000. The Lemon Squeezy
-- variants are repriced to match; their IDs do not change.
UPDATE public.plans SET
  price_monthly        = 20,
  price_annual_monthly = 16
WHERE lower(name) = 'creator';
