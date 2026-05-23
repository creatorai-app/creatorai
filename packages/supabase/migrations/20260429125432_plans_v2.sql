alter table "public"."plans" 
add column "daily_limit" int NOT NULL DEFAULT 5,
add column "cooldown_minutes" int NOT NULL DEFAULT 60;

alter table "public"."youtube_channels" 
add column "top_videos" jsonb,
add column "recent_videos" jsonb,
add column "last_synced_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "last_used_at"     TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "usage_count"      INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "usage_reset_date" DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN "youtube_trained_videos" jsonb;



CREATE OR REPLACE FUNCTION use_feature(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_count              INT;
  v_last_used          TIMESTAMPTZ;
  v_reset_date         DATE;
  v_daily_limit        INT;
  v_cooldown           INT;
  v_plan_name          VARCHAR;
  v_minutes_since_last FLOAT;
BEGIN

  -- 1. Try active subscription
  SELECT p.daily_limit, p.cooldown_minutes, p.name
  INTO v_daily_limit, v_cooldown, v_plan_name
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id
    AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
  ORDER BY p.daily_limit DESC
  LIMIT 1;

  -- 2. No active sub → fall back to starter plan limits
  IF v_daily_limit IS NULL THEN
    SELECT daily_limit, cooldown_minutes, name
    INTO v_daily_limit, v_cooldown, v_plan_name
    FROM plans WHERE name = 'starter'
    LIMIT 1;
  END IF;

  -- 3. Starter plan row missing → hard-coded safety defaults
  v_daily_limit := COALESCE(v_daily_limit, 5);
  v_cooldown    := COALESCE(v_cooldown, 60);
  v_plan_name   := COALESCE(v_plan_name, 'starter');

  SELECT usage_count, last_used_at, usage_reset_date
  INTO v_count, v_last_used, v_reset_date
  FROM youtube_channels
  WHERE user_id = p_user_id;

  -- Treat as zero if the stored date is from a previous day
  IF v_reset_date IS NULL OR v_reset_date < CURRENT_DATE THEN
    v_count     := 0;
    v_last_used := NULL;
  END IF;

  v_count := COALESCE(v_count, 0);

  IF v_last_used IS NOT NULL THEN
    v_minutes_since_last := EXTRACT(EPOCH FROM (NOW() - v_last_used)) / 60;

    IF v_minutes_since_last < v_cooldown THEN
      RETURN json_build_object(
        'allowed',           false,
        'reason',            'cooldown',
        'plan',              v_plan_name,
        'minutes_remaining', ROUND((v_cooldown - v_minutes_since_last)::numeric, 1),
        'message',           'Please wait before using this feature again'
      );
    END IF;
  END IF;

  IF v_count >= v_daily_limit THEN
    RETURN json_build_object(
      'allowed',     false,
      'reason',      'daily_limit',
      'plan',        v_plan_name,
      'usage_count', v_count,
      'remaining',   0,
      'daily_limit', v_daily_limit,
      'message',     'Daily limit reached. Resets tomorrow.'
    );
  END IF;

  -- Atomically increment; reset count if date rolled over
  UPDATE youtube_channels
  SET
    usage_count      = CASE WHEN usage_reset_date < CURRENT_DATE THEN 1 ELSE usage_count + 1 END,
    usage_reset_date = CURRENT_DATE,
    last_used_at     = NOW()
  WHERE user_id = p_user_id
  RETURNING usage_count INTO v_count;

  RETURN json_build_object(
    'allowed',          true,
    'plan',             v_plan_name,
    'usage_count',      v_count,
    'remaining',        v_daily_limit - v_count,
    'daily_limit',      v_daily_limit,
    'cooldown_minutes', v_cooldown,
    'message',          'Feature used successfully'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



CREATE OR REPLACE FUNCTION get_feature_usage(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_count              INT;
  v_last_used          TIMESTAMPTZ;
  v_reset_date         DATE;
  v_daily_limit        INT;
  v_cooldown           INT;
  v_plan_name          VARCHAR;
  v_cooldown_remaining FLOAT;
  v_minutes_since_last FLOAT;
BEGIN

  -- 1. Try active subscription
  SELECT p.daily_limit, p.cooldown_minutes, p.name
  INTO v_daily_limit, v_cooldown, v_plan_name
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id
    AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
  ORDER BY p.daily_limit DESC
  LIMIT 1;

  -- 2. No active sub → fall back to starter plan limits
  IF v_daily_limit IS NULL THEN
    SELECT daily_limit, cooldown_minutes, name
    INTO v_daily_limit, v_cooldown, v_plan_name
    FROM plans WHERE name = 'starter' LIMIT 1;
  END IF;

  -- 3. Starter plan row missing → hard-coded safety defaults
  v_daily_limit := COALESCE(v_daily_limit, 5);
  v_cooldown    := COALESCE(v_cooldown, 60);
  v_plan_name   := COALESCE(v_plan_name, 'starter');

  SELECT usage_count, last_used_at, usage_reset_date
  INTO v_count, v_last_used, v_reset_date
  FROM youtube_channels
  WHERE user_id = p_user_id;

  -- Reset if date has rolled over
  IF v_reset_date IS NULL OR v_reset_date < CURRENT_DATE THEN
    v_count     := 0;
    v_last_used := NULL;
  END IF;

  v_count := COALESCE(v_count, 0);

  IF v_last_used IS NOT NULL THEN
    v_minutes_since_last := EXTRACT(EPOCH FROM (NOW() - v_last_used)) / 60;
    v_cooldown_remaining := GREATEST(v_cooldown - v_minutes_since_last, 0);
  ELSE
    v_cooldown_remaining := 0;
  END IF;

  RETURN json_build_object(
    'plan',               v_plan_name,
    'usage_count',        v_count,
    'remaining',          GREATEST(v_daily_limit - v_count, 0),
    'daily_limit',        v_daily_limit,
    'cooldown_minutes',   v_cooldown,
    'cooldown_remaining', ROUND(v_cooldown_remaining::numeric, 1),
    'can_use_now',        v_cooldown_remaining < 0.01 AND v_count < v_daily_limit
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;