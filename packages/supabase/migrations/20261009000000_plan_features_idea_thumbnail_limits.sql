-- Ideas and thumbnails per run now scale with the plan (getIdeationLimitsForPlan,
-- maxThumbnailsForPlan), and the cards were reorganised into cumulative tiers: each plan
-- lists only what it ADDS over the one below, the way the marketing cards render
-- "Everything in <plan>, plus:". Annual savings and referral rewards moved off the cards
-- into the comparison table. Copy matches apps/web/lib/pricing-plans.ts.

UPDATE public.plans SET
  tagline  = 'Best for trying Creator AI risk-free, no card.',
  features = '["500 credits every month","Build AI memory on your own voice","Scripts & Story Builder","1 video idea and 1 thumbnail per run","Subtitles in 70+ languages","Dubbing in 90+ languages"]'::jsonb
WHERE lower(name) = 'starter';

UPDATE public.plans SET
  features = '["Everything in Starter, plus:","3,000 credits every month","Up to 3 video ideas per run","Idea comparison matrix","3 thumbnail variations for A/B testing"]'::jsonb
WHERE lower(name) = 'creator';

UPDATE public.plans SET
  features = '["Everything in Creator, plus:","8,000 credits every month","Up to 10 video ideas per run","AI video generation","Priority generation speed"]'::jsonb
WHERE lower(name) = 'pro';

UPDATE public.plans SET
  features = '["Everything in Pro, plus:","50,000 credits every month","Built for studios & teams","Highest generation throughput","Priority support"]'::jsonb
WHERE lower(name) = 'business';

UPDATE public.plans SET
  features = '["Everything in Business, plus:","100,000 credits every month","Built for agencies & networks","Maximum generation throughput"]'::jsonb
WHERE lower(name) = 'scale';
