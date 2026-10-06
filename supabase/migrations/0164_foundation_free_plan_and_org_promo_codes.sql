-- ============================================================================
-- Migration: 0164_foundation_free_plan_and_org_promo_codes.sql
-- Description: Foundation promo code validation, free Basic plan provisioning
-- with pre-loaded AI credits, seat allocation, and mandatory payment checks.
-- ============================================================================

-- 1. Table for Organization Promo & Foundation Bypass Codes
CREATE TABLE IF NOT EXISTS public.org_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'starter',
  grant_ai_credits INT NOT NULL DEFAULT 1000,
  grant_seats INT NOT NULL DEFAULT 50,
  max_redemptions INT NOT NULL DEFAULT 100,
  redemptions_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  organization_type TEXT NOT NULL DEFAULT 'foundation',
  expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '1 year'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed standard Foundation & Partner Bypass Codes
INSERT INTO public.org_promo_codes (code, name, tier, grant_ai_credits, grant_seats, organization_type)
VALUES
  ('SARA-FOUNDATION', 'Sara Foundation Africa Social Impact Grant', 'starter', 1000, 50, 'foundation'),
  ('FOUNDATION-FREE', 'Global Non-Profit Free Basic Plan', 'starter', 1000, 50, 'foundation'),
  ('TRAINAI-FOUNDATION', 'Train AI Impact & Foundation Partner', 'starter', 1000, 50, 'foundation'),
  ('CAP3-FOUNDATION', 'CAP Cohort 3 Foundation Sponsor', 'starter', 1000, 50, 'foundation'),
  ('IMPACT-2026', 'Non-Governmental Organization Grant 2026', 'starter', 1000, 50, 'foundation')
ON CONFLICT (code) DO UPDATE
  SET grant_ai_credits = EXCLUDED.grant_ai_credits,
      grant_seats = EXCLUDED.grant_seats,
      is_active = true;

ALTER TABLE public.org_promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_promo_codes_select_public ON public.org_promo_codes;
CREATE POLICY org_promo_codes_select_public ON public.org_promo_codes
  FOR SELECT USING (true);

-- 2. Validation RPC for checking promo code before signup
CREATE OR REPLACE FUNCTION public.validate_org_promo_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec org_promo_codes%ROWTYPE;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No code provided');
  END IF;

  SELECT * INTO v_rec 
  FROM org_promo_codes 
  WHERE upper(trim(code)) = upper(trim(p_code))
  LIMIT 1;

  IF v_rec.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid foundation or promo code.');
  END IF;

  IF NOT v_rec.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This code has been deactivated.');
  END IF;

  IF v_rec.expires_at IS NOT NULL AND v_rec.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This code has expired.');
  END IF;

  IF v_rec.redemptions_count >= v_rec.max_redemptions THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Maximum redemptions reached for this code.');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_rec.code,
    'name', v_rec.name,
    'tier', v_rec.tier,
    'grant_ai_credits', v_rec.grant_ai_credits,
    'grant_seats', v_rec.grant_seats,
    'organization_type', v_rec.organization_type
  );
END;
$$;

