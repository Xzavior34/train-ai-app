-- ============================================================================
-- 0165_sso_domain_routing.sql
-- Route new signups to their organization based on email domain (org_sso_settings)
-- ============================================================================

create or replace function join_default_organization()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_domain text;
  v_matched_org_id uuid;
  v_default_org_id uuid;
  v_existing_org uuid;
begin
  if v_user_id is null then
    raise exception 'Must be signed in';
  end if;

  select organization_id into v_existing_org from user_profiles where id = v_user_id;
  if v_existing_org is not null then
    return v_existing_org;
  end if;

  -- Read caller's email from auth.users
  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is not null and position('@' in v_user_email) > 0 then
    v_domain := lower(split_part(v_user_email, '@', 2));
    
    -- Check org_sso_settings for matching allowed_domain
    select organization_id into v_matched_org_id
    from org_sso_settings
    where lower(allowed_domain) = v_domain and enabled = true
    limit 1;
  end if;

  -- Fallback to 'tech-learning' if domain doesn't match an SSO org
  if v_matched_org_id is null then
    select id into v_default_org_id from organizations where slug = 'tech-learning';
    v_matched_org_id := v_default_org_id;
  end if;

  if v_matched_org_id is null then
    raise exception 'Default organization is not configured';
  end if;

  insert into user_profiles (id, organization_id, role)
  values (v_user_id, v_matched_org_id, 'learner')
  on conflict (id) do update
    set organization_id = coalesce(user_profiles.organization_id, v_matched_org_id);

  insert into organization_members (organization_id, user_id, role, status, joined_at)
  values (v_matched_org_id, v_user_id, 'member', 'active', now())
  on conflict do nothing;

  return v_matched_org_id;
end;
$$;

comment on function join_default_organization() is
  'Places new signups into their domain-matched SSO organization if registered in org_sso_settings, or falls back to "tech-learning". No-op if already affiliated.';
