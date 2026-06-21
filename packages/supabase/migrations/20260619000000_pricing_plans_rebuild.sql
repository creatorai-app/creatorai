-- =====================================================================
-- Pricing rebuild (Lemon Squeezy): 5 plans, all features on every plan,
-- annual billing support, per-plan "why choose" tagline.
--
-- Plans:
--   Starter   $0      / 200 credits      (free forever, no card)
--   Creator   $24/mo  / 3,000 credits    ($19/mo billed annually)
--   Pro       $49/mo  / 8,000 credits    ($39/mo billed annually)
--   Business  $299/mo / 50,000 credits   (monthly only)
--   Scale     $599/mo / 150,000 credits  (monthly only)
--
-- Every feature is available on every plan — plans differ only by the
-- monthly credit allowance and usage throughput, never by feature locks.
-- =====================================================================

-- 1. New columns (idempotent)
ALTER TABLE "public"."plans"
  ADD COLUMN IF NOT EXISTS "tagline"              TEXT,
  ADD COLUMN IF NOT EXISTS "price_annual_monthly" NUMERIC,        -- per-month price when billed annually (display)
  ADD COLUMN IF NOT EXISTS "ls_variant_id_annual" TEXT;           -- Lemon Squeezy variant id for the annual plan

-- 2. Starter (free) — update the existing free plan in place.
UPDATE public.plans SET
  name                 = 'Starter',
  price_monthly        = 0,
  price_annual_monthly = 0,
  credits_monthly      = 200,
  daily_limit          = 5,
  cooldown_minutes     = 60,
  tagline              = 'Best for trying Creator AI risk-free — every feature unlocked, no credit card.',
  features             = '["200 credits every month","Every feature included — nothing locked","No credit card required","AI voice training on your channel","Scripts, ideas, thumbnails & subtitles","Story Builder, dubbing & video generation"]'
WHERE price_monthly = 0 OR lower(name) IN ('starter');

-- 3. Creator — was "Creator+"/"Pro" (the mid consumer tier).
UPDATE public.plans SET
  name                 = 'Creator',
  price_monthly        = 24,
  price_annual_monthly = 19,
  credits_monthly      = 3000,
  daily_limit          = 25,
  cooldown_minutes     = 10,
  tagline              = 'Best for weekly creators who want a steady flow of scripts, thumbnails and ideas.',
  features             = '["3,000 credits every month","Every feature included","Save 20% with annual billing ($19/mo)","AI voice training & script writing","Thumbnails, subtitles & dubbing","Referral + affiliate rewards"]'
WHERE lower(name) IN ('creator+', 'creator', 'pro');

-- 4. Business — repurpose the old top tier ("Enterprise") as the first studio tier.
UPDATE public.plans SET
  name                 = 'Business',
  price_monthly        = 299,
  price_annual_monthly = NULL,
  credits_monthly      = 50000,
  daily_limit          = 200,
  cooldown_minutes     = 1,
  tagline              = 'Best for studios and multi-channel teams producing content at scale.',
  features             = '["50,000 credits every month","Every feature included","Built for studios & teams","Highest generation throughput","All AI tools, fully unlocked","Priority support"]'
WHERE lower(name) IN ('enterprise', 'business');

-- 5. Pro ($49 / 8,000) — new tier between Creator and Business.
INSERT INTO public.plans
  (name, price_monthly, price_annual_monthly, credits_monthly, daily_limit, cooldown_minutes, is_active, tagline, features)
SELECT
  'Pro', 49, 39, 8000, 50, 5, true,
  'Best for daily uploaders and growing channels publishing at full speed.',
  '["8,000 credits every month","Every feature included","Save 20% with annual billing ($39/mo)","Priority generation speed","All AI tools, fully unlocked","Referral + affiliate rewards"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'pro');

-- 6. Scale ($599 / 150,000) — top studio tier.
INSERT INTO public.plans
  (name, price_monthly, price_annual_monthly, credits_monthly, daily_limit, cooldown_minutes, is_active, tagline, features)
SELECT
  'Scale', 599, NULL, 150000, 500, 1, true,
  'Best for agencies and networks running high-volume content operations.',
  '["150,000 credits every month","Every feature included","Built for agencies & networks","Maximum generation throughput","All AI tools, fully unlocked","Priority support"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'scale');
