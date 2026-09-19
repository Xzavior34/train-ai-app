-- ============================================================================
-- 0161_single_db_leaderboard_and_security.sql
-- Single Production Database Leaderboard Multi-Tenant Scoping & Security Hardening
-- Target Database: jeobggrtxeybxvlwpxvn
--
-- 1. get_leaderboard_with_profiles:
--    - Scopes ranking to caller's organization_id (or explicit verified p_org_id)
--    - Respects organization leaderboard toggle (organizations.settings->'leaderboard'->'enabled')
--    - Returns empty result set if leaderboard is disabled for caller's organization
-- 2. get_leaderboard_for_period:
--    - Scopes period points to caller's organization_id
--    - Respects organization leaderboard toggle
-- 3. get_cohort_leaderboard:
--    - Verifies cohort organization leaderboard toggle
-- ============================================================================

-- 1. All-time leaderboard scoped to caller's organization & feature flags
create or replace function get_leaderboard_with_profiles(p_limit int default 50, p_org_id uuid default null)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points int,
  current_level int,
  streak_days int,
  cohort_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_org_id uuid;
  v_is_super boolean := false;
  v_target_org uuid;
  v_leaderboard_enabled boolean := true;
begin
  if v_caller_id is not null then
    select organization_id into v_caller_org_id from user_profiles where id = v_caller_id;
    select exists(select 1 from user_roles where user_roles.user_id = v_caller_id and role = 'super_admin') into v_is_super;
  end if;

  -- Resolve target organization
  if p_org_id is not null then
    if v_is_super or v_caller_org_id = p_org_id then
      v_target_org := p_org_id;
    else
      v_target_org := v_caller_org_id;
    end if;
  else
    v_target_org := v_caller_org_id;
  end if;

  -- Check organization leaderboard toggle if tenant is known
  if v_target_org is not null then
    select coalesce((settings->'leaderboard'->>'enabled')::boolean, true)
    into v_leaderboard_enabled
    from organizations
    where id = v_target_org;

    if v_leaderboard_enabled is false then
      return;
    end if;
  end if;

  return query
  select
    s.user_id,
    up.display_name,
    up.avatar_url,
    s.total_points,
    s.current_level,
    s.streak_days,
    coalesce(c.name, 'Active Batch') as cohort_name
  from user_gamification_stats s
  join user_profiles up on up.id = s.user_id
  left join lateral (
    select co.name
    from cohort_members cm
    join cohorts co on co.id = cm.cohort_id
    where cm.user_id = s.user_id
    order by cm.added_at desc
    limit 1
  ) c on true
  where (
    case
      when v_is_super and p_org_id is null and v_caller_org_id is null then true
      when v_target_org is not null then up.organization_id = v_target_org
      else up.organization_id is null
    end
  )
  order by s.total_points desc
  limit p_limit;
end;
$$;

-- 2. Period leaderboard scoped to caller's organization & feature flags
create or replace function get_leaderboard_for_period(
  p_start timestamptz,
  p_end timestamptz,
  p_limit int default 50,
  p_org_id uuid default null
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  period_points bigint,
  current_level int,
  streak_days int,
  cohort_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_org_id uuid;
  v_is_super boolean := false;
  v_target_org uuid;
  v_leaderboard_enabled boolean := true;
begin
  if v_caller_id is not null then
    select organization_id into v_caller_org_id from user_profiles where id = v_caller_id;
    select exists(select 1 from user_roles where user_roles.user_id = v_caller_id and role = 'super_admin') into v_is_super;
  end if;

  -- Resolve target organization
  if p_org_id is not null then
    if v_is_super or v_caller_org_id = p_org_id then
      v_target_org := p_org_id;
    else
      v_target_org := v_caller_org_id;
    end if;
  else
    v_target_org := v_caller_org_id;
  end if;

  -- Check organization leaderboard toggle if tenant is known
  if v_target_org is not null then
    select coalesce((settings->'leaderboard'->>'enabled')::boolean, true)
    into v_leaderboard_enabled
    from organizations
    where id = v_target_org;

    if v_leaderboard_enabled is false then
      return;
    end if;
  end if;

  return query
  with lesson_points as (
    select lp.user_id, count(*) * 50 as pts
    from lesson_progress lp
    where lp.is_completed = true and lp.completed_at >= p_start and lp.completed_at < p_end
    group by lp.user_id
  ),
  quiz_points as (
    select qa.user_id, coalesce(sum(qa.total_points), 0) as pts
    from quiz_attempts qa
    where qa.completed_at >= p_start and qa.completed_at < p_end
    group by qa.user_id
  ),
  login_points as (
    select dlr.user_id, coalesce(sum(dlr.points_awarded), 0) as pts
    from daily_login_rewards dlr
    where dlr.claimed_date >= p_start::date and dlr.claimed_date < p_end::date
    group by dlr.user_id
  ),
  combined as (
    select u.user_id, sum(u.pts) as period_points
    from (
      select * from lesson_points
      union all select * from quiz_points
      union all select * from login_points
    ) u
    group by u.user_id
    having sum(u.pts) > 0
  )
  select
    c.user_id,
    up.display_name,
    up.avatar_url,
    c.period_points,
    coalesce(s.current_level, 1),
    coalesce(s.streak_days, 0),
    coalesce(ch.name, 'Active Batch') as cohort_name
  from combined c
  join user_profiles up on up.id = c.user_id
  left join user_gamification_stats s on s.user_id = c.user_id
  left join lateral (
    select co.name
    from cohort_members cm
    join cohorts co on co.id = cm.cohort_id
    where cm.user_id = c.user_id
    order by cm.added_at desc
    limit 1
  ) ch on true
  where (
    case
      when v_is_super and p_org_id is null and v_caller_org_id is null then true
      when v_target_org is not null then up.organization_id = v_target_org
      else up.organization_id is null
    end
  )
  order by c.period_points desc
  limit p_limit;
end;
$$;

-- 3. Cohort leaderboard respecting organization feature flag
create or replace function get_cohort_leaderboard(p_cohort_id uuid, p_limit int default 50)
returns table (user_id uuid, display_name text, avatar_url text, total_points int, current_level int, streak_days int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_cohort_org_id uuid;
  v_leaderboard_enabled boolean := true;
begin
  select organization_id into v_cohort_org_id from cohorts where id = p_cohort_id;
  if v_cohort_org_id is not null then
    select coalesce((settings->'leaderboard'->>'enabled')::boolean, true)
    into v_leaderboard_enabled
    from organizations
    where id = v_cohort_org_id;

    if v_leaderboard_enabled is false then
      return;
    end if;
  end if;

  return query
  select s.user_id, up.display_name, up.avatar_url, s.total_points, s.current_level, s.streak_days
  from cohort_members cm
  join user_gamification_stats s on s.user_id = cm.user_id
  join user_profiles up on up.id = cm.user_id
  where cm.cohort_id = p_cohort_id
  order by s.total_points desc
  limit p_limit;
end;
$$;
