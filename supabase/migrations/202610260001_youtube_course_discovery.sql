begin;
create table if not exists public.youtube_course_searches (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
 created_by uuid not null references user_profiles(id), prompt text not null check(length(prompt) between 5 and 1000),
 level text not null check(level in ('beginner','intermediate','advanced')), status text not null default 'searching',
 created_at timestamptz not null default now()
);
create index if not exists youtube_search_org_time on public.youtube_course_searches(organization_id,created_at);
create table if not exists public.youtube_course_suggestions (
 id uuid primary key default gen_random_uuid(), search_id uuid not null references youtube_course_searches(id),
 organization_id uuid not null references organizations(id), video_id text not null check(video_id ~ '^[A-Za-z0-9_-]{11}$'),
 title text not null, description text, channel_title text not null, duration_seconds integer not null check(duration_seconds>0),
 published_at timestamptz, reason text not null, cautions text, category text not null, level text not null,
 rank integer not null, verified_at timestamptz not null default now(), status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 course_id uuid references courses(id), reviewed_by uuid references user_profiles(id), reviewed_at timestamptz,
 unique(search_id,video_id)
);
create table if not exists public.youtube_course_imports (
 organization_id uuid not null references organizations(id), video_id text not null, course_id uuid not null references courses(id),
 primary key(organization_id,video_id)
);
alter table public.youtube_course_searches enable row level security;
alter table public.youtube_course_suggestions enable row level security;
alter table public.youtube_course_imports enable row level security;
drop policy if exists youtube_search_admin_read on public.youtube_course_searches;
create policy youtube_search_admin_read on public.youtube_course_searches for select to authenticated using(can_administer_organization(organization_id));
drop policy if exists youtube_suggestion_admin_read on public.youtube_course_suggestions;
create policy youtube_suggestion_admin_read on public.youtube_course_suggestions for select to authenticated using(can_administer_organization(organization_id));
drop policy if exists youtube_import_admin_read on public.youtube_course_imports;
create policy youtube_import_admin_read on public.youtube_course_imports for select to authenticated using(can_administer_organization(organization_id));
revoke all on public.youtube_course_searches,public.youtube_course_suggestions,public.youtube_course_imports from anon,authenticated;
grant select on public.youtube_course_searches,public.youtube_course_suggestions,public.youtube_course_imports to authenticated;
grant all on public.youtube_course_searches,public.youtube_course_suggestions,public.youtube_course_imports to service_role;

