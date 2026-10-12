-- ============================================================================
-- Migration: 202610120001_user_referral_link_and_date_tracking.sql
-- Purpose:
--   1. Add `join_source` and `referral_link` tracking columns to
--      `organization_members` and `user_profiles` for accurate tracking of
--      users who join via an Organization Shareable Invite & Referral Link
--      versus direct email invitations or admin provisioning.
--   2. Ensure `created_at` / `joined_at` timestamps are populated for date
--      filtering across Organization Admin and Platform Owner views.
--   3. Update `join_organization_by_invite` RPC to record `join_source = 'shareable_link'`
--      and the exact `referral_link` slug (`/?join=<slug>`).
-- ============================================================================

-- 1. Add tracking columns to organization_members
ALTER TABLE IF EXISTS public.organization_members
  ADD COLUMN IF NOT EXISTS join_source text DEFAULT 'shareable_link',
  ADD COLUMN IF NOT EXISTS referral_link text;

-- 2. Add tracking columns to user_profiles
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS join_source text DEFAULT 'shareable_link',
  ADD COLUMN IF NOT EXISTS referral_link text;

-- 3. Backfill organization_members join_source and referral_link where null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_members'
  ) THEN
    UPDATE public.organization_members om
    SET
      join_source = CASE
        WHEN om.invited_by IS NOT NULL THEN 'email_invite'
        ELSE COALESCE(om.join_source, 'shareable_link')
      END,
      referral_link = COALESCE(
        om.referral_link,
        '/?join=' || COALESCE(
          (SELECT o.slug FROM public.organizations o WHERE o.id = om.organization_id LIMIT 1),
          om.organization_id::text
        )
      ),
      joined_at = COALESCE(om.joined_at, om.invited_at, now())
    WHERE om.referral_link IS NULL OR om.join_source IS NULL;
  END IF;
END $$;

-- 4. Backfill user_profiles joined_at, join_source, and referral_link where null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    UPDATE public.user_profiles up
    SET
      joined_at = COALESCE(
        up.joined_at,
        (SELECT om.joined_at FROM public.organization_members om WHERE om.user_id = up.id ORDER BY om.joined_at DESC NULLS LAST LIMIT 1),
        up.created_at,
        up.last_active_at,
        now()
      ),
      join_source = COALESCE(
        (SELECT om.join_source FROM public.organization_members om WHERE om.user_id = up.id ORDER BY om.joined_at DESC NULLS LAST LIMIT 1),
        up.join_source,
        'shareable_link'
      ),
      referral_link = COALESCE(
        up.referral_link,
        (SELECT om.referral_link FROM public.organization_members om WHERE om.user_id = up.id ORDER BY om.joined_at DESC NULLS LAST LIMIT 1),
        CASE
          WHEN up.organization_id IS NOT NULL THEN
            '/?join=' || COALESCE(
              (SELECT o.slug FROM public.organizations o WHERE o.id = up.organization_id LIMIT 1),
              up.organization_id::text
            )
          ELSE NULL
        END
      )
    WHERE up.referral_link IS NULL OR up.joined_at IS NULL;
  END IF;
END $$;

-- 5. Update join_organization_by_invite to explicitly record join_source and referral_link
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
  v_role text := CASE WHEN lower(coalesce(p_role, 'learner')) IN ('instructor', 'mentor') THEN 'instructor' ELSE 'learner' END;
  v_ref_link text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_clean_input = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization identifier is required');
  END IF;

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
  ORDER BY o.created_at ASC
  LIMIT 1;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found or invite link expired');
  END IF;

  v_ref_link := '/?join=' || COALESCE(v_org.slug, v_org.id::text);

  -- Update profiles if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    UPDATE public.profiles
    SET
      org_id = v_org.id,
      organization = COALESCE(v_org.name, organization),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Update user_profiles with referral_link and join_source
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    UPDATE public.user_profiles
    SET
      organization_id = v_org.id,
      join_source = 'shareable_link',
      referral_link = v_ref_link,
      joined_at = COALESCE(joined_at, now())
    WHERE id = v_user_id;
  END IF;

  -- Upsert organization_members with join_source = 'shareable_link'
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_members'
  ) THEN
    INSERT INTO public.organization_members (
      organization_id, user_id, role, status, joined_at, join_source, referral_link
    )
    VALUES (
      v_org.id, v_user_id, 'member', 'active', now(), 'shareable_link', v_ref_link
    )
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET
      join_source = COALESCE(organization_members.join_source, 'shareable_link'),
      referral_link = COALESCE(organization_members.referral_link, EXCLUDED.referral_link),
      joined_at = COALESCE(organization_members.joined_at, now());
  END IF;

  BEGIN
    PERFORM public.get_or_create_learner_credit_account(v_user_id, v_org.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'organization_slug', v_org.slug,
    'join_source', 'shareable_link',
    'referral_link', v_ref_link,
    'role', v_role,
    'status', 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_organization_by_invite(text, text) TO authenticated, service_role;
