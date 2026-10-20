-- Explicit teaching assignments; all privileged operations bind to auth.uid().
begin;

alter table public.cohort_members add column if not exists cohort_role text not null default 'learner'
  check (cohort_role in ('learner', 'instructor'));

-- Preserve existing instructors' memberships without treating every member as staff.
update public.cohort_members cm set cohort_role = 'instructor'
where exists (select 1 from public.user_roles ur where ur.user_id = cm.user_id and ur.role::text = 'mentor');

create or replace function public.can_administer_organization(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'super_admin')
    or exists (select 1 from organization_members where organization_id = p_org_id
      and user_id = auth.uid() and status = 'active' and role::text in ('owner', 'admin'))
  );
$$;

create or replace function public.is_assigned_cohort_instructor(p_cohort_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from cohort_members cm join cohorts c on c.id = cm.cohort_id
    join organization_members om on om.organization_id = c.organization_id and om.user_id = cm.user_id
    where cm.cohort_id = p_cohort_id and cm.user_id = auth.uid()
      and cm.cohort_role = 'instructor' and om.status = 'active'
      and exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'mentor')
  );
$$;

create or replace function public.can_teach_cohort(p_cohort_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from cohorts c where c.id = p_cohort_id
    and (can_administer_organization(c.organization_id) or is_assigned_cohort_instructor(c.id)));
$$;

