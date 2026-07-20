-- Categorized bulk email system: from-address pool, DB-stored editable templates,
-- and an audit log of every send. Templates hold their HTML in the DB (not a file
-- path) so admins edit them from the dashboard with no rebuild/deploy — the
-- packages/email-templates package is compiled and unreadable at runtime.

create table if not exists email_from_addresses (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'product_update', 'tips_and_tricks', 'feature_spotlight',
    'action_required', 'use_case', 'announcement'
  )),
  name text not null,
  subject text not null,
  html text not null,            -- editable HTML with {{mergeTags}}
  default_segment jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_sends (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references email_templates(id),
  from_address text not null,
  segment_filter jsonb,                 -- filter used to build the candidate list (audit only)
  recipient_ids uuid[] not null,        -- final confirmed list after manual adjustment
  recipient_count int not null,
  custom_html_used boolean not null default false,
  custom_html text,                     -- set only when the template was edited before send
  resend_batch_ids text[],
  status text not null check (status in ('sent', 'partial_failure', 'failed')),
  error_details jsonb,
  sent_by uuid,
  sent_at timestamptz not null default now()
);

create index if not exists email_sends_template_id_idx on email_sends (template_id);
create index if not exists email_sends_sent_at_idx on email_sends (sent_at desc);

-- Service-role only: these tables are admin-managed via the API's admin client,
-- never touched by end users. RLS on, no policies = no anon/auth access.
alter table email_from_addresses enable row level security;
alter table email_templates enable row level security;
alter table email_sends enable row level security;

-- ==================== SEED (Phase 8) ====================

insert into email_from_addresses (email, display_name)
values
  ('support@tryscriptai.com', 'Creator AI Support'),
  ('notifications@tryscriptai.com', 'Creator AI'),
  ('hello@tryscriptai.com', 'Afrin at Creator AI')
on conflict (email) do nothing;

-- Shared shell: white card, dark navy/deep-purple footer band, unsubscribe line.
-- {{firstName}} / {{planTier}} / {{channelName}} / {{email}} / {{unsubscribeUrl}}
-- are resolved per-recipient by resolveMergeTags() at send time.
insert into email_templates (category, name, subject, default_segment, html) values

('product_update', 'Product Update', 'What''s new in Creator AI', null,
$html$
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" style="padding:32px 16px;background:#f5f5f7;"><tr><td align="center">
<table role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.06);">
<tr><td style="background:#0f0a29;color:#fff;padding:22px 28px;font-size:18px;font-weight:700;letter-spacing:.5px;">Creator AI</td></tr>
<tr><td style="padding:36px 32px;">
<h1 style="margin:0 0 18px;font-size:22px;color:#111;">Hey {{firstName}}, we shipped something new</h1>
<p style="margin:0 0 18px;color:#333;font-size:15px;line-height:1.7;">We''ve been busy improving Creator AI and wanted to share the latest update with you. Here''s what''s new and how it helps you ship content faster.</p>
<p style="margin:0 0 28px;color:#333;font-size:15px;line-height:1.7;">Log in to try it out on your <strong>{{planTier}}</strong> plan.</p>
<a href="https://tryscriptai.com/dashboard" style="display:inline-block;background:#4f2fd6;color:#fff;text-decoration:none;border-radius:26px;padding:13px 30px;font-size:14px;font-weight:600;">Open Creator AI</a>
</td></tr>
<tr><td style="background:#0f0a29;color:#9c93c7;padding:22px 32px;text-align:center;font-size:12px;line-height:1.6;">Creator AI · Sent to {{email}}<br><a href="{{unsubscribeUrl}}" style="color:#9c93c7;">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>
$html$),

