begin;
-- CAP workspace storage. No sample teams, scores or learner choices are inserted.
create table if not exists public.cap_teams (
 id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.cohorts(id) on delete cascade,
 organization_id uuid not null references public.organizations(id), name text not null, project_title text not null,
 problem_statement text, technologies text[] not null default '{}', github_url text, demo_url text, presentation_url text,
 demo_video_url text, screenshot_url text, mentor_id uuid, mentor_name text, phase text not null default 'LEARN',
 demo_day_status text not null default 'Draft', final_score numeric(5,2), judges_feedback text, mentor_feedback text,
 is_archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.cap_teams add column if not exists is_archived boolean not null default false;
alter table public.cap_teams alter column final_score type numeric(5,2);
create table if not exists public.cap_team_members (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.cap_teams(id) on delete cascade,
 user_id uuid not null references public.user_profiles(id), name text, role text not null, joined_at timestamptz not null default now(), unique(team_id,user_id)
);
create table if not exists public.mentorship_checkins (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.cap_teams(id), cohort_id uuid not null references public.cohorts(id),
 team_name text, mentor_id uuid, mentor_name text, checkin_date date not null default current_date, notes text not null,
 progress_rating int not null check(progress_rating between 1 and 5), issues_blockers text, recommended_actions text,
 next_checkin_date date, is_private_admin boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.cap_learning_intentions (
 cohort_id uuid not null references public.cohorts(id), user_id uuid not null references public.user_profiles(id),
 track text, specific_skill text, problem_title text, problem_statement text,
 review_status text not null default 'Not submitted' check(review_status in ('Not submitted','Submitted','Reviewed','Changes requested')),
 review_feedback text, reviewed_by uuid, updated_at timestamptz not null default now(), primary key(cohort_id,user_id)
);
create table if not exists public.cap_skill_options (
 id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.cohorts(id), track text not null, skill text not null,
 is_active boolean not null default true, unique(cohort_id,track,skill)
);
create index if not exists cap_teams_cohort_idx on public.cap_teams(cohort_id);
create index if not exists cap_checkins_cohort_idx on public.mentorship_checkins(cohort_id);
create index if not exists cap_intentions_user_idx on public.cap_learning_intentions(user_id);
-- This helper follows the current organization admin and assigned instructor rules.
create or replace function public.can_manage_cap_cohort(p_cohort_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from cohorts c where c.id=p_cohort_id and (can_administer_organization(c.organization_id) or is_assigned_cohort_instructor(c.id)));
$$;
do $$ declare p record; t text; begin
 for t in select unnest(array['cap_teams','cap_team_members','mentorship_checkins','cap_learning_intentions','cap_skill_options']) loop
  execute format('alter table public.%I enable row level security',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy cap_read_workspace on public.cap_teams for select to authenticated using(can_read_cohort_workspace(cohort_id));
create policy cap_members_read_workspace on public.cap_team_members for select to authenticated using(exists(select 1 from cap_teams t where t.id=team_id and can_read_cohort_workspace(t.cohort_id)));
create policy cap_checkins_read_workspace on public.mentorship_checkins for select to authenticated using(can_read_cohort_workspace(cohort_id) and (not is_private_admin or exists(select 1 from cohorts c where c.id=cohort_id and can_administer_organization(c.organization_id))));
create policy cap_intentions_read_workspace on public.cap_learning_intentions for select to authenticated using(can_read_cohort_workspace(cohort_id) and (user_id=auth.uid() or can_manage_cap_cohort(cohort_id)));
create policy cap_options_read_workspace on public.cap_skill_options for select to authenticated using(can_read_cohort_workspace(cohort_id));

create or replace function public.get_cap_workspace(p_cohort_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_staff boolean; v_admin boolean; begin
 if auth.uid() is null or not can_read_cohort_workspace(p_cohort_id) then raise exception 'Cohort access required' using errcode='42501'; end if;
 v_staff := can_manage_cap_cohort(p_cohort_id);
 select can_administer_organization(c.organization_id) into v_admin from cohorts c where c.id=p_cohort_id;
 return jsonb_build_object('selfRegistration',(select jsonb_build_object('tracks',upref.data->'learningTracks','specificInterest',upref.data->'techInterest') from user_personalization upref where upref.user_id=auth.uid()),'canManage',v_staff,'isAdmin',v_admin,'cohort',(select to_jsonb(c) from cohorts c where c.id=p_cohort_id),
 'teams',coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'name',coalesce(up.display_name,m.name,'Team member'),'role',m.role)) from cap_team_members m left join user_profiles up on up.id=m.user_id where m.team_id=t.id),'[]'::jsonb)) order by t.created_at desc) from cap_teams t where t.cohort_id=p_cohort_id),'[]'::jsonb),
 'checkins',coalesce((select jsonb_agg(to_jsonb(ch) order by ch.checkin_date desc) from mentorship_checkins ch where ch.cohort_id=p_cohort_id and (not ch.is_private_admin or v_admin)),'[]'::jsonb),
 'intentions',coalesce((select jsonb_agg(to_jsonb(i) || jsonb_build_object('display_name',up.display_name) order by up.display_name) from cap_learning_intentions i join user_profiles up on up.id=i.user_id where i.cohort_id=p_cohort_id and (v_staff or i.user_id=auth.uid())),'[]'::jsonb),
 'members',case when v_staff then coalesce((select jsonb_agg(jsonb_build_object('user_id',cm.user_id,'name',up.display_name,'cohort_role',cm.cohort_role,'registration_tracks',(select upref.data->'learningTracks' from user_personalization upref where upref.user_id=cm.user_id),'registration_interest',(select upref.data->'techInterest' from user_personalization upref where upref.user_id=cm.user_id))) from cohort_members cm join user_profiles up on up.id=cm.user_id where cm.cohort_id=p_cohort_id),'[]'::jsonb) else '[]'::jsonb end,
 'skillOptions',coalesce((select jsonb_agg(to_jsonb(o) order by o.track,o.skill) from cap_skill_options o where o.cohort_id=p_cohort_id and (o.is_active or v_admin)),'[]'::jsonb));
