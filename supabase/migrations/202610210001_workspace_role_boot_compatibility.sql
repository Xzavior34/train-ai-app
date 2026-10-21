-- Keep the application boot contract available in every production project.
-- This function deliberately returns only the authenticated user's own roles.
begin;

create or replace function public.get_my_workspace_roles()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    array_agg(distinct ur.role::text) filter (where ur.role is not null),
    array['learner']::text[]
  )
  from public.user_roles ur
  where ur.user_id = auth.uid();
$$;

revoke all on function public.get_my_workspace_roles() from public, anon;
grant execute on function public.get_my_workspace_roles() to authenticated, service_role;

commit;
