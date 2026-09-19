-- ============================================================================
-- 0168_default_org_enforcement_and_tenant_isolation.sql
-- 1. Assign orphan courses & profiles to Digital Training Organization (bd1b4b0c-abdc-4175-87f8-878a3e22fe4b)
-- 2. Update join_default_organization() RPC
-- 3. Replace get_leaderboard_with_profiles and get_leaderboard_for_period with strict tenant isolation
-- 4. Enable strict RLS on courses table
-- ============================================================================

-- Step 1: Assign orphan courses (organization_id IS NULL) to Digital Training Organization
UPDATE courses
SET organization_id = 'bd1b4b0c-abdc-4175-87f8-878a3e22fe4b'
WHERE organization_id IS NULL;

-- Step 2: Assign orphan user profiles (organization_id IS NULL) to Digital Training Organization
UPDATE user_profiles
SET organization_id = 'bd1b4b0c-abdc-4175-87f8-878a3e22fe4b'
WHERE organization_id IS NULL;

-- Step 3: Ensure join_default_organization() RPC attaches unassigned users to Digital Training Organization
CREATE OR REPLACE FUNCTION join_default_organization()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_domain text;
  v_matched_org_id uuid;
  v_default_org_id uuid := 'bd1b4b0c-abdc-4175-87f8-878a3e22fe4b'::uuid;
  v_existing_org uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT organization_id INTO v_existing_org FROM user_profiles WHERE id = v_user_id;
  IF v_existing_org IS NOT NULL THEN
    RETURN v_existing_org;
  END IF;

  -- Read caller's email from auth.users
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NOT NULL AND position('@' in v_user_email) > 0 THEN
    v_domain := lower(split_part(v_user_email, '@', 2));
    
    -- Check org_sso_settings for matching allowed_domain
    SELECT organization_id INTO v_matched_org_id
    FROM org_sso_settings
    WHERE lower(allowed_domain) = v_domain AND enabled = true
    LIMIT 1;
  END IF;

  -- Fallback to Digital Training Organization ('bd1b4b0c-abdc-4175-87f8-878a3e22fe4b')
  IF v_matched_org_id IS NULL THEN
    SELECT id INTO v_matched_org_id FROM organizations WHERE slug = 'tech-learning' OR id = v_default_org_id LIMIT 1;
    IF v_matched_org_id IS NULL THEN
      v_matched_org_id := v_default_org_id;
    END IF;
  END IF;

  INSERT INTO user_profiles (id, organization_id, role)
  VALUES (v_user_id, v_matched_org_id, 'learner')
  ON CONFLICT (id) DO UPDATE
    SET organization_id = coalesce(user_profiles.organization_id, v_matched_org_id);

  INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
  VALUES (v_matched_org_id, v_user_id, 'member', 'active', now())
  ON CONFLICT DO NOTHING;

  RETURN v_matched_org_id;
END;
$$;

