begin;
-- CAP records inherit cohort access, including team membership and private check-ins.
create or replace function public.is_cap_team_member(p_team_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.cap_team_members where team_id=p_team_id and user_id=auth.uid());
$$;
revoke all on function public.is_cap_team_member(uuid) from public,anon;
grant execute on function public.is_cap_team_member(uuid) to authenticated;
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('cap_teams','cap_team_members','mentorship_checkins') loop
 execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;
end $$;
create policy cap_read_enrolled on public.cap_teams for select to authenticated using(public.can_access_cohort(cohort_id));
create policy cap_update_members on public.cap_teams for update to authenticated using(public.can_manage_cohort(cohort_id) or (public.can_access_cohort(cohort_id) and public.is_cap_team_member(id))) with check(public.can_access_cohort(cohort_id));
create policy cap_delete_staff on public.cap_teams for delete to authenticated using(public.can_manage_cohort(cohort_id));
create policy cap_members_read on public.cap_team_members for select to authenticated using(exists(select 1 from public.cap_teams t where t.id=team_id and public.can_access_cohort(t.cohort_id)));
create policy cap_members_join on public.cap_team_members for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.cap_teams t where t.id=team_id and public.can_access_cohort(t.cohort_id)));
create policy cap_members_leave on public.cap_team_members for delete to authenticated using(user_id=auth.uid());
create policy cap_members_staff on public.cap_team_members for all to authenticated using(exists(select 1 from public.cap_teams t where t.id=team_id and public.can_manage_cohort(t.cohort_id))) with check(exists(select 1 from public.cap_teams t where t.id=team_id and public.can_manage_cohort(t.cohort_id)));
create policy cap_checkins_read on public.mentorship_checkins for select to authenticated using(public.can_access_cohort(cohort_id) and (not is_private_admin or public.can_manage_cohort(cohort_id)));
create policy cap_checkins_manage on public.mentorship_checkins for all to authenticated using(public.can_manage_cohort(cohort_id)) with check(public.can_manage_cohort(cohort_id) and exists(select 1 from public.cap_teams t where t.id=team_id and t.cohort_id=mentorship_checkins.cohort_id));
create or replace function public.protect_cap_team_fields() returns trigger
language plpgsql set search_path=public,pg_temp as $$ begin
 if current_user='authenticated' then
 if new.cohort_id is distinct from old.cohort_id or new.organization_id is distinct from old.organization_id then raise exception 'Team scope cannot be changed'; end if;
 if not public.can_manage_cohort(old.cohort_id) and (
 new.final_score is distinct from old.final_score or new.judges_feedback is distinct from old.judges_feedback
 or new.mentor_feedback is distinct from old.mentor_feedback or new.mentor_id is distinct from old.mentor_id or new.mentor_name is distinct from old.mentor_name
 or (new.demo_day_status is distinct from old.demo_day_status and new.demo_day_status not in ('Draft','Pending Review'))
 ) then raise exception 'Only assigned staff can review or assign mentors'; end if;
 end if; return new;
end $$;
create trigger protect_cap_team_fields before update on public.cap_teams for each row execute function public.protect_cap_team_fields();
create or replace function public.register_my_cap_team(p_cohort_id uuid,p_name text,p_project_title text,p_problem_statement text,p_technologies text[],p_role text)
returns public.cap_teams language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.cap_teams; v_org uuid; v_name text; begin
 if auth.uid() is null or not public.can_access_cohort(p_cohort_id) then raise exception 'Cohort enrollment required'; end if;
 if nullif(trim(p_name),'') is null or length(p_name)>200 or nullif(trim(p_project_title),'') is null then raise exception 'Team and project names are required'; end if;
 select organization_id into v_org from public.cohorts where id=p_cohort_id;
 select display_name into v_name from public.user_profiles where id=auth.uid();
 insert into public.cap_teams(cohort_id,organization_id,name,project_title,problem_statement,technologies,phase,demo_day_status)
 values(p_cohort_id,v_org,trim(p_name),trim(p_project_title),p_problem_statement,p_technologies,'BUILD','Pending Review') returning * into t;
 insert into public.cap_team_members(team_id,user_id,name,role) values(t.id,auth.uid(),v_name,p_role);
 return t;
end $$;
revoke all on function public.register_my_cap_team(uuid,text,text,text,text[],text) from public,anon;
grant execute on function public.register_my_cap_team(uuid,text,text,text,text[],text) to authenticated;

create or replace function public.list_my_learner_activity_alerts()
returns table(name text,days int,risk text,avatar text) language sql stable security definer set search_path=public,pg_temp as $$
 select distinct up.display_name,case when up.last_active_at is null then null else greatest(0,extract(day from now()-up.last_active_at)::int) end,
 case when up.last_active_at<now()-interval '7 days' then 'high' else 'medium' end,up.avatar_url
 from public.user_profiles up join public.cohort_members cm on cm.user_id=up.id
 where up.role='learner' and public.has_role(auth.uid(),'mentor') and public.can_access_cohort(cm.cohort_id)
 and exists(select 1 from public.cohort_members mine where mine.cohort_id=cm.cohort_id and mine.user_id=auth.uid())
 and (up.last_active_at is null or up.last_active_at<now()-interval '3 days') limit 6;
$$;
revoke all on function public.list_my_learner_activity_alerts() from public,anon;
grant execute on function public.list_my_learner_activity_alerts() to authenticated;
commit;
