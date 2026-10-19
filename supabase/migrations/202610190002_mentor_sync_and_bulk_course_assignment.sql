-- Keep role-based instructors synchronized with the mentors directory and
-- provide an atomic bulk course-assignment operation for cohort admins.

create or replace function public.refresh_mentor_directory_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_mentor boolean := false;
  v_organization_id uuid;
begin
  if p_user_id is null then
    return;
  end if;

  select
    coalesce(up.role::text = 'mentor', false)
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = p_user_id and ur.role::text = 'mentor'
      ),
    coalesce(
      (
        select om.organization_id
        from public.organization_members om
        where om.user_id = p_user_id and om.status = 'active'
        order by
          case om.role::text
            when 'owner' then 1
            when 'admin' then 2
            when 'content_manager' then 3
            else 4
          end,
          om.joined_at
        limit 1
      ),
      up.organization_id
    )
  into v_is_mentor, v_organization_id
  from public.user_profiles up
  where up.id = p_user_id;

  if not found then
    return;
  end if;

  if v_is_mentor then
    insert into public.mentors (
      user_id,
      organization_id,
      title,
      is_active,
      is_approved
    )
    values (
      p_user_id,
      v_organization_id,
      'Instructor',
      true,
      true
    )
    on conflict (user_id) do update
      set organization_id = coalesce(excluded.organization_id, mentors.organization_id),
          is_active = true,
          is_approved = true;
  else
    update public.mentors
    set is_active = false,
        is_approved = false
    where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.refresh_mentor_directory_for_user(uuid) from public, anon, authenticated;
grant execute on function public.refresh_mentor_directory_for_user(uuid) to service_role;

create or replace function public.sync_mentor_directory_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if tg_table_name = 'user_profiles' then
    v_user_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  end if;

  perform public.refresh_mentor_directory_for_user(v_user_id);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_mentor_from_profile on public.user_profiles;
create trigger trg_sync_mentor_from_profile
after insert or update or delete on public.user_profiles
for each row execute function public.sync_mentor_directory_trigger();

drop trigger if exists trg_sync_mentor_from_role on public.user_roles;
create trigger trg_sync_mentor_from_role
after insert or update or delete on public.user_roles
for each row execute function public.sync_mentor_directory_trigger();

drop trigger if exists trg_sync_mentor_from_membership on public.organization_members;
create trigger trg_sync_mentor_from_membership
after insert or update or delete on public.organization_members
for each row execute function public.sync_mentor_directory_trigger();

do $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct up.id
    from public.user_profiles up
    left join public.user_roles ur on ur.user_id = up.id
    where up.role::text = 'mentor' or ur.role::text = 'mentor'
  loop
    perform public.refresh_mentor_directory_for_user(v_user_id);
  end loop;
end;
$$;

create or replace function public.assign_course_to_cohort_members(
  p_cohort_id uuid,
  p_course_id uuid,
  p_user_ids uuid[] default null,
  p_assign_all boolean default false,
  p_due_at date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_user_ids uuid[] := array[]::uuid[];
  v_requested_count integer := 0;
  v_assigned_count integer := 0;
  v_new_assignment_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select c.organization_id into v_organization_id
  from public.cohorts c
  where c.id = p_cohort_id;

  if v_organization_id is null then
    raise exception 'Cohort not found';
  end if;

  if not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = v_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role::text in ('owner', 'admin', 'people_manager')
    )
  ) then
    raise exception 'Not authorized to assign courses for this cohort' using errcode = '42501';
  end if;

  if not exists (select 1 from public.courses c where c.id = p_course_id) then
    raise exception 'Course not found';
  end if;

  if p_assign_all then
    select coalesce(array_agg(distinct cm.user_id), array[]::uuid[])
    into v_user_ids
    from public.cohort_members cm
    where cm.cohort_id = p_cohort_id;
  else
    select count(distinct requested_id)
    into v_requested_count
    from unnest(coalesce(p_user_ids, array[]::uuid[])) requested_id;

    select coalesce(array_agg(distinct cm.user_id), array[]::uuid[])
    into v_user_ids
    from public.cohort_members cm
    join unnest(coalesce(p_user_ids, array[]::uuid[])) requested_id
      on requested_id = cm.user_id
    where cm.cohort_id = p_cohort_id;

    if cardinality(v_user_ids) <> v_requested_count then
      raise exception 'One or more selected learners do not belong to this cohort';
    end if;
  end if;

  v_assigned_count := cardinality(v_user_ids);
  if v_assigned_count = 0 then
    raise exception 'Select at least one learner before assigning this course';
  end if;

  insert into public.cohort_courses (cohort_id, course_id, due_at)
  values (p_cohort_id, p_course_id, p_due_at)
  on conflict (cohort_id, course_id) do update
    set due_at = excluded.due_at;

  with inserted as (
    insert into public.cohort_learner_courses (
      cohort_id,
      course_id,
      user_id,
      assigned_by
    )
    select p_cohort_id, p_course_id, selected_user_id, auth.uid()
    from unnest(v_user_ids) selected_user_id
    where not exists (
      select 1
      from public.cohort_learner_courses existing
      where existing.cohort_id = p_cohort_id
        and existing.course_id = p_course_id
        and existing.user_id = selected_user_id
    )
    returning id
  )
  select count(*) into v_new_assignment_count from inserted;

  insert into public.course_enrollments (
    user_id,
    course_id,
    enrolled_at,
    progress_percentage
  )
  select selected_user_id, p_course_id, now(), 0
  from unnest(v_user_ids) selected_user_id
  on conflict (user_id, course_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'assigned_count', v_assigned_count,
    'new_assignment_count', v_new_assignment_count,
    'scope', case when p_assign_all then 'cohort' else 'individuals' end
  );
end;
$$;

revoke all on function public.assign_course_to_cohort_members(uuid, uuid, uuid[], boolean, date) from public, anon;
grant execute on function public.assign_course_to_cohort_members(uuid, uuid, uuid[], boolean, date) to authenticated, service_role;

comment on function public.assign_course_to_cohort_members(uuid, uuid, uuid[], boolean, date) is
  'Atomically assigns one course to every learner in a cohort or to an authorized selected subset.';
