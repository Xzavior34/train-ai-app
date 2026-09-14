-- ============================================================================
-- Super Admin can only ever be granted to Train AI email accounts
-- ============================================================================
-- Philip's task memo, "Important Architecture Decisions": "Keep Super Admin
-- access separate from Foundation accounts" and Platform/Super Admin
-- requires "Train AI email accounts only." Checked the actual grant path
-- (grantSuperAdminByUserId in lib/api/platform.js, backed by
-- ur_write_super_admin in 0006_rls_policies.sql) and found a real gap: any
-- existing super_admin could grant the role to *any* account at all, with
-- no check on whose account it actually was. "Foundation accounts should
-- not automatically receive Super Admin privileges" was already true by
-- construction (Sara Foundation lives in a separate Supabase project
-- entirely, so there's no code path connecting a Foundation account to
-- this table at all) - but "Train AI email accounts only" was not enforced
-- anywhere; it was just something that happened to be true if nobody ever
-- tried it, not a real constraint.
--
-- Enforced directly in the RLS policy itself (not only in a wrapper
-- function that a direct insert could bypass) - checks the target user's
-- real email in auth.users ends with @trainailtd.com before allowing a
-- super_admin row to be written at all, regardless of which code path
-- attempts the insert.
-- ============================================================================

create or replace function is_trainai_staff_email(check_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select email ilike '%@trainailtd.com' from auth.users where id = check_user_id),
    false
  );
$$;

drop policy if exists ur_write_super_admin on user_roles;
create policy ur_write_super_admin on user_roles for all
  using (is_super_admin(auth.uid()))
  with check (
    is_super_admin(auth.uid())
    and (role != 'super_admin' or is_trainai_staff_email(user_id))
  );

comment on function is_trainai_staff_email(uuid) is
  'Used to gate super_admin role grants to Train AI staff accounts only (ur_write_super_admin policy) - "Train AI email accounts only" per the confirmed architecture requirement.';

-- The Access Control screen's Super Admin Roster had a working Revoke
-- button but no way to Grant at all - grantSuperAdminByUserId() existed in
-- lib/api/platform.js but was never called from anywhere, and there was no
-- way to resolve a known @trainailtd.com email into the user_id that
-- function actually needs. This is that lookup, restricted to super_admin
-- callers (an open "look up any user by email" function would itself be a
-- real information-disclosure gap for any other role).
create or replace function find_user_id_by_email(p_email text)
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only Platform Owner (super_admin) can look up users by email';
  end if;
  select id into v_user_id from auth.users where email ilike p_email;
  return v_user_id;
end;
$$;
