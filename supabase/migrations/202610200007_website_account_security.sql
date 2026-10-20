begin;
-- Invitations must not grant platform-owner access or cross tenant boundaries,
-- including via the legacy definer RPC and direct REST writes.
create or replace function public.validate_invitation_access()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid := auth.uid(); v_owner boolean;
begin
 if tg_op='UPDATE' and new.role is not distinct from old.role and new.organization_role is not distinct from old.organization_role
   and new.organization_id is not distinct from old.organization_id and new.invited_by is not distinct from old.invited_by
   and new.email is not distinct from old.email and new.token is not distinct from old.token
   and not (new.status='accepted' and old.status is distinct from 'accepted') then return new; end if;
 if new.role::text='super_admin' or new.organization_role::text='owner' then
   raise exception 'Owner access cannot be granted through organization invitations' using errcode='42501';
 end if;
 if new.organization_id is null or new.role::text not in ('learner','mentor','manager','admin') then
   raise exception 'A valid organization and supported role are required'; end if;
 if auth.role()='service_role' then v_actor:=new.invited_by; end if;
 if tg_op='UPDATE' and new.status='accepted' and old.status is distinct from 'accepted' then v_actor:=old.invited_by; end if;
 if v_actor is null or not (is_super_admin(v_actor) or exists(select 1 from organization_members where organization_id=new.organization_id and user_id=v_actor and status='active' and role::text in ('owner','admin'))) then
   raise exception 'Only this organization administrator can create invitations' using errcode='42501'; end if;
 if new.invited_by is distinct from v_actor then raise exception 'Invitation sender must match the authenticated caller' using errcode='42501'; end if;
 v_owner:=is_super_admin(v_actor) or exists(select 1 from organization_members where organization_id=new.organization_id and user_id=v_actor and status='active' and role::text='owner');
 if (new.role::text='admin' or new.organization_role::text='admin') and not v_owner then
   raise exception 'Only the organization owner can invite administrators' using errcode='42501'; end if;
 if (new.role::text='admin') <> (new.organization_role::text='admin') then
   raise exception 'Administrator invitation roles must match'; end if;
 new.email:=lower(trim(new.email));
 return new;
end $$;
create trigger validate_invitation_access before insert or update on public.user_invitations
 for each row execute function public.validate_invitation_access();

do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='user_invitations' loop
 execute format('drop policy %I on public.user_invitations',p.policyname); end loop;
end $$;
create policy invitation_read_scoped on user_invitations for select to authenticated using(can_administer_org(organization_id) or lower(email)=lower(auth.jwt()->>'email'));
create policy invitation_write_scoped on user_invitations for all to authenticated using(can_administer_org(organization_id)) with check(can_administer_org(organization_id));
create or replace function public.create_user_invitation(p_email text,p_role platform_role,p_organization_id uuid,p_organization_role org_member_role)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; begin
 if not can_administer_org(p_organization_id) then raise exception 'Organization administrator required' using errcode='42501'; end if;
 if not check_seat_available(p_organization_id) then raise exception 'No available seats'; end if;
 insert into user_invitations(email,role,organization_id,organization_role,invited_by)
 values(p_email,p_role,p_organization_id,p_organization_role,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_user_invitation(text,platform_role,uuid,org_member_role) from public,anon;
grant execute on function public.create_user_invitation(text,platform_role,uuid,org_member_role) to authenticated;

-- Serialize anonymous recovery requests on both dimensions. Failing to count
-- must never silently disable the limiter.
create or replace function public.take_password_reset_attempt(p_email_hash text,p_ip_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 if p_email_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' or p_email_hash is null or p_ip_hash is null then raise exception 'Invalid request identity'; end if;
 perform pg_advisory_xact_lock(hashtextextended('recovery-email:'||p_email_hash,200007));
 perform pg_advisory_xact_lock(hashtextextended('recovery-ip:'||p_ip_hash,200007));
 if (select count(*) from password_reset_attempts where email_hash=p_email_hash and created_at>=now()-interval '15 minutes')>=5
 or (select count(*) from password_reset_attempts where ip_hash=p_ip_hash and created_at>=now()-interval '15 minutes')>=20 then return false; end if;
 insert into password_reset_attempts(email_hash,ip_hash) values(p_email_hash,p_ip_hash);
 return true;
end $$;
revoke all on function public.take_password_reset_attempt(text,text) from public,anon,authenticated;
grant execute on function public.take_password_reset_attempt(text,text) to service_role;
commit;
