-- Strictly enforce Platform Owner isolation:
-- Only trainailtd@gmail.com (and trainai@gmail.com) can ever hold or receive 'super_admin' role.
-- Any organization admin (including info@sarafoundationafrica.com) is restricted to their
-- respective organization's admin / mentor / learner scope and cannot access platform owner controls.

begin;

-- 1. Remove 'super_admin' role from any user in public.user_roles whose email is NOT a trainai platform owner address
delete from public.user_roles ur
where ur.role = 'super_admin'
  and exists (
    select 1 from auth.users u
    where u.id = ur.user_id
      and lower(trim(u.email)) not in ('trainailtd@gmail.com', 'trainai@gmail.com')
  );

-- 2. Ensure info@sarafoundationafrica.com has their proper organization admin role for Sara Foundation Africa
do $$
declare
  sara_user_id uuid;
  sara_org_id uuid;
begin
  select id into sara_user_id
  from auth.users
  where lower(trim(email)) = 'info@sarafoundationafrica.com'
  limit 1;

  select id into sara_org_id
  from public.organizations
  where slug in ('sara-foundation', 'sara-foundation-africa')
     or lower(name) like '%sara foundation%'
  order by created_at asc
  limit 1;

  if sara_user_id is not null then
    -- Ensure admin role exists in user_roles
    insert into public.user_roles (user_id, role)
    values (sara_user_id, 'admin')
    on conflict do nothing;

    -- Update user_profile to role 'admin' and link to Sara Foundation
    if sara_org_id is not null then
      update public.user_profiles
      set role = 'admin',
          organization_id = sara_org_id
      where id = sara_user_id;

      insert into public.organization_members (organization_id, user_id, role, status)
      values (sara_org_id, sara_user_id, 'admin', 'active')
      on conflict (organization_id, user_id)
      do update set role = 'admin', status = 'active';
    end if;
  end if;
end $$;

-- 3. Replace get_my_workspace_roles() to guarantee super_admin is NEVER returned for non-platform-owner emails
create or replace function public.get_my_workspace_roles()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    array_agg(distinct ur.role::text) filter (
      where ur.role is not null
        and (
          ur.role != 'super_admin'
          or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) in ('trainailtd@gmail.com', 'trainai@gmail.com')
        )
    ),
    array['learner']::text[]
  )
  from public.user_roles ur
  where ur.user_id = auth.uid();
$$;

revoke all on function public.get_my_workspace_roles() from public, anon;
grant execute on function public.get_my_workspace_roles() to authenticated, service_role;

commit;