create or replace function public.assign_cohort_instructor(p_cohort_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid;
begin
  select organization_id into v_org from cohorts where id = p_cohort_id for update;
  if v_org is null or not can_administer_organization(v_org) then
    raise exception 'Only an administrator of this organization can assign instructors.' using errcode = '42501';
  end if;
  if not exists (select 1 from organization_members where organization_id = v_org
    and user_id = p_user_id and status = 'active') then
    raise exception 'The instructor must be an active member of this organization.' using errcode = '42501';
  end if;
  insert into user_roles(user_id, role) values (p_user_id, 'mentor') on conflict do nothing;
  update user_profiles set role = 'mentor' where id = p_user_id and role::text = 'learner';
  perform refresh_mentor_directory_for_user(p_user_id);
  insert into cohort_members(cohort_id, user_id, added_by, cohort_role)
  values (p_cohort_id, p_user_id, auth.uid(), 'instructor')
  on conflict (cohort_id, user_id) do update set cohort_role = 'instructor', added_by = auth.uid();
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.get_my_workspace_roles()
returns text[] language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(array_agg(distinct role::text), array['learner']::text[])
  from user_roles where user_id = auth.uid();
$$;

create or replace function public.list_my_instructor_cohorts()
returns setof public.cohorts language sql stable security definer set search_path = public, pg_temp as $$
  select c.* from cohorts c where is_assigned_cohort_instructor(c.id)
    and (c.ends_at is null or c.ends_at >= current_date)
    and coalesce((to_jsonb(c)->>'is_archived')::boolean, false) = false
    and to_jsonb(c)->>'deleted_at' is null order by c.name;
$$;

-- Replace permissive legacy ALL policies (including self-enrollment) so direct
-- requests cannot self-promote or manage another cohort via global mentor status.
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public'
    and tablename in ('cohorts', 'cohort_members', 'cohort_resources', 'cohort_sessions')
  loop execute format('drop policy %I on public.%I', p.policyname, p.tablename); end loop;
end $$;

create or replace function public.can_read_cohort_workspace(p_cohort_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from cohorts c where c.id = p_cohort_id and
    (can_administer_organization(c.organization_id) or exists (
      select 1 from cohort_members cm join organization_members om
      on om.user_id = cm.user_id and om.organization_id = c.organization_id
      where cm.cohort_id = c.id and cm.user_id = auth.uid() and om.status = 'active')));
$$;

create policy cohort_read_scoped on public.cohorts for select to authenticated using (can_read_cohort_workspace(id));
create policy cohort_insert_admin on public.cohorts for insert to authenticated with check (can_administer_organization(organization_id) or
 (created_by=auth.uid() and has_role(auth.uid(),'mentor') and exists(select 1 from organization_members where organization_id=cohorts.organization_id and user_id=auth.uid() and status='active')));
create policy cohort_update_admin on public.cohorts for update to authenticated
  using (can_administer_organization(organization_id)) with check (can_administer_organization(organization_id));
create policy cohort_delete_admin on public.cohorts for delete to authenticated using (can_administer_organization(organization_id));
create policy cohort_members_read_scoped on public.cohort_members for select to authenticated using (can_read_cohort_workspace(cohort_id));
create policy cohort_members_admin on public.cohort_members for all to authenticated
  using (exists (select 1 from cohorts c where c.id = cohort_id and can_administer_organization(c.organization_id)))
  with check (exists (select 1 from cohorts c where c.id = cohort_id and can_administer_organization(c.organization_id)));
create policy cohort_resources_read_scoped on public.cohort_resources for select to authenticated using (can_read_cohort_workspace(cohort_id));
create policy cohort_resources_teach on public.cohort_resources for all to authenticated
  using (can_teach_cohort(cohort_id)) with check (can_teach_cohort(cohort_id));
create policy cohort_sessions_read_scoped on public.cohort_sessions for select to authenticated using (can_read_cohort_workspace(cohort_id));
create policy cohort_sessions_teach on public.cohort_sessions for all to authenticated
  using (can_teach_cohort(cohort_id)) with check (can_teach_cohort(cohort_id));

-- A narrow member record for admins or the student's explicitly assigned teacher.
-- The teacher receives only this cohort's coursework, never unrelated learning.
create or replace function public.get_member_learning_track(p_org_id uuid, p_user_id uuid, p_cohort_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_admin boolean; v_courses jsonb; v_paths jsonb; v_cohorts jsonb;
begin
  v_admin := can_administer_organization(p_org_id);
  if not exists (select 1 from organization_members where organization_id = p_org_id
    and user_id = p_user_id and (v_admin or status = 'active')) or not (
      v_admin or (is_assigned_cohort_instructor(p_cohort_id) and exists (
        select 1 from cohort_members cm join cohorts c on c.id = cm.cohort_id
        where cm.cohort_id = p_cohort_id and cm.user_id = p_user_id and c.organization_id = p_org_id))) then
    raise exception 'You cannot view this learner record.' using errcode = '42501';
  end if;

  with assigned as (
    select cc.course_id from cohort_courses cc join cohort_members cm on cm.cohort_id = cc.cohort_id
      join cohorts c on c.id = cm.cohort_id where cm.user_id = p_user_id and c.organization_id = p_org_id
        and (v_admin or c.id = p_cohort_id)
    union select clc.course_id from cohort_learner_courses clc join cohorts c on c.id = clc.cohort_id
      where clc.user_id = p_user_id and c.organization_id = p_org_id and (v_admin or c.id = p_cohort_id)
    union select lpc.course_id from learning_path_enrollments lpe join learning_paths lp on lp.id = lpe.path_id
      join learning_path_courses lpc on lpc.path_id = lp.id
      where v_admin and lpe.user_id = p_user_id and lp.organization_id = p_org_id
    union select ce.course_id from course_enrollments ce join courses c on c.id = ce.course_id
      where v_admin and ce.user_id = p_user_id and c.organization_id = p_org_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'courseId', c.id, 'title', c.title, 'category', c.category,
    'progress', least(100, greatest(0, coalesce(ce.progress_percentage,0))),
    'completedAt', ce.completed_at, 'enrolledAt', ce.enrolled_at,
    'status', case when ce.completed_at is not null then 'completed' when ce.enrolled_at is null then 'assigned' else 'in_progress' end
  ) order by c.title), '[]'::jsonb) into v_courses from assigned a join courses c on c.id = a.course_id
  left join course_enrollments ce on ce.course_id = c.id and ce.user_id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', lp.id, 'title', lp.title, 'status', lpe.status,
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title,
      'progress', least(100,greatest(0,coalesce(ce.progress_percentage,0))), 'completedAt', ce.completed_at,
      'orderIndex', lpc.order_index) order by lpc.order_index)
      from learning_path_courses lpc join courses c on c.id = lpc.course_id
      left join course_enrollments ce on ce.course_id = c.id and ce.user_id = p_user_id
      where lpc.path_id = lp.id), '[]'::jsonb))), '[]'::jsonb) into v_paths
    from learning_path_enrollments lpe join learning_paths lp on lp.id = lpe.path_id
    where v_admin and lpe.user_id = p_user_id and lp.organization_id = p_org_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'memberRowId', cm.id)), '[]'::jsonb)
    into v_cohorts from cohort_members cm join cohorts c on c.id = cm.cohort_id
    where cm.user_id = p_user_id and c.organization_id = p_org_id and (v_admin or c.id = p_cohort_id);
  return jsonb_build_object(
    'profile', (select case when v_admin then to_jsonb(up) else jsonb_build_object('id', id, 'display_name', display_name) end from user_profiles up where id = p_user_id),
    'membership', case when v_admin then (select to_jsonb(om) from organization_members om where user_id=p_user_id and organization_id=p_org_id) else null end,
    'roles', case when v_admin then (select coalesce(jsonb_agg(role::text),'[]'::jsonb) from user_roles where user_id=p_user_id) else '[]'::jsonb end,
    'certificates', case when v_admin then (select coalesce(jsonb_agg(to_jsonb(cert)), '[]'::jsonb) from certificates cert where user_id=p_user_id and organization_id=p_org_id) else '[]'::jsonb end,
    'stats', case when v_admin then (select to_jsonb(st) from user_gamification_stats st where user_id=p_user_id) else null end,
    'compliance', case when v_admin then (select coalesce(jsonb_agg(jsonb_build_object('id',ca.id,'title',c.title,'status',ca.status,'dueAt',ca.due_at,'completedAt',ca.completed_at)), '[]'::jsonb) from compliance_assignments ca join courses c on c.id=ca.course_id where ca.user_id=p_user_id and c.organization_id=p_org_id) else '[]'::jsonb end,
    'enrollments', v_courses, 'tracks', v_paths, 'cohorts', v_cohorts,
    'completedCount', (select count(*) from jsonb_array_elements(v_courses) x where x->>'completedAt' is not null),
    'avgProgress', (select coalesce(round(avg((x->>'progress')::numeric)),0) from jsonb_array_elements(v_courses) x));