-- 3. Comprehensive Self-Serve Registration with Promo Code or Payment Verification
CREATE OR REPLACE FUNCTION public.create_organization_with_code_or_payment(
  p_org_name TEXT,
  p_promo_code TEXT DEFAULT NULL,
  p_payment_ref TEXT DEFAULT NULL,
  p_payment_provider TEXT DEFAULT 'test_flow'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_org_id UUID;
  v_slug TEXT;
  v_base_slug TEXT;
  v_promo org_promo_codes%ROWTYPE;
  v_tier TEXT := 'starter';
  v_seats INT := 50;
  v_credits INT := 0;
  v_credit_acc_id UUID;
  v_is_promo_used BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create an organization';
  END IF;

  IF p_org_name IS NULL OR length(trim(p_org_name)) < 2 THEN
    RAISE EXCEPTION 'Organization name must be at least 2 characters';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Verify Promo Code if provided
  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo 
    FROM org_promo_codes 
    WHERE upper(trim(code)) = upper(trim(p_promo_code))
    FOR UPDATE;

    IF v_promo.id IS NOT NULL AND v_promo.is_active AND (v_promo.expires_at IS NULL OR v_promo.expires_at > NOW()) THEN
      v_is_promo_used := true;
      v_tier := v_promo.tier;
      v_credits := v_promo.grant_ai_credits;
      v_seats := v_promo.grant_seats;

      UPDATE org_promo_codes 
      SET redemptions_count = redemptions_count + 1, updated_at = NOW() 
      WHERE id = v_promo.id;
    ELSE
      RAISE EXCEPTION 'The provided promo code is invalid or has expired.';
    END IF;
  ELSE
    -- If no promo code is provided, payment is mandatory!
    IF p_payment_ref IS NULL OR length(trim(p_payment_ref)) < 3 THEN
      RAISE EXCEPTION 'Payment verification or a valid Foundation Code is required to create an organization.';
    END IF;
    -- Regular Starter Plan allocation for paid orgs
    v_tier := 'starter';
    v_seats := 25;
    v_credits := 200;
  END IF;

  -- Generate Unique Slug
  v_base_slug := lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF length(v_base_slug) < 2 THEN v_base_slug := 'org-' || substr(v_user_id::text, 1, 6); END IF;
  v_slug := v_base_slug;

  IF EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) THEN
    v_slug := v_base_slug || '-' || substr(md5(random()::text), 1, 4);
  END IF;

  -- Insert Organization
  INSERT INTO organizations (
    name,
    slug,
    subscription_tier,
    status,
    seat_limit,
    billing_email,
    created_at,
    updated_at
  )
  VALUES (
    trim(p_org_name),
    v_slug,
    v_tier::subscription_tier,
    'active',
    v_seats,
    v_user_email,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_org_id;

  -- Add Owner to organization_members
  INSERT INTO organization_members (organization_id, user_id, role, status, created_at)
  VALUES (v_org_id, v_user_id, 'owner', 'active', NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner', status = 'active';

  -- Update user profile
  UPDATE user_profiles
  SET role = 'admin',
      organization_id = v_org_id,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Enable Feature Flags
  INSERT INTO organization_feature_flags (organization_id, ai_enabled, cohorts_enabled, certificates_enabled)
  VALUES (v_org_id, true, true, true)
  ON CONFLICT (organization_id) DO UPDATE SET ai_enabled = true;

  -- Provision AI Credits Account & Transaction
  IF v_credits > 0 THEN
    INSERT INTO ai_credit_accounts (organization_id, account_type, balance, lifetime_credited, created_at, updated_at)
    VALUES (v_org_id, 'organization', v_credits, v_credits, NOW(), NOW())
    ON CONFLICT (organization_id) WHERE account_type = 'organization' DO UPDATE
      SET balance = ai_credit_accounts.balance + v_credits,
          lifetime_credited = ai_credit_accounts.lifetime_credited + v_credits
    RETURNING id INTO v_credit_acc_id;

    INSERT INTO ai_credit_transactions (
      organization_id,
      account_id,
      user_id,
      transaction_type,
      amount,
      balance_before,
      balance_after,
      reference_type,
      reference_id,
      metadata,
      created_at
    )
    VALUES (
      v_org_id,
      v_credit_acc_id,
      v_user_id,
      'top_up',
      v_credits,
      0,
      v_credits,
      CASE WHEN v_is_promo_used THEN 'foundation_grant' ELSE 'payment_reference' END,
      COALESCE(p_promo_code, p_payment_ref),
      jsonb_build_object(
        'plan', v_tier,
        'is_promo', v_is_promo_used,
        'provider', p_payment_provider,
        'seats', v_seats
      ),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'slug', v_slug,
    'name', trim(p_org_name),
    'tier', v_tier,
    'status', 'active',
    'seats', v_seats,
    'ai_credits', v_credits,
    'is_free_grant', v_is_promo_used
  );
END;
$$;
