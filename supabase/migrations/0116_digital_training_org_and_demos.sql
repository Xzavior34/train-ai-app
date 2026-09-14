-- ============================================================================
-- Digital Training Organization (rename), and demo orgs per tier
-- ============================================================================
-- "Multi-Tenant Database Architecture Reference," Section 2.2: the B2C
-- default-org for individual learners is named "Digital Training
-- Organization" - not "Tech Learning" (built two rounds ago, before this
-- document existed, under a different working name for the same concept).
-- Renaming the existing row in place rather than creating a second default
-- org: same slug-based lookup in join_default_organization()
-- (0106_join_default_organization.sql) still works unchanged, since that
-- function looks up by slug, not by display name.
--
-- Also per Section 2.2: "This is not a stripped-down, structure-less
-- tenant - it is a full organization in the data model, with the same
-- internal structure as any B2B tenant." No schema change needed for
-- that part specifically - any organization row already supports
-- instructor/admin/manager roles via the existing role machinery; Digital
-- Training Organization gets that "for free" just by being a real
-- organizations row, which it already was.
-- ============================================================================

update organizations
set name = 'Digital Training Organization'
where slug = 'tech-learning';

-- Section 2.3: "For engineering/demo purposes, build at least one demo
-- account per pricing tier so the tiered feature model can be tested and
-- shown... Each of these demo orgs is a fully isolated tenant just like a
-- real customer would be."
insert into organizations (name, slug, status, subscription_tier, created_by)
values
  ('Demo Org - Starter', 'demo-org-starter', 'active', 'starter', null),
  ('Demo Org - Growth', 'demo-org-growth', 'active', 'growth', null),
  ('Demo Org - Enterprise', 'demo-org-enterprise', 'active', 'enterprise', null)
on conflict (slug) do nothing;

-- Bulk variant of get_org_feature() - the application checks several flags
-- per screen (e.g. AdminAnalyticsScreen checks analytics_export AND
-- multi_department_breakdown), and the existing fetch-once-check-many-times
-- pattern used everywhere else in this app (useSupabaseQuery once, read
-- from cached data thereafter) needs one round trip, not one per flag.
create or replace function get_org_features_bulk(p_org_id uuid, p_feature_keys text[])
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_key text;
begin
  foreach v_key in array p_feature_keys loop
    v_result := v_result || jsonb_build_object(v_key, get_org_feature(p_org_id, v_key));
  end loop;
  return v_result;
end;
$$;
