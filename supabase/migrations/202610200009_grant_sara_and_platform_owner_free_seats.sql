-- ============================================================================
-- Grant 300 More Seats to Sara Foundation & 1,000 Free Seats to Platform Owner Org
-- ============================================================================
-- 1. Creates grant_free_seats RPC for the Platform Owner to grant free seats.
-- 2. Grants 300 additional seats to Sara Foundation (in seat_purchases & max_users).
-- 3. Grants 1,000 free seats to the Platform Owner's organization.
-- 4. Updates org_promo_codes for SARA-FOUNDATION (350 seats) and TRAINAI-FOUNDATION (1,000 seats).
-- ============================================================================

-- Ensure seat_purchases table exists
CREATE TABLE IF NOT EXISTS public.seat_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seats_purchased int NOT NULL CHECK (seats_purchased > 0),
  amount_paid numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  payment_reference text,
  purchased_by uuid REFERENCES public.user_profiles(id),
  purchased_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seat_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seatp_select_own_org ON public.seat_purchases;
CREATE POLICY seatp_select_own_org ON public.seat_purchases FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid())
    OR is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = seat_purchases.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'people_manager')
        AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS seatp_write_super_admin ON public.seat_purchases;
CREATE POLICY seatp_write_super_admin ON public.seat_purchases FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- RPC for Platform Owner to grant free seats to any organization
CREATE OR REPLACE FUNCTION public.grant_free_seats(
  p_organization_id uuid,
  p_seats int,
  p_reason text DEFAULT 'Platform Owner Free Seats Grant'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_summary jsonb;
  v_purchased int;
  v_used int;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only Platform Owner can grant free seats';
  END IF;

  IF p_seats <= 0 THEN
    RAISE EXCEPTION 'Seat count must be positive';
  END IF;

  -- 1. Record free seat grant in seat_purchases
  INSERT INTO public.seat_purchases (
    organization_id,
    seats_purchased,
    amount_paid,
    currency,
    payment_reference,
    purchased_by
  )
  VALUES (
    p_organization_id,
    p_seats,
    0,
    'USD',
    coalesce(p_reason, 'Platform Owner Free Seats Grant'),
    auth.uid()
  );

  -- 2. Increase max_users capacity on organizations table
  UPDATE public.organizations
  SET max_users = coalesce(max_users, 0) + p_seats
  WHERE id = p_organization_id;

  -- 3. Calculate updated seats summary
  SELECT coalesce(sum(seats_purchased), 0) INTO v_purchased
  FROM public.seat_purchases
  WHERE organization_id = p_organization_id;

  SELECT count(*) INTO v_used
  FROM public.organization_members
  WHERE organization_id = p_organization_id AND status = 'active';

  v_summary := jsonb_build_object(
    'purchased', v_purchased,
    'used', v_used,
    'available', greatest(0, v_purchased - v_used)
  );

  RETURN jsonb_build_object(
    'success', true,
    'seats_granted', p_seats,
    'summary', v_summary
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grant_free_seats(uuid, int, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.grant_free_seats(uuid, int, text) TO authenticated;

-- ============================================================================
-- Execute Grants for Sara Foundation (300 more seats) and Platform Owner (1,000 free seats)
-- ============================================================================
DO $$
DECLARE
  v_sara_org_id uuid;
  v_trainai_org_id uuid;
BEGIN
  -- 1. Locate Sara Foundation Organization
  SELECT id INTO v_sara_org_id
  FROM public.organizations
  WHERE lower(coalesce(slug, '')) IN ('sara-foundation', 'sara-org-1', 'sara-foundation-africa')
     OR lower(coalesce(name, '')) LIKE '%sara foundation%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_sara_org_id IS NOT NULL THEN
    -- Grant 300 more seats to Sara Foundation
    INSERT INTO public.seat_purchases (
      organization_id,
      seats_purchased,
      amount_paid,
      currency,
      payment_reference
    )
    VALUES (
      v_sara_org_id,
      300,
      0,
      'USD',
      'PLATFORM_OWNER_GRANT_300_SEATS'
    );

    UPDATE public.organizations
    SET max_users = greatest(coalesce(max_users, 50) + 300, 350)
    WHERE id = v_sara_org_id;

    RAISE NOTICE 'Granted 300 additional seats to Sara Foundation (Org ID: %)', v_sara_org_id;
  END IF;

  -- 2. Locate Platform Owner Organization (Train AI LTD / Train AI Academy / Digital Training)
  SELECT id INTO v_trainai_org_id
  FROM public.organizations
  WHERE lower(coalesce(slug, '')) IN ('trainai-ltd', 'trainai-hq', 'tech-learning', 'digital-training-hq')
     OR lower(coalesce(name, '')) LIKE '%train ai%'
     OR lower(coalesce(name, '')) LIKE '%digital training%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_trainai_org_id IS NOT NULL THEN
    -- Grant 1,000 free seats to the Platform Owner's organization
    INSERT INTO public.seat_purchases (
      organization_id,
      seats_purchased,
      amount_paid,
      currency,
      payment_reference
    )
    VALUES (
      v_trainai_org_id,
      1000,
      0,
      'USD',
      'PLATFORM_OWNER_GRANT_1000_FREE_SEATS'
    );

    UPDATE public.organizations
    SET max_users = greatest(coalesce(max_users, 0), 1000)
    WHERE id = v_trainai_org_id;

    RAISE NOTICE 'Granted 1000 free seats to Platform Owner Org (Org ID: %)', v_trainai_org_id;
  END IF;
END $$;

-- Update promo codes table if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_promo_codes' AND table_schema = 'public') THEN
    UPDATE public.org_promo_codes
    SET grant_seats = 350
    WHERE code = 'SARA-FOUNDATION';

    UPDATE public.org_promo_codes
    SET grant_seats = 1000
    WHERE code = 'TRAINAI-FOUNDATION';

    INSERT INTO public.org_promo_codes (code, name, tier, grant_ai_credits, grant_seats, organization_type)
    VALUES
      ('SARA-FOUNDATION-300', 'Sara Foundation 300 Additional Seats Grant', 'starter', 1000, 350, 'foundation'),
      ('PLATFORM-OWNER-1000', 'Platform Owner 1000 Free Seats Grant', 'enterprise', 5000, 1000, 'platform')
    ON CONFLICT (code) DO UPDATE
      SET grant_seats = EXCLUDED.grant_seats;
  END IF;
END $$;
