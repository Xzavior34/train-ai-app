-- Restore the platform-wide study group directory without reopening access to
-- private organization groups, and repair legacy users that have an Auth/profile
-- row but no organization relationship.

alter table public.study_groups
  add column if not exists is_global boolean not null default false;

-- These ten long-standing peer-learning groups were the original public
-- directory. A previous organization backfill attached them to their creator's
-- tenant, which made the entire directory disappear for other learners. Mark
-- exactly one row per canonical name as global; duplicates remain tenant-only.
with canonical_names(name) as (
  values
    ('AI/ML Fundamentals Study Group'),
    ('Computer Vision Projects'),
    ('Data Science Career Prep'),
    ('Deep Learning Researchers'),
    ('JavaScript Fundamentals Study Group'),
    ('Machine Learning Book Club'),
    ('NLP & Text Analytics'),
    ('Python Coding Challenges'),
    ('Python for Data Science'),
    ('React Projects Collaboration')
), ranked as (
  select
    sg.id,
    row_number() over (
      partition by sg.name
      order by (sg.organization_id is null) desc, sg.id
    ) as row_number
  from public.study_groups sg
  join canonical_names cn on cn.name = sg.name
)
update public.study_groups sg
set is_global = true
from ranked r
where sg.id = r.id
  and r.row_number = 1;

drop policy if exists sg_select_all on public.study_groups;
drop policy if exists sg_select_own_org on public.study_groups;
drop policy if exists sg_select_visible on public.study_groups;
create policy sg_select_visible on public.study_groups for select to authenticated
  using (
    is_global
    or organization_id = public.get_user_organization_id(auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- Replace the original helper with a version that also repairs split legacy
-- identity state. Existing active membership wins, then an existing profile
-- organization, and only truly unaffiliated users enter the default learning
-- organization. The user's platform role is never downgraded.
create or replace function public.join_default_organization()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_profile_org uuid;
  v_profile_role public.platform_role;
  v_member_role public.org_member_role;
begin
  if v_user_id is null then
    raise exception 'Must be signed in';
  end if;

  select up.organization_id, up.role
    into v_profile_org, v_profile_role
  from public.user_profiles up
  where up.id = v_user_id;

  select om.organization_id
    into v_org_id
  from public.organization_members om
  where om.user_id = v_user_id
    and om.status = 'active'
  order by om.joined_at desc nulls last, om.invited_at desc nulls last
  limit 1;

  if v_org_id is not null then
    update public.user_profiles
    set organization_id = v_org_id
    where id = v_user_id
      and organization_id is distinct from v_org_id;
    return v_org_id;
  end if;

  if v_profile_org is not null then
    v_org_id := v_profile_org;
  else
    select id into v_org_id
    from public.organizations
    where slug = 'tech-learning'
    limit 1;
  end if;

  if v_org_id is null then
    raise exception 'Default organization is not configured';
  end if;

  insert into public.user_profiles (id, organization_id, role)
  values (v_user_id, v_org_id, coalesce(v_profile_role, 'learner'::public.platform_role))
  on conflict (id) do update
    set organization_id = coalesce(public.user_profiles.organization_id, excluded.organization_id);

  v_member_role := case
    when v_profile_role in ('admin'::public.platform_role, 'super_admin'::public.platform_role)
      then 'admin'::public.org_member_role
    else 'member'::public.org_member_role
  end;

  insert into public.organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org_id, v_user_id, v_member_role, 'active', now())
  on conflict (organization_id, user_id) do update
    set status = 'active',
        role = case
          when public.organization_members.role in ('owner', 'admin', 'people_manager')
            then public.organization_members.role
          else excluded.role
        end,
        joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at);

  return v_org_id;
end;
$$;

revoke all on function public.join_default_organization() from public, anon;
grant execute on function public.join_default_organization() to authenticated;
