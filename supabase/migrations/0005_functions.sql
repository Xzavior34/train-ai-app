-- =============================================================================
-- Train AI — Backend functions (SECURITY DEFINER)
-- Every function pins `search_path` explicitly — required so a
-- SECURITY DEFINER function can't be tricked into resolving an
-- attacker-controlled object via a manipulated search_path.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role & permission resolution
-- ---------------------------------------------------------------------------

create or replace function get_user_roles(user_uuid uuid)
returns setof platform_role
language sql stable security definer set search_path = public as $$
  select role from user_roles where user_id = user_uuid;
$$;

create or replace function has_role(check_user_id uuid, check_role platform_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = check_user_id and role = check_role);
$$;

-- Priority order per spec: super_admin > admin > hr > manager > mentor > learner
create or replace function get_primary_role(check_user_id uuid)
returns platform_role
language sql stable security definer set search_path = public as $$
  select role from user_roles
  where user_id = check_user_id
  order by array_position(
    array['super_admin','admin','hr','manager','mentor','learner']::platform_role[],
    role
  )
  limit 1;
$$;

create or replace function current_user_is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(auth.uid(), 'super_admin');
$$;

create or replace function is_super_admin(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(check_user_id, 'super_admin');
$$;

create or replace function is_org_admin(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where user_id = check_user_id and role in ('owner','admin') and status = 'active'
  ) or is_super_admin(check_user_id);
$$;

create or replace function is_org_owner(check_user_id uuid, org_uuid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where user_id = check_user_id and organization_id = org_uuid and role = 'owner' and status = 'active'
  ) or is_super_admin(check_user_id);
$$;

create or replace function is_any_org_admin(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select is_org_admin(check_user_id);
$$;

create or replace function get_user_organization_id(check_user_id uuid default auth.uid())
returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from user_profiles where id = check_user_id;
$$;

create or replace function is_manager_of(manager_id uuid, learner_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles where id = learner_id and manager_id = is_manager_of.manager_id
  );
$$;

create or replace function is_group_member(check_user_id uuid, group_uuid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_group_members where user_id = check_user_id and group_id = group_uuid);
$$;

-- Role-level default lookup (role_permissions_matrix), by the caller's primary role
create or replace function role_has_permission(check_user_id uuid, perm_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select allowed from role_permissions_matrix
     where role = get_primary_role(check_user_id) and permission_key = perm_key),
    false
  );
$$;

-- Resolution order: explicit revoke always wins, then explicit grant, then role default.
create or replace function effective_has_permission(check_user_id uuid, perm_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when exists (
      select 1 from user_permission_overrides
      where user_id = check_user_id and permission_key = perm_key and effect = 'revoke'
        and (expires_at is null or expires_at > now())
    ) then false
    when exists (
      select 1 from user_permission_overrides
      where user_id = check_user_id and permission_key = perm_key and effect = 'grant'
        and (expires_at is null or expires_at > now())
    ) then true
    else role_has_permission(check_user_id, perm_key)
  end;
$$;

create or replace function get_my_effective_permissions()
returns table (permission_key text, allowed boolean)
language sql stable security definer set search_path = public as $$
  select distinct pk.permission_key, effective_has_permission(auth.uid(), pk.permission_key)
  from (select distinct permission_key from role_permissions_matrix) pk;
$$;

create or replace function can_manage_people(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select effective_has_permission(check_user_id, 'manage_users');
$$;

create or replace function can_moderate_content(check_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select effective_has_permission(check_user_id, 'moderate_content');
$$;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create or replace function create_user_invitation(
  p_email text, p_role platform_role, p_organization_id uuid, p_organization_role org_member_role
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_org_admin(auth.uid()) then
    raise exception 'not authorized to invite users to this organization';
  end if;
  insert into user_invitations (email, role, organization_id, organization_role, invited_by)
  values (p_email, p_role, p_organization_id, p_organization_role, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function validate_invitation_token(p_token text)
returns table (id uuid, email text, role platform_role, organization_id uuid, organization_role org_member_role, valid boolean)
language sql stable security definer set search_path = public as $$
  select id, email, role, organization_id, organization_role,
    (status = 'pending' and expires_at > now()) as valid
  from user_invitations where token = p_token;
$$;

create or replace function accept_invitation(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_inv user_invitations;
begin
  select * into v_inv from user_invitations where token = p_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'invitation is invalid or expired';
  end if;
  insert into user_roles (user_id, role) values (auth.uid(), v_inv.role)
    on conflict do nothing;
  if v_inv.organization_id is not null then
    insert into organization_members (organization_id, user_id, role, status, invited_by, joined_at)
    values (v_inv.organization_id, auth.uid(), v_inv.organization_role, 'active', v_inv.invited_by, now())
    on conflict (organization_id, user_id) do update set status = 'active', joined_at = now();
    update user_profiles set organization_id = v_inv.organization_id where id = auth.uid();
  end if;
  update user_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Referrals
-- ---------------------------------------------------------------------------

create or replace function validate_referral_code(p_code text)
returns table (link_id uuid, referrer_user_id uuid, is_active boolean)
language sql stable security definer set search_path = public as $$
  select id, user_id, is_active from referral_links where code = p_code;
$$;

create or replace function get_my_referral_signups()
returns setof referral_signups
language sql stable security definer set search_path = public as $$
  select * from referral_signups where referrer_user_id = auth.uid();
$$;

create or replace function get_referral_analytics(check_user_id uuid default auth.uid())
returns table (clicks int, signups bigint, conversion_rate numeric)
language sql stable security definer set search_path = public as $$
  select rl.clicks, count(rs.id), case when rl.clicks > 0 then round(count(rs.id)::numeric / rl.clicks * 100, 1) else 0 end
  from referral_links rl
  left join referral_signups rs on rs.referral_link_id = rl.id and rs.signup_completed
  where rl.user_id = check_user_id
  group by rl.id, rl.clicks;
$$;

-- ---------------------------------------------------------------------------
-- Quiz/assessment integrity — scores server-side; client never receives
-- correct_answer directly (see the safe_quiz_questions view).
-- ---------------------------------------------------------------------------

create or replace function check_quiz_answers(p_quiz_id uuid, p_answers jsonb)
returns table (score numeric, correct_count int, total int, total_points int)
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_correct int := 0;
  v_points int := 0;
  v_total_points int := 0;
  q record;
begin
  select count(*) into v_total from quiz_questions where quiz_id = p_quiz_id;
  for q in select * from quiz_questions where quiz_id = p_quiz_id loop
    v_total_points := v_total_points + q.points;
    if (p_answers ->> q.id::text) = q.correct_answer then
      v_correct := v_correct + 1;
      v_points := v_points + q.points;
    end if;
  end loop;
  return query select
    case when v_total > 0 then round(v_correct::numeric / v_total * 100, 1) else 0 end,
    v_correct, v_total, v_points;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gamification
-- ---------------------------------------------------------------------------

create or replace function award_achievement(p_user_id uuid, p_achievement_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_points int;
begin
  select points into v_points from achievements where id = p_achievement_id;
  insert into user_achievements (user_id, achievement_id, points_awarded)
  values (p_user_id, p_achievement_id, coalesce(v_points, 0))
  on conflict (user_id, achievement_id) do nothing;

  insert into user_gamification_stats (user_id, total_points)
  values (p_user_id, coalesce(v_points, 0))
  on conflict (user_id) do update
    set total_points = user_gamification_stats.total_points + coalesce(v_points, 0);
end;
$$;

create or replace function get_my_gamification_stats()
returns setof user_gamification_stats
language sql stable security definer set search_path = public as $$
  select * from user_gamification_stats where user_id = auth.uid();
$$;

create or replace function get_public_gamification_stats(check_user_id uuid)
returns table (total_points int, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  select total_points, current_level, streak_days from user_gamification_stats where user_id = check_user_id;
$$;

create or replace function create_or_join_weekly_league(p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_league_id uuid;
begin
  select id into v_league_id from weekly_leagues
  where is_active and week_start <= current_date and week_end >= current_date
  order by league_tier asc limit 1;

  if v_league_id is null then
    insert into weekly_leagues (league_name, league_tier, week_start, week_end)
    values ('Bronze League', 1, date_trunc('week', now())::date, (date_trunc('week', now()) + interval '6 days')::date)
    returning id into v_league_id;
  end if;

  insert into league_members (league_id, user_id) values (v_league_id, p_user_id)
    on conflict (league_id, user_id) do nothing;
  return v_league_id;
end;
$$;

create or replace function get_streak_leaderboard(p_limit int default 20)
returns table (user_id uuid, display_name text, streak_days int)
language sql stable security definer set search_path = public as $$
  select s.user_id, up.display_name, s.streak_days
  from user_gamification_stats s
  join user_profiles up on up.id = s.user_id
  order by s.streak_days desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------

create or replace function get_leaderboard_data(p_limit int default 50)
returns table (user_id uuid, total_points int, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  select user_id, total_points, current_level, streak_days
  from user_gamification_stats
  order by total_points desc
  limit p_limit;
$$;

-- Joins display name/avatar server-side since direct cross-user profile reads are RLS-restricted
create or replace function get_leaderboard_with_profiles(p_limit int default 50)
returns table (user_id uuid, display_name text, avatar_url text, total_points int, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  select s.user_id, up.display_name, up.avatar_url, s.total_points, s.current_level, s.streak_days
  from user_gamification_stats s
  join user_profiles up on up.id = s.user_id
  order by s.total_points desc
  limit p_limit;
$$;

create or replace function get_public_leaderboard(p_limit int default 50)
returns table (display_name text, total_points int, current_level int)
language sql stable security definer set search_path = public as $$
  select up.display_name, s.total_points, s.current_level
  from user_gamification_stats s
  join user_profiles up on up.id = s.user_id
  order by s.total_points desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Community
-- ---------------------------------------------------------------------------

create or replace function get_community_posts_with_details(p_limit int default 20)
returns table (id uuid, author_name text, author_avatar text, content text, created_at timestamptz, like_count bigint, comment_count bigint)
language sql stable security definer set search_path = public as $$
  select p.id, up.display_name, up.avatar_url, p.content, p.created_at,
    (select count(*) from post_reactions r where r.post_id = p.id),
    (select count(*) from post_comments c where c.post_id = p.id)
  from community_posts p
  join user_profiles up on up.id = p.user_id
  where p.moderation_status in ('approved','pending')
  order by p.created_at desc
  limit p_limit;
$$;

create or replace function set_post_pinned(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_moderate_content(auth.uid()) then
    raise exception 'not authorized to pin posts';
  end if;
  update community_posts set is_pinned = p_pinned where id = p_post_id;
end;
$$;

create or replace function search_mentionable_users(p_query text, p_limit int default 10)
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select id, display_name from user_profiles
  where display_name ilike '%' || p_query || '%'
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Mentor operations
-- ---------------------------------------------------------------------------

create or replace function get_mentor_analytics(p_mentor_id uuid)
returns table (total_sessions bigint, completed_sessions bigint, avg_rating numeric, total_earnings numeric)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where true),
    count(*) filter (where status = 'completed'),
    (select avg(rating) from session_ratings where mentor_id = p_mentor_id),
    (select coalesce(sum(amount), 0) from mentor_earnings where mentor_id = p_mentor_id)
  from mentorship_sessions where mentor_id = p_mentor_id;
$$;

create or replace function generate_recurring_sessions(
  p_mentor_id uuid, p_learner_id uuid, p_start timestamptz, p_duration int, p_pattern text, p_end_date date
) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_current timestamptz := p_start; v_step interval;
begin
  v_step := case p_pattern when 'weekly' then interval '7 days' when 'biweekly' then interval '14 days' else interval '7 days' end;
  while v_current::date <= p_end_date loop
    insert into mentorship_sessions (mentor_id, learner_id, scheduled_at, duration_minutes, is_recurring, recurrence_pattern, recurrence_end_date)
    values (p_mentor_id, p_learner_id, v_current, p_duration, true, p_pattern, p_end_date);
    v_count := v_count + 1;
    v_current := v_current + v_step;
  end loop;
  return v_count;
end;
$$;

create or replace function cancel_recurring_sessions(p_parent_session_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update mentorship_sessions set status = 'cancelled'
  where parent_session_id = p_parent_session_id and status not in ('completed','cancelled');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Compliance
-- ---------------------------------------------------------------------------

create or replace function refresh_compliance_status()
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update compliance_assignments
  set status = 'overdue'
  where status in ('pending','in_progress') and due_at < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------

create or replace function current_user_email()
returns text
language sql stable security definer set search_path = public as $$
  select email from auth.users where id = auth.uid();
$$;

create or replace function get_current_auth_email()
returns text
language sql stable security definer set search_path = public as $$
  select current_user_email();
$$;

-- ---------------------------------------------------------------------------
-- Logging — writes to the hash-chained admin_audit_log. The chain makes the
-- log tamper-evident: each row's hash is derived from the previous row's
-- hash, so editing or deleting a past row breaks every hash after it.
-- ---------------------------------------------------------------------------

create or replace function log_admin_action(
  p_action_type text, p_target_type text, p_target_id uuid, p_target_identifier text,
  p_old_value jsonb, p_new_value jsonb, p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_prev_hash text;
  v_row_hash text;
  v_id uuid;
begin
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(
    digest(
      coalesce(v_prev_hash, '') || p_action_type || coalesce(p_target_id::text, '') || now()::text,
      'sha256'
    ),
    'hex'
  );
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, old_value, new_value, metadata, prev_hash, row_hash)
  values (auth.uid(), p_action_type, p_target_type, p_target_id, p_target_identifier, p_old_value, p_new_value, p_metadata, v_prev_hash, v_row_hash)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function log_error(p_error_type text, p_error_message text, p_component text, p_context jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into error_logs (user_id, error_type, error_message, component_name, user_context)
  values (auth.uid(), p_error_type, p_error_message, p_component, p_context);
end;
$$;

create or replace function track_user_activity(p_activity_type text, p_activity_data jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into user_analytics (user_id, activity_type, activity_data)
  values (auth.uid(), p_activity_type, p_activity_data);
end;
$$;