('tips_and_tricks', 'Tips & Tricks', 'A quick tip to get more out of Creator AI', null,
$html$
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" style="padding:32px 16px;background:#f5f5f7;"><tr><td align="center">
<table role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.06);">
<tr><td style="background:#0f0a29;color:#fff;padding:22px 28px;font-size:18px;font-weight:700;letter-spacing:.5px;">Creator AI · Tips</td></tr>
<tr><td style="padding:36px 32px;">
<h1 style="margin:0 0 18px;font-size:22px;color:#111;">{{firstName}}, here''s a 30-second tip</h1>
<p style="margin:0 0 18px;color:#333;font-size:15px;line-height:1.7;">Most creators miss this one: once your AI is trained on your channel, you can regenerate any script in a different tone without starting over. Small lever, big time savings.</p>
<p style="margin:0 0 28px;color:#333;font-size:15px;line-height:1.7;">Give it a try on your next script.</p>
<a href="https://tryscriptai.com/dashboard" style="display:inline-block;background:#4f2fd6;color:#fff;text-decoration:none;border-radius:26px;padding:13px 30px;font-size:14px;font-weight:600;">Try it now</a>
</td></tr>
<tr><td style="background:#0f0a29;color:#9c93c7;padding:22px 32px;text-align:center;font-size:12px;line-height:1.6;">Creator AI · Sent to {{email}}<br><a href="{{unsubscribeUrl}}" style="color:#9c93c7;">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>
$html$),

('feature_spotlight', 'Feature Spotlight', 'Have you tried this yet?', null,
$html$
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" style="padding:32px 16px;background:#f5f5f7;"><tr><td align="center">
<table role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.06);">
<tr><td style="background:#0f0a29;color:#fff;padding:22px 28px;font-size:18px;font-weight:700;letter-spacing:.5px;">Creator AI · Spotlight</td></tr>
<tr><td style="padding:36px 32px;">
<h1 style="margin:0 0 18px;font-size:22px;color:#111;">{{firstName}}, meet a feature you might have missed</h1>
<p style="margin:0 0 18px;color:#333;font-size:15px;line-height:1.7;">There''s a part of Creator AI that quietly saves our power users hours every week. We put together a short walkthrough so you can put it to work on {{channelName}}.</p>
<a href="https://tryscriptai.com/dashboard" style="display:inline-block;background:#4f2fd6;color:#fff;text-decoration:none;border-radius:26px;padding:13px 30px;font-size:14px;font-weight:600;">See how it works</a>
</td></tr>
<tr><td style="background:#0f0a29;color:#9c93c7;padding:22px 32px;text-align:center;font-size:12px;line-height:1.6;">Creator AI · Sent to {{email}}<br><a href="{{unsubscribeUrl}}" style="color:#9c93c7;">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>
$html$),

('action_required', 'Action Required: Connect Your Channel', 'Connect your channel to unlock Creator AI', '{"channelConnected": false}',
$html$
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" style="padding:32px 16px;background:#f5f5f7;"><tr><td align="center">
<table role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.06);">
<tr><td style="background:#0f0a29;color:#fff;padding:22px 28px;font-size:18px;font-weight:700;letter-spacing:.5px;">Creator AI</td></tr>
<tr><td style="padding:36px 32px;">
<h1 style="margin:0 0 18px;font-size:22px;color:#111;">{{firstName}}, you''re one step away</h1>
<p style="margin:0 0 18px;color:#333;font-size:15px;line-height:1.7;">Creator AI works best once it knows your channel. You haven''t connected yours yet — connecting takes about a minute and unlocks personalized scripts, ideas and thumbnails tuned to your audience.</p>
<a href="https://tryscriptai.com/dashboard" style="display:inline-block;background:#4f2fd6;color:#fff;text-decoration:none;border-radius:26px;padding:13px 30px;font-size:14px;font-weight:600;">Connect my channel</a>
</td></tr>
<tr><td style="background:#0f0a29;color:#9c93c7;padding:22px 32px;text-align:center;font-size:12px;line-height:1.6;">Creator AI · Sent to {{email}}<br><a href="{{unsubscribeUrl}}" style="color:#9c93c7;">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>
$html$),

