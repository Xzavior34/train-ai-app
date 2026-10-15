-- Train AI live repair: authentication profiles, organization directory,
-- cohort membership, study-group visibility, and invite-link onboarding.
-- Paste this entire file into the Supabase SQL Editor and click Run once.
-- Safe to run again. Run separately on BOTH Train AI Supabase projects.

begin;

alter table if exists public.organizations
  add column if not exists require_join_approval boolean not null default false;

alter table if exists public.organization_members
  add column if not exists join_source text default 'shareable_link',
  add column if not exists referral_link text;

alter table if exists public.user_profiles
  add column if not exists joined_at timestamptz default now(),
  add column if not exists join_source text default 'shareable_link',
  add column if not exists referral_link text;

update public.organization_members om
set
  join_source = case
    when om.invited_by is not null then 'email_invite'
    else coalesce(om.join_source, 'shareable_link')
  end,
  referral_link = coalesce(
    om.referral_link,
    '/?join=' || coalesce(
      (select o.slug from public.organizations o where o.id = om.organization_id),
      om.organization_id::text
    )
  ),
  joined_at = coalesce(om.joined_at, om.invited_at, now())
where om.join_source is null
   or om.referral_link is null
   or om.joined_at is null;


-- Ensure every Auth account has the public user_profiles row required by
-- organization_members, cohorts, study groups, and admin directory queries.

create or replace function public.bootstrap_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.bootstrap_auth_user_profile() from public, anon, authenticated;

drop trigger if exists trainai_bootstrap_auth_user_profile on auth.users;
create trigger trainai_bootstrap_auth_user_profile
after insert on auth.users
for each row execute function public.bootstrap_auth_user_profile();

-- Repair accounts created before the trigger existed.
insert into public.user_profiles (id, display_name)
select
  au.id,
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
    split_part(au.email, '@', 1)
  )
from auth.users au
where not exists (
  select 1 from public.user_profiles up where up.id = au.id
)
on conflict (id) do nothing;

-- ============================================================================
-- Fix Organization Invite Link, Member Onboarding & Admin Visibility
-- ============================================================================
-- Ensures users who click organization referral links (?join=slug or ?org=id)
-- are reliably captured, enrolled into organization_members, and visible to
-- organization admins in People & Access (both active Directory and Pending Approvals).
-- ============================================================================

-- Remove the older enum-typed overload. Keeping both the enum and text
-- variants makes PostgREST unable to choose reliably from a JSON string.
DROP FUNCTION IF EXISTS public.join_organization_by_invite(text, public.platform_role);

