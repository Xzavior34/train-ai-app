-- =============================================================================
-- Migration 0171: Support Plan Tier Selection in Self-Serve Org Creation
--
-- Enables organizations to choose their plan (Starter, Growth, Enterprise)
-- during registration/signup flow.
-- =============================================================================

create or replace function create_organization_self_serve(p_org_name text, p_tier text default 'growth')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_slug text;
  v_existing_org uuid;
  v_tier subscription_tier := 'growth';
  v_max_users int := 100;
begin
  if v_user_id is null then
    raise exception 'Must be signed in to register an organization';
  end if;

  if p_org_name is null or length(trim(p_org_name)) < 2 then
    raise exception 'Organization name is required';
  end if;

  if p_tier in ('starter', 'growth', 'enterprise') then
    v_tier := p_tier::subscription_tier;
  end if;

  if v_tier = 'starter' then
    v_max_users := 100;
  elsif v_tier = 'growth' then
    v_max_users := 500;
  elsif v_tier = 'enterprise' then
    v_max_users := 5000;
  end if;

  select organization_id into v_existing_org from user_profiles where id = v_user_id;
  if v_existing_org is not null then
    raise exception 'This account already belongs to an organization';
  end if;

  v_slug := lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'org';
  end if;
  v_slug := v_slug || '-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6);

  insert into organizations (name, slug, status, subscription_tier, max_users, created_by)
  values (trim(p_org_name), v_slug, 'trial', v_tier, v_max_users, v_user_id)
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
