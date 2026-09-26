-- Drop two tables nothing uses.
--
-- 1. `activities` was an ADMIN audit trail, not a user activity log: actor_id was
--    always the admin making the request, and the affected record was stored as
--    entity_type/entity_id. It was written by 15 admin endpoints and read by
--    nothing -- there has never been a UI for it. The admin "Activities" page is a
--    different data path entirely (it merges the per-feature tables).
--    We only want to track what users do, so the trail and its writer are gone.
--
-- 2. `documentation_generations` was in the original schema and never gained a
--    writer. It was queried on every activity-feed load, every admin user page and
--    every billing usage chart, and always returned nothing.
--
-- IRREVERSIBLE: this destroys whatever rows these tables hold. Both are read by
-- no code, so nothing breaks, but the admin audit history is not recoverable
-- afterwards. Dump the tables first if that history is worth keeping.

-- Policies and indexes go with the table; DROP TABLE removes them.
DROP TABLE IF EXISTS public.activities;
DROP TABLE IF EXISTS public.documentation_generations;
