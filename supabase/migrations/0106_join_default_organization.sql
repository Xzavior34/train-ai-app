-- ============================================================================
-- Individual signup -> "Tech Learning" default org, and a real bug fix
-- ============================================================================
-- Discovered while building this: nothing in these migrations creates a
-- user_profiles row on signup (no trigger on auth.users, and no INSERT
-- policy on user_profiles for a client to create its own row either).
-- Whatever makes user_profiles rows exist today is either configured
-- directly on the live Supabase project outside these tracked migrations,
-- or genuinely doesn't exist yet - either way, code here should not assume
-- a row is already there.
--
-- That surfaced two real bugs in create_organization_self_serve() (0102),
-- found by testing against a genuinely fresh signup (auth.users row only,
-- no user_profiles row) rather than by inspection:
--   1. It UPDATEd user_profiles to set organization_id/role, which silently
--      affects zero rows if no profile exists yet - the organization would
--      get created, but the calling user would never end up linked to it.
--   2. organizations.created_by has a foreign key to user_profiles(id), not
--      auth.users(id) - so the very first insert (creating the
--      organization itself) hard-fails with a foreign-key violation for a
--      genuinely fresh signup, before the UPDATE bug above even matters.
-- Fixed below by ensuring a bare user_profiles row exists before touching
-- organizations at all, then updating it once the org exists.
-- ============================================================================

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

  select organization_id into v_existing_org from user_profiles where id = v_user_id;
  if v_existing_org is not null then
    raise exception 'This account already belongs to an organization';
  end if;

  -- Ensure a user_profiles row exists BEFORE creating the organization:
  -- organizations.created_by has a foreign key to user_profiles(id), not
  -- auth.users(id), so a genuinely fresh signup with no profile row yet
  -- would fail the organizations insert below with a foreign-key violation
  -- (found by testing against a real fresh-signup scenario, not by
  -- inspection - the organizations insert is the very first statement to
  -- touch user_profiles transitively, so it's also the first to fail).
  insert into user_profiles (id) values (v_user_id)
  on conflict (id) do nothing;

  v_slug := lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  v_slug := v_slug || '-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6);

  insert into organizations (name, slug, status, subscription_tier, created_by)
  values (trim(p_org_name), v_slug, 'trial', 'starter', v_user_id)
  returning id into v_org_id;

  update user_profiles set organization_id = v_org_id, role = 'admin' where id = v_user_id;

  insert into organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org_id, v_user_id, 'owner', 'active', now());

  insert into user_roles (user_id, role)
  values (v_user_id, 'admin')
  on conflict (user_id, role) do nothing;

  return v_org_id;
end;
$$;

-- Individual signup path (secondary to organization signup): places a
-- previously-unaffiliated user into the "Tech Learning" default org rather
-- than leaving organization_id null. Learner role only - this is not a
-- promotion the way create_organization_self_serve's admin grant is.
create or replace function join_default_organization()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_existing_org uuid;
begin
  if v_user_id is null then
    raise exception 'Must be signed in';
  end if;

  select id into v_org_id from organizations where slug = 'tech-learning';
  if v_org_id is null then
    raise exception 'Default organization is not configured - run 0105_tech_learning_default_org.sql';
  end if;

  select organization_id into v_existing_org from user_profiles where id = v_user_id;
  if v_existing_org is not null then
    -- Already affiliated (Tech Learning already, or a real organization
    -- via invitation/self-serve) - leave it alone, this is a no-op.
    return v_existing_org;
  end if;

  insert into user_profiles (id, organization_id, role)
  values (v_user_id, v_org_id, 'learner')
  on conflict (id) do update
    set organization_id = coalesce(user_profiles.organization_id, v_org_id);

  insert into organization_members (organization_id, user_id, role, status, joined_at)
  values (v_org_id, v_user_id, 'member', 'active', now())
  on conflict do nothing;

  return v_org_id;
end;
$$;

comment on function join_default_organization() is
  'Individual (no-organization) signup path: places a previously-unaffiliated learner into the "Tech Learning" default organization. No-op if the user already belongs to any organization.';
