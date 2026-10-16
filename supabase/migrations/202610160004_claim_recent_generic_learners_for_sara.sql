-- The five learner accounts created from 12 to 14 October 2026 without an
-- organization target were confirmed by the platform owner to be Sara
-- Foundation applicants who selected the wrong option during signup.
-- Move only that bounded, unambiguous set into Sara's approval queue.

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

  -- The shared B2B database does not contain the Sara tenant.
  if v_sara_org_id is null then
    return;
  end if;

  insert into public.organization_members (
    organization_id, user_id, role, status, joined_at, join_source, referral_link
  )
  select
    v_sara_org_id,
    au.id,
    'member'::public.org_member_role,
    v_sara_status,
    coalesce(au.created_at, now()),
    'admin_correction',
    '/?join=sara-org-1'
  from auth.users au
  join public.user_profiles up on up.id = au.id
  where au.created_at >= '2026-10-12 00:00:00+00'::timestamptz
    and au.created_at < '2026-10-15 00:00:00+00'::timestamptz
    and coalesce(au.raw_user_meta_data ->> 'account_type', au.raw_user_meta_data ->> 'role', 'learner') = 'learner'
    and coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'organization_id'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'organization_slug'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'organization'), '')
    ) is null
    and not exists (
      select 1
      from public.organization_members other_member
      join public.organizations other_org on other_org.id = other_member.organization_id
      where other_member.user_id = au.id
        and other_member.status = 'active'
        and other_member.organization_id <> v_sara_org_id
        and not (
          lower(coalesce(other_org.slug, '')) = 'tech-learning'
          or lower(coalesce(other_org.name, '')) = 'digital training organization'
        )
    )
  on conflict (organization_id, user_id) do update
    set status = case
      when public.organization_members.status = 'active' then 'active'::public.org_member_status
      else excluded.status
    end,
    joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at),
    join_source = 'admin_correction',
    referral_link = coalesce(public.organization_members.referral_link, excluded.referral_link);

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
    and au.created_at >= '2026-10-12 00:00:00+00'::timestamptz
    and au.created_at < '2026-10-15 00:00:00+00'::timestamptz
    and coalesce(au.raw_user_meta_data ->> 'account_type', au.raw_user_meta_data ->> 'role', 'learner') = 'learner'
    and coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'organization_id'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'organization_slug'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'organization'), '')
    ) is null
    and exists (
      select 1 from public.organization_members sara_member
      where sara_member.organization_id = v_sara_org_id
        and sara_member.user_id = au.id
    );

  if v_sara_status = 'active' then
    update public.user_profiles up
    set organization_id = v_sara_org_id
    from auth.users au
    where up.id = au.id
      and au.created_at >= '2026-10-12 00:00:00+00'::timestamptz
      and au.created_at < '2026-10-15 00:00:00+00'::timestamptz
      and coalesce(au.raw_user_meta_data ->> 'account_type', au.raw_user_meta_data ->> 'role', 'learner') = 'learner'
      and coalesce(
        nullif(trim(au.raw_user_meta_data ->> 'organization_id'), ''),
        nullif(trim(au.raw_user_meta_data ->> 'organization_slug'), ''),
        nullif(trim(au.raw_user_meta_data ->> 'organization'), '')
      ) is null;
  end if;
end;
$$;
