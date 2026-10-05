-- Starter and Creator advertised every feature, but video generation needs Pro or above
-- (VIDEO_GENERATION_PLANS). Copy matches apps/web/lib/pricing-plans.ts.

UPDATE public.plans SET
  tagline  = 'Best for trying Creator AI risk-free, no card.',
  features = '["500 credits every month","No credit card required","Train the AI on your own voice","Scripts, ideas, thumbnails & subtitles","Story Builder & dubbing"]'::jsonb
WHERE lower(name) = 'starter';

UPDATE public.plans SET
  features = '["3,000 credits every month","Every feature except video generation","Save 20% with annual billing","Voice-matched scripts in minutes","Click-worthy thumbnails & subtitles","Referral + affiliate rewards"]'::jsonb
WHERE lower(name) = 'creator';
