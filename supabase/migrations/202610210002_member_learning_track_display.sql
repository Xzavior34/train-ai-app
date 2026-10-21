-- Display shared catalog assignments and completed progress consistently.
-- Existing viewer and membership checks are retained.
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
      where v_admin and lpe.user_id = p_user_id and (lp.organization_id = p_org_id or lp.organization_id is null)
    union select ce.course_id from course_enrollments ce join courses c on c.id = ce.course_id
      where v_admin and ce.user_id = p_user_id and (c.organization_id = p_org_id or c.organization_id is null)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'courseId', c.id, 'title', c.title, 'category', c.category,
    'progress', least(100, greatest(0, coalesce(ce.progress_percentage,0))),
    'completedAt', ce.completed_at, 'enrolledAt', ce.enrolled_at,
    'status', case when ce.completed_at is not null or coalesce(ce.progress_percentage, 0) >= 100 then 'completed' when ce.enrolled_at is null then 'assigned' else 'in_progress' end
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
    where v_admin and lpe.user_id = p_user_id and (lp.organization_id = p_org_id or lp.organization_id is null);

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
    'completedCount', (select count(*) from jsonb_array_elements(v_courses) x where x->>'completedAt' is not null or (x->>'progress')::numeric >= 100),
    'avgProgress', (select coalesce(round(avg((x->>'progress')::numeric)),0) from jsonb_array_elements(v_courses) x));
end;
$$;
