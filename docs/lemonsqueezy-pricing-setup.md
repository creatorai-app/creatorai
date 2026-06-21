# Lemon Squeezy Pricing Setup Guide

This guide walks you through creating the Creator AI products in Lemon Squeezy (LS)
and wiring their prices to the application so checkout, credits, annual billing, and
referral rewards all work correctly.

> **Read this first — how the app maps plans to LS.**
> The app's source of truth for pricing is the `plans` table in the database. Each
> paid plan row stores two Lemon Squeezy **variant IDs**:
> - `ls_variant_id` → the **monthly** variant
> - `ls_variant_id_annual` → the **annual** variant (optional)
>
> At checkout the API reads the plan from the DB, picks the monthly or annual variant
> based on the toggle, and creates an LS checkout. It passes `plan_id` in the
> checkout's `custom_data`, so the webhook knows exactly which plan was bought — **you
> do not need to map variant → plan anywhere**. You only need to paste the correct
> variant IDs into the `plans` table.

---

## 1. The pricing model

| Plan      | Monthly | Annual (per-month) | Annual (billed yearly) | Credits/mo | LS product? |
|-----------|---------|--------------------|------------------------|-----------:|-------------|
| Starter   | $0      | $0                 | —                      | 200        | ❌ No (free, no card) |
| Creator   | $24     | $19                | **$228 / year**        | 3,000      | ✅ Yes (monthly + annual) |
| Pro       | $49     | $39                | **$468 / year**        | 8,000      | ✅ Yes (monthly + annual) |
| Business  | $299    | —                  | —                      | 50,000     | ✅ Yes (monthly only) |
| Scale     | $599    | —                  | —                      | 150,000    | ✅ Yes (monthly only) |

Notes:
- **Starter is free** and has no LS product. It is assigned automatically to every
  new user. Never create a $0 LS variant for it.
- The "annual (per-month)" figure ($19, $39) is only a **display** price. In Lemon
  Squeezy you charge the **yearly total** ($228, $468) on a yearly billing interval.
- **Business and Scale are monthly-only.** Leave their `ls_variant_id_annual` empty.
- Every feature is available on every plan — plans differ only by monthly credits.
  You do not configure features in LS; they live in the `plans.features` column.

---

## 2. Create the products in Lemon Squeezy

You can model this either as **one product per plan** (recommended — cleaner
reporting) or one product with many variants. The steps below use one product per
paid plan.

For **each** paid plan (Creator, Pro, Business, Scale):

1. Go to **Lemon Squeezy → Store → Products → New Product**.
2. **Name** it after the plan (e.g. "Creator AI — Creator").
3. Set the product to a **Subscription**.
4. Add the **monthly variant**:
   - Pricing model: **Subscription**
   - Interval: **Every 1 month**
   - Price: the monthly price from the table ($24 / $49 / $299 / $599).
   - Name the variant `Monthly`.
5. For **Creator** and **Pro** only, add a second **annual variant**:
   - Interval: **Every 1 year**
   - Price: the **yearly total** ($228 for Creator, $468 for Pro).
   - Name the variant `Annual`.
6. Save & **Publish** the product.

> Do **not** enable "Pay what you want", quantities, or setup fees — the app expects a
> single fixed subscription price per variant.

---

## 3. Get the variant IDs

Each variant has a numeric ID you need for the database.

- **Easiest:** Lemon Squeezy dashboard → open the product → click a variant → the
  variant ID is shown in the URL/details panel.
- **Via API:**
  ```bash
  curl -s https://api.lemonsqueezy.com/v1/variants \
    -H "Authorization: Bearer $LEMONSQUEEZY_API_KEY" \
    -H "Accept: application/vnd.api+json" | jq '.data[] | {id, name: .attributes.name, price: .attributes.price}'
  ```
  The `id` field is what goes into the `plans` table. (`price` is in cents.)

Record them:

| Plan     | Monthly variant ID | Annual variant ID |
|----------|--------------------|-------------------|
| Creator  | `1819381`          | `1819479`         |
| Pro      | `1819492`          | `1819494`         |
| Business | `1819499`          | (leave empty)     |
| Scale    | `1819502`          | (leave empty)     |

> **Test store IDs above.** Replace with production variant IDs before go-live.

---

## 4. Write the variant IDs into the database

Run the pricing migration first (it creates/updates the 5 plans):

```
packages/supabase/migrations/20260619000000_pricing_plans_rebuild.sql
```

Then set the variant IDs (test store IDs shown — replace for production):

