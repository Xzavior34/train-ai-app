-- Close legacy SECURITY DEFINER execution gaps found during the production
-- database audit. Keep public demo availability read-only, bind learner
-- gamification to the signed-in learner, and reserve internal operations for
-- trusted callers.

begin;

-- Public demo availability is intentionally readable, but a fixed search path
-- prevents object-shadowing when this privileged function runs.
alter function public.get_booked_slots(date, date)
  set search_path = public, pg_temp;
revoke all on function public.get_booked_slots(date, date) from public;
grant execute on function public.get_booked_slots(date, date) to anon, authenticated;

-- This legacy email lookup is not used by the current client. It reveals an
-- organisation name for an arbitrary email, so only trusted server code may
-- call it. The DO block keeps this migration portable across both production
-- projects, because only the Sara project currently has the function.
do $$
begin
  if to_regprocedure('public.get_user_org_name(text)') is not null then
    execute 'alter function public.get_user_org_name(text) set search_path = public, auth, pg_temp';
    execute 'revoke all on function public.get_user_org_name(text) from public, anon, authenticated';
    execute 'grant execute on function public.get_user_org_name(text) to service_role';
  end if;
end;
$$;

-- Awarding is still initiated by the signed-in learner client, but it may
-- never award another account. Service-role callers remain available for
-- future trusted automation.
create or replace function public.award_achievement(
  p_user_id uuid,
  p_achievement_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_points int;
  v_name text;
  v_description text;
  v_icon text;
  v_already_earned boolean;
begin
  if auth.role() <> 'service_role' and p_user_id is distinct from auth.uid() then
    raise exception 'Achievements can only be awarded to the signed-in account';
  end if;

  select points, name, description, icon
    into v_points, v_name, v_description, v_icon
    from public.achievements
    where id = p_achievement_id;

  if not found then
    return;
  end if;

  select exists(
    select 1 from public.user_achievements
    where user_id = p_user_id and achievement_id = p_achievement_id
  ) into v_already_earned;

  if v_already_earned then
    return;
  end if;

  insert into public.user_achievements (
    user_id, achievement_id, achievement_title, achievement_description,
    achievement_icon, points_awarded
  ) values (
    p_user_id, p_achievement_id, v_name, v_description,
    v_icon, coalesce(v_points, 0)
  )
  on conflict (user_id, achievement_id) do nothing;

  insert into public.user_gamification_stats (user_id, total_points)
  values (p_user_id, coalesce(v_points, 0))
  on conflict (user_id) do update
    set total_points = public.user_gamification_stats.total_points + coalesce(v_points, 0);

  insert into public.real_notifications (user_id, type, title, message)
  values (
    p_user_id,
    'achievement',
    'Achievement Unlocked: ' || coalesce(v_name, 'New Badge'),
    coalesce(v_description, 'You earned a new achievement!') ||
      ' (+' || coalesce(v_points, 0) || ' points)'
  );
end;
$$;

create or replace function public.award_achievement_by_slug(
  p_user_id uuid,
  p_slug text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.role() <> 'service_role' and p_user_id is distinct from auth.uid() then
    raise exception 'Achievements can only be awarded to the signed-in account';
  end if;

  select id into v_id from public.achievements where slug = p_slug;
  if v_id is null then
    return;
  end if;
  perform public.award_achievement(p_user_id, v_id);
end;
$$;

revoke all on function public.award_achievement(uuid, uuid) from public, anon;
revoke all on function public.award_achievement_by_slug(uuid, text) from public, anon;
grant execute on function public.award_achievement(uuid, uuid) to authenticated, service_role;
grant execute on function public.award_achievement_by_slug(uuid, text) to authenticated, service_role;

-- A learner may join a weekly league only as themselves.
create or replace function public.create_or_join_weekly_league(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_league_id uuid;
begin
  if auth.role() <> 'service_role' and p_user_id is distinct from auth.uid() then
    raise exception 'A league can only be joined for the signed-in account';
  end if;

  select id into v_league_id
  from public.weekly_leagues
  where is_active and week_start <= current_date and week_end >= current_date
  order by league_tier asc
  limit 1;

  if v_league_id is null then
    insert into public.weekly_leagues (
      league_name, league_tier, week_start, week_end
    ) values (
      'Bronze League', 1, date_trunc('week', now())::date,
      (date_trunc('week', now()) + interval '6 days')::date
    ) returning id into v_league_id;
  end if;

  insert into public.league_members (league_id, user_id)
  values (v_league_id, p_user_id)
  on conflict (league_id, user_id) do nothing;

  return v_league_id;
end;
$$;

revoke all on function public.create_or_join_weekly_league(uuid) from public, anon;
grant execute on function public.create_or_join_weekly_league(uuid) to authenticated, service_role;

-- Recurring mentorship changes are limited to the participating mentor or an
-- authorised organisation/platform administrator.
create or replace function public.generate_recurring_sessions(
  p_mentor_id uuid,
  p_learner_id uuid,
  p_start timestamptz,
  p_duration int,
  p_pattern text,
  p_end_date date
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
  v_current timestamptz := p_start;
  v_step interval;
begin
  if auth.role() <> 'service_role'
     and p_mentor_id is distinct from auth.uid()
     and not public.is_org_admin(auth.uid())
     and not public.is_super_admin(auth.uid()) then
    raise exception 'Not authorized to create recurring mentorship sessions';
  end if;

  if p_duration < 15 or p_duration > 480 then
    raise exception 'Session duration must be between 15 and 480 minutes';
  end if;
  if p_end_date < p_start::date or p_end_date > p_start::date + 366 then
    raise exception 'Recurrence end date is outside the allowed range';
  end if;

  v_step := case p_pattern
    when 'weekly' then interval '7 days'
    when 'biweekly' then interval '14 days'
    else null
  end;
  if v_step is null then
    raise exception 'Unsupported recurrence pattern';
  end if;

  while v_current::date <= p_end_date loop
    insert into public.mentorship_sessions (
      mentor_id, learner_id, scheduled_at, duration_minutes,
      is_recurring, recurrence_pattern, recurrence_end_date
    ) values (
      p_mentor_id, p_learner_id, v_current, p_duration,
      true, p_pattern, p_end_date
    );
    v_count := v_count + 1;
    v_current := v_current + v_step;
  end loop;

  return v_count;
end;
$$;

create or replace function public.cancel_recurring_sessions(p_parent_session_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_mentor_id uuid;
  v_learner_id uuid;
begin
  select mentor_id, learner_id
    into v_mentor_id, v_learner_id
  from public.mentorship_sessions
  where id = p_parent_session_id;

  if not found then
    raise exception 'Parent mentorship session not found';
  end if;

  if auth.role() <> 'service_role'
     and auth.uid() is distinct from v_mentor_id
     and auth.uid() is distinct from v_learner_id
     and not public.is_org_admin(auth.uid())
     and not public.is_super_admin(auth.uid()) then
    raise exception 'Not authorized to cancel these recurring sessions';
  end if;

  update public.mentorship_sessions
  set status = 'cancelled'
  where parent_session_id = p_parent_session_id
    and status not in ('completed', 'cancelled');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.generate_recurring_sessions(uuid, uuid, timestamptz, int, text, date) from public, anon;
revoke all on function public.cancel_recurring_sessions(uuid) from public, anon;
grant execute on function public.generate_recurring_sessions(uuid, uuid, timestamptz, int, text, date) to authenticated, service_role;
grant execute on function public.cancel_recurring_sessions(uuid) to authenticated, service_role;

-- Compliance refresh is an administrative operation, not a public mutation.
create or replace function public.refresh_compliance_status()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if auth.role() <> 'service_role'
     and not public.is_org_admin(auth.uid())
     and not public.is_super_admin(auth.uid()) then
    raise exception 'Not authorized to refresh compliance status';
  end if;

  update public.compliance_assignments
  set status = 'overdue'
  where status in ('pending', 'in_progress') and due_at < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.refresh_compliance_status() from public, anon;
grant execute on function public.refresh_compliance_status() to authenticated, service_role;

-- These routines are internal implementation details. Security-definer
-- callers and Edge Functions run as their owners/service role and continue to
-- work, while browsers can no longer invoke them directly.
revoke all on function public.log_admin_action(text, text, uuid, text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.log_admin_action(text, text, uuid, text, jsonb, jsonb, jsonb)
  to service_role;

do $$
declare
  v_signature regprocedure;
begin
  for v_signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'dispatch_org_webhooks'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to service_role', v_signature);
  end loop;
end;
$$;

revoke all on function public.record_academy_transaction(uuid, uuid, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.record_academy_transaction(uuid, uuid, text, text, text, bigint)
  to service_role;

revoke all on function public.record_and_grant_ai_credit_payment(text, text, text, uuid, uuid, integer, numeric, text)
  from public, anon, authenticated;
grant execute on function public.record_and_grant_ai_credit_payment(text, text, text, uuid, uuid, integer, numeric, text)
  to service_role;

-- Demo submissions must go through the validated/rate-limited Edge Function,
-- which uses the service role to reserve the slot atomically.
drop policy if exists demo_requests_public_insert on public.demo_requests;
drop policy if exists "demo_requests_public_insert" on public.demo_requests;
revoke insert on public.demo_requests from anon, authenticated;

do $$
begin
  if to_regprocedure(
    'public.reserve_demo_appointment(uuid,text,text,text,text,text,text,date,text,text,text,text,text,text)'
  ) is not null then
    execute 'revoke all on function public.reserve_demo_appointment(uuid,text,text,text,text,text,text,date,text,text,text,text,text,text) from public, anon, authenticated';
    execute 'grant execute on function public.reserve_demo_appointment(uuid,text,text,text,text,text,text,date,text,text,text,text,text,text) to service_role';
  end if;
end;
$$;

commit;
