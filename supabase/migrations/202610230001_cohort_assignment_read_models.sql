-- Read the caller's saved assignments in one operation. No inferred enrollment,
-- organization changes, or access for unrelated users is introduced here.
create or replace function public.get_my_cohort_memberships()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to view your cohorts.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.cohort_members cm
    where cm.user_id = auth.uid() and not public.can_read_cohort_workspace(cm.cohort_id)
  ) then
    raise exception 'Your cohort assignment requires an active organization membership. Contact your administrator.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(cm) || jsonb_build_object('cohorts', to_jsonb(c)) order by cm.added_at desc, c.id)
    from public.cohort_members cm join public.cohorts c on c.id = cm.cohort_id
    where cm.user_id = auth.uid() and public.can_read_cohort_workspace(c.id)
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_my_cohort_memberships() from public, anon;
grant execute on function public.get_my_cohort_memberships() to authenticated, service_role;

-- Instructor identity belongs to the cohort assignment, rather than a user's
-- global role or email address. Keep the existing same-cohort access check.
create or replace function public.get_cohort_member_directory(p_cohort_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.can_read_cohort_workspace(p_cohort_id) then
    raise exception 'Not authorized to view this cohort' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', cm.id, 'cohort_id', cm.cohort_id, 'user_id', cm.user_id,
      'added_at', cm.added_at, 'cohort_role', cm.cohort_role,
      'user_profiles', jsonb_build_object(
        'id', up.id, 'display_name', coalesce(nullif(trim(up.display_name), ''), 'Cohort Member'),
        'avatar_url', up.avatar_url, 'role', up.role
      )
    ) order by lower(coalesce(nullif(trim(up.display_name), ''), 'cohort member')), cm.added_at)
    from public.cohort_members cm join public.user_profiles up on up.id = cm.user_id
    where cm.cohort_id = p_cohort_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_cohort_member_directory(uuid) from public, anon;
grant execute on function public.get_cohort_member_directory(uuid) to authenticated, service_role;
