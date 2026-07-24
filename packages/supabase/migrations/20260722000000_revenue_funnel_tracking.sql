-- Revenue + purchase-intent funnel tracking.
--
-- The admin "Total Revenue"/"Total Sales" cards used to read affiliate_sales,
-- which only ever holds affiliate commissions -- hence $0.00 / 0 despite live
-- subscriptions. Real money now comes from ls_webhook_events, the audit trail
-- of every Lemon Squeezy webhook we accept.

create table if not exists "public"."ls_webhook_events" (
  "id" uuid primary key default gen_random_uuid(),
  "event_name" text not null,
  "ls_id" text not null,              -- Lemon Squeezy data.id (order / subscription / invoice)
  "ls_subscription_id" text,          -- links payments back to subscriptions -> plans
  "customer_email" text,
  "variant_id" text,
  "amount_cents" integer not null default 0,
  "currency" text,
  "status" text,
  "payload" jsonb not null,
  "occurred_at" timestamptz not null,
  "created_at" timestamptz not null default now(),
  -- Lemon Squeezy retries failed deliveries and the event may be registered to
  -- more than one endpoint. A retry replays an identical payload, so its
  -- occurred_at matches; a genuine later update carries a newer one.
  unique ("event_name", "ls_id", "occurred_at")
);

create index if not exists "ls_webhook_events_event_name_idx" on "public"."ls_webhook_events" ("event_name");
create index if not exists "ls_webhook_events_subscription_idx" on "public"."ls_webhook_events" ("ls_subscription_id");
create index if not exists "ls_webhook_events_created_at_idx" on "public"."ls_webhook_events" ("created_at" desc);

-- Purchase intent, tracked from our own frontend: Lemon Squeezy only ever sees
-- the people who already reached its checkout.
create table if not exists "public"."funnel_events" (
  "id" uuid primary key default gen_random_uuid(),
  "event" text not null check ("event" in ('pricing_viewed', 'plan_clicked', 'checkout_started')),
  "tier" text,
  "user_id" uuid,
  "session_id" text not null,
  "referrer" text,
  "created_at" timestamptz not null default now()
);

create index if not exists "funnel_events_event_idx" on "public"."funnel_events" ("event");
create index if not exists "funnel_events_created_at_idx" on "public"."funnel_events" ("created_at" desc);

-- Written and read only by the API's service-role client: RLS on, no policies.
alter table "public"."ls_webhook_events" enable row level security;
alter table "public"."funnel_events" enable row level security;

-- Revenue is summed from subscription_payment_success only. Lemon Squeezy also
-- fires order_created for the first payment of a subscription, so counting both
-- would double-bill every initial purchase. order_created is still stored for
-- the audit trail.
create or replace view "public"."ls_revenue_by_tier" with (security_invoker = on) as
select
  p.name as tier,
  coalesce(sum(e.amount_cents) filter (
    where e.event_name = 'subscription_payment_success' and e.status = 'paid'
  ), 0)::bigint as revenue_cents,
  count(*) filter (
    where e.event_name = 'subscription_payment_success' and e.status = 'paid'
  )::bigint as payments,
  count(*) filter (where e.event_name = 'subscription_created')::bigint as sales,
  count(*) filter (where e.event_name = 'subscription_payment_failed')::bigint as failed_payments,
  count(*) filter (where e.event_name in ('subscription_cancelled', 'subscription_expired'))::bigint as churned
from "public"."ls_webhook_events" e
join "public"."subscriptions" s on s.ls_subscription_id = e.ls_subscription_id
join "public"."plans" p on p.id = s.plan_id
group by p.name;

create or replace view "public"."funnel_summary" with (security_invoker = on) as
select
  event,
  coalesce(tier, 'all') as tier,
  count(*)::bigint as events,
  count(distinct session_id)::bigint as sessions
from "public"."funnel_events"
group by 1, 2;
