-- Mid-article branded CTA: the sign-up card rendered halfway down a post.
--
-- Stored per post rather than hardcoded in the page so the offer can be matched
-- to the article (a dubbing post sells dubbing, not "sign up") and edited from
-- the admin dashboard without a deploy. One jsonb column instead of four text
-- columns because the block is read and written as a unit, and NULL is the
-- honest "this post has no mid-article CTA".

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS branded_cta jsonb;

-- The render path reads ->>'title' etc. directly, so a scalar or an array here
-- would be a blank card on a live post. Same reasoning as the faqs/videos
-- array checks above: validate the shape where every writer passes through.
-- buttonHref is optional (defaults to /signup) but must stay same-origin: this
-- column is admin-editable and lands in an href, so it is a trust boundary.
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_branded_cta_shape_check;
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_branded_cta_shape_check CHECK (
    branded_cta IS NULL OR (
      jsonb_typeof(branded_cta) = 'object'
      AND length(btrim(coalesce(branded_cta ->> 'title', ''))) > 0
      AND length(btrim(coalesce(branded_cta ->> 'description', ''))) > 0
      AND length(btrim(coalesce(branded_cta ->> 'buttonLabel', ''))) > 0
      AND (branded_cta ->> 'buttonHref' IS NULL OR branded_cta ->> 'buttonHref' ~ '^/[a-zA-Z0-9/_.~%-]*$')
    )
  );

COMMENT ON COLUMN public.blog_posts.branded_cta IS
  '{title, description, buttonLabel, buttonHref?} rendered as the sign-up card halfway down the post. NULL hides it. buttonHref must be a site-relative path; defaults to /signup.';
