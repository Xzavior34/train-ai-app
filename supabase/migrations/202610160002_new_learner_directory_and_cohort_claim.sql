-- Repair signup-to-admin synchronization for learner profiles, Auth email,
-- organization membership, and cohort assignment.

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

  -- Complete invite-link joins before email confirmation creates a browser
  -- session. This removes the timing gap that left fresh profiles orphaned.
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

-- Backfill names missed by older bootstrap versions that ignored display_name.
update public.user_profiles up
set display_name = coalesce(
  nullif(trim(au.raw_user_meta_data ->> 'display_name'), ''),
  nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
  split_part(au.email, '@', 1)
)
from auth.users au
where au.id = up.id
  and nullif(trim(up.display_name), '') is null;

-- Return members plus safe, same-project candidates. Candidate access is
-- limited to the dedicated Sara tenant, so shared-database admins never see
-- accounts owned by another customer organization.
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
declare
  v_is_sara boolean;
begin
  if auth.uid() is null or not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.organization_members caller
      where caller.organization_id = p_organization_id
        and caller.user_id = auth.uid()
        and caller.status = 'active'
        and caller.role in ('owner', 'admin', 'people_manager')
    )
  ) then
    raise exception 'Not authorized to view this organization directory';
  end if;

  select (
    lower(coalesce(o.slug, '')) like 'sara%'
    or lower(coalesce(o.name, '')) like 'sara foundation%'
  ) into v_is_sara
  from public.organizations o
  where o.id = p_organization_id;

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

  union all

  select
    up.id,
    coalesce(nullif(trim(up.display_name), ''), split_part(au.email, '@', 1)),
    au.email::text,
    up.role,
    p_organization_id,
    'pending'::public.org_member_status,
    up.created_at
  from public.user_profiles up
  join auth.users au on au.id = up.id
  where coalesce(v_is_sara, false)
    and not exists (
      select 1 from public.organization_members target
      where target.user_id = up.id and target.organization_id = p_organization_id
    )
    and not exists (
      select 1
      from public.organization_members other_member
      join public.organizations other_org on other_org.id = other_member.organization_id
      where other_member.user_id = up.id
        and other_member.status = 'active'
        and other_member.organization_id <> p_organization_id
        and not (
          lower(coalesce(other_org.slug, '')) = 'tech-learning'
          or lower(coalesce(other_org.name, '')) = 'digital training organization'
        )
    )
  order by 2, 3, 1;
end;
$$;

revoke all on function public.list_organization_users(uuid) from public, anon;
grant execute on function public.list_organization_users(uuid) to authenticated;

-- One authorized transaction claims an eligible learner into Sara Foundation
-- and assigns the cohort. This replaces the fragile client-side sequence.
create or replace function public.assign_user_to_cohort(
  p_cohort_id uuid,
  p_user_id uuid,
  p_exclusive boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid;
  v_is_sara boolean;
  v_member_id uuid;
begin
  select c.organization_id,
         (lower(coalesce(o.slug, '')) like 'sara%' or lower(coalesce(o.name, '')) like 'sara foundation%')
    into v_org_id, v_is_sara
  from public.cohorts c
  join public.organizations o on o.id = c.organization_id
  where c.id = p_cohort_id;

  if v_org_id is null then
    return jsonb_build_object('success', false, 'error', 'Cohort not found');
  end if;

  if auth.uid() is null or not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.organization_members caller
      where caller.organization_id = v_org_id
        and caller.user_id = auth.uid()
        and caller.status = 'active'
        and caller.role in ('owner', 'admin', 'people_manager')
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'Not authorized to manage this cohort');
  end if;

  if not exists (select 1 from public.user_profiles where id = p_user_id) then
    return jsonb_build_object('success', false, 'error', 'Learner profile not found');
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and user_id = p_user_id and status = 'active'
  ) then
    if not coalesce(v_is_sara, false) or exists (
      select 1
      from public.organization_members other_member
      join public.organizations other_org on other_org.id = other_member.organization_id
      where other_member.user_id = p_user_id
        and other_member.status = 'active'
        and other_member.organization_id <> v_org_id
        and not (
          lower(coalesce(other_org.slug, '')) = 'tech-learning'
          or lower(coalesce(other_org.name, '')) = 'digital training organization'
        )
    ) then
      return jsonb_build_object('success', false, 'error', 'This learner belongs to another organization');
    end if;

    update public.organization_members om
    set status = 'suspended'
    from public.organizations existing_org
    where om.organization_id = existing_org.id
      and om.user_id = p_user_id
      and om.status = 'active'
      and (
        lower(coalesce(existing_org.slug, '')) = 'tech-learning'
        or lower(coalesce(existing_org.name, '')) = 'digital training organization'
      );

    insert into public.organization_members (
      organization_id, user_id, role, status, invited_by, joined_at, join_source
    ) values (
      v_org_id, p_user_id, 'member', 'active', auth.uid(), now(), 'admin_assignment'
    )
    on conflict (organization_id, user_id) do update
      set status = 'active',
          invited_by = coalesce(public.organization_members.invited_by, excluded.invited_by),
          joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at);

    update public.user_profiles set organization_id = v_org_id where id = p_user_id;
  end if;

  if p_exclusive then
    delete from public.cohort_members cm
    using public.cohorts existing_cohort
    where cm.cohort_id = existing_cohort.id
      and cm.user_id = p_user_id
      and existing_cohort.organization_id = v_org_id
      and cm.cohort_id <> p_cohort_id;
  end if;

  insert into public.cohort_members (cohort_id, user_id, added_by)
  values (p_cohort_id, p_user_id, auth.uid())
  on conflict (cohort_id, user_id) do update
    set added_at = coalesce(public.cohort_members.added_at, now())
  returning id into v_member_id;

  return jsonb_build_object(
    'success', true,
    'cohort_id', p_cohort_id,
    'user_id', p_user_id,
    'cohort_member_id', v_member_id
  );
end;
$$;

revoke all on function public.assign_user_to_cohort(uuid, uuid, boolean) from public, anon;
grant execute on function public.assign_user_to_cohort(uuid, uuid, boolean) to authenticated;

create or replace function public.add_cohort_member_by_email(
  p_cohort_id uuid,
  p_email text,
  p_added_by uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_result jsonb;
begin
  select organization_id into v_org_id
  from public.cohorts
  where id = p_cohort_id;

  if v_org_id is null then
    return jsonb_build_object('success', false, 'error', 'Cohort not found');
  end if;

  if auth.uid() is null or not (
    public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.organization_members caller
      where caller.organization_id = v_org_id
        and caller.user_id = auth.uid()
        and caller.status = 'active'
        and caller.role in ('owner', 'admin', 'people_manager')
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'Not authorized to manage this cohort');
  end if;

  select au.id into v_user_id
  from auth.users au
  where lower(au.email) = lower(trim(coalesce(p_email, '')))
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'No account was found with this email');
  end if;

  v_result := public.assign_user_to_cohort(p_cohort_id, v_user_id, true);
  return v_result || jsonb_build_object('email', lower(trim(p_email)));
end;
$$;

revoke all on function public.add_cohort_member_by_email(uuid, text, uuid) from public, anon;
grant execute on function public.add_cohort_member_by_email(uuid, text, uuid) to authenticated;

comment on function public.assign_user_to_cohort(uuid, uuid, boolean) is
  'Authorized atomic organization claim and cohort assignment for existing learners.';
