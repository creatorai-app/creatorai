-- Recalibrate credit pricing for an ≥80% gross-margin floor across all features.
--
-- Context: real 2026 vendor COGS (Gemini 3.5 Flash $9/M output, Flash Image $0.039/image,
-- Omni video $0.10/s) exceeded what the old credit multipliers charged at the cheapest
-- plan. The fix has two levers (see consts/credits.ts for the multiplier side):
--   1. Raise per-action credit multipliers to derived, margin-safe values (code).
--   2. Lift the LOWEST plan $/credit so those multipliers stay moderate (this migration).
--
-- Scale was the binding constraint at $599 / 150,000 = $0.00399/credit — well below the
-- ~$0.006/credit of Pro ($49/8k) and Business ($299/50k). Trimming Scale to 100,000
-- credits raises it to $0.00599/credit, aligning the floor and making 80% reachable
-- without extreme multipliers. Price is unchanged; only the monthly credit grant moves.

UPDATE public.plans SET
  credits_monthly = 100000,
  features = '["100,000 credits every month","Every feature included","Built for agencies & networks","Maximum generation throughput","All AI tools, fully unlocked","Priority support"]'::jsonb
WHERE lower(name) = 'scale';
