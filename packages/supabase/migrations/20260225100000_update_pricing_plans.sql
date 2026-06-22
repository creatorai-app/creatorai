-- Update pricing plans: Pro -> Creator+, new feature lists
UPDATE public.plans SET
  features = '["No credit card required","Monthly 200 free credits","AI model training","Ideation","Script Gen","Subtitle gen","Story Builder","Thumbnail gen","Course Builder"]'
WHERE name = 'Starter';

UPDATE public.plans SET
  name = 'Creator+',
  features = '["Everything in Starter","5k credits/month","Audio dubbing","Video Generation","Community Access"]'
WHERE name = 'Pro';

UPDATE public.plans SET
  features = '["Everything in Creator+","100k credits/month","Advance analytics","Team collaboration","Priority access to new features"]'
WHERE name = 'Enterprise';
