-- Job posts get their own public page at /careers/<slug>, so they need a stable
-- URL key and a markdown body separate from the one-line listing blurb.

ALTER TABLE public.job_posts
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS content text;

CREATE OR REPLACE FUNCTION public.slugify_job_title(p_title text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from lower(regexp_replace(coalesce(p_title, ''), '[^a-zA-Z0-9]+', '-', 'g')));
$$;

-- Generated in the database, not in the admin API: the seeds below, the admin
-- API and any direct SQL insert all need a slug, and NOT NULL would break the
-- ones that forget. Insert only, so an edited title keeps its published URL.
CREATE OR REPLACE FUNCTION public.set_job_post_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  base text;
  candidate text;
  n int := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;

  base := nullif(public.slugify_job_title(NEW.title), '');
  IF base IS NULL THEN
    base := 'role';
  END IF;

  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.job_posts WHERE slug = candidate) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_job_post_slug_trigger ON public.job_posts;
CREATE TRIGGER set_job_post_slug_trigger
  BEFORE INSERT ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_job_post_slug();

-- Backfill existing rows, numbering duplicate titles by age.
UPDATE public.job_posts AS j
SET slug = CASE WHEN s.rn = 1 THEN s.base ELSE s.base || '-' || s.rn END
FROM (
  SELECT
    id,
    coalesce(nullif(public.slugify_job_title(title), ''), 'role') AS base,
    row_number() OVER (
      PARTITION BY coalesce(nullif(public.slugify_job_title(title), ''), 'role')
      ORDER BY created_at, id
    ) AS rn
  FROM public.job_posts
  WHERE slug IS NULL
) AS s
WHERE j.id = s.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_posts_slug ON public.job_posts(slug);
ALTER TABLE public.job_posts ALTER COLUMN slug SET NOT NULL;

-- Give every existing post a readable body without inventing anything: the
-- description becomes the intro and the requirements prose, which is already a
-- list written as sentences, becomes the list it always was.
UPDATE public.job_posts
SET content =
  '## About the role' || E'\n\n' || description ||
  CASE
    WHEN coalesce(trim(requirements), '') = '' THEN ''
    ELSE E'\n\n' || '## Requirements' || E'\n\n- ' ||
         trim(trailing E'\n- ' from regexp_replace(trim(requirements), '\.\s+', E'.\n- ', 'g'))
  END
WHERE content IS NULL;
