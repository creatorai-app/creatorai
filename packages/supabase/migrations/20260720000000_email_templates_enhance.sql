-- Follow-ups to the bulk email system: templates remember a default from-address,
-- unsubscribes are captured + surfaced in the admin activity feed, and every
-- seeded template's header text is swapped for the colored logo image.

alter table email_templates add column if not exists default_from_address text;

create table if not exists email_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  created_at timestamptz not null default now()
);
-- One row per user — re-clicking unsubscribe just refreshes the timestamp.
create unique index if not exists email_unsubscribes_user_id_key on email_unsubscribes (user_id);
alter table email_unsubscribes enable row level security;

-- Swap the text header cell (#0f0a29 band, 22px 28px padding) for the logo. The
-- footer band uses a different style so it isn't touched. Idempotent: once the
-- header is an <img>, the pattern no longer matches.
update email_templates set html = regexp_replace(
  html,
  '<td style="background:#0f0a29;color:#fff;padding:22px 28px;font-size:18px;font-weight:700;letter-spacing:.5px;">[^<]*</td>',
  '<td style="background:#0f0a29;padding:16px 28px;"><img src="https://tryscriptai.com/colored%20logo.png" alt="Creator AI" height="30" style="height:30px;width:auto;display:block;border:0;"></td>'
);
