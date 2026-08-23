-- Domain move: tryscriptai.com -> trycreatorai.com.
--
-- The code-side fallbacks live in the repo, but some rows were seeded by earlier
-- migrations and are edited from the admin dashboard, so they can only be moved
-- here. A read-only scan of every public table found the old domain in six of
-- them; three are live configuration and are rewritten below, three are
-- historical records and are deliberately left alone:
--
--   REWRITTEN
--   1. email_from_addresses.email      - the sender pool the composer offers.
--   2. email_templates.html            - CTA links and the header logo <img>
--      src. Email clients do not follow a 301 for an image, so a stale logo URL
--      renders as a broken box in every campaign.
--      email_templates.default_from_address - null everywhere today, but the
--      dashboard can set it, and it holds a bare address with no FK to the
--      sender pool, so renaming the pool alone could strand it.
--   3. blog_posts.content              - absolute self-links. Matches 0 rows
--      today; kept as a guard for posts edited before this deploys.
--
--   LEFT ALONE ON PURPOSE - do not "fix" these later
--   - email_sends.from_address / .custom_html : the audit log of what was
--     actually sent. Rewriting it would falsify the record.
--   - funnel_events.referrer : raw analytics, stored verbatim from
--     document.referrer and never parsed by host. Rewriting it would falsify
--     where traffic actually came from.
--   - mail_messages.body : inbound support mail. It is other people's words.
--
-- Every statement is a plain string replacement and idempotent: once no
-- old-domain string remains, re-running changes nothing.

-- 1. Sender pool. The unique index on email is why this is a guarded update
-- rather than a blind one: if a previous run already inserted the new address,
-- updating the old row onto it would raise 23505.
update email_from_addresses a
set email = replace(a.email, '@tryscriptai.com', '@trycreatorai.com')
where a.email like '%@tryscriptai.com'
  and not exists (
    select 1 from email_from_addresses b
    where b.email = replace(a.email, '@tryscriptai.com', '@trycreatorai.com')
  );

-- Drop any old-domain row that survived the guard because its new-domain twin
-- already existed, so the composer stops offering a dead sender.
delete from email_from_addresses
where email like '%@tryscriptai.com';

-- 2. Template bodies: CTA hrefs, both logo <img src> variants, support mailto.
-- default_from_address moves in the same statement so a template can never end
-- up pointing at a sender address that step 1 just renamed away.
update email_templates
set html = replace(html, 'tryscriptai.com', 'trycreatorai.com'),
    default_from_address = replace(default_from_address, 'tryscriptai.com', 'trycreatorai.com'),
    updated_at = now()
where html like '%tryscriptai.com%'
   or default_from_address like '%tryscriptai.com%';

-- 3. Post bodies. Relative internal links are unaffected; this only catches
-- absolute self-links, so they stop taking a 301 hop.
update blog_posts
set content = replace(content, 'tryscriptai.com', 'trycreatorai.com')
where content like '%tryscriptai.com%';
