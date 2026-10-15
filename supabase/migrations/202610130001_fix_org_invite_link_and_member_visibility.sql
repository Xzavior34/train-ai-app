-- ============================================================================
-- Fix Organization Invite Link, Member Onboarding & Admin Visibility
-- ============================================================================
-- Ensures users who click organization referral links (?join=slug or ?org=id)
-- are reliably captured, enrolled into organization_members, and visible to
-- organization admins in People & Access (both active Directory and Pending Approvals).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_organization_by_invite(
  p_org_target text,
  p_role text DEFAULT 'learner'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org record;
  v_clean_input text := lower(trim(coalesce(p_org_target, '')));
  v_role text := CASE WHEN lower(coalesce(p_role, 'learner')) IN ('instructor', 'mentor') THEN 'mentor' ELSE 'learner' END;
  v_ref_link text;
  v_require_approval boolean := false;
  v_status text := 'active';
  v_existing_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_clean_input = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization identifier is required');
  END IF;

  -- Resolve organization by UUID, slug, name, or common aliases
  SELECT *
  INTO v_org
  FROM public.organizations o
  WHERE o.id::text = trim(p_org_target)
     OR lower(coalesce(o.slug, '')) = v_clean_input
     OR lower(coalesce(o.name, '')) = v_clean_input
     OR (
       v_clean_input IN ('sara-foundation', 'sara-org-1', 'sara-foundation-africa', 'sara')
       AND (
         lower(coalesce(o.slug, '')) LIKE 'sara%'
         OR lower(coalesce(o.name, '')) LIKE 'sara foundation%'
       )
     )
     OR (
       v_clean_input IN ('cap', 'cap3', 'cap-cohort-3', 'cap3-foundation')
       AND (
         lower(coalesce(o.slug, '')) LIKE 'cap%'
         OR lower(coalesce(o.name, '')) LIKE 'cap cohort%'
       )
     )
  ORDER BY o.created_at ASC
  LIMIT 1;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found or invite link expired');
  END IF;

  v_ref_link := '/?join=' || COALESCE(v_org.slug, v_org.id::text);

  -- Check existing membership status
  SELECT status INTO v_existing_status
  FROM public.organization_members
  WHERE organization_id = v_org.id AND user_id = v_user_id;

  IF v_existing_status = 'active' THEN
    -- Ensure profile pointers are current
    UPDATE public.user_profiles
    SET organization_id = v_org.id,
        join_source = COALESCE(join_source, 'shareable_link'),
        referral_link = COALESCE(referral_link, v_ref_link)
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'already_member', true,
      'pending_approval', false,
      'status', 'active',
      'organization_id', v_org.id,
      'organization_name', v_org.name,
      'slug', v_org.slug
    );
  END IF;

  -- Determine if approval is required before activating
  IF v_org.require_join_approval IS TRUE THEN
    v_require_approval := true;
    v_status := 'pending';
  ELSE
    -- Check seat capacity if active paid organization
    BEGIN
      IF NOT public.check_seat_available(v_org.id) THEN
        v_require_approval := true;
        v_status := 'pending';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_status := 'active';
    END;
  END IF;

  -- Insert/update organization_members
  INSERT INTO public.organization_members (
    organization_id, user_id, role, status, joined_at, join_source, referral_link
  )
  VALUES (
    v_org.id, v_user_id, 'member', v_status, now(), 'shareable_link', v_ref_link
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET
    status = CASE WHEN organization_members.status = 'active' THEN 'active' ELSE v_status END,
    join_source = COALESCE(organization_members.join_source, 'shareable_link'),
    referral_link = COALESCE(organization_members.referral_link, EXCLUDED.referral_link),
    joined_at = COALESCE(organization_members.joined_at, now());

  -- If active, link profile directly
  IF v_status = 'active' THEN
    UPDATE public.user_profiles
    SET
      organization_id = v_org.id,
      join_source = COALESCE(join_source, 'shareable_link'),
      referral_link = COALESCE(referral_link, v_ref_link),
      joined_at = COALESCE(joined_at, now())
    WHERE id = v_user_id;

    -- Ensure role exists in user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, v_role::platform_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Grant starter AI credit account if applicable
  BEGIN
    PERFORM public.get_or_create_learner_credit_account(v_user_id, v_org.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'pending_approval', (v_status = 'pending'),
    'status', v_status,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'slug', v_org.slug,
    'join_source', 'shareable_link',
    'referral_link', v_ref_link
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_organization_by_invite(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_organization_by_invite(text, text) TO authenticated, service_role;

-- Overload for single-parameter call
CREATE OR REPLACE FUNCTION public.join_organization_by_invite(p_org_target text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.join_organization_by_invite(p_org_target, 'learner');
END;
$$;

REVOKE ALL ON FUNCTION public.join_organization_by_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_organization_by_invite(text) TO authenticated, service_role;

-- Direct helper to record membership by explicit user ID
CREATE OR REPLACE FUNCTION public.record_pending_org_join(
  p_user_id uuid,
  p_org_target text,
  p_role text DEFAULT 'learner'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_clean_input text := lower(trim(coalesce(p_org_target, '')));
  v_ref_link text;
  v_status text := 'active';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;

  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to record this organization join';
  END IF;

  SELECT *
  INTO v_org
  FROM public.organizations o
  WHERE o.id::text = trim(p_org_target)
     OR lower(coalesce(o.slug, '')) = v_clean_input
     OR lower(coalesce(o.name, '')) = v_clean_input
  ORDER BY o.created_at ASC
  LIMIT 1;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  v_ref_link := '/?join=' || COALESCE(v_org.slug, v_org.id::text);

  IF v_org.require_join_approval IS TRUE THEN
    v_status := 'pending';
  END IF;

  INSERT INTO public.organization_members (
    organization_id, user_id, role, status, joined_at, join_source, referral_link
  )
  VALUES (
    v_org.id, p_user_id, 'member', v_status, now(), 'shareable_link', v_ref_link
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET
    status = CASE WHEN organization_members.status = 'active' THEN 'active' ELSE v_status END,
    join_source = COALESCE(organization_members.join_source, 'shareable_link'),
    referral_link = COALESCE(organization_members.referral_link, EXCLUDED.referral_link),
    joined_at = COALESCE(organization_members.joined_at, now());

  IF v_status = 'active' THEN
    UPDATE public.user_profiles
    SET organization_id = v_org.id,
        join_source = COALESCE(join_source, 'shareable_link'),
        referral_link = COALESCE(referral_link, v_ref_link),
        joined_at = COALESCE(joined_at, now())
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'slug', v_org.slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_pending_org_join(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_pending_org_join(uuid, text, text) TO authenticated, service_role;