```sql
-- Creator: monthly + annual
UPDATE public.plans
   SET ls_variant_id        = '1819381',
       ls_variant_id_annual = '1819479'
 WHERE name = 'Creator';

-- Pro: monthly + annual
UPDATE public.plans
   SET ls_variant_id        = '1819492',
       ls_variant_id_annual = '1819494'
 WHERE name = 'Pro';

-- Business: monthly only
UPDATE public.plans
   SET ls_variant_id        = '1819499',
       ls_variant_id_annual = NULL
 WHERE name = 'Business';

-- Scale: monthly only
UPDATE public.plans
   SET ls_variant_id        = '1819502',
       ls_variant_id_annual = NULL
 WHERE name = 'Scale';
```

Verify:

```sql
SELECT name, price_monthly, price_annual_monthly, credits_monthly,
       ls_variant_id, ls_variant_id_annual
  FROM public.plans
 ORDER BY price_monthly;
```

> ⚠️ The **prices in LS must match `price_monthly` / `price_annual_monthly` in the DB.**
> The DB drives what the UI shows; LS drives what the customer is actually charged. If
> they disagree, customers see one price and get billed another. Re-check after every
> price change in either place.

---

## 5. Environment variables (API)

Set these in `apps/api/.env` (see `apps/api/.env.example`):

```env
LEMONSQUEEZY_API_KEY=your-lemonsqueezy-api-key       # Settings → API
LEMONSQUEEZY_STORE_ID=your-store-id                  # Settings → Stores (numeric)
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-signing-secret
FRONTEND_DEV_URL=http://localhost:3000
FRONTEND_PROD_URL=https://your-production-domain.com
```

---

## 6. Configure the webhook

1. Lemon Squeezy → **Settings → Webhooks → New webhook**.
2. **Callback URL:**
   ```
   https://<your-api-domain>/api/v1/lemonsqueezy/webhook
   ```
   (Local testing: expose your API with a tunnel, e.g. `ngrok http 4000`, and use the
   tunnel URL.)
3. **Signing secret:** set the same value as `LEMONSQUEEZY_WEBHOOK_SECRET`. The API
   verifies the `x-signature` HMAC on every request and rejects mismatches.
4. **Events to enable** (at minimum):
   - `subscription_created` — provisions the plan, grants credits, completes any
     referral and pays both referral bonuses, records affiliate commission.
   - `subscription_payment_success` — credits recurring renewals + affiliate commission.
   - `subscription_updated`, `subscription_cancelled`, `subscription_expired` — keep
     plan state in sync and downgrade to Starter when a subscription ends.

---

## 7. How annual billing flows through the app

1. On `/pricing` or **Settings → Billing**, the user toggles **Annual**.
2. The frontend calls `POST /api/v1/billing/checkout` with `{ planId, interval: "annual" }`.
3. The API picks `ls_variant_id_annual` (falls back to monthly if none is set) and
   creates the LS checkout.
4. LS charges the **yearly total**; the webhook reads `custom_data.plan_id` and grants
   that plan's monthly credit allowance.

If a plan has no annual variant (Business, Scale), the annual toggle simply shows no
annual price and checkout uses the monthly variant.

---

## 8. How referral rewards interact with checkout

- A referred user's reward is **only** granted on their **first purchase** (no sign-up
  bonus). When `subscription_created` fires:
  - The pending referral is marked `completed`.
  - The **referrer** earns **1,000 credits** (via the `award_referral_credits` DB
    trigger).
  - The **buyer** receives **1,000 bonus credits** on top of their plan allowance
    (handled in `billing.service.ts`, `REFERRAL_PURCHASE_BONUS`).
- Affiliate commission (20% recurring) is separate and recorded on each successful
  payment.

Nothing extra is needed in Lemon Squeezy for referrals — they are matched by the
buyer's email / linked profile inside the webhook.

---

## 9. Go-live checklist

- [ ] Pricing migration applied; `plans` table shows all 5 plans with correct prices/credits.
- [ ] Creator & Pro have **both** monthly and annual variant IDs set.
- [ ] Business & Scale have **monthly** variant IDs; annual left `NULL`.
- [ ] LS variant prices exactly match the DB ($24/$228, $49/$468, $299, $599).
- [ ] `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` set.
- [ ] Webhook URL reachable and signing secret matches; required events enabled.
- [ ] Test monthly checkout → user lands on plan, credits granted.
- [ ] Test annual checkout (Creator/Pro) → charged yearly total, credits granted.
- [ ] Test a referred user's first purchase → referrer +1,000, buyer +1,000.
- [ ] Test cancellation → downgrades to Starter at period end.
```
