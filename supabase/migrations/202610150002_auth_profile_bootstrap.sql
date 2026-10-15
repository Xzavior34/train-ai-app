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
