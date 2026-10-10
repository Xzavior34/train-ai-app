-- ============================================================
-- Migration: 20 Free AI Credits for All New Users & Organization Join Links
-- 1. Grants 20 free AI credits on learner credit account creation
-- 2. Lazily initializes the 20 free AI credits in get_my_ai_credits()
-- 3. Backfills existing zero-lifetime learner accounts with 20 free AI credits
-- 4. Enhances join_organization_by_invite(p_org_target, p_role) to resolve organizations by slug or UUID
-- ============================================================

-- 1. Update get_or_create_learner_credit_account to grant 20 free AI credits on initial creation
CREATE OR REPLACE FUNCTION public.get_or_create_learner_credit_account(p_user_id uuid, p_org_id uuid DEFAULT NULL)
RETURNS public.ai_credit_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.ai_credit_accounts;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required to initialize learner AI credit account';
  END IF;

  INSERT INTO public.ai_credit_accounts (
    owner_type,
    user_id,
    org_id,
    balance,
    lifetime_credited,
    lifetime_consumed
  )
  VALUES (
    'learner',
    p_user_id,
    p_org_id,
    20,
    20,
    0
  )
  ON CONFLICT (user_id) WHERE owner_type = 'learner'
  DO UPDATE SET
    org_id = COALESCE(public.ai_credit_accounts.org_id, EXCLUDED.org_id),
    updated_at = now()
  RETURNING * INTO v_account;

  -- Record the initial welcome grant transaction if no welcome_grant exists yet
  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_credit_transactions
    WHERE account_id = v_account.id
      AND reference_type = 'welcome_grant'
  ) AND v_account.lifetime_credited = 20 AND v_account.lifetime_consumed = 0 THEN
    INSERT INTO public.ai_credit_transactions (
      account_id,
      owner_type,
      org_id,
      user_id,
      actor_user_id,
      transaction_type,
      credits_delta,
      balance_after,
      reference_type,
      reference_id,
      metadata
    )
    VALUES (
      v_account.id,
      'learner',
      v_account.org_id,
      p_user_id,
      p_user_id,
      'top_up',
      20,
      v_account.balance,
      'welcome_grant',
      'signup_free_20_credits',
      jsonb_build_object('reason', 'Welcome allocation of 20 free AI credits')
    );
  END IF;

  RETURN v_account;
END;
$$;

-- 2. Backfill existing learner accounts that were created with 0 lifetime credits
UPDATE public.ai_credit_accounts
SET
  balance = 20,
  lifetime_credited = 20,
  updated_at = now()
WHERE owner_type = 'learner'
  AND lifetime_credited = 0
  AND lifetime_consumed = 0
  AND balance = 0;

-- 3. Update get_my_ai_credits so new users immediately get their 20 free AI credits initialized
CREATE OR REPLACE FUNCTION public.get_my_ai_credits()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_org_balance integer := 0;
  v_user_account public.ai_credit_accounts;
  v_user_balance integer := 0;
  v_is_suspended boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT org_id INTO v_org_id FROM public.profiles WHERE id = v_user_id;

  IF v_org_id IS NOT NULL THEN
    SELECT COALESCE(balance, 0), COALESCE(is_suspended, false)
    INTO v_org_balance, v_is_suspended
    FROM public.ai_credit_accounts
    WHERE owner_type = 'organization' AND org_id = v_org_id;
  END IF;

  v_user_account := public.get_or_create_learner_credit_account(v_user_id, v_org_id);
  v_user_balance := COALESCE(v_user_account.balance, 20);

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'org_balance', COALESCE(v_org_balance, 0),
    'org_suspended', COALESCE(v_is_suspended, false),
    'personal_balance', COALESCE(v_user_balance, 20),
    'total_available', (CASE WHEN v_is_suspended THEN 0 ELSE COALESCE(v_org_balance, 0) END) + COALESCE(v_user_balance, 20)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_learner_credit_account(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_ai_credits() TO authenticated, service_role;

-- 4. Ensure join_organization_by_invite resolves organizations by UUID, slug, or Sara Foundation alias
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

  UPDATE public.profiles
  SET
    org_id = v_org.id,
    organization = COALESCE(v_org.name, organization),
    updated_at = now()
  WHERE id = v_user_id;

  PERFORM public.get_or_create_learner_credit_account(v_user_id, v_org.id);

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'organization_slug', v_org.slug,
    'role', v_role,
    'status', 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_organization_by_invite(text, text) TO authenticated, service_role;