('action_required', 'Action Required: Train Your AI', 'Train your AI to start generating', '{"modelTrained": false}',
$html$
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" style="padding:32px 16px;background:#f5f5f7;"><tr><td align="center">
<table role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.06);">
<tr><td style="background:#0f0a29;color:#fff;padding:22px 28px;font-size:18px;font-weight:700;letter-spacing:.5px;">Creator AI</td></tr>
<tr><td style="padding:36px 32px;">
<h1 style="margin:0 0 18px;font-size:22px;color:#111;">{{firstName}}, train your AI to get started</h1>
<p style="margin:0 0 18px;color:#333;font-size:15px;line-height:1.7;">Your account is set up but your AI isn''t trained yet — so it can''t write in your voice. Training runs in the background and only takes a few minutes. Once it''s done, every script sounds like you.</p>
<a href="https://tryscriptai.com/dashboard" style="display:inline-block;background:#4f2fd6;color:#fff;text-decoration:none;border-radius:26px;padding:13px 30px;font-size:14px;font-weight:600;">Train my AI</a>
</td></tr>
<tr><td style="background:#0f0a29;color:#9c93c7;padding:22px 32px;text-align:center;font-size:12px;line-height:1.6;">Creator AI · Sent to {{email}}<br><a href="{{unsubscribeUrl}}" style="color:#9c93c7;">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>
$html$),

('use_case', 'Use Case', 'How creators like you use Creator AI', null,
$html$
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" style="padding:32px 16px;background:#f5f5f7;"><tr><td align="center">
<table role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.06);">
<tr><td style="background:#0f0a29;color:#fff;padding:22px 28px;font-size:18px;font-weight:700;letter-spacing:.5px;">Creator AI · Use Case</td></tr>
<tr><td style="padding:36px 32px;">
<h1 style="margin:0 0 18px;font-size:22px;color:#111;">{{firstName}}, here''s a workflow worth stealing</h1>
<p style="margin:0 0 18px;color:#333;font-size:15px;line-height:1.7;">A creator on the {{planTier}} plan turns one idea into a full week of content: script, thumbnail, and title variations in a single sitting. Here''s the exact flow they use.</p>
<a href="https://tryscriptai.com/dashboard" style="display:inline-block;background:#4f2fd6;color:#fff;text-decoration:none;border-radius:26px;padding:13px 30px;font-size:14px;font-weight:600;">Try this workflow</a>
</td></tr>
<tr><td style="background:#0f0a29;color:#9c93c7;padding:22px 32px;text-align:center;font-size:12px;line-height:1.6;">Creator AI · Sent to {{email}}<br><a href="{{unsubscribeUrl}}" style="color:#9c93c7;">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>
$html$),

('announcement', 'Announcement', 'A quick note from Creator AI', null,
$html$
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" style="padding:32px 16px;background:#f5f5f7;"><tr><td align="center">
<table role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.06);">
<tr><td style="background:#0f0a29;color:#fff;padding:22px 28px;font-size:18px;font-weight:700;letter-spacing:.5px;">Creator AI</td></tr>
<tr><td style="padding:36px 32px;">
<h1 style="margin:0 0 18px;font-size:22px;color:#111;">Hi {{firstName}}</h1>
<p style="margin:0 0 18px;color:#333;font-size:15px;line-height:1.7;">Quick note from the Creator AI team — from now on we''ll send you the occasional short update: new features, tips, and the odd announcement. No noise, just the useful stuff. You can unsubscribe anytime.</p>
<p style="margin:0 0 0;color:#333;font-size:15px;line-height:1.7;">Thanks for being here,<br>Afrin</p>
</td></tr>
<tr><td style="background:#0f0a29;color:#9c93c7;padding:22px 32px;text-align:center;font-size:12px;line-height:1.6;">Creator AI · Sent to {{email}}<br><a href="{{unsubscribeUrl}}" style="color:#9c93c7;">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>
$html$);
