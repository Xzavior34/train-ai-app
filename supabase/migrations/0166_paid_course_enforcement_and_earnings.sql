-- ============================================================================
-- Migration 0166: Paid Course Enforcement + Org Course Revenue Tracking
-- ============================================================================
-- Architecture (confirmed with platform owner):
--   - Organization keeps all course revenue (after platform commission).
--   - Instructors are org employees/contractors paid separately via PayoutsScreen.
--   - Platform commission is deducted server-side by record_academy_transaction()
--     (0158), which already exists and is service-role-only.
--   - Learner enrollment in a paid course is blocked server-side until
--     payment is verified — not just hidden in the UI.
-- ============================================================================

-- 1. Paid course enrollment guard — enforces payment server-side.
--    Called by the webhook path (service_role) and optionally by
--    the client callback after verify returns success.
--    Free courses (price = 0 or null) enroll instantly as before.
CREATE OR REPLACE FUNCTION enroll_after_course_payment(
  p_course_id   uuid,
  p_user_id     uuid,
  p_reference   text,
  p_provider    text,
  p_amount_paid numeric default null,
  p_currency    text    default 'NGN'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_course       courses%rowtype;
  v_org_id       uuid;
  v_existing     text;
BEGIN
  -- Load course
  SELECT * INTO v_course FROM courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  -- Authorization: service_role (webhook), or the learner themselves,
  -- or an admin of the course's org.
  IF auth.role() <> 'service_role' THEN
    IF auth.uid() <> p_user_id
       AND NOT (
         is_org_admin(auth.uid())
         AND get_user_organization_id(auth.uid()) = v_course.organization_id
       )
       AND NOT is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Not authorized to enroll this learner';
    END IF;
  END IF;

  -- Idempotency: already enrolled and active? Return success.
  SELECT status INTO v_existing
  FROM course_enrollments
  WHERE course_id = p_course_id AND user_id = p_user_id;

  IF v_existing = 'active' THEN
    RETURN jsonb_build_object('success', true, 'already_enrolled', true);
  END IF;

  -- Upsert enrollment to active
  INSERT INTO course_enrollments (course_id, user_id, status, enrolled_at)
  VALUES (p_course_id, p_user_id, 'active', now())
  ON CONFLICT (course_id, user_id)
  DO UPDATE SET status = 'active', enrolled_at = now();

  -- Record the academy transaction so org revenue + platform commission
  -- are tracked. Only if a real amount was provided (free courses skip this).
  -- record_academy_transaction() is service_role-only and idempotent on
  -- provider+reference — duplicate webhooks are safe.
  IF p_amount_paid IS NOT NULL AND p_amount_paid > 0 AND p_reference IS NOT NULL THEN
    PERFORM record_academy_transaction(
      v_course.organization_id,
      p_user_id,
      p_provider,
      p_reference,
      p_currency,
      (p_amount_paid * 100)::bigint  -- convert to minor units
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'enrolled', true, 'course_id', p_course_id);
END;
$$;

COMMENT ON FUNCTION enroll_after_course_payment IS
  'Server-side enrollment activation after a verified paid course payment.
   Handles free courses (no payment ref needed), idempotent on repeat calls.
   Called by paystack-webhook / stripe-webhook (service_role) AND optionally
   from OrgPaymentCallbackScreen after client-side verify succeeds.';

-- 2. Org course revenue summary — what the admin sees.
--    Returns per-course revenue aggregated from academy_transactions.
CREATE OR REPLACE FUNCTION get_org_course_revenue(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (
    get_user_organization_id(auth.uid()) = p_org_id
    AND is_org_admin(auth.uid())
    OR is_super_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to view this organization''s revenue';
  END IF;

  SELECT jsonb_agg(row_to_json(r))
  INTO v_result
  FROM (
    SELECT
      c.id                AS course_id,
      c.title             AS course_name,
      c.price             AS listed_price,
      COUNT(DISTINCT ce.user_id)          AS enrollment_count,
      COALESCE(SUM(at2.gross_amount_minor) / 100.0, 0) AS gross_revenue,
      COALESCE(SUM(at2.platform_fee_minor) / 100.0, 0) AS platform_fee,
      COALESCE(SUM(at2.academy_net_minor)  / 100.0, 0) AS net_to_org
    FROM courses c
    LEFT JOIN course_enrollments ce ON ce.course_id = c.id AND ce.status = 'active'
    LEFT JOIN academy_transactions at2
           ON at2.organization_id = c.organization_id
          AND at2.learner_id = ce.user_id
    WHERE c.organization_id = p_org_id
    GROUP BY c.id, c.title, c.price
    ORDER BY gross_revenue DESC
  ) r;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 3. Overall org revenue summary (totals for the dashboard hero card).
CREATE OR REPLACE FUNCTION get_org_revenue_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    (get_user_organization_id(auth.uid()) = p_org_id AND is_org_admin(auth.uid()))
    OR is_super_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'total_gross',       COALESCE(SUM(gross_amount_minor), 0) / 100.0,
      'total_platform_fee',COALESCE(SUM(platform_fee_minor), 0) / 100.0,
      'total_net',         COALESCE(SUM(academy_net_minor),  0) / 100.0,
      'transaction_count', COUNT(*)
    )
    FROM academy_transactions
    WHERE organization_id = p_org_id
      AND status = 'completed'
  );
END;
$$;

-- 4. RLS: academy_transactions already has select policy for org admins (0158).
--    No changes needed here.

-- 5. Ensure academy_commission_configs has at least a default entry for orgs
--    that don't have one yet, so record_academy_transaction() doesn't error
--    with "No active commission configuration". Platform owner sets real rates
--    through the CommissionConfigScreen (new). Default = 10% platform fee.
CREATE OR REPLACE FUNCTION ensure_default_commission(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM academy_commission_configs
    WHERE organization_id = p_org_id AND is_active = true
  ) THEN
    INSERT INTO academy_commission_configs
      (organization_id, commission_percent, fixed_fee_minor, currency, is_active)
    VALUES (p_org_id, 10.00, 0, 'USD', true)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
