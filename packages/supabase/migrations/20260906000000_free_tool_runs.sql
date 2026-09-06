-- Persistence for the anonymous /tools generators.
--
-- Until now a free run existed only in React state: the visitor generated
-- something good, hit the signup wall, and lost it on navigation. That is the
-- worst possible moment to lose someone, because it is the one moment they have
-- proof the product works. This table keeps the run so signing up can hand it
-- straight back, materialized into the real feature table.
--
-- ONE table for all three tools rather than three shadow tables. The rows are
-- write-once, read-once, and the only per-tool logic is which real table a claim
-- materializes into, which lives in code. `input`/`output` are jsonb because the
-- shapes differ per tool and nothing here is ever queried by their contents.

CREATE TABLE IF NOT EXISTS public.free_tool_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Client-generated UUID kept in the visitor's localStorage. Doubles as the
  -- bearer secret for claiming: a claim must present it, so knowing a run id
  -- (which travels in a URL) is not enough to steal someone else's work.
  session_id uuid NOT NULL,
  tool text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}',
  output jsonb NOT NULL DEFAULT '{}',
  -- Set when the visitor signs up and the run is copied into the real table.
  claimed_by uuid,
  claimed_at timestamptz,
  -- Which row the claim created, so a second claim can return it instead of
  -- inserting a duplicate. Not a FK: it points at one of three tables.
  claimed_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT free_tool_runs_pkey PRIMARY KEY (id),
  CONSTRAINT free_tool_runs_tool_check CHECK (tool IN ('script', 'idea', 'story')),
  CONSTRAINT free_tool_runs_user_fkey FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  -- claimed_by/claimed_at/claimed_record_id are set together or not at all.
  CONSTRAINT free_tool_runs_claim_shape_check CHECK (
    (claimed_by IS NULL AND claimed_at IS NULL AND claimed_record_id IS NULL)
    OR (claimed_by IS NOT NULL AND claimed_at IS NOT NULL AND claimed_record_id IS NOT NULL)
  )
);

-- The claim path: "every unclaimed run for this session".
CREATE INDEX IF NOT EXISTS idx_free_tool_runs_session
  ON public.free_tool_runs USING btree (session_id, created_at DESC)
  WHERE claimed_by IS NULL;

-- Retention sweep and the funnel report both read by age.
CREATE INDEX IF NOT EXISTS idx_free_tool_runs_created_at
  ON public.free_tool_runs USING btree (created_at DESC);

-- RLS on with no anon policy at all: every read and write goes through the API
-- on the service role. An anon-writable table reachable with the public key is a
-- free Gemini-output store for anyone who reads our JS bundle, and the rows hold
-- whatever topic a visitor typed. Nothing needs direct client access here.
ALTER TABLE public.free_tool_runs ENABLE ROW LEVEL SECURITY;

-- A signed-in user may read back the runs they claimed. Nothing more: the write
-- and the claim are both service-role operations, because claiming has to insert
-- into the real feature tables in the same breath.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'free_tool_runs' AND policyname = 'Users can read runs they claimed'
  ) THEN
    CREATE POLICY "Users can read runs they claimed"
      ON public.free_tool_runs FOR SELECT TO authenticated
      USING (claimed_by = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE public.free_tool_runs IS
  'Anonymous generations from the public /tools pages, kept so signing up can materialize them into scripts / ideation_jobs / story_builder_jobs instead of losing them.';
COMMENT ON COLUMN public.free_tool_runs.session_id IS
  'Client-generated UUID from localStorage. Required to claim a run, so a leaked run id alone is not enough.';