create or replace function public.begin_youtube_course_search(p_org_id uuid,p_prompt text,p_level text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if not can_administer_organization(p_org_id) then raise exception 'Organization admin access required' using errcode='42501'; end if;
 if p_level not in ('beginner','intermediate','advanced') or length(trim(p_prompt)) not between 5 and 1000 then raise exception 'Enter a course request between 5 and 1000 characters and a valid level'; end if;
 perform pg_advisory_xact_lock(hashtext('youtube-search:'||p_org_id::text));
 if (select count(*) from youtube_course_searches where organization_id=p_org_id and created_at>now()-interval '1 hour')>=10
 or (select count(*) from youtube_course_searches where organization_id=p_org_id and created_at>now()-interval '1 day')>=50 then
 raise exception 'Search limit reached. Please try again later.';
 end if;
 insert into youtube_course_searches(organization_id,created_by,prompt,level) values(p_org_id,auth.uid(),trim(p_prompt),p_level) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.review_youtube_course_suggestion(p_id uuid,p_decision text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s youtube_course_suggestions; v_course uuid; v_url text;
begin
 select * into s from youtube_course_suggestions where id=p_id for update;
 if not found or not can_administer_organization(s.organization_id) then raise exception 'Organization admin access required' using errcode='42501'; end if;
 if p_decision not in ('accept','reject','restore') then raise exception 'Invalid review decision'; end if;
 if s.status='accepted' then return s.course_id; end if;
 if p_decision='restore' then
 update youtube_course_suggestions set status='pending',reviewed_by=auth.uid(),reviewed_at=now() where id=p_id; return null;
 elsif p_decision='reject' then
 update youtube_course_suggestions set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where id=p_id; return null;
 end if;
 if s.verified_at<now()-interval '1 day' then raise exception 'This suggestion has expired. Search again to verify its availability.'; end if;
 perform pg_advisory_xact_lock(hashtext('youtube-import:'||s.organization_id::text||s.video_id));
 select course_id into v_course from youtube_course_imports where organization_id=s.organization_id and video_id=s.video_id;
 if v_course is null then
 v_url:='https://www.youtube.com/watch?v='||s.video_id;
 insert into courses(organization_id,instructor_id,title,description,category,level,duration_hours,price,is_published,is_approved,course_source,course_link,cover_image_url)
 values(s.organization_id,auth.uid(),s.title,coalesce(s.description,'')||E'\n\nSource: YouTube — '||s.channel_title,s.category,s.level,round(s.duration_seconds::numeric/3600,2),0,false,true,'external',v_url,'https://i.ytimg.com/vi/'||s.video_id||'/hqdefault.jpg') returning id into v_course;
 insert into lessons(course_id,title,description,video_url,duration_minutes,order_index,is_published)
 values(v_course,s.title,'Original course by '||s.channel_title||' on YouTube.',v_url,ceil(s.duration_seconds::numeric/60),0,true);
 insert into youtube_course_imports values(s.organization_id,s.video_id,v_course);
 end if;
 update youtube_course_suggestions set status='accepted',course_id=v_course,reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
 return v_course;
end; $$;

-- Explicit publication + assignment is atomic. Imports alone remain drafts.
create or replace function public.publish_assign_youtube_course(p_course_id uuid,p_user_ids uuid[] default '{}',p_cohort_id uuid default null)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_org uuid; v_ids uuid[]; v_count integer;
begin
 select c.organization_id into v_org from courses c join youtube_course_imports i on i.course_id=c.id where c.id=p_course_id and c.archived_at is null for update of c;
 if v_org is null or not can_administer_organization(v_org) then raise exception 'Organization admin access required' using errcode='42501'; end if;
 if p_cohort_id is not null then
 if not exists(select 1 from cohorts where id=p_cohort_id and organization_id=v_org) then raise exception 'Choose a cohort from this organization'; end if;
 select coalesce(array_agg(distinct cm.user_id),'{}') into v_ids from cohort_members cm join organization_members om on om.user_id=cm.user_id and om.organization_id=v_org
 where cm.cohort_id=p_cohort_id and cm.cohort_role='learner' and om.status='active';
 else
 select coalesce(array_agg(distinct x),'{}') into v_ids from unnest(coalesce(p_user_ids,'{}')) x;
 end if;
 v_count:=cardinality(v_ids);
 if v_count=0 then raise exception 'Select at least one active learner'; end if;
 if exists(select 1 from unnest(v_ids) x where not exists(select 1 from organization_members om where om.organization_id=v_org and om.user_id=x and om.status='active')) then raise exception 'All learners must be active members of this organization'; end if;
 update courses set is_published=true,is_approved=true where id=p_course_id;
 insert into course_enrollments(user_id,course_id) select x,p_course_id from unnest(v_ids) x on conflict(user_id,course_id) do nothing;
 if p_cohort_id is not null then
 insert into cohort_courses(cohort_id,course_id) values(p_cohort_id,p_course_id) on conflict(cohort_id,course_id) do nothing;
 insert into cohort_learner_courses(cohort_id,user_id,course_id,assigned_by) select p_cohort_id,x,p_course_id,auth.uid() from unnest(v_ids) x
 where not exists(select 1 from cohort_learner_courses lc where lc.cohort_id=p_cohort_id and lc.user_id=x and lc.course_id=p_course_id) on conflict do nothing;
 end if;
 return v_count;
end; $$;

create or replace function public.get_youtube_course_assignment_targets(p_org_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not can_administer_organization(p_org_id) then raise exception 'Organization admin access required' using errcode='42501'; end if;
 return jsonb_build_object('cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from cohorts where organization_id=p_org_id),'[]'),
 'learners',coalesce((select jsonb_agg(jsonb_build_object('id',om.user_id,'name',coalesce(nullif(up.display_name,''),'Unnamed learner')) order by up.display_name)
 from organization_members om join user_profiles up on up.id=om.user_id where om.organization_id=p_org_id and om.status='active' and om.role::text='member'),'[]'));
end; $$;
revoke all on function public.begin_youtube_course_search(uuid,text,text),public.review_youtube_course_suggestion(uuid,text),public.publish_assign_youtube_course(uuid,uuid[],uuid),public.get_youtube_course_assignment_targets(uuid) from public,anon;
grant execute on function public.begin_youtube_course_search(uuid,text,text),public.review_youtube_course_suggestion(uuid,text),public.publish_assign_youtube_course(uuid,uuid[],uuid),public.get_youtube_course_assignment_targets(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