end;
$$;

create or replace function public.get_instructor_cohort_workspace(p_cohort_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_org uuid;
begin
  select organization_id into v_org from cohorts where id = p_cohort_id;
  if not can_teach_cohort(p_cohort_id) then raise exception 'This cohort is not assigned to you.' using errcode = '42501'; end if;
  return jsonb_build_object('cohort', (select to_jsonb(c) from cohorts c where id = p_cohort_id),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', cm.id, 'user_id', cm.user_id,
      'display_name', up.display_name, 'cohort_role', cm.cohort_role))
      from cohort_members cm join user_profiles up on up.id = cm.user_id where cm.cohort_id = p_cohort_id), '[]'::jsonb),
    'resources', coalesce((select jsonb_agg(to_jsonb(r)) from cohort_resources r where cohort_id = p_cohort_id), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) order by s.starts_at) from cohort_sessions s where cohort_id = p_cohort_id), '[]'::jsonb));
end;
$$;

-- Definer entry points are never exposed to anonymous callers.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('can_administer_organization', 'is_assigned_cohort_instructor',
      'can_teach_cohort', 'can_read_cohort_workspace', 'assign_cohort_instructor', 'get_my_workspace_roles',
      'list_my_instructor_cohorts', 'get_member_learning_track', 'get_instructor_cohort_workspace')
  loop
    execute format('revoke all on function %s from public, anon', f.signature);
    execute format('grant execute on function %s to authenticated, service_role', f.signature);
  end loop;
end $$;
-- Existing resource/session/group helpers share the explicit teaching boundary.
create or replace function public.can_manage_cohort(p_cohort_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select can_teach_cohort(p_cohort_id);
$$;

create or replace function public.list_organization_instructors(p_org_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
 if not can_administer_organization(p_org_id) then raise exception 'Organization administrator required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',up.id,'name',up.display_name,'role','instructor'))
 from organization_members om join user_profiles up on up.id=om.user_id
 where om.organization_id=p_org_id and om.status='active' and exists(
 select 1 from user_roles ur where ur.user_id=up.id and ur.role::text='mentor')), '[]'::jsonb);
