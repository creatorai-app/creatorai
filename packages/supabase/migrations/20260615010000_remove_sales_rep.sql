-- Remove the legacy sales-rep feature.
-- The affiliate hub reuses affiliate_links.sales_rep_id / affiliate_sales.sales_rep_id
-- as the generic "owner" column, so those columns and owner-scoped policies stay.

-- 1. Drop redundant is_sales_rep()-gated write policies on affiliate_links.
--    The affiliate-hub migration already added open owner-scoped INSERT/UPDATE/DELETE policies.
DROP POLICY IF EXISTS "Sales reps can create own affiliate links" ON public.affiliate_links;
DROP POLICY IF EXISTS "Sales reps can update own affiliate links" ON public.affiliate_links;

-- 2. Rename owner-read SELECT policies away from the sales-rep concept (same predicate).
DROP POLICY IF EXISTS "Sales reps can view own affiliate links" ON public.affiliate_links;
CREATE POLICY "Owners can view own affiliate links"
  ON public.affiliate_links FOR SELECT TO authenticated
  USING (sales_rep_id = auth.uid());

DROP POLICY IF EXISTS "Sales reps can view own sales" ON public.affiliate_sales;
CREATE POLICY "Owners can view own affiliate sales"
  ON public.affiliate_sales FOR SELECT TO authenticated
  USING (sales_rep_id = auth.uid());

-- 3. Drop the sales-rep invitation feature entirely (table + its policies + trigger).
DROP TABLE IF EXISTS public.invited_users CASCADE;

-- 4. Drop the now-unused helper (no remaining policy references it).
DROP FUNCTION IF EXISTS public.is_sales_rep();