CREATE OR REPLACE FUNCTION public.join_organization_by_invite(
  p_org_target text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org record;
  v_clean_input text := lower(trim(coalesce(p_org_target, '')));
  v_role text := CASE WHEN lower(coalesce(p_role, 'learner')) IN ('instructor', 'mentor') THEN 'mentor' ELSE 'learner' END;
  v_ref_link text;
  v_require_approval boolean := false;
  v_status text := 'active';
  v_existing_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_clean_input = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization identifier is required');
  END IF;

  -- A fresh auth.users account may not have a profile yet. The membership
  -- table references user_profiles, so materialize the safe learner profile
  -- before attempting an organization or cohort relationship.
  INSERT INTO public.user_profiles (id, display_name)
  SELECT
    au.id,
    COALESCE(
      NULLIF(trim(au.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(trim(au.raw_user_meta_data ->> 'name'), ''),
      split_part(au.email, '@', 1)
    )
  FROM auth.users au
  WHERE au.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Resolve organization by UUID, slug, name, or common aliases
  SELECT *
  INTO v_org
  FROM public.organizations o
  WHERE o.id::text = trim(p_org_target)
     OR lower(coalesce(o.slug, '')) = v_clean_input
     OR lower(coalesce(o.name, '')) = v_clean_input
     OR (
       v_clean_input IN ('sara-foundation', 'sara-org-1', 'sara-foundation-africa', 'sara')
       AND (
         lower(coalesce(o.slug, '')) LIKE 'sara%'
         OR lower(coalesce(o.name, '')) LIKE 'sara foundation%'
       )
     )
     OR (
       v_clean_input IN ('cap', 'cap3', 'cap-cohort-3', 'cap3-foundation')
       AND (
         lower(coalesce(o.slug, '')) LIKE 'cap%'
         OR lower(coalesce(o.name, '')) LIKE 'cap cohort%'
       )
     )
  ORDER BY o.created_at ASC
  LIMIT 1;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found or invite link expired');
  END IF;

  v_ref_link := '/?join=' || COALESCE(v_org.slug, v_org.id::text);

  -- Check existing membership status
  SELECT status INTO v_existing_status
  FROM public.organization_members
  WHERE organization_id = v_org.id AND user_id = v_user_id;

  IF v_existing_status = 'active' THEN
    -- Ensure profile pointers are current
    UPDATE public.user_profiles
    SET organization_id = v_org.id,
        join_source = COALESCE(join_source, 'shareable_link'),
        referral_link = COALESCE(referral_link, v_ref_link)
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'already_member', true,
      'pending_approval', false,
      'status', 'active',
      'organization_id', v_org.id,
      'organization_name', v_org.name,
      'slug', v_org.slug
    );
  END IF;

  -- Determine if approval is required before activating
  IF v_org.require_join_approval IS TRUE THEN
    v_require_approval := true;
    v_status := 'pending';
  ELSE
    -- Check seat capacity if active paid organization
    BEGIN
      IF NOT public.check_seat_available(v_org.id) THEN
        v_require_approval := true;
        v_status := 'pending';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_status := 'active';
    END;
  END IF;

  -- Insert/update organization_members
  INSERT INTO public.organization_members (
    organization_id, user_id, role, status, joined_at, join_source, referral_link
  )
  VALUES (
    v_org.id, v_user_id, 'member', v_status, now(), 'shareable_link', v_ref_link
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET
    status = CASE WHEN organization_members.status = 'active' THEN 'active' ELSE v_status END,
    join_source = COALESCE(organization_members.join_source, 'shareable_link'),
    referral_link = COALESCE(organization_members.referral_link, EXCLUDED.referral_link),
    joined_at = COALESCE(organization_members.joined_at, now());

  -- If active, link profile directly
  IF v_status = 'active' THEN
    UPDATE public.user_profiles
    SET
      organization_id = v_org.id,
      join_source = COALESCE(join_source, 'shareable_link'),
      referral_link = COALESCE(referral_link, v_ref_link),
      joined_at = COALESCE(joined_at, now())
    WHERE id = v_user_id;

    -- Ensure role exists in user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, v_role::platform_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Grant starter AI credit account if applicable
  BEGIN
    PERFORM public.get_or_create_learner_credit_account(v_user_id, v_org.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'pending_approval', (v_status = 'pending'),
    'status', v_status,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'slug', v_org.slug,
    'join_source', 'shareable_link',
    'referral_link', v_ref_link
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_organization_by_invite(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_organization_by_invite(text, text) TO authenticated, service_role;

-- Overload for single-parameter call
CREATE OR REPLACE FUNCTION public.join_organization_by_invite(p_org_target text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.join_organization_by_invite(p_org_target, 'learner');
END;
$$;

REVOKE ALL ON FUNCTION public.join_organization_by_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_organization_by_invite(text) TO authenticated, service_role;

-- Direct helper to record membership by explicit user ID
CREATE OR REPLACE FUNCTION public.record_pending_org_join(
  p_user_id uuid,
  p_org_target text,
  p_role text DEFAULT 'learner'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_clean_input text := lower(trim(coalesce(p_org_target, '')));
  v_ref_link text;
  v_status text := 'active';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;

  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to record this organization join';
  END IF;

  INSERT INTO public.user_profiles (id, display_name)
  SELECT
    au.id,
    COALESCE(
      NULLIF(trim(au.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(trim(au.raw_user_meta_data ->> 'name'), ''),
      split_part(au.email, '@', 1)
    )
  FROM auth.users au
  WHERE au.id = p_user_id
  ON CONFLICT (id) DO NOTHING;

  SELECT *
  INTO v_org
  FROM public.organizations o
  WHERE o.id::text = trim(p_org_target)
     OR lower(coalesce(o.slug, '')) = v_clean_input
     OR lower(coalesce(o.name, '')) = v_clean_input
  ORDER BY o.created_at ASC
  LIMIT 1;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  v_ref_link := '/?join=' || COALESCE(v_org.slug, v_org.id::text);

  IF v_org.require_join_approval IS TRUE THEN
    v_status := 'pending';
  END IF;

  INSERT INTO public.organization_members (
    organization_id, user_id, role, status, joined_at, join_source, referral_link
  )
  VALUES (
    v_org.id, p_user_id, 'member', v_status, now(), 'shareable_link', v_ref_link
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET
    status = CASE WHEN organization_members.status = 'active' THEN 'active' ELSE v_status END,
    join_source = COALESCE(organization_members.join_source, 'shareable_link'),
    referral_link = COALESCE(organization_members.referral_link, EXCLUDED.referral_link),
    joined_at = COALESCE(organization_members.joined_at, now());

  IF v_status = 'active' THEN
    UPDATE public.user_profiles
    SET organization_id = v_org.id,
        join_source = COALESCE(join_source, 'shareable_link'),
        referral_link = COALESCE(referral_link, v_ref_link),
        joined_at = COALESCE(joined_at, now())
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'slug', v_org.slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_pending_org_join(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_pending_org_join(uuid, text, text) TO authenticated, service_role;

-- Keep authentication profiles, organization membership, and cohort access in sync.
-- A user may be present in organization_members while user_profiles.organization_id
-- is still null. That split makes the user disappear from admin directories and
-- prevents learner RLS policies from exposing their cohort and study groups.

-- Repair existing profile rows from active organization memberships.
with preferred_membership as (
  select distinct on (om.user_id)
    om.user_id,
    om.organization_id
  from public.organization_members om
  where om.status = 'active'
  order by om.user_id, om.joined_at desc nulls last, om.invited_at desc nulls last
)
update public.user_profiles up
set organization_id = pm.organization_id
from preferred_membership pm
where up.id = pm.user_id
  and (
    up.organization_id is null
    or not exists (
      select 1
      from public.organization_members current_membership
      where current_membership.user_id = up.id
        and current_membership.organization_id = up.organization_id
        and current_membership.status = 'active'
    )
  );

-- Legacy accounts sometimes have the profile pointer but no membership row.
-- Materialize that missing relationship so all directory and cohort workflows
-- use one consistent source of truth.
insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status,
  joined_at
)
select
  up.organization_id,
  up.id,
  case when up.role in ('admin', 'super_admin') then 'admin'::public.org_member_role else 'member'::public.org_member_role end,
  'active'::public.org_member_status,
  coalesce(up.created_at, now())
from public.user_profiles up
where up.organization_id is not null
  and not exists (
    select 1
    from public.organization_members om
    where om.organization_id = up.organization_id
      and om.user_id = up.id
  )
on conflict (organization_id, user_id) do nothing;

-- Repair cohorts and study groups that were created under a fallback or stale
-- organization. Preserve the current organization whenever the creator still
-- has an active membership there.
with creator_membership as (
  select distinct on (om.user_id)
    om.user_id,
    om.organization_id
  from public.organization_members om
  where om.status = 'active'
  order by om.user_id, om.joined_at desc nulls last, om.invited_at desc nulls last
)
update public.cohorts c
set organization_id = cm.organization_id
from creator_membership cm
where c.created_by = cm.user_id
  and not exists (
    select 1
    from public.organization_members existing
    where existing.user_id = c.created_by
      and existing.organization_id = c.organization_id
      and existing.status = 'active'
  );

with creator_membership as (
  select distinct on (om.user_id)
    om.user_id,
    om.organization_id
  from public.organization_members om
  where om.status = 'active'
  order by om.user_id, om.joined_at desc nulls last, om.invited_at desc nulls last
)
update public.study_groups sg
set organization_id = cm.organization_id
from creator_membership cm
where sg.created_by = cm.user_id
  and not exists (
    select 1
    from public.organization_members existing
    where existing.user_id = sg.created_by
      and existing.organization_id = sg.organization_id
      and existing.status = 'active'
  );

create or replace function public.sync_profile_organization_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_replacement uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'active' then
    update public.user_profiles
    set organization_id = new.organization_id
    where id = new.user_id
      and organization_id is distinct from new.organization_id;
    return new;
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.status = 'active' and new.status <> 'active') then
    select om.organization_id
      into v_replacement
    from public.organization_members om
    where om.user_id = old.user_id
      and om.status = 'active'
    order by om.joined_at desc nulls last, om.invited_at desc nulls last
    limit 1;

    update public.user_profiles
    set organization_id = v_replacement
    where id = old.user_id
      and organization_id = old.organization_id;

    if tg_op = 'DELETE' then return old; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists organization_members_sync_profile_org on public.organization_members;
create trigger organization_members_sync_profile_org
after insert or delete or update of organization_id, status
on public.organization_members
for each row execute function public.sync_profile_organization_from_membership();

-- Authorized directory function. It includes the real Auth email without
-- exposing emails across organizations.
create or replace function public.list_organization_users(p_organization_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role public.platform_role,
  organization_id uuid,
  member_status public.org_member_status,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.organization_members caller
      where caller.organization_id = p_organization_id
        and caller.user_id = auth.uid()
        and caller.status = 'active'
        and caller.role in ('owner', 'admin', 'people_manager')
    )
  ) then
    raise exception 'Not authorized to view this organization directory';
  end if;

  return query
  select
    up.id,
    coalesce(nullif(trim(up.display_name), ''), split_part(au.email, '@', 1)),
    au.email::text,
    up.role,
    om.organization_id,
    om.status,
    coalesce(om.joined_at, om.invited_at, up.created_at)
  from public.organization_members om
  join public.user_profiles up on up.id = om.user_id
  left join auth.users au on au.id = om.user_id
  where om.organization_id = p_organization_id
  order by coalesce(nullif(trim(up.display_name), ''), au.email, up.id::text);
end;
$$;

revoke all on function public.list_organization_users(uuid) from public, anon;
grant execute on function public.list_organization_users(uuid) to authenticated;

-- Organization-scoped email lookup for cohort assignment. The previous
-- client reused find_user_id_by_email(), which intentionally allows only
-- Platform Owners and therefore always failed for organization admins.
create or replace function public.find_organization_user_by_email(
  p_organization_id uuid,
  p_email text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  if auth.uid() is null or not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.organization_members caller
      where caller.organization_id = p_organization_id
        and caller.user_id = auth.uid()
        and caller.status = 'active'
        and caller.role in ('owner', 'admin', 'people_manager')
    )
  ) then
    raise exception 'Not authorized to search this organization directory';
  end if;

  select om.user_id
    into v_user_id
  from public.organization_members om
  join auth.users au on au.id = om.user_id
  where om.organization_id = p_organization_id
    and om.status = 'active'
    and lower(au.email) = lower(trim(p_email))
  limit 1;

  return v_user_id;
end;
$$;

revoke all on function public.find_organization_user_by_email(uuid, text) from public, anon;
grant execute on function public.find_organization_user_by_email(uuid, text) to authenticated;

-- Refuse cross-organization cohort membership rows. This converts silent,
-- invisible assignments into a clear error and also repairs a null profile
-- pointer for a valid active organization member.
create or replace function public.validate_cohort_member_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort_org uuid;
  v_profile_org uuid;
begin
  select organization_id into v_cohort_org
  from public.cohorts
  where id = new.cohort_id;

  if v_cohort_org is null then
    raise exception 'Cohort organization could not be resolved';
  end if;

  select organization_id into v_profile_org
  from public.user_profiles
  where id = new.user_id;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = v_cohort_org
      and om.user_id = new.user_id
      and om.status = 'active'
  ) then
    raise exception 'User is not an active member of this cohort organization';
  end if;

  if v_profile_org is distinct from v_cohort_org then
    update public.user_profiles
    set organization_id = v_cohort_org
    where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists cohort_members_validate_organization on public.cohort_members;
create trigger cohort_members_validate_organization
before insert or update of cohort_id, user_id
on public.cohort_members
for each row execute function public.validate_cohort_member_organization();

-- ============================================================================
-- Cohort Member Assignment & Bulk Add by Email
-- ============================================================================
-- Fixes cohort member assignment so organization admins, managers, and instructors
-- can reliably add existing members or lookup members by email to enroll into cohorts.
-- Provides a secure SECURITY DEFINER RPC that safely resolves auth.users by email
-- within the caller's authorized organization context, preventing information disclosure
-- while removing the blocker where only super_admin could perform email lookups.
-- ============================================================================

-- 1. Secure helper to look up a user by email within an authorized cohort/organization
CREATE OR REPLACE FUNCTION public.find_cohort_user_by_email(
  p_cohort_id uuid,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_clean_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_clean_email = '' OR p_cohort_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Resolve cohort organization
  SELECT organization_id INTO v_org_id FROM public.cohorts WHERE id = p_cohort_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cohort not found';
  END IF;

  -- Caller must be super_admin, or admin/owner of this organization
  IF NOT (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = v_org_id
        AND role IN ('owner', 'admin', 'people_manager')
        AND status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to look up members for this cohort';
  END IF;

  -- Lookup user in auth.users
  SELECT au.id INTO v_user_id
  FROM auth.users au
  JOIN public.organization_members om ON om.user_id = au.id
  WHERE lower(au.email) = v_clean_email
    AND om.organization_id = v_org_id
    AND om.status = 'active'
  LIMIT 1;
  RETURN v_user_id;
END;
$$;

-- 2. Direct atomic addition of a cohort member by email
CREATE OR REPLACE FUNCTION public.add_cohort_member_by_email(
  p_cohort_id uuid,
  p_email text,
  p_added_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_clean_email text := lower(trim(coalesce(p_email, '')));
  v_cohort_member_id uuid;
  v_added_by uuid := auth.uid();
BEGIN
  IF v_clean_email = '' OR p_cohort_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cohort ID and email are required');
  END IF;

  -- 1. Verify cohort and retrieve organization ID
  SELECT organization_id INTO v_org_id FROM public.cohorts WHERE id = p_cohort_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cohort not found');
  END IF;

  -- 2. Authorization check
  IF NOT (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = v_org_id
        AND role IN ('owner', 'admin', 'people_manager')
        AND status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to manage this cohort');
  END IF;

  -- 3. Resolve an approved user from this organization only
  SELECT au.id INTO v_user_id
  FROM auth.users au
  JOIN public.organization_members om ON om.user_id = au.id
  WHERE lower(au.email) = v_clean_email
    AND om.organization_id = v_org_id
    AND om.status = 'active'
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No approved organization member was found with this email');
  END IF;

  -- 4. Add to cohort_members idempotently
  INSERT INTO public.cohort_members (cohort_id, user_id, added_by)
  VALUES (p_cohort_id, v_user_id, v_added_by)
  ON CONFLICT (cohort_id, user_id)
  DO UPDATE SET added_at = now()
  RETURNING id INTO v_cohort_member_id;

  RETURN jsonb_build_object(
    'success', true,
    'cohort_id', p_cohort_id,
    'user_id', v_user_id,
    'email', v_clean_email
  );
END;
$$;

-- SECURITY DEFINER functions must not retain PostgreSQL's default PUBLIC
-- execute privilege. Authorization is enforced inside each function too.
REVOKE ALL ON FUNCTION public.find_cohort_user_by_email(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.add_cohort_member_by_email(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_cohort_user_by_email(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_cohort_member_by_email(uuid, text, uuid) TO authenticated, service_role;

-- 3. Update cohort_members RLS write policy to allow organization admins/managers
DROP POLICY IF EXISTS cm_write_admin ON public.cohort_members;
CREATE POLICY cm_write_admin ON public.cohort_members FOR ALL
  USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = cohort_members.cohort_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'people_manager')
        AND om.status = 'active'
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = cohort_members.cohort_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'people_manager')
        AND om.status = 'active'
    )
  );


commit;

-- Verification: the first two counts should be 0 and all readiness values
-- should be true. invalid_cohort_members is a review count: it should also be
-- 0, but this script deliberately does not delete or auto-authorize any old
-- cross-organization cohort rows.
select
  (select count(*)
   from auth.users au
   left join public.user_profiles up on up.id = au.id
   where up.id is null) as auth_users_missing_profile,

  (select count(*)
   from public.user_profiles up
   where exists (
     select 1 from public.organization_members any_active
     where any_active.user_id = up.id and any_active.status = 'active'
   )
   and not exists (
     select 1 from public.organization_members matching_active
     where matching_active.user_id = up.id
       and matching_active.organization_id = up.organization_id
       and matching_active.status = 'active'
   )) as profiles_without_matching_active_membership,

  (select count(*)
   from public.cohort_members cm
   join public.cohorts c on c.id = cm.cohort_id
   where not exists (
     select 1
     from public.organization_members om
     where om.user_id = cm.user_id
       and om.organization_id = c.organization_id
       and om.status = 'active'
   )) as invalid_cohort_members,

  to_regprocedure('public.list_organization_users(uuid)') is not null
    as list_organization_users_ready,

  to_regprocedure('public.find_organization_user_by_email(uuid,text)') is not null
    as organization_email_lookup_ready,

  to_regprocedure('public.find_cohort_user_by_email(uuid,text)') is not null
    as cohort_email_lookup_ready,

  to_regprocedure('public.add_cohort_member_by_email(uuid,text,uuid)') is not null
    as cohort_add_by_email_ready,

  exists (
    select 1
    from pg_trigger
    where tgname = 'trainai_bootstrap_auth_user_profile'
      and not tgisinternal
  ) as new_user_profile_trigger_ready;