end $$;

create or replace function public.set_organization_member_role(p_org_id uuid,p_user_id uuid,p_role text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_current text;
begin
 if not can_administer_organization(p_org_id) or p_role not in ('learner','mentor','manager','admin') then
 raise exception 'Not authorized to change this role' using errcode='42501'; end if;
 select role::text into v_current from organization_members where organization_id=p_org_id and user_id=p_user_id and status='active' for update;
 if v_current is null or v_current='owner' or exists(select 1 from user_roles where user_id=p_user_id and role::text='super_admin') then
 raise exception 'This role must be managed by the platform owner' using errcode='42501'; end if;
 if (p_role='admin' or v_current='admin') and not (is_super_admin(auth.uid()) or exists(select 1 from organization_members where organization_id=p_org_id and user_id=auth.uid() and status='active' and role::text='owner')) then
 raise exception 'Only the organization owner can change administrator access' using errcode='42501'; end if;
 if exists(select 1 from organization_members where user_id=p_user_id and status='active' and organization_id<>p_org_id) then
 raise exception 'Multi-organization roles require platform owner review' using errcode='42501'; end if;
 delete from user_roles where user_id=p_user_id and role::text in ('learner','mentor','manager','admin');
 insert into user_roles(user_id,role) values(p_user_id,p_role::platform_role);
 update user_profiles set role=p_role::platform_role where id=p_user_id;
 update organization_members set role=(case p_role when 'admin' then 'admin' when 'manager' then 'people_manager' else 'member' end)::org_member_role
 where organization_id=p_org_id and user_id=p_user_id;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.list_organization_instructors(uuid), public.set_organization_member_role(uuid,uuid,text) from public,anon;
grant execute on function public.list_organization_instructors(uuid), public.set_organization_member_role(uuid,uuid,text) to authenticated;
create or replace function public.create_cohort_with_instructor(p_organization_id uuid,p_name text,p_starts_at date,p_ends_at date,p_program_name text,p_trial_status text,p_instructor_id uuid default null)
returns public.cohorts language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.cohorts; begin
 if auth.uid() is null or not (public.can_administer_org(p_organization_id) or (public.has_role(auth.uid(),'mentor') and exists(select 1 from public.organization_members where user_id=auth.uid() and organization_id=p_organization_id and status='active'))) then raise exception 'Not authorized to create this cohort'; end if;
 if nullif(trim(p_name),'') is null or length(p_name)>200 or p_starts_at is null or p_ends_at<=p_starts_at then raise exception 'Invalid cohort name or dates'; end if;
 if p_instructor_id is not null then
 if p_instructor_id is distinct from auth.uid() and not public.can_administer_org(p_organization_id) then raise exception 'Only organization administrators can assign another instructor'; end if;
 if not public.has_role(p_instructor_id,'mentor') or not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=p_instructor_id and status='active') then raise exception 'Instructor must be an active mentor in this organization'; end if;
 end if;
 insert into public.cohorts(organization_id,name,starts_at,ends_at,program_name,trial_status,status,created_by)
 values(p_organization_id,trim(p_name),p_starts_at,p_ends_at,p_program_name,p_trial_status,case when p_starts_at>current_date then 'Upcoming' else 'Active' end,auth.uid()) returning * into c;
 if p_instructor_id is not null then insert into public.cohort_members(cohort_id,user_id,added_by,cohort_role) values(c.id,p_instructor_id,auth.uid(),'instructor') on conflict(cohort_id,user_id) do update set cohort_role='instructor'; end if;
 return c;
end $$;
create or replace function public.add_cohort_creator_membership() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if new.created_by is not null and exists(select 1 from public.organization_members om where om.user_id=new.created_by and om.organization_id=new.organization_id and om.status='active') then
 insert into public.cohort_members(cohort_id,user_id,added_by,cohort_role) values(new.id,new.created_by,new.created_by,case when public.has_role(new.created_by,'mentor') then 'instructor' else 'learner' end) on conflict do nothing;
 end if; return new; end $$;
commit;
