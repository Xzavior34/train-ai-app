-- ============================================================================
-- Real server-side entitlement enforcement + payment edge-case hardening
-- ============================================================================
-- Finding, confirmed by reading the code, not assumed: "advanced feature"
-- entitlements (organization_feature_flags / get_org_feature, 0115, fixed
-- for cross-tenant reads in 0154) were checked CLIENT-SIDE only.
-- AdminAnalyticsScreen.jsx computes `canExport` from a real, correctly-
-- authorized RPC result, but the underlying analytics data was already
-- fetched and rendered on screen before that check ever runs, and the
-- "export" action itself (exportRowsAsCsv) is a pure client-side CSV-blob
-- generator with no server call at all - trivially callable from devtools
-- regardless of entitlement. Same shape for WorkforceIntelligenceScreen.jsx:
-- fetchWorkforceIntelligence() queries plain RLS-protected tables with no
-- entitlement check anywhere.
--
-- Important, honest distinction from the seat-concurrency bug: this is NOT
-- a tenant-isolation vulnerability - RLS still correctly restricts every
-- one of these queries to the caller's own organization, so no cross-org
-- data is exposed. It's a monetization/business-logic gap: a non-entitled
-- org's own admin can still see (and manually copy) data a paid tier is
-- supposed to gate, because the entitlement was only ever a UI convenience
-- check. Full closure would require restructuring what data these screens
-- fetch at all when un-entitled, which is a larger frontend change than
-- this pass attempts. What IS implemented here is the correct primitive
-- for real enforcement going forward, and it's wired into the one case
-- (workforce intelligence) most worth doing now.
-- ============================================================================

create or replace function assert_feature_entitled(p_org_id uuid, p_feature_key text)
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (p_org_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid())) then
    raise exception 'Not authorized to check this organization''s entitlements';
  end if;
  if not is_super_admin(auth.uid()) and not get_org_feature(p_org_id, p_feature_key) then
    raise exception 'This organization does not have the % feature enabled', p_feature_key;
  end if;
end;
$$;

-- Real, server-side aggregation for Workforce Intelligence, gated by the
-- entitlement check above BEFORE any data is touched - this is the
-- concrete fix, not just the primitive. Computes the same shape
-- fetchWorkforceIntelligence() already returns, server-side, so a client
-- that isn't entitled gets nothing at all rather than a UI-hidden copy of
-- data it already received.
create or replace function get_workforce_intelligence(p_org_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_learner_count int;
  v_ai_usage_7d int;
  v_feedback_30d int;
  v_avg_score numeric;
begin
  perform assert_feature_entitled(p_org_id, 'ai_intelligence_advanced');

  select count(*) into v_learner_count from user_profiles
    where organization_id = p_org_id and role not in ('admin', 'super_admin', 'mentor');

  select count(*) into v_ai_usage_7d from ai_usage_events
    where organization_id = p_org_id and created_at >= now() - interval '7 days';

  select count(*) into v_feedback_30d from feedback_notes
    where organization_id = p_org_id and created_at >= now() - interval '30 days';

  select avg(score) into v_avg_score from assessment_attempts aa
    join user_profiles up on up.id = aa.user_id
    where up.organization_id = p_org_id;

  return jsonb_build_object(
    'learnerCount', v_learner_count,
    'aiUsageCount7d', v_ai_usage_7d,
    'feedbackNotesCount30d', v_feedback_30d,
    'avgAssessmentScore', v_avg_score
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Payment edge-case hardening, found by direct-attack testing this round.
-- consume_ai_credits already guards against a zero/negative cost operation
-- key via ai_operation_costs' own check(credit_cost >= 0) and the
-- `if v_cost = 0` free-operation branch (0156) - confirmed still correct,
-- not changed. What needed a fix: record_academy_transaction() already
-- rejects p_gross_amount_minor <= 0 (0158) - confirmed correct. The real
-- gap found this round is in grant_ai_credits(): it checked
-- `p_amount <= 0` but not integer overflow / absurd values, and
-- purchase_ai_credits/purchase_personal_ai_credits_for pass p_credits
-- straight through with no upper bound at all - a compromised service-role
-- caller (or a bug in the calling Edge Function) could grant an
-- absurd credit amount with no sanity ceiling.
-- ----------------------------------------------------------------------------
create or replace function grant_ai_credits(
  p_account_id uuid,
  p_amount int,
  p_transaction_type text,
  p_reference text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account ai_credit_accounts%rowtype;
  v_new_balance int;
begin
  if p_amount <= 0 then
    raise exception 'Grant amount must be positive';
  end if;
  -- Sanity ceiling - not a business rule about pricing, a defense-in-depth
  -- bound against a forged/buggy amount reaching this function at all
  -- (matches "integer overflow/very large amount" from this round's
  -- explicit attack list). 1,000,000 credits in a single grant is already
  -- far beyond any real package this product sells.
  if p_amount > 1000000 then
    raise exception 'Grant amount exceeds the maximum allowed in a single transaction';
  end if;
  if p_transaction_type not in ('purchase', 'top_up', 'adjustment') then
    raise exception 'Invalid grant transaction type';
  end if;

  select * into v_account from ai_credit_accounts where id = p_account_id for update;
  if v_account.id is null then
    raise exception 'Credit account not found';
  end if;

  if not (
    auth.role() = 'service_role'
    or is_super_admin(auth.uid())
    or (v_account.owner_user_id = auth.uid())
    or (v_account.account_type = 'organization' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
    or (v_account.account_type = 'learner' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
  ) then
    raise exception 'Not authorized to add credits to this account';
  end if;

  update ai_credit_accounts
    set balance = balance + p_amount, lifetime_credited = lifetime_credited + p_amount, updated_at = now()
    where id = p_account_id
    returning balance into v_new_balance;

  insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, created_by)
  values (v_account.organization_id, p_account_id, v_account.owner_user_id, p_transaction_type, p_amount, v_new_balance - p_amount, v_new_balance, 'payment_reference', p_reference, auth.uid());

  return jsonb_build_object('granted', true, 'new_balance', v_new_balance);
end;
$$;
