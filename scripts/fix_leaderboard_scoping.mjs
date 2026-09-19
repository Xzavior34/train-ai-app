const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN || "";
const PROJECT = 'jeobggrtxeybxvlwpxvn';

async function sql(q, label) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + PROJECT + '/database/query', {
    method:'POST', headers:{'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'},
    body: JSON.stringify({ query: q })
  });
  const t = await r.text();
  const ok = r.status === 200 || r.status === 201;
  console.log(ok ? '[PASS]' : '[FAIL]', label, ok ? '' : '-> ' + t.substring(0, 500));
  return ok;
}

const fixSQL = `
CREATE OR REPLACE FUNCTION public.get_leaderboard_for_period(
  p_start timestamptz,
  p_end   timestamptz,
  p_limit integer DEFAULT 50,
  p_org_id uuid DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  period_points bigint,
  current_level integer,
  streak_days integer,
  cohort_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_org_id uuid;
  v_is_super boolean := false;
  v_target_org uuid;
  v_leaderboard_enabled boolean := true;
begin
  if v_caller_id is not null then
    v_caller_org_id := get_user_organization_id(v_caller_id);
    v_is_super := is_super_admin(v_caller_id);
  else
    v_is_super := true; -- system caller (service_role / direct query)
  end if;

  if (v_is_super or v_caller_id is null) and p_org_id is not null then
    v_target_org := p_org_id;
  elsif not v_is_super then
    v_target_org := v_caller_org_id;
    if v_target_org is not null then
      select coalesce((settings->'leaderboard'->>'enabled')::boolean, true)
        into v_leaderboard_enabled
        from organizations where id = v_target_org;
      if not v_leaderboard_enabled then
        return;
      end if;
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
    select u.user_id, sum(u.pts)::bigint as period_points
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
      when (v_is_super or v_caller_id is null) and p_org_id is null and v_caller_org_id is null then true
      when v_target_org is not null then up.organization_id = v_target_org
      else up.organization_id is null
    end
  )
  order by c.period_points desc
  limit p_limit;
end;
$$;
`;

await sql(fixSQL, 'Fix get_leaderboard_for_period system-caller org scoping');
