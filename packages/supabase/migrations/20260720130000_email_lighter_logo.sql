-- Swap the email header to the lighter, email-optimized logo and place the app
-- name directly beneath it. Targets the logo cell produced by
-- 20260720000000_email_templates_enhance.sql (an <img> alone in the #0f0a29
-- header band). Idempotent: once a <div> sits after the <img>, the pattern no
-- longer matches, so re-running is a no-op.
update email_templates set html = regexp_replace(
  html,
  '<td style="background:#0f0a29;padding:16px 28px;"><img[^>]*></td>',
  '<td style="background:#0f0a29;padding:18px 28px;">'
  || '<img src="https://tryscriptai.com/lighter%20email%20logo.png" alt="Creator AI" height="30" style="height:30px;width:auto;display:block;border:0;">'
  || '<div style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:.5px;margin-top:6px;">Creator AI</div>'
  || '</td>'
);
