-- Dubbing now reaches 94 languages: ElevenLabs dubs every language on its Dubbing v2
-- table (93, Cantonese among them) plus Bengali on dubbing_v1, and Cypher (the in-house
-- engine) 23 of them. See supportedLanguages / dubbableLanguagesFor in
-- packages/validations/src/consts/dubbing.ts, which the product pages quote directly.
--
-- Same approach as 20260927000000_blog_dubbing_language_count.sql: only the exact phrases
-- this product wrote are replaced, so an admin edit elsewhere in a post survives and
-- re-running this is a no-op. If the language list changes again, copy this migration
-- with the new number rather than editing this one.

UPDATE public.blog_posts
SET content    = replace(content, '| Yes, 33 languages |', '| Yes, 94 languages |'),
    updated_at = now()
WHERE content LIKE '%| Yes, 33 languages |%';

UPDATE public.blog_posts
SET branded_cta = replace(branded_cta::text, 'any of 33 languages', 'any of 94 languages')::jsonb,
    updated_at  = now()
WHERE branded_cta::text LIKE '%any of 33 languages%';
