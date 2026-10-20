-- Forward-only repair; no user/content deletion. Apply to staging before production.
begin;

create or replace function public.can_administer_org(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select auth.uid() is not null and (public.is_super_admin(auth.uid()) or exists (
   select 1 from public.organization_members where organization_id=p_org_id
   and user_id=auth.uid() and status='active' and role in ('owner','admin')
 ));
$$;
create or replace function public.can_access_cohort(p_cohort_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.cohorts c where c.id=p_cohort_id and (
   public.can_administer_org(c.organization_id) or exists (
     select 1 from public.cohort_members cm join public.organization_members om
       on om.user_id=cm.user_id and om.organization_id=c.organization_id and om.status='active'
     where cm.cohort_id=c.id and cm.user_id=auth.uid()
   )
 ));
$$;
create or replace function public.can_manage_cohort(p_cohort_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.cohorts c where c.id=p_cohort_id and (
   public.can_administer_org(c.organization_id) or (
     public.has_role(auth.uid(),'mentor') and public.can_access_cohort(c.id)
   )
 ));
$$;
revoke all on function public.can_administer_org(uuid), public.can_access_cohort(uuid), public.can_manage_cohort(uuid) from public,anon;
grant execute on function public.can_administer_org(uuid), public.can_access_cohort(uuid), public.can_manage_cohort(uuid) to authenticated;

-- Replace permissive OR-combined legacy rules on these four assignment tables.
-- Helpers are SECURITY DEFINER to avoid cohorts <-> cohort_members RLS recursion.
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public'
 and tablename in ('cohorts','cohort_members','cohort_resources','cohort_sessions') loop
 execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
create policy cohorts_read_assigned on public.cohorts for select to authenticated using(public.can_access_cohort(id));
create policy cohorts_create_authorized on public.cohorts for insert to authenticated with check (
 public.can_administer_org(organization_id) or (
   created_by=auth.uid() and public.has_role(auth.uid(),'mentor') and exists (
    select 1 from public.organization_members om where om.organization_id=cohorts.organization_id and om.user_id=auth.uid() and om.status='active'
   )
 ));
create policy cohorts_update_assigned on public.cohorts for update to authenticated using(public.can_manage_cohort(id)) with check(public.can_manage_cohort(id));
create policy cohorts_delete_admin on public.cohorts for delete to authenticated using(public.can_administer_org(organization_id));
create policy cm_read_assigned on public.cohort_members for select to authenticated using(public.can_access_cohort(cohort_id));
create policy cm_write_admin on public.cohort_members for all to authenticated
 using(exists(select 1 from public.cohorts c where c.id=cohort_id and public.can_administer_org(c.organization_id)))
 with check(exists(select 1 from public.cohorts c where c.id=cohort_id and public.can_administer_org(c.organization_id)));
create policy resources_read_assigned on public.cohort_resources for select to authenticated using(public.can_access_cohort(cohort_id));
create policy resources_manage_assigned on public.cohort_resources for all to authenticated using(public.can_manage_cohort(cohort_id)) with check(public.can_manage_cohort(cohort_id));
create policy sessions_read_assigned on public.cohort_sessions for select to authenticated using(public.can_access_cohort(cohort_id));
create policy sessions_manage_assigned on public.cohort_sessions for all to authenticated using(public.can_manage_cohort(cohort_id)) with check(public.can_manage_cohort(cohort_id));

-- A cohort's tenant cannot be rewritten while retaining old memberships/resources.
create or replace function public.protect_cohort_organization() returns trigger
language plpgsql set search_path=public,pg_temp as $$ begin
 if new.organization_id is distinct from old.organization_id and current_user='authenticated' then
 raise exception 'Move cohorts only through a reviewed administrative migration'; end if;
 return new;
end $$;
create trigger protect_cohort_organization before update of organization_id on public.cohorts for each row execute function public.protect_cohort_organization();

create or replace function public.add_cohort_creator_membership() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if new.created_by is not null and exists(select 1 from public.organization_members om where om.user_id=new.created_by and om.organization_id=new.organization_id and om.status='active') then
 insert into public.cohort_members(cohort_id,user_id,added_by) values(new.id,new.created_by,new.created_by) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger add_cohort_creator_membership after insert on public.cohorts for each row execute function public.add_cohort_creator_membership();

create or replace function public.list_my_instructor_cohorts()
returns setof public.cohorts language sql stable security definer set search_path=public,pg_temp as $$
 select c.* from public.cohorts c where public.has_role(auth.uid(),'mentor')
 and public.can_access_cohort(c.id)
 and exists(select 1 from public.cohort_members cm where cm.cohort_id=c.id and cm.user_id=auth.uid())
 and c.deleted_at is null and not coalesce(c.is_archived,false)
 and (c.ends_at is null or c.ends_at>=current_date) order by c.starts_at desc nulls last,c.name;
$$;
revoke all on function public.list_my_instructor_cohorts() from public,anon;
grant execute on function public.list_my_instructor_cohorts() to authenticated;

-- Serialize all activations, including Auth signup and alternative join helpers.
-- A full organization queues shareable-link requests instead of failing signup.
create or replace function public.enforce_membership_seat_capacity() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if new.status<>'active' then return new; end if;
 if tg_op='UPDATE' then
   if old.status='active' and old.organization_id=new.organization_id then return new; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,200001));
 perform 1 from public.organizations where id=new.organization_id for update;
 if not public.check_seat_available(new.organization_id) then
   if coalesce(new.join_source,'')='shareable_link' then new.status:='pending'; new.joined_at:=null;
   else raise exception 'No seats available in this organization'; end if;
 end if;
 return new;
