-- Dubbing now reaches 34 languages: Cantonese joins as its own language on ElevenLabs
-- Dubbing v2, so ElevenLabs covers all 34 and Cypher (the in-house engine) 23. See
-- supportedLanguages / dubbableLanguagesFor in packages/validations/src/consts/dubbing.ts,
-- which the product pages quote directly.
--
-- Same approach as 20260927000000_blog_dubbing_language_count.sql: only the exact phrases
-- this product wrote are replaced, so an admin edit elsewhere in a post survives and
-- re-running this is a no-op. If the ElevenLabs language list grows again, copy this
-- migration with the new number rather than editing this one.

UPDATE public.blog_posts
SET content    = replace(content, '| Yes, 33 languages |', '| Yes, 34 languages |'),
    updated_at = now()
WHERE content LIKE '%| Yes, 33 languages |%';

UPDATE public.blog_posts
SET branded_cta = replace(branded_cta::text, 'any of 33 languages', 'any of 34 languages')::jsonb,
    updated_at  = now()
WHERE branded_cta::text LIKE '%any of 33 languages%';
