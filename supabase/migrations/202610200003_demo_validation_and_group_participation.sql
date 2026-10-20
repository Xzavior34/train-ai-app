begin;
-- Syntactic validation and calendar delivery are distinct from email ownership verification.
alter table public.demo_requests add column if not exists contact_verification text not null default 'unverified'
 check(contact_verification in ('unverified','verified'));

create or replace function public.take_demo_booking_attempt(p_email_hash text,p_ip_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_key bigint; v_since timestamptz:=now()-interval '15 minutes'; begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required'; end if;
 if p_email_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' or p_email_hash is null or p_ip_hash is null then raise exception 'Invalid rate-limit identifiers'; end if;
 -- Lock both keys in deterministic order to prevent races and deadlocks.
 for v_key in select distinct k from unnest(array[hashtextextended('email:'||p_email_hash,200003),hashtextextended('ip:'||p_ip_hash,200003)]) k order by k loop
 perform pg_advisory_xact_lock(v_key);
 end loop;
 if (select count(*) from public.demo_booking_attempts where email_hash=p_email_hash and created_at>=v_since)>=5
 or (select count(*) from public.demo_booking_attempts where ip_hash=p_ip_hash and created_at>=v_since)>=20 then return false; end if;
 insert into public.demo_booking_attempts(email_hash,ip_hash) values(p_email_hash,p_ip_hash);
 return true;
end $$;
revoke all on function public.take_demo_booking_attempt(text,text) from public,anon,authenticated;
grant execute on function public.take_demo_booking_attempt(text,text) to service_role;

-- Active enrolled learners may send group messages; direct-message restrictions stay separate.
create or replace function public.can_participate_in_study_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.study_groups sg join public.study_group_members gm on gm.group_id=sg.id
 where sg.id=p_group_id and gm.user_id=auth.uid()
 and ((sg.is_global and not coalesce(sg.is_private,false)) or exists(
 select 1 from public.organization_members om where om.user_id=auth.uid() and om.organization_id=sg.organization_id and om.status='active'
 )));
$$;
revoke all on function public.can_participate_in_study_group(uuid) from public,anon;
grant execute on function public.can_participate_in_study_group(uuid) to authenticated;
drop policy if exists sgm_insert_instructor_only on public.study_group_messages;
create policy sgm_insert_enrolled_member on public.study_group_messages for insert to authenticated
with check(sender_id=auth.uid() and public.can_participate_in_study_group(study_group_id));
drop policy if exists sgm_select_member on public.study_group_messages;
create policy sgm_select_member on public.study_group_messages for select to authenticated
using(public.can_participate_in_study_group(study_group_id) or exists(select 1 from public.study_groups sg where sg.id=study_group_id and public.can_administer_org(sg.organization_id)));

-- Group membership itself must not let a user bypass a private-group invitation.
drop policy if exists sgm_write_own_or_group_creator on public.study_group_members;
create policy group_member_leave on public.study_group_members for delete to authenticated using(user_id=auth.uid());
create policy group_member_join_public on public.study_group_members for insert to authenticated with check (
 user_id=auth.uid() and role='member' and exists(select 1 from public.study_groups sg where sg.id=group_id and not coalesce(sg.is_private,false)
 and (sg.is_global or exists(select 1 from public.organization_members om where om.user_id=auth.uid() and om.organization_id=sg.organization_id and om.status='active')))
);
create policy group_member_manage on public.study_group_members for all to authenticated
 using(exists(select 1 from public.study_groups sg where sg.id=group_id and (sg.created_by=auth.uid() or public.can_administer_org(sg.organization_id))))
 with check(exists(select 1 from public.study_groups sg where sg.id=group_id and (sg.created_by=auth.uid() or public.can_administer_org(sg.organization_id))));
-- Remove the old unscoped manage_courses branch, which also granted SELECT.
create or replace function public.can_manage_study_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.study_groups sg where sg.id=p_group_id and (
 public.can_administer_org(sg.organization_id) or (sg.created_by=auth.uid() and public.can_read_study_group(sg.id)) or
 (public.has_role(auth.uid(),'mentor') and public.can_participate_in_study_group(sg.id))));
$$;
revoke all on function public.can_manage_study_group(uuid) from public,anon;
grant execute on function public.can_manage_study_group(uuid) to authenticated;
drop policy if exists sg_write_authorized_or_member_instructor on public.study_groups;
create policy sg_update_managed on public.study_groups for update to authenticated using(public.can_manage_study_group(id)) with check(public.can_manage_study_group(id));
create policy sg_delete_managed on public.study_groups for delete to authenticated using(public.can_manage_study_group(id));
create policy sg_create_in_org on public.study_groups for insert to authenticated with check(created_by=auth.uid() and not is_global and exists(select 1 from public.organization_members om where om.organization_id=study_groups.organization_id and om.user_id=auth.uid() and om.status='active'));
create or replace function public.protect_study_group_scope() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin
 if current_user='authenticated' and (new.is_global is distinct from old.is_global or new.organization_id is distinct from old.organization_id or new.created_by is distinct from old.created_by) then
 raise exception 'Group scope and ownership require a reviewed administrative change'; end if; return new;
end $$;
create trigger protect_study_group_scope before update on public.study_groups for each row execute function public.protect_study_group_scope();
commit;