end $$;
create trigger enforce_membership_seat_capacity before insert or update of status,organization_id on public.organization_members
for each row execute function public.enforce_membership_seat_capacity();

create or replace function public.generate_recurring_sessions(p_mentor_id uuid,p_learner_id uuid,p_start timestamptz,p_duration int,p_pattern text,p_end_date date)
returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare v_mentor_user uuid; v_org uuid; v_current timestamptz:=p_start; v_step interval; v_count int:=0; v_parent uuid; v_id uuid;
begin
 select user_id,organization_id into v_mentor_user,v_org from public.mentors where id=p_mentor_id and is_active;
 if not found then raise exception 'Mentor not available'; end if;
 if coalesce(auth.role(),'')<>'service_role' and not coalesce(auth.uid()=v_mentor_user or public.can_administer_org(v_org),false) then
 raise exception 'Not authorized to create these sessions'; end if;
 if not exists(select 1 from public.organization_members where user_id=p_learner_id and organization_id=v_org and status='active') then
 raise exception 'Learner is not an active member of the mentor organization'; end if;
 if p_start is null or p_duration is null or p_duration<15 or p_duration>480 or p_end_date is null or p_end_date<p_start::date or p_end_date>p_start::date+366 then
 raise exception 'Invalid recurrence dates or duration'; end if;
 v_step:=case p_pattern when 'weekly' then interval '7 days' when 'biweekly' then interval '14 days' else null end;
 if v_step is null then raise exception 'Unsupported recurrence pattern'; end if;
 while v_current::date<=p_end_date loop
 insert into public.mentorship_sessions(mentor_id,learner_id,scheduled_at,duration_minutes,is_recurring,recurrence_pattern,recurrence_end_date,parent_session_id)
 values(p_mentor_id,p_learner_id,v_current,p_duration,true,p_pattern,p_end_date,v_parent) returning id into v_id;
 if v_parent is null then v_parent:=v_id; end if;
 v_current:=v_current+v_step; v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
create or replace function public.cancel_recurring_sessions(p_parent_session_id uuid)
returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid; v_learner uuid; v_org uuid; v_count int;
begin
 select m.user_id,s.learner_id,m.organization_id into v_user,v_learner,v_org
 from public.mentorship_sessions s join public.mentors m on m.id=s.mentor_id where s.id=p_parent_session_id;
 if not found then raise exception 'Session not found'; end if;
 if coalesce(auth.role(),'')<>'service_role' and not coalesce(auth.uid()=v_user or auth.uid()=v_learner or public.can_administer_org(v_org),false) then
 raise exception 'Not authorized to cancel these sessions'; end if;
 update public.mentorship_sessions set status='cancelled' where (id=p_parent_session_id or parent_session_id=p_parent_session_id) and status not in ('completed','cancelled');
 get diagnostics v_count=row_count; return v_count;
end $$;
create or replace function public.refresh_compliance_status()
returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count int; begin
 if coalesce(auth.role(),'')<>'service_role' and not exists(select 1 from public.organization_members where user_id=auth.uid() and status='active' and role in ('owner','admin')) and not public.is_super_admin(auth.uid()) then
 raise exception 'Not authorized to refresh compliance'; end if;
 update public.compliance_assignments ca set status='overdue' where ca.status in ('pending','in_progress') and ca.due_at<current_date
 and (auth.role()='service_role' or exists(select 1 from public.user_profiles up where up.id=ca.user_id and public.can_administer_org(up.organization_id)));
 get diagnostics v_count=row_count; return v_count;
end $$;
revoke all on function public.generate_recurring_sessions(uuid,uuid,timestamptz,int,text,date),public.cancel_recurring_sessions(uuid),public.refresh_compliance_status() from public,anon;
grant execute on function public.generate_recurring_sessions(uuid,uuid,timestamptz,int,text,date),public.cancel_recurring_sessions(uuid),public.refresh_compliance_status() to authenticated,service_role;

