-- Repair Sara learner signups that used the legacy client-side organization
-- identifier `sara-org-1`. These users already have valid Auth and profile
-- records, but the old bootstrap trigger could not resolve that alias, so the
-- default-organization fallback hid Sara cohorts and private study groups.

create or replace function public.bootstrap_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_status public.org_member_status := 'active';
  v_org_target text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'organization_id'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'organization_slug'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'organization'), '')
  );
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
    set display_name = coalesce(nullif(trim(public.user_profiles.display_name), ''), excluded.display_name);

  if v_org_target is not null then
    select o.id,
           case when coalesce(o.require_join_approval, false)
             then 'pending'::public.org_member_status
             else 'active'::public.org_member_status
           end
      into v_org_id, v_org_status
    from public.organizations o
    where o.id::text = v_org_target
       or lower(coalesce(o.slug, '')) = lower(v_org_target)
       or lower(coalesce(o.name, '')) = lower(v_org_target)
       or (
         lower(v_org_target) in ('sara-org-1', 'sara-foundation', 'sara-foundation-africa')
         and (
           lower(coalesce(o.slug, '')) like 'sara%'
           or lower(coalesce(o.name, '')) like 'sara foundation%'
         )
       )
    order by o.created_at asc
    limit 1;

    if v_org_id is not null then
      insert into public.organization_members (
        organization_id, user_id, role, status, joined_at, join_source, referral_link
      ) values (
        v_org_id, new.id, 'member', v_org_status, now(), 'shareable_link', '/?join=' || v_org_target
      )
      on conflict (organization_id, user_id) do update
        set status = case
          when public.organization_members.status = 'active' then 'active'::public.org_member_status
          else excluded.status
        end,
        joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at),
        join_source = coalesce(public.organization_members.join_source, excluded.join_source),
        referral_link = coalesce(public.organization_members.referral_link, excluded.referral_link);

      if v_org_status = 'active' then
        update public.user_profiles set organization_id = v_org_id where id = new.id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.bootstrap_auth_user_profile() from public, anon, authenticated;

drop trigger if exists trainai_bootstrap_auth_user_profile on auth.users;
create trigger trainai_bootstrap_auth_user_profile
after insert on auth.users
for each row execute function public.bootstrap_auth_user_profile();

-- Backfill every existing account whose signup metadata explicitly selected
-- Sara Foundation. This does not claim generic learners or members of another
-- customer organization.
do $$
declare
  v_sara_org_id uuid;
  v_sara_status public.org_member_status;
begin
  select o.id,
         case when coalesce(o.require_join_approval, false)
           then 'pending'::public.org_member_status
           else 'active'::public.org_member_status
         end
    into v_sara_org_id, v_sara_status
  from public.organizations o
  where lower(coalesce(o.slug, '')) like 'sara%'
     or lower(coalesce(o.name, '')) like 'sara foundation%'
  order by o.created_at asc
  limit 1;

  if v_sara_org_id is null then
    -- The shared B2B project intentionally has no Sara tenant. Keep this
    -- migration portable across both production projects.
    return;
  end if;

  -- The generic membership was created by the fallback path. Suspend only
  -- that known default membership for accounts that explicitly chose Sara.
  update public.organization_members om
  set status = 'suspended'
  from auth.users au, public.organizations existing_org
  where om.user_id = au.id
    and om.organization_id = existing_org.id
    and om.status = 'active'
    and (
      lower(coalesce(existing_org.slug, '')) = 'tech-learning'
      or lower(coalesce(existing_org.name, '')) = 'digital training organization'
    )
    and lower(coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'organization_id'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'organization_slug'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'organization'), '')
    )) in ('sara-org-1', 'sara-foundation', 'sara-foundation-africa', v_sara_org_id::text);

  insert into public.organization_members (
    organization_id, user_id, role, status, joined_at, join_source, referral_link
  )
  select
    v_sara_org_id,
    au.id,
    'member'::public.org_member_role,
    v_sara_status,
    coalesce(au.created_at, now()),
    'shareable_link',
    '/?join=sara-org-1'
  from auth.users au
  where lower(coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'organization_id'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'organization_slug'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'organization'), '')
  )) in ('sara-org-1', 'sara-foundation', 'sara-foundation-africa', v_sara_org_id::text)
  on conflict (organization_id, user_id) do update
    set status = case
      when public.organization_members.status = 'active' then 'active'::public.org_member_status
      else excluded.status
    end,
    joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at),
    join_source = coalesce(public.organization_members.join_source, excluded.join_source),
    referral_link = coalesce(public.organization_members.referral_link, excluded.referral_link);

  if v_sara_status = 'active' then
    update public.user_profiles up
    set organization_id = v_sara_org_id
    from auth.users au
    where up.id = au.id
      and lower(coalesce(
        nullif(trim(au.raw_user_meta_data ->> 'organization_id'), ''),
        nullif(trim(au.raw_user_meta_data ->> 'organization_slug'), ''),
        nullif(trim(au.raw_user_meta_data ->> 'organization'), '')
      )) in ('sara-org-1', 'sara-foundation', 'sara-foundation-africa', v_sara_org_id::text);
  end if;
end;
$$;

comment on function public.bootstrap_auth_user_profile() is
  'Creates a complete learner profile and resolves current or legacy organization signup targets.';
