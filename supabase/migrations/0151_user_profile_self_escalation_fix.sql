-- ============================================================================
-- CRITICAL: user_profiles self-escalation via organization_id/role rewrite
-- ============================================================================
-- Found while running the Phase 9 (role/org escalation) attack tests: the
-- existing `up_update_own` policy (0006_rls_policies.sql) lets any
-- authenticated user UPDATE their own user_profiles row with NO restriction
-- on which columns change - including organization_id and role.
--
-- Verified empirically, not assumed: as a real learner in Org B, a plain
-- `update user_profiles set organization_id = <Org A's id> where id =
-- auth.uid()` succeeded outright, and immediately granted read access to
-- Org A's cohorts (and, transitively, every other table whose RLS trusts
-- get_user_organization_id(auth.uid()) - which is nearly every tenant-scoped
-- table in this schema, including the courses/certificates policies just
-- fixed in 0149). This is more severe than the courses gap: it doesn't
-- attack one table's policy, it attacks the trust root nearly all of them
-- share. ANY authenticated user could self-assign into ANY organization by
-- rewriting one column on their own row.
--
-- Why this wasn't caught by the courses/certificates fix: that fix (0149)
-- correctly compares a resource's organization_id against
-- get_user_organization_id(auth.uid()) - which is the right pattern *only
-- if* a user's own organization_id can't be freely rewritten by that same
-- user. It couldn't be assumed safe without testing it directly, which is
-- what this pass did differently.
--
-- Why a trigger, not a WITH CHECK clause: Postgres RLS's WITH CHECK on an
-- UPDATE has access to the NEW row but not a clean way to compare against
-- OLD without re-querying the same (RLS-protected) table recursively. A
-- BEFORE UPDATE trigger has direct, non-recursive access to OLD and NEW.
--
-- Why the current_user check, not just is_org_admin()/is_super_admin():
-- legitimate self-assignment of organization_id already happens today
-- through vetted SECURITY DEFINER functions (accept_invitation(),
-- create_organization_self_serve(), join_default_organization() -
-- 0106_join_default_organization.sql) that intentionally bypass RLS to let
-- a brand-new user attach themselves to an org via a real invitation token
-- or real self-serve signup flow. Those functions are owned by the
-- migration-owner role (postgres), so their internal UPDATE statements run
-- with current_user = the function owner - confirmed empirically in this
-- pass, not assumed - whereas a raw client-side PATCH through PostgREST
-- always executes as current_user = authenticated. The trigger below
-- allows the former (the vetted, already-validated path) and blocks the
-- latter (an unvalidated raw write), which is the correct trust boundary:
-- trust the RPC that checked a real token/seat/eligibility, never trust a
-- bare column write.
-- ============================================================================

create or replace function protect_user_profile_privileged_fields()
returns trigger
language plpgsql set search_path = public as $$
begin
  -- Writes coming from a SECURITY DEFINER function owned by this migration
  -- role (accept_invitation, create_organization_self_serve,
  -- join_default_organization, etc.) run as that owner, not as
  -- `authenticated` - those are the already-vetted paths and are left
  -- alone. Only a raw client-side write needs this check.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.role is distinct from old.role then
    if is_super_admin(auth.uid()) then
      return new;
    end if;
    -- An org admin may change a member's role or move them, but only
    -- within their own organization on both sides of the change - this is
    -- not a mechanism for an admin to pull a user OUT of another org
    -- (old.organization_id must already equal the admin's own org).
    if is_org_admin(auth.uid())
       and old.organization_id = get_user_organization_id(auth.uid())
       and new.organization_id = get_user_organization_id(auth.uid()) then
      return new;
    end if;
    raise exception 'Not authorized to change organization or role on this profile directly';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_user_profile_privileged_fields on user_profiles;
create trigger trg_protect_user_profile_privileged_fields
  before update on user_profiles
  for each row execute function protect_user_profile_privileged_fields();

comment on function protect_user_profile_privileged_fields() is
  'Blocks a raw client-side (current_user = authenticated) UPDATE from changing organization_id or role on a user_profiles row, closing a self-escalation path where any user could rewrite their own organization_id to gain org-scoped access to any tenant. Vetted SECURITY DEFINER paths (accept_invitation, create_organization_self_serve, etc.) are unaffected since they run as the function-owner role.';
