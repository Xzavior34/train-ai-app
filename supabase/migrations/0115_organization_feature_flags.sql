-- ============================================================================
-- Real per-organization feature flags - replacing hardcoded tier checks
-- ============================================================================
-- "Train AI - Multi-Tenant Database Architecture Reference" (Sarah),
-- Section 3: "Feature availability is not hardcoded per organization
-- type - it's controlled centrally by Train AI as platform owner... via
-- toggleable feature flags per organization." Section 6: "Model as a
-- per-organization settings/config table (organization_id, feature_key,
-- enabled) rather than hardcoding tier logic."
--
-- What existed before this (lib/tierFeatures.js, built two rounds ago)
-- hardcoded a tier->feature map directly in application code - correct
-- defaults, wrong mechanism per this doc. This migration adds the real
-- mechanism (a real settings table, checked by a real SQL function), and
-- the application-layer tier map becomes only the *default* used when no
-- explicit per-org override row exists - same architecture already used
-- for role_permissions_matrix + user_permission_overrides
-- (0005_functions.sql: effective_has_permission resolves explicit
-- grant/revoke first, falls back to the role default) - this mirrors that
-- exact pattern for organizations instead of users.
-- ============================================================================

create table if not exists organization_feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  set_by uuid references user_profiles(id),
  updated_at timestamptz not null default now(),
  unique (organization_id, feature_key)
);

alter table organization_feature_flags enable row level security;

drop policy if exists off_select_member on organization_feature_flags;
create policy off_select_member on organization_feature_flags for select
  using (
    organization_id = get_user_organization_id(auth.uid())
    or is_super_admin(auth.uid())
  );

-- Only the platform owner sets these - "Feature flag control: Turn
-- features on/off per organization" is listed explicitly under Section 4's
-- Platform Owner View capabilities, not under any organization's own Admin
-- capabilities. A tenant admin (even Enterprise) does not get to grant
-- itself SSO by editing this table.
drop policy if exists off_write_super_admin on organization_feature_flags;
create policy off_write_super_admin on organization_feature_flags for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- Tier-based defaults, matching Section 3's baseline table exactly. Used
-- only when no explicit organization_feature_flags row exists for that
-- org+feature - an explicit row (set by the platform owner) always wins,
-- same resolution order as effective_has_permission.
create or replace function tier_default_feature(p_tier subscription_tier, p_feature_key text)
returns boolean
language sql immutable as $$
  select case p_feature_key
    when 'learner_view' then true
    when 'instructor_view' then true
    when 'admin_view' then true
    when 'manager_view' then p_tier in ('growth', 'enterprise')
    when 'ai_intelligence_layer' then true  -- everyone gets at least "Limited"
    when 'ai_intelligence_advanced' then p_tier in ('growth', 'enterprise')  -- the "Limited" vs "Yes" distinction
    when 'sso' then p_tier = 'enterprise'
    when 'api_integrations' then p_tier = 'enterprise'
    when 'analytics_export' then p_tier in ('growth', 'enterprise')
    when 'multi_department_breakdown' then p_tier in ('growth', 'enterprise')
    when 'custom_branding' then p_tier = 'enterprise'
    else false
  end;
$$;

create or replace function get_org_feature(p_org_id uuid, p_feature_key text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_override boolean;
  v_tier subscription_tier;
begin
  select enabled into v_override
  from organization_feature_flags
  where organization_id = p_org_id and feature_key = p_feature_key;

  if v_override is not null then
    return v_override;
  end if;

  select subscription_tier into v_tier from organizations where id = p_org_id;
  return tier_default_feature(coalesce(v_tier, 'starter'), p_feature_key);
end;
$$;

comment on function get_org_feature(uuid, text) is
  'Resolution order: explicit organization_feature_flags row always wins (platform-owner override), then falls back to the tier default (tier_default_feature) - same shape as effective_has_permission for users.';
