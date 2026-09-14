-- =============================================================================
-- Train AI - Organization self-serve sign-up
--
-- Backlog item: "New Sign-up Flow" - organization sign-up should be its own
-- primary path, not something only a super_admin can provision by hand.
-- Before this migration, `organizations` could only be inserted by a
-- super_admin (see org_insert_super_admin in 0006_rls_policies.sql), which
-- matched Train AI 2.0's org-provisioned-by-us model but not the Starter-tier
-- self-serve motion described in the product spec (Part II, Section 10).
--
-- This does not touch org_insert_super_admin - Train AI staff can still
-- provision an org directly for Growth/Enterprise deals reached via Book a
-- Demo. This adds a second, narrower path for a brand-new authenticated user
-- registering their own organization for the first time.
-- =============================================================================

create or replace function create_organization_self_serve(p_org_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_slug text;
  v_existing_org uuid;
begin
  if v_user_id is null then
    raise exception 'Must be signed in to register an organization';
  end if;

  if p_org_name is null or length(trim(p_org_name)) < 2 then
    raise exception 'Organization name is required';
  end if;

  -- One self-serve org per user. Someone who already belongs to an
  -- organization should be added by that org's admin (invitation flow),
  -- not create a second org through this path.
  select organization_id into v_existing_org from user_profiles where id = v_user_id;
  if v_existing_org is not null then
    raise exception 'This account already belongs to an organization';
  end if;

  -- Slugify the name, then disambiguate with a short random suffix so two
  -- organizations with the same display name (e.g. two different "Acme"s)
  -- don't collide on the unique slug constraint.
  v_slug := lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  v_slug := v_slug || '-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6);

  insert into organizations (name, slug, status, subscription_tier, created_by)
  values (trim(p_org_name), v_slug, 'trial', 'starter', v_user_id)
  returning id into v_org_id;

  update user_profiles
  set organization_id = v_org_id, role = 'admin'
  where id = v_user_id;

  insert into organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org_id, v_user_id, 'owner', 'active', now());

  insert into user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  return v_org_id;
end;
$$;

comment on function create_organization_self_serve(text) is
  'Self-serve organization sign-up: the calling user becomes org owner/admin. One organization per previously-unaffiliated user. Growth/Enterprise deals reached via Book a Demo are still provisioned directly by a super_admin, unchanged from org_insert_super_admin.';