-- Step 4: Strict tenant-scoped Leaderboard RPC (get_leaderboard_with_profiles)
CREATE OR REPLACE FUNCTION get_leaderboard_with_profiles(p_limit integer DEFAULT 50, p_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points integer,
  current_level integer,
  streak_days integer,
  cohort_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_org_id uuid;
  v_target_org uuid;
  v_leaderboard_enabled boolean := true;
BEGIN
  IF v_caller_id IS NOT NULL THEN
    SELECT organization_id INTO v_caller_org_id FROM user_profiles WHERE id = v_caller_id;
  END IF;

  -- Strictly resolve target organization: caller's org_id or explicit p_org_id
  IF p_org_id IS NOT NULL THEN
    v_target_org := p_org_id;
  ELSE
    v_target_org := v_caller_org_id;
  END IF;

  -- If target org is still null, return empty result set (do NOT leak cross-tenant data)
  IF v_target_org IS NULL THEN
    RETURN;
  END IF;

  -- Check organization leaderboard toggle
  SELECT coalesce((settings->'leaderboard'->>'enabled')::boolean, true)
  INTO v_leaderboard_enabled
  FROM organizations
  WHERE id = v_target_org;

  IF v_leaderboard_enabled IS FALSE THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.user_id,
    up.display_name,
    up.avatar_url,
    s.total_points,
    s.current_level,
    s.streak_days,
    coalesce(c.name, 'Active Batch') AS cohort_name
  FROM user_gamification_stats s
  JOIN user_profiles up ON up.id = s.user_id
  LEFT JOIN LATERAL (
    SELECT co.name
    FROM cohort_members cm
    JOIN cohorts co ON co.id = cm.cohort_id
    WHERE cm.user_id = s.user_id
    ORDER BY cm.added_at DESC
    LIMIT 1
  ) c ON true
  WHERE up.organization_id = v_target_org
  ORDER BY s.total_points DESC
  LIMIT p_limit;
END;
$$;

-- Step 5: Strict tenant-scoped Leaderboard RPC for Period (get_leaderboard_for_period)
CREATE OR REPLACE FUNCTION get_leaderboard_for_period(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_limit integer DEFAULT 50,
  p_org_id uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  period_points bigint,
  current_level integer,
  streak_days integer,
  cohort_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_org_id uuid;
  v_target_org uuid;
  v_leaderboard_enabled boolean := true;
BEGIN
  IF v_caller_id IS NOT NULL THEN
    SELECT organization_id INTO v_caller_org_id FROM user_profiles WHERE id = v_caller_id;
  END IF;

  IF p_org_id IS NOT NULL THEN
    v_target_org := p_org_id;
  ELSE
    v_target_org := v_caller_org_id;
  END IF;

  IF v_target_org IS NULL THEN
    RETURN;
  END IF;

  SELECT coalesce((settings->'leaderboard'->>'enabled')::boolean, true)
  INTO v_leaderboard_enabled
  FROM organizations WHERE id = v_target_org;

  IF NOT v_leaderboard_enabled THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH lesson_pts AS (
    SELECT lp.user_id, count(*) * 50 AS pts
    FROM lesson_progress lp
    WHERE lp.is_completed = true AND lp.completed_at >= p_start AND lp.completed_at < p_end
    GROUP BY lp.user_id
  ),
  quiz_pts AS (
    SELECT qa.user_id, coalesce(sum(qa.total_points), 0) AS pts
    FROM quiz_attempts qa
    WHERE qa.completed_at >= p_start AND qa.completed_at < p_end
    GROUP BY qa.user_id
  ),
  login_pts AS (
    SELECT dlr.user_id, coalesce(sum(dlr.points_awarded), 0) AS pts
    FROM daily_login_rewards dlr
    WHERE dlr.claimed_date >= p_start::date AND dlr.claimed_date < p_end::date
    GROUP BY dlr.user_id
  ),
  combined AS (
    SELECT u.user_id, sum(u.pts)::bigint AS period_points
    FROM (
      SELECT * FROM lesson_pts
      UNION ALL SELECT * FROM quiz_pts
      UNION ALL SELECT * FROM login_pts
    ) u
    GROUP BY u.user_id
    HAVING sum(u.pts) > 0
  )
  SELECT
    c.user_id,
    up.display_name,
    up.avatar_url,
    c.period_points,
    coalesce(s.current_level, 1),
    coalesce(s.streak_days, 0),
    coalesce(ch.name, 'Active Batch') AS cohort_name
  FROM combined c
  JOIN user_profiles up ON up.id = c.user_id
  LEFT JOIN user_gamification_stats s ON s.user_id = c.user_id
  LEFT JOIN LATERAL (
    SELECT co.name
    FROM cohort_members cm
    JOIN cohorts co ON co.id = cm.cohort_id
    WHERE cm.user_id = c.user_id
    ORDER BY cm.added_at DESC
    LIMIT 1
  ) ch ON true
  WHERE up.organization_id = v_target_org
  ORDER BY c.period_points DESC
  LIMIT p_limit;
END;
$$;

-- Step 6: Enable Row Level Security (RLS) on courses table
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courses_tenant_select ON courses;
CREATE POLICY courses_tenant_select ON courses
  FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    OR (SELECT role FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin' LIMIT 1) IS NOT NULL
  );
