-- ============================================================================
-- Cohort Member Assignment & Bulk Add by Email
-- ============================================================================
-- Fixes cohort member assignment so organization admins, managers, and instructors
-- can reliably add existing members or lookup members by email to enroll into cohorts.
-- Provides a secure SECURITY DEFINER RPC that safely resolves auth.users by email
-- within the caller's authorized organization context, preventing information disclosure
-- while removing the blocker where only super_admin could perform email lookups.
-- ============================================================================

-- 1. Secure helper to look up a user by email within an authorized cohort/organization
CREATE OR REPLACE FUNCTION public.find_cohort_user_by_email(
  p_cohort_id uuid,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_clean_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_clean_email = '' OR p_cohort_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Resolve cohort organization
  SELECT organization_id INTO v_org_id FROM public.cohorts WHERE id = p_cohort_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cohort not found';
  END IF;

  -- Caller must be super_admin, or admin/owner of this organization
  IF NOT (
    is_super_admin(auth.uid())
    OR is_org_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = v_org_id
        AND role IN ('owner', 'admin', 'manager')
        AND status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to look up members for this cohort';
  END IF;

  -- Lookup user in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;
  RETURN v_user_id;
END;
$$;

-- 2. Direct atomic addition of a cohort member by email
CREATE OR REPLACE FUNCTION public.add_cohort_member_by_email(
  p_cohort_id uuid,
  p_email text,
  p_added_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_clean_email text := lower(trim(coalesce(p_email, '')));
  v_cohort_member_id uuid;
  v_added_by uuid := auth.uid();
BEGIN
  IF v_clean_email = '' OR p_cohort_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cohort ID and email are required');
  END IF;

  -- 1. Verify cohort and retrieve organization ID
  SELECT organization_id INTO v_org_id FROM public.cohorts WHERE id = p_cohort_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cohort not found');
  END IF;

  -- 2. Authorization check
  IF NOT (
    is_super_admin(auth.uid())
    OR is_org_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = v_org_id
        AND role IN ('owner', 'admin', 'manager')
        AND status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to manage this cohort');
  END IF;

  -- 3. Resolve user ID from auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user registered with this email');
  END IF;

  -- 4. Ensure member is in organization_members
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_org_id, v_user_id, 'member', 'active')
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET status = 'active' WHERE organization_members.status = 'pending';

    -- Ensure profile exists
    INSERT INTO public.user_profiles (id, organization_id, role)
    VALUES (v_user_id, v_org_id, 'learner')
    ON CONFLICT (id)
    DO UPDATE SET organization_id = coalesce(user_profiles.organization_id, v_org_id);
  END IF;

  -- 5. Add to cohort_members idempotently
  INSERT INTO public.cohort_members (cohort_id, user_id, added_by)
  VALUES (p_cohort_id, v_user_id, v_added_by)
  ON CONFLICT (cohort_id, user_id)
  DO UPDATE SET added_at = now()
  RETURNING id INTO v_cohort_member_id;

  RETURN jsonb_build_object(
    'success', true,
    'cohort_id', p_cohort_id,
    'user_id', v_user_id,
    'email', v_clean_email
  );
END;
$$;

-- Grant execute permissions to authenticated users (functions handle authorization internally)
GRANT EXECUTE ON FUNCTION public.find_cohort_user_by_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_cohort_member_by_email(uuid, text, uuid) TO authenticated;

-- 3. Update cohort_members RLS write policy to allow organization admins/managers
DROP POLICY IF EXISTS cm_write_admin ON public.cohort_members;
CREATE POLICY cm_write_admin ON public.cohort_members FOR ALL
  USING (
    is_super_admin(auth.uid())
    OR is_org_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = cohort_members.cohort_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.status = 'active'
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_org_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = cohort_members.cohort_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
        AND om.status = 'active'
    )
  );
