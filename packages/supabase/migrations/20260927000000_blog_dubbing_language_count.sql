-- Dubbing now reaches 33 languages: all of them on ElevenLabs, 23 on Cypher (the
-- in-house engine). See supportedLanguages / dubbableLanguagesFor in
-- packages/validations/src/consts/dubbing.ts, which the product pages quote directly.
--
-- Blog posts and their branded CTAs are content in this table, so they still say 29.
-- Only the exact phrases this product wrote are replaced; sentences about other tools'
-- language counts are left alone. Matching on the phrase rather than on slugs means an
-- admin edit elsewhere in a post survives, and re-running this is a no-op.

UPDATE public.blog_posts
SET content    = replace(content, '| Yes, 29 languages |', '| Yes, 33 languages |'),
    updated_at = now()
WHERE content LIKE '%| Yes, 29 languages |%';

UPDATE public.blog_posts
SET branded_cta = replace(branded_cta::text, 'any of 29 languages', 'any of 33 languages')::jsonb,
    updated_at  = now()
WHERE branded_cta::text LIKE '%any of 29 languages%';
