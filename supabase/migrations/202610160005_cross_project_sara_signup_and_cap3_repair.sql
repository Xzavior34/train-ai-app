-- Organization UUIDs are project-local. A Sara Foundation row from the
-- shared organization directory was previously merged into the signup list
-- and its UUID was sent to the dedicated Sara project. Resolve that known
-- legacy UUID as Sara, repair affected signups, and guarantee that every CAP
-- Cohort 3 member has matching organization state.

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
         lower(v_org_target) in (
           'sara-org-1',
           'sara-foundation',
           'sara-foundation-africa',
           'bee8f57e-c14c-4230-98ee-233346e51ebe'
         )
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

do $$
declare
  v_sara_org_id uuid;
  v_cap3_id uuid;
  v_external_sara_id constant text := 'bee8f57e-c14c-4230-98ee-233346e51ebe';
  v_regina_id uuid;
begin
  select o.id into v_sara_org_id
  from public.organizations o
  where lower(coalesce(o.slug, '')) like 'sara%'
     or lower(coalesce(o.name, '')) like 'sara foundation%'
  order by o.created_at asc
  limit 1;

  if v_sara_org_id is null then
    -- The shared project intentionally has no dedicated Sara tenant.
    return;
  end if;

  select c.id into v_cap3_id
  from public.cohorts c
  where c.organization_id = v_sara_org_id
    and lower(regexp_replace(trim(c.name), '\s+', ' ', 'g')) like 'cap cohort 3%'
  order by c.created_at desc
  limit 1;

  -- Repair every account that received the shared project's Sara UUID.
  insert into public.organization_members (
    organization_id, user_id, role, status, joined_at, join_source, referral_link
  )
  select
    v_sara_org_id,
    au.id,
    'member'::public.org_member_role,
    'active'::public.org_member_status,
    coalesce(au.created_at, now()),
    'signup_repair',
    '/?join=sara-foundation'
  from auth.users au
  where lower(coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'organization_id'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'organization_slug'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'organization'), '')
  )) = v_external_sara_id
  on conflict (organization_id, user_id) do update
    set status = 'active',
        joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at),
        join_source = 'signup_repair',
        referral_link = excluded.referral_link;

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
    )) = v_external_sara_id;

  update public.user_profiles up
  set organization_id = v_sara_org_id
  from auth.users au
  where up.id = au.id
    and lower(coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'organization_id'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'organization_slug'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'organization'), '')
    )) = v_external_sara_id;

  -- Regina was confirmed by the platform owner as a CAP Cohort 3 learner.
  select au.id into v_regina_id
  from auth.users au
  where lower(au.email) = 'inemregina46@gmail.com'
  limit 1;

  if v_regina_id is not null and v_cap3_id is not null then
    insert into public.cohort_members (cohort_id, user_id)
    values (v_cap3_id, v_regina_id)
    on conflict (cohort_id, user_id) do nothing;
  end if;

  -- Cohort membership is authoritative: repair any historical CAP Cohort 3
  -- member whose active organization membership or profile drifted.
  if v_cap3_id is not null then
    insert into public.organization_members (
      organization_id, user_id, role, status, joined_at, join_source
    )
    select
      v_sara_org_id,
      cm.user_id,
      'member'::public.org_member_role,
      'active'::public.org_member_status,
      coalesce(cm.added_at, now()),
      'cohort_sync'
    from public.cohort_members cm
    where cm.cohort_id = v_cap3_id
    on conflict (organization_id, user_id) do update
      set status = 'active',
          joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at);

    update public.user_profiles up
    set organization_id = v_sara_org_id
    where exists (
      select 1 from public.cohort_members cm
      where cm.cohort_id = v_cap3_id and cm.user_id = up.id
    );

    update public.organization_members om
    set status = 'suspended'
    from public.organizations existing_org
    where om.organization_id = existing_org.id
      and om.status = 'active'
      and (
        lower(coalesce(existing_org.slug, '')) = 'tech-learning'
        or lower(coalesce(existing_org.name, '')) = 'digital training organization'
      )
      and exists (
        select 1 from public.cohort_members cm
        where cm.cohort_id = v_cap3_id and cm.user_id = om.user_id
      );
  end if;
end;
$$;

comment on function public.bootstrap_auth_user_profile() is
  'Creates learner profiles and resolves local, canonical, and known legacy cross-project organization targets.';
