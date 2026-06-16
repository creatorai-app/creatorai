-- Affiliate Hub
-- Opens the affiliate program to all users: tracking links + admin-assigned promo codes,
-- recurring commissions with a maturity (refund-hold) window, and a manual withdrawal system.

-- ==========================================
-- 1. Extend affiliate_sales
-- ==========================================
ALTER TABLE public.affiliate_sales
  ADD COLUMN IF NOT EXISTS mature_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS promo_code_id uuid;

-- Promo-attributed sales have no affiliate link.
ALTER TABLE public.affiliate_sales ALTER COLUMN affiliate_link_id DROP NOT NULL;

ALTER TABLE public.affiliate_sales
  DROP CONSTRAINT IF EXISTS affiliate_sales_source_check;
ALTER TABLE public.affiliate_sales
  ADD CONSTRAINT affiliate_sales_source_check CHECK (source IN ('link', 'promo'));

CREATE INDEX IF NOT EXISTS idx_affiliate_sales_mature_at ON public.affiliate_sales USING btree (mature_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_sales_customer ON public.affiliate_sales USING btree (customer_id);

-- ==========================================
-- 2. Promo codes (admin-managed LS discounts assigned to an affiliate owner)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.affiliate_promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  code text NOT NULL,
  ls_discount_id text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  amount_type text NOT NULL DEFAULT 'percent',
  commission_rate numeric(5,2) NOT NULL DEFAULT 20.00,
  label text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT affiliate_promo_codes_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_promo_codes_code_key UNIQUE (code),
  CONSTRAINT affiliate_promo_codes_owner_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT affiliate_promo_codes_amount_type_check CHECK (amount_type IN ('percent', 'fixed')),
  CONSTRAINT affiliate_promo_codes_commission_check CHECK (commission_rate >= 0 AND commission_rate <= 100)
);

ALTER TABLE public.affiliate_promo_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_affiliate_promo_codes_owner ON public.affiliate_promo_codes USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_promo_codes_code ON public.affiliate_promo_codes USING btree (code);

ALTER TABLE public.affiliate_sales
  DROP CONSTRAINT IF EXISTS affiliate_sales_promo_fkey;
ALTER TABLE public.affiliate_sales
  ADD CONSTRAINT affiliate_sales_promo_fkey FOREIGN KEY (promo_code_id)
    REFERENCES public.affiliate_promo_codes(id) ON DELETE SET NULL;

-- ==========================================
-- 3. Payout methods (one per affiliate)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.affiliate_payout_methods (
  user_id uuid NOT NULL,
  method text NOT NULL DEFAULT 'paypal',
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT affiliate_payout_methods_pkey PRIMARY KEY (user_id),
  CONSTRAINT affiliate_payout_methods_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT affiliate_payout_methods_method_check CHECK (method IN ('paypal', 'wise', 'bank'))
);

ALTER TABLE public.affiliate_payout_methods ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. Withdrawals (manual admin-processed payouts)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.affiliate_withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  method text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'requested',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT affiliate_withdrawals_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_withdrawals_affiliate_fkey FOREIGN KEY (affiliate_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT affiliate_withdrawals_processor_fkey FOREIGN KEY (processed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT affiliate_withdrawals_status_check CHECK (status IN ('requested', 'approved', 'paid', 'rejected')),
  CONSTRAINT affiliate_withdrawals_amount_check CHECK (amount > 0)
);

ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_affiliate ON public.affiliate_withdrawals USING btree (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_status ON public.affiliate_withdrawals USING btree (status);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_created_at ON public.affiliate_withdrawals USING btree (created_at DESC);

-- ==========================================
-- 5. RLS Policies
-- ==========================================

-- Promo codes: owners read their own; admins manage all
CREATE POLICY "Owners can view own promo codes"
  ON public.affiliate_promo_codes FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can manage all promo codes"
  ON public.affiliate_promo_codes FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Payout methods: users manage their own; admins read all
CREATE POLICY "Users can manage own payout method"
  ON public.affiliate_payout_methods FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all payout methods"
  ON public.affiliate_payout_methods FOR SELECT TO authenticated
  USING (is_admin());

-- Withdrawals: affiliates view/create their own; admins manage all
CREATE POLICY "Affiliates can view own withdrawals"
  ON public.affiliate_withdrawals FOR SELECT TO authenticated
  USING (affiliate_id = auth.uid());

CREATE POLICY "Affiliates can request own withdrawals"
  ON public.affiliate_withdrawals FOR INSERT TO authenticated
  WITH CHECK (affiliate_id = auth.uid());

CREATE POLICY "Admins can manage all withdrawals"
  ON public.affiliate_withdrawals FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Affiliate links / sales: any user can create / read their own (open hub).
-- The existing "Sales reps can view own ..." SELECT policies already allow owner reads.
CREATE POLICY "Owners can create own affiliate links"
  ON public.affiliate_links FOR INSERT TO authenticated
  WITH CHECK (sales_rep_id = auth.uid());

CREATE POLICY "Owners can update own affiliate links"
  ON public.affiliate_links FOR UPDATE TO authenticated
  USING (sales_rep_id = auth.uid());

CREATE POLICY "Owners can delete own affiliate links"
  ON public.affiliate_links FOR DELETE TO authenticated
  USING (sales_rep_id = auth.uid());

-- ==========================================
-- 6. updated_at triggers
-- ==========================================
CREATE TRIGGER update_affiliate_promo_codes_updated_at
  BEFORE UPDATE ON public.affiliate_promo_codes
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_affiliate_payout_methods_updated_at
  BEFORE UPDATE ON public.affiliate_payout_methods
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_affiliate_withdrawals_updated_at
  BEFORE UPDATE ON public.affiliate_withdrawals
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