end $$;

create or replace function public.save_my_cap_learning_goal(p_cohort_id uuid,p_track text,p_skill text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r cap_learning_intentions; begin
 if auth.uid() is null or not can_read_cohort_workspace(p_cohort_id) then raise exception 'Cohort access required' using errcode='42501'; end if;
 if not exists(select 1 from cap_skill_options where cohort_id=p_cohort_id and track=p_track and skill=p_skill and is_active) then raise exception 'Choose an available track and specific skill'; end if;
 insert into cap_learning_intentions(cohort_id,user_id,track,specific_skill) values(p_cohort_id,auth.uid(),p_track,p_skill)
 on conflict(cohort_id,user_id) do update set track=excluded.track,specific_skill=excluded.specific_skill,updated_at=now() returning * into r;
 return to_jsonb(r);
end $$;
create or replace function public.save_my_cap_problem(p_cohort_id uuid,p_title text,p_statement text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r cap_learning_intentions; begin
 if auth.uid() is null or not can_read_cohort_workspace(p_cohort_id) then raise exception 'Cohort access required' using errcode='42501'; end if;
 if nullif(trim(p_statement),'') is null or length(p_statement)>20000 or length(p_title)>300 then raise exception 'Enter a problem statement of up to 20,000 characters'; end if;
 insert into cap_learning_intentions(cohort_id,user_id,problem_title,problem_statement,review_status) values(p_cohort_id,auth.uid(),trim(p_title),trim(p_statement),'Submitted')
 on conflict(cohort_id,user_id) do update set problem_title=excluded.problem_title,problem_statement=excluded.problem_statement,review_status='Submitted',review_feedback=null,reviewed_by=null,updated_at=now() returning * into r;
 return to_jsonb(r);
end $$;
create or replace function public.review_cap_problem(p_cohort_id uuid,p_user_id uuid,p_status text,p_feedback text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not can_manage_cap_cohort(p_cohort_id) then raise exception 'Assigned staff access required' using errcode='42501'; end if;
 if p_status not in ('Reviewed','Changes requested') then raise exception 'Choose a review status'; end if;
 update cap_learning_intentions set review_status=p_status,review_feedback=left(p_feedback,20000),reviewed_by=auth.uid(),updated_at=now() where cohort_id=p_cohort_id and user_id=p_user_id and problem_statement is not null;
 if not found then raise exception 'No submitted problem statement'; end if;
end $$;
create or replace function public.save_cap_skill_option(p_cohort_id uuid,p_track text,p_skill text,p_active boolean default true) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if not exists(select 1 from cohorts c where c.id=p_cohort_id and can_administer_organization(c.organization_id)) then raise exception 'Organization admin access required' using errcode='42501'; end if;
 if nullif(trim(p_track),'') is null or nullif(trim(p_skill),'') is null or length(p_track)>120 or length(p_skill)>160 then raise exception 'Enter a track and specific skill'; end if;
 insert into cap_skill_options(cohort_id,track,skill,is_active) values(p_cohort_id,trim(p_track),trim(p_skill),p_active) on conflict(cohort_id,track,skill) do update set is_active=excluded.is_active;
end $$;
create or replace function public.register_my_cap_team(p_cohort_id uuid,p_name text,p_project_title text,p_problem_statement text,p_technologies text[],p_role text) returns public.cap_teams language plpgsql security definer set search_path=public,pg_temp as $$
declare t cap_teams; v_org uuid; begin
 if auth.uid() is null or not can_read_cohort_workspace(p_cohort_id) then raise exception 'Cohort access required' using errcode='42501'; end if;
 if nullif(trim(p_name),'') is null or nullif(trim(p_project_title),'') is null or length(p_name)>200 or length(p_project_title)>300 or length(p_role)>120 then raise exception 'Enter valid team, project and role names'; end if;
 select organization_id into v_org from cohorts where id=p_cohort_id;
 insert into cap_teams(cohort_id,organization_id,name,project_title,problem_statement,technologies) values(p_cohort_id,v_org,trim(p_name),trim(p_project_title),left(p_problem_statement,20000),p_technologies) returning * into t;
 if not can_manage_cap_cohort(p_cohort_id) then insert into cap_team_members(team_id,user_id,name,role) select t.id,auth.uid(),display_name,coalesce(nullif(trim(p_role),''),'Team member') from user_profiles where id=auth.uid(); end if;
 return t;
end $$;
create or replace function public.set_cap_team_member(p_team_id uuid,p_user_id uuid,p_role text,p_remove boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_cohort uuid; begin
 select cohort_id into v_cohort from cap_teams where id=p_team_id and not is_archived;
 if v_cohort is null or not can_read_cohort_workspace(v_cohort) or (p_user_id is distinct from auth.uid() and not can_manage_cap_cohort(v_cohort)) then raise exception 'Team access required' using errcode='42501'; end if;
 if p_remove then delete from cap_team_members where team_id=p_team_id and user_id=p_user_id; return; end if;
 if not exists(select 1 from cohort_members cm join cohorts c on c.id=cm.cohort_id join organization_members om on om.organization_id=c.organization_id and om.user_id=cm.user_id and om.status='active' where cm.cohort_id=v_cohort and cm.user_id=p_user_id) then raise exception 'Team members must be active members of this cohort'; end if;
 if nullif(trim(p_role),'') is null or length(p_role)>120 then raise exception 'Enter a valid team role'; end if;
 insert into cap_team_members(team_id,user_id,name,role) select p_team_id,p_user_id,display_name,trim(p_role) from user_profiles where id=p_user_id on conflict(team_id,user_id) do update set role=excluded.role,name=excluded.name;
end $$;
create or replace function public.update_cap_team(p_team_id uuid,p_patch jsonb) returns public.cap_teams language plpgsql security definer set search_path=public,pg_temp as $$
declare t cap_teams; r cap_teams; staff boolean; mentor_name_value text; k text; begin
 select * into t from cap_teams where id=p_team_id for update;
 if t.id is null or not can_read_cohort_workspace(t.cohort_id) then raise exception 'Team access required' using errcode='42501'; end if;
 staff := can_manage_cap_cohort(t.cohort_id);
 if not staff and not exists(select 1 from cap_team_members where team_id=t.id and user_id=auth.uid()) then raise exception 'Team membership required' using errcode='42501'; end if;
 for k in select jsonb_object_keys(p_patch) loop if k not in ('name','project_title','problem_statement','technologies','github_url','demo_url','presentation_url','demo_video_url','screenshot_url','mentor_id','mentor_name','phase','demo_day_status','final_score','judges_feedback','mentor_feedback','is_archived') then raise exception 'Unsupported team field'; end if; end loop;
 if not staff and exists(select 1 from jsonb_each(p_patch) e where e.key in ('mentor_id','mentor_name','phase','demo_day_status','final_score','judges_feedback','mentor_feedback','is_archived') and e.value is distinct from to_jsonb(t)->e.key) then raise exception 'Only assigned staff can manage phases, mentors and reviews' using errcode='42501'; end if;
 r := jsonb_populate_record(t,p_patch);
 if nullif(trim(r.name),'') is null or nullif(trim(r.project_title),'') is null or length(r.name)>200 or length(r.project_title)>300 then raise exception 'Team and project names are required'; end if;
 if r.phase not in ('LEARN','BUILD','LAUNCH') or r.demo_day_status not in ('Draft','Pending Review','Demo Day Ready','Featured','Completed','Needs Revision') then raise exception 'Invalid phase or review status'; end if;
 if r.final_score is not null and (r.final_score<0 or r.final_score>100) then raise exception 'Score must be between 0 and 100'; end if;
 foreach k in array array[r.github_url,r.demo_url,r.presentation_url,r.demo_video_url,r.screenshot_url] loop if coalesce(k,'')<>'' and k !~* '^https?://[^[:space:]@]+' then raise exception 'Project links must use http or https'; end if; end loop;
 if r.mentor_id is not null then
  select up.display_name into mentor_name_value from cohort_members cm join user_profiles up on up.id=cm.user_id join cohorts c on c.id=cm.cohort_id join organization_members om on om.organization_id=c.organization_id and om.user_id=cm.user_id and om.status='active' where cm.cohort_id=t.cohort_id and cm.user_id=r.mentor_id and cm.cohort_role='instructor';
  if not found then raise exception 'Choose an instructor assigned to this cohort'; end if;
 end if;
 update cap_teams set name=r.name,project_title=r.project_title,problem_statement=r.problem_statement,technologies=r.technologies,github_url=r.github_url,demo_url=r.demo_url,presentation_url=r.presentation_url,demo_video_url=r.demo_video_url,screenshot_url=r.screenshot_url,mentor_id=r.mentor_id,mentor_name=mentor_name_value,phase=r.phase,demo_day_status=r.demo_day_status,final_score=r.final_score,judges_feedback=r.judges_feedback,mentor_feedback=r.mentor_feedback,is_archived=r.is_archived,updated_at=now() where id=t.id returning * into r;
 return r;
end $$;
create or replace function public.save_cap_checkin(p_team_id uuid,p_checkin_date date,p_notes text,p_rating int,p_blockers text default '',p_actions text default '',p_next_date date default null,p_private boolean default false) returns public.mentorship_checkins language plpgsql security definer set search_path=public,pg_temp as $$
declare t cap_teams; r mentorship_checkins; v_name text; begin
 select * into t from cap_teams where id=p_team_id;
 if t.id is null or not can_manage_cap_cohort(t.cohort_id) then raise exception 'Assigned staff access required' using errcode='42501'; end if;
 if p_private and not can_administer_organization(t.organization_id) then raise exception 'Only organization admins can write private admin notes' using errcode='42501'; end if;
 if nullif(trim(p_notes),'') is null or length(p_notes)>20000 or p_rating not between 1 and 5 or p_checkin_date is null or (p_next_date is not null and p_next_date<p_checkin_date) then raise exception 'Enter valid check-in notes, rating and dates'; end if;
 select display_name into v_name from user_profiles where id=auth.uid();
 insert into mentorship_checkins(team_id,cohort_id,team_name,mentor_id,mentor_name,checkin_date,notes,progress_rating,issues_blockers,recommended_actions,next_checkin_date,is_private_admin) values(t.id,t.cohort_id,t.name,auth.uid(),v_name,p_checkin_date,trim(p_notes),p_rating,p_blockers,p_actions,p_next_date,p_private) returning * into r;
 return r;
end $$;
create or replace function public.get_member_learning_interests(p_org_id uuid,p_user_id uuid,p_cohort_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$ begin
 if not (can_administer_organization(p_org_id) or (is_assigned_cohort_instructor(p_cohort_id) and exists(select 1 from cohort_members cm join cohorts c on c.id=cm.cohort_id where cm.cohort_id=p_cohort_id and cm.user_id=p_user_id and c.organization_id=p_org_id))) or not exists(select 1 from organization_members where organization_id=p_org_id and user_id=p_user_id) then raise exception 'Organization admin access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('cohort',c.name,'track',i.track,'specificSkill',i.specific_skill,'updatedAt',i.updated_at)) from cap_learning_intentions i join cohorts c on c.id=i.cohort_id where c.organization_id=p_org_id and i.user_id=p_user_id and i.track is not null and (can_administer_organization(p_org_id) or i.cohort_id=p_cohort_id)),'[]'::jsonb) || coalesce((select jsonb_build_array(jsonb_build_object('kind','registration','tracks',upref.data->'learningTracks','specificInterest',upref.data->'techInterest')) from user_personalization upref where upref.user_id=p_user_id and can_administer_organization(p_org_id) and (upref.data ? 'learningTracks' or upref.data ? 'techInterest')),'[]'::jsonb);
end $$;
-- Defaults are available choices, never inferred learner selections.
insert into cap_skill_options(cohort_id,track,skill)
select c.id,o.track,o.skill from cohorts c cross join (values ('Code','Frontend development'),('Code','Backend development'),('Code','Full-stack development'),('Code','Mobile development'),('Code','Cloud and DevOps'),('No Code','UI/UX design'),('No Code','Product management'),('No Code','Data analysis'),('No Code','Digital marketing'),('Tech Entrepreneurship','Business development'),('Tech Entrepreneurship','Product strategy'),('General Soft Skills','Communication'),('General Soft Skills','Leadership')) o(track,skill) where c.name ~* 'CAP.*(Cohort[[:space:]]*)?3' on conflict(cohort_id,track,skill) do nothing;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('can_manage_cap_cohort','get_cap_workspace','save_my_cap_learning_goal','save_my_cap_problem','review_cap_problem','save_cap_skill_option','register_my_cap_team','set_cap_team_member','update_cap_team','save_cap_checkin','get_member_learning_interests') loop
 execute format('revoke all on function %s from public,anon',f.signature); execute format('grant execute on function %s to authenticated,service_role',f.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
