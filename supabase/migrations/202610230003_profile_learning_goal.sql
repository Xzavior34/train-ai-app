begin;
-- A learner's stated interests are separate from assigned courses/cohorts.
create or replace function public.get_my_learning_goal() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$ begin
 if auth.uid() is null then raise exception 'Sign in to view your learning goal' using errcode='42501'; end if;
 return (select data->'learningGoal' from user_personalization where user_id=auth.uid());
end $$;
create or replace function public.save_my_learning_goal(p_track text,p_skill text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_goal jsonb; begin
 if auth.uid() is null then raise exception 'Sign in to save your learning goal' using errcode='42501'; end if;
 if nullif(trim(p_track),'') is null or nullif(trim(p_skill),'') is null or length(p_track)>120 or length(p_skill)>160 then raise exception 'Enter a track and a specific skill'; end if;
 v_goal := jsonb_build_object('track',trim(p_track),'skill',trim(p_skill),'updatedAt',now());
 insert into user_personalization(user_id,data,updated_at) values(auth.uid(),jsonb_build_object('learningGoal',v_goal),now())
 on conflict(user_id) do update set data=coalesce(user_personalization.data,'{}'::jsonb) || excluded.data,updated_at=now();
 return v_goal;
end $$;
revoke all on function public.get_my_learning_goal() from public,anon;
revoke all on function public.save_my_learning_goal(text,text) from public,anon;
grant execute on function public.get_my_learning_goal(),public.save_my_learning_goal(text,text) to authenticated,service_role;
create or replace function public.get_member_learning_interests(p_org_id uuid,p_user_id uuid,p_cohort_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$ begin
 if not (can_administer_organization(p_org_id) or (is_assigned_cohort_instructor(p_cohort_id) and exists(select 1 from cohort_members cm join cohorts c on c.id=cm.cohort_id where cm.cohort_id=p_cohort_id and cm.user_id=p_user_id and c.organization_id=p_org_id))) or not exists(select 1 from organization_members where organization_id=p_org_id and user_id=p_user_id) then raise exception 'Organization admin access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('cohort',c.name,'track',i.track,'specificSkill',i.specific_skill,'updatedAt',i.updated_at)) from cap_learning_intentions i join cohorts c on c.id=i.cohort_id where c.organization_id=p_org_id and i.user_id=p_user_id and i.track is not null and (can_administer_organization(p_org_id) or i.cohort_id=p_cohort_id)),'[]'::jsonb)
 || coalesce((select jsonb_build_array(jsonb_build_object('cohort','Profile learning goal','track',upref.data#>>'{learningGoal,track}','specificSkill',upref.data#>>'{learningGoal,skill}','updatedAt',upref.data#>>'{learningGoal,updatedAt}')) from user_personalization upref where upref.user_id=p_user_id and can_administer_organization(p_org_id) and upref.data#>>'{learningGoal,track}' is not null),'[]'::jsonb)
 || coalesce((select jsonb_build_array(jsonb_build_object('kind','registration','tracks',upref.data->'learningTracks','specificInterest',upref.data->'techInterest')) from user_personalization upref where upref.user_id=p_user_id and can_administer_organization(p_org_id) and (upref.data ? 'learningTracks' or upref.data ? 'techInterest')),'[]'::jsonb);
end $$;
create or replace function public.get_cap_workspace(p_cohort_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_staff boolean; v_admin boolean; begin
 if auth.uid() is null or not can_read_cohort_workspace(p_cohort_id) then raise exception 'Cohort access required' using errcode='42501'; end if;
 v_staff := can_manage_cap_cohort(p_cohort_id);
 select can_administer_organization(c.organization_id) into v_admin from cohorts c where c.id=p_cohort_id;
 return jsonb_build_object('selfRegistration',(select jsonb_build_object('goal',upref.data->'learningGoal','tracks',upref.data->'learningTracks','specificInterest',upref.data->'techInterest') from user_personalization upref where upref.user_id=auth.uid()),'canManage',v_staff,'isAdmin',v_admin,'cohort',(select to_jsonb(c) from cohorts c where c.id=p_cohort_id),
 'teams',coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'name',coalesce(up.display_name,m.name,'Team member'),'role',m.role)) from cap_team_members m left join user_profiles up on up.id=m.user_id where m.team_id=t.id),'[]'::jsonb)) order by t.created_at desc) from cap_teams t where t.cohort_id=p_cohort_id),'[]'::jsonb),
 'checkins',coalesce((select jsonb_agg(to_jsonb(ch) order by ch.checkin_date desc) from mentorship_checkins ch where ch.cohort_id=p_cohort_id and (not ch.is_private_admin or v_admin)),'[]'::jsonb),
 'intentions',coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('display_name',up.display_name) order by up.display_name) from cap_learning_intentions i join user_profiles up on up.id=i.user_id where i.cohort_id=p_cohort_id and (v_staff or i.user_id=auth.uid())),'[]'::jsonb),
 'members',case when v_staff then coalesce((select jsonb_agg(jsonb_build_object('user_id',cm.user_id,'name',up.display_name,'cohort_role',cm.cohort_role,'profile_goal',case when v_admin then (select upref.data->'learningGoal' from user_personalization upref where upref.user_id=cm.user_id) else null end,'registration_tracks',(select upref.data->'learningTracks' from user_personalization upref where upref.user_id=cm.user_id),'registration_interest',(select upref.data->'techInterest' from user_personalization upref where upref.user_id=cm.user_id))) from cohort_members cm join user_profiles up on up.id=cm.user_id where cm.cohort_id=p_cohort_id),'[]'::jsonb) else '[]'::jsonb end,
 'skillOptions',coalesce((select jsonb_agg(to_jsonb(o) order by o.track,o.skill) from cap_skill_options o where o.cohort_id=p_cohort_id and (o.is_active or v_admin)),'[]'::jsonb));
end $$;
notify pgrst,'reload schema';
commit;
