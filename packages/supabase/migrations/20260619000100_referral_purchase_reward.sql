-- =====================================================================
-- Referral program rework: purchase-triggered rewards.
--
-- Old model: 250 credits awarded to the referrer when the referred user
--            signed up (referral marked 'completed' at sign-up).
--
-- New model: NO sign-up bonus. A referral is only marked 'completed' when
--            the referred user makes their first paid purchase. On that
--            event the referrer earns 1,000 credits (this trigger) and the
--            buyer also receives a 1,000-credit bonus (handled in the
--            billing webhook, see billing.service.ts).
--
-- This migration only bumps the per-referral award to 1,000. The decision
-- of *when* a referral becomes 'completed' now lives in application code
-- (the Lemon Squeezy subscription_created webhook).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.award_referral_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  credits_to_award INTEGER := 1000;
  referrer_profile_id UUID;
  current_credits INTEGER;
  current_referral_credits INTEGER;
BEGIN
  -- Only award credits when status transitions to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    referrer_profile_id := NEW.referrer_id;

    SELECT credits, referral_credits
      INTO current_credits, current_referral_credits
      FROM public.profiles
     WHERE id = referrer_profile_id;

    IF FOUND THEN
      UPDATE public.profiles
         SET credits           = COALESCE(current_credits, 0) + credits_to_award,
             referral_credits  = COALESCE(current_referral_credits, 0) + credits_to_award,
             total_referrals   = COALESCE(total_referrals, 0) + 1,
             updated_at        = NOW()
       WHERE id = referrer_profile_id;
    END IF;

    -- Ensure credits_awarded reflects the reward on the referral row.
    IF NEW.credits_awarded IS NULL OR NEW.credits_awarded = 0 THEN
      NEW.credits_awarded := credits_to_award;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Keep the validation trigger's default award in sync (used only when an
-- update sets status='completed' without an explicit credits_awarded).
CREATE OR REPLACE FUNCTION public.validate_referral_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
    IF NEW.credits_awarded IS NULL OR NEW.credits_awarded = 0 THEN
      NEW.credits_awarded := 1000;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
