-- Canonical UUID credit helper contract; corrected from incompatible legacy aliases.
create or replace function public.get_or_create_learner_credit_account(p_user_id uuid,p_org_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_balance int; v_grant int:=20;
begin
 if p_user_id is null then raise exception 'User ID required'; end if;
 insert into public.ai_credit_accounts(organization_id,owner_user_id,account_type,balance) values(p_org_id,p_user_id,'learner',0)
 on conflict(owner_user_id) where account_type='learner' do nothing;
 select id,balance into v_id,v_balance from public.ai_credit_accounts where owner_user_id=p_user_id and account_type='learner' for update;
 if exists(select 1 from public.ai_credit_accounts where id=v_id and lifetime_credited=0 and lifetime_consumed=0)
 and not exists(select 1 from public.ai_credit_transactions where account_id=v_id and reference_type='welcome_grant') then
 update public.ai_credit_accounts set balance=balance+v_grant,lifetime_credited=lifetime_credited+v_grant,updated_at=now() where id=v_id;
 insert into public.ai_credit_transactions(organization_id,account_id,user_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id)
 values(p_org_id,v_id,p_user_id,'top_up',v_grant,v_balance,v_balance+v_grant,'welcome_grant','signup_welcome');
 end if;
 return v_id;
end $$;
create or replace function public.get_my_ai_credits()
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_org uuid; v_personal int; v_org_balance int:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 v_org:=public.get_user_organization_id(auth.uid());
 v_id:=public.get_or_create_learner_credit_account(auth.uid(),v_org);
 select balance into v_personal from public.ai_credit_accounts where id=v_id;
 select balance into v_org_balance from public.ai_credit_accounts where account_type='organization' and organization_id=v_org;
 return jsonb_build_object('organization_balance',coalesce(v_org_balance,0),'org_balance',coalesce(v_org_balance,0),'personal_balance',coalesce(v_personal,0),'total_available',coalesce(v_org_balance,0)+coalesce(v_personal,0));
end $$;
revoke all on function public.get_or_create_learner_credit_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_my_ai_credits() to authenticated,service_role;

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
