-- ============================================================================
-- Phase 2 (trust-root/SECURITY DEFINER audit) findings: three functions with
-- no authorization check at all, found by inventorying every SECURITY
-- DEFINER function in the schema rather than only the ones already known
-- to be involved in courses/cohorts.
-- ============================================================================
-- get_mentor_analytics(p_mentor_id) - any authenticated user (a learner in
-- any organization) could query any mentor's total sessions, average
-- rating, and total EARNINGS by passing their mentor_id - a real financial
-- data leak, not just a courtesy statistic. Confirmed unauthenticated
-- (no auth.uid() check at all) by reading the function body directly.
--
-- search_mentionable_users(p_query) - searched user_profiles.display_name
-- platform-wide with no organization filter, callable directly by any
-- authenticated user (used by the @mention search bar). Let anyone
-- enumerate which users/display names exist in OTHER organizations -
-- lower severity than the courses/certificates leaks (a name, not content),
-- but the same class of cross-tenant disclosure this whole pass exists to
-- close, and directly client-reachable.
--
-- get_org_feature / get_org_features_bulk - took p_org_id directly with no
-- check that the caller belongs to that org, letting any authenticated
-- user read any organization's feature-flag configuration. Confirmed
-- client-reachable: fetchOrgFeatures() in src/lib/api/organizations.js
-- calls get_org_features_bulk directly with the org id from context - that
-- legitimate call always passes the caller's own org, so restricting the
-- function does not change its behavior for real callers, only for a
-- caller passing someone else's org id on purpose.
-- ============================================================================

create or replace function get_mentor_analytics(p_mentor_id uuid)
returns table (total_sessions bigint, completed_sessions bigint, avg_rating numeric, total_earnings numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_mentor_user_id uuid;
  v_mentor_org uuid;
begin
  select user_id, organization_id into v_mentor_user_id, v_mentor_org from mentors where id = p_mentor_id;
  if not (
    v_mentor_user_id = auth.uid()
    or (is_org_admin(auth.uid()) and v_mentor_org is not null and v_mentor_org = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to view this mentor''s analytics';
  end if;
  return query
  select
    count(*) filter (where true),
    count(*) filter (where status = 'completed'),
    (select avg(rating) from session_ratings where mentor_id = p_mentor_id),
    (select coalesce(sum(amount), 0) from mentor_earnings where mentor_id = p_mentor_id)
  from mentorship_sessions where mentor_id = p_mentor_id;
end;
$$;

create or replace function search_mentionable_users(p_query text, p_limit int default 10)
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select id, display_name from user_profiles
  where display_name ilike '%' || p_query || '%'
    and organization_id = get_user_organization_id(auth.uid())
  limit p_limit;
$$;

create or replace function get_org_feature(p_org_id uuid, p_feature_key text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_override boolean;
  v_tier subscription_tier;
begin
  if not (p_org_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid())) then
    raise exception 'Not authorized to read this organization''s feature settings';
  end if;

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

create or replace function get_org_features_bulk(p_org_id uuid, p_feature_keys text[])
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_key text;
begin
  if not (p_org_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid())) then
    raise exception 'Not authorized to read this organization''s feature settings';
  end if;
  foreach v_key in array p_feature_keys loop
    v_result := v_result || jsonb_build_object(v_key, get_org_feature(p_org_id, v_key));
  end loop;
  return v_result;
end;
$$;

-- ============================================================================
-- certificate_templates SELECT (ct_select_all) was still `using (true)` -
-- 0149 fixed the write policy but missed that the read policy independently
-- exposed every organization's certificate template (title, passing score,
-- approval requirement, and template_text - actual certificate wording/
-- branding) to any signed-in user platform-wide. Certificates' own
-- organization_id-based policies (also 0149) are unaffected by this change.
-- ============================================================================
drop policy if exists ct_select_all on certificate_templates;
create policy ct_select_all on certificate_templates for select
  using (
    certificate_templates.organization_id is null
    or exists (select 1 from courses c where c.id = certificate_templates.course_id and c.instructor_id = auth.uid())
    or certificate_templates.organization_id = get_user_organization_id(auth.uid())
    or is_super_admin(auth.uid())
  );