-- Qualifying stats are server-maintained. Direct browser writes would defeat eligibility.
drop policy if exists ugs_write_own on public.user_gamification_stats;
revoke insert,update,delete on public.user_gamification_stats from anon,authenticated;
create or replace function public.award_achievement(p_user_id uuid,p_achievement_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.achievements%rowtype; s public.user_gamification_stats%rowtype; v_current int; v_required int; v_inserted uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' and p_user_id is distinct from auth.uid() then raise exception 'Cannot award another account'; end if;
 select * into a from public.achievements where id=p_achievement_id;
 if not found then return; end if;
 insert into public.user_gamification_stats(user_id) values(p_user_id) on conflict do nothing;
 select * into s from public.user_gamification_stats where user_id=p_user_id for update;
 v_required:=case a.slug when 'first_lesson' then 1 when 'five_lessons' then 5 when 'ten_lessons' then 10
 when 'first_course' then 1 when 'five_courses' then 5 when 'ten_courses' then 10
 when 'three_day_streak' then 3 when 'week_streak' then 7 when 'two_week_streak' then 14 when 'month_streak' then 30
 when 'hundred_points' then 100 when 'five_hundred_points' then 500 when 'thousand_points' then 1000
 when 'level_five' then 5 when 'level_ten' then 10 when 'first_session' then 1 when 'session_regular' then 5 when 'session_master' then 10 end;
 v_current:=case when a.slug in ('first_lesson','five_lessons','ten_lessons') then s.lessons_completed
 when a.slug in ('first_course','five_courses','ten_courses') then s.courses_completed
 when a.category='streak' then s.streak_days when a.slug like '%points' then s.total_points
 when a.slug in ('level_five','level_ten') then s.current_level when a.category='social' then s.sessions_completed end;
 if coalesce(auth.role(),'')<>'service_role' and (v_required is null or coalesce(v_current,0)<v_required) then raise exception 'Achievement criteria not met'; end if;
 insert into public.user_achievements(user_id,achievement_id,achievement_title,achievement_description,achievement_icon,points_awarded)
 values(p_user_id,a.id,a.name,a.description,a.icon,coalesce(a.points,0)) on conflict(user_id,achievement_id) do nothing returning id into v_inserted;
 if v_inserted is null then return; end if;
 update public.user_gamification_stats set total_points=total_points+coalesce(a.points,0) where user_id=p_user_id;
 insert into public.real_notifications(user_id,type,title,message) values(p_user_id,'achievement','Achievement Unlocked: '||a.name,coalesce(a.description,'You earned an achievement!'));
end $$;
revoke all on function public.award_achievement(uuid,uuid) from public,anon;
grant execute on function public.award_achievement(uuid,uuid) to authenticated,service_role;

-- Private group access requires a current organization relationship as well as enrollment.
create or replace function public.can_read_study_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.study_groups sg where sg.id=p_group_id and (
   public.can_administer_org(sg.organization_id) or (sg.is_global and not coalesce(sg.is_private,false))
   or ((sg.organization_id is null or exists(select 1 from public.organization_members om where om.organization_id=sg.organization_id and om.user_id=auth.uid() and om.status='active'))
   and (sg.created_by=auth.uid() or public.is_study_group_member(auth.uid(),sg.id) or (sg.organization_id is not null and not coalesce(sg.is_private,false))))
 ));
$$;
revoke all on function public.can_read_study_group(uuid) from public,anon;
grant execute on function public.can_read_study_group(uuid) to authenticated;
drop policy if exists sg_select_all on public.study_groups;
drop policy if exists sg_select_own_org on public.study_groups;
drop policy if exists sg_select_visible on public.study_groups;
create policy sg_select_visible on public.study_groups for select to authenticated using(public.can_read_study_group(id));
create or replace function public.bootstrap_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_status public.org_member_status := 'active';
  v_org_target text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'organization_id'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'organization_slug'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'organization'), '')
  );
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
    set display_name = coalesce(nullif(trim(public.user_profiles.display_name), ''), excluded.display_name);

  if v_org_target is not null then
    select o.id,
           case when coalesce(o.require_join_approval, false)
             then 'pending'::public.org_member_status
             else 'active'::public.org_member_status
           end
      into v_org_id, v_org_status
    from public.organizations o
    where o.id::text = v_org_target
       or lower(coalesce(o.slug, '')) = lower(v_org_target)
       or lower(coalesce(o.name, '')) = lower(v_org_target)
       or (
         lower(v_org_target) in (
           'sara-org-1',
           'sara-foundation',
           'sara-foundation-africa',
           'bee8f57e-c14c-4230-98ee-233346e51ebe'
         )
         and (
           lower(coalesce(o.slug, '')) like 'sara%'
           or lower(coalesce(o.name, '')) like 'sara foundation%'
         )
       )
    order by o.created_at asc
    limit 1;

    if v_org_id is not null then
      insert into public.organization_members (
        organization_id, user_id, role, status, joined_at, join_source, referral_link
      ) values (
        v_org_id, new.id, 'member', v_org_status, now(), 'shareable_link', '/?join=' || v_org_target
      )
      on conflict (organization_id, user_id) do update
        set status = case
          when public.organization_members.status = 'active' then 'active'::public.org_member_status
          else excluded.status
        end,
        joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at),
        join_source = coalesce(public.organization_members.join_source, excluded.join_source),
        referral_link = coalesce(public.organization_members.referral_link, excluded.referral_link);

      select status into v_org_status from public.organization_members where organization_id=v_org_id and user_id=new.id;
      if v_org_status = 'active' then
        update public.user_profiles set organization_id = v_org_id where id = new.id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

commit;
