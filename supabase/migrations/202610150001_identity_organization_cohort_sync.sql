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
