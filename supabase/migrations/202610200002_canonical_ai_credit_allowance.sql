-- Canonical schema from 0156. Lifetime welcome allowance (no calendar reset).
begin;
-- Fail safely on a deployed schema variant; never silently rewrite live payment ledgers.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='ai_credit_accounts' and column_name='owner_user_id') then
 raise exception 'Unsupported credit schema: reconcile canonical ledger before applying this migration'; end if;
end $$;
create or replace function public.get_affiliated_organization(p_user_id uuid)
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
 select om.organization_id from public.organization_members om join public.organizations o on o.id=om.organization_id
 where om.user_id=p_user_id and om.status='active' and coalesce(o.slug,'')<>'tech-learning'
 and lower(o.name)<>'digital training organization'
 order by om.joined_at desc nulls last,om.organization_id limit 1;
$$;
revoke all on function public.get_affiliated_organization(uuid) from public,anon,authenticated;

create or replace function public.get_or_create_learner_credit_account(p_user_id uuid,p_org_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_balance int; v_grant int; v_welcome int; v_removed int; v_spent int; v_remove int;
begin
 if p_user_id is null then raise exception 'User ID required'; end if;
 v_grant:=case when public.get_affiliated_organization(p_user_id) is null then 3 else 20 end;
 insert into public.ai_credit_accounts(organization_id,owner_user_id,account_type,balance) values(p_org_id,p_user_id,'learner',0)
 on conflict(owner_user_id) where account_type='learner' do nothing;
 select id,balance into v_id,v_balance from public.ai_credit_accounts where owner_user_id=p_user_id and account_type='learner' for update;
 -- Re-evaluate after membership changes; joining/leaving an organization cannot enlarge the unaffiliated allowance.
 if public.get_affiliated_organization(p_user_id) is null then
 select coalesce(sum(amount) filter(where reference_type='welcome_grant' and amount>0),0),
 coalesce(-sum(amount) filter(where reference_type='welcome_limit_3'),0) into v_welcome,v_removed
 from public.ai_credit_transactions where account_id=v_id;
 select lifetime_consumed into v_spent from public.ai_credit_accounts where id=v_id;
 v_remove:=least(v_balance,greatest(0,v_welcome-greatest(3,v_spent)-v_removed));
 if v_remove>0 then
 update public.ai_credit_accounts set balance=balance-v_remove,lifetime_credited=lifetime_credited-v_remove,updated_at=now() where id=v_id;
 insert into public.ai_credit_transactions(organization_id,account_id,user_id,transaction_type,amount,balance_before,balance_after,reference_type)
 values(p_org_id,v_id,p_user_id,'adjustment',-v_remove,v_balance,v_balance-v_remove,'welcome_limit_3');
 v_balance:=v_balance-v_remove;
 end if;
 end if;
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
 v_org:=public.get_affiliated_organization(auth.uid());
 v_id:=public.get_or_create_learner_credit_account(auth.uid(),v_org);
 select balance into v_personal from public.ai_credit_accounts where id=v_id;
 select balance into v_org_balance from public.ai_credit_accounts where account_type='organization' and organization_id=v_org;
 return jsonb_build_object('organization_balance',coalesce(v_org_balance,0),'org_balance',coalesce(v_org_balance,0),'personal_balance',coalesce(v_personal,0),'total_available',coalesce(v_org_balance,0)+coalesce(v_personal,0));
end $$;

create or replace function consume_ai_credits(
  p_operation_key text,
  p_reference_id text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_cost int;
  v_org_account uuid;
  v_learner_account uuid;
  v_org_balance int;
  v_learner_balance int;
  v_txn_id uuid;
begin
  -- The only trustworthy identity here is auth.uid() - the caller's own
  -- verified session. p_user_id/p_org_id were client-supplied parameters
  -- in an earlier draft of this function; adversarial testing during this
  -- same implementation pass proved that let any authenticated user drain
  -- any organization's credit pool by simply naming it (confirmed: a
  -- learner with zero relationship to Org A successfully deducted from
  -- Org A's balance by passing its id as a parameter). Fixed by deriving
  -- both from the server-verified session instead, matching the trust
  -- pattern every other SECURITY DEFINER function in this schema already
  -- uses (get_user_organization_id(auth.uid()), never a parameter).
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Must be signed in';
  end if;
  v_org_id := public.get_affiliated_organization(v_user_id);

  select credit_cost into v_cost from ai_operation_costs where operation_key = p_operation_key;
  if v_cost is null then raise exception 'Unknown AI operation'; end if;
  if v_org_id is null then v_cost:=greatest(v_cost,1); end if;
  if v_cost = 0 then
    return jsonb_build_object('authorized', true, 'consumed_from', 'free', 'cost', 0);
  end if;

  if v_org_id is not null then
    v_org_account := get_or_create_org_credit_account(v_org_id);
    select balance into v_org_balance from ai_credit_accounts where id = v_org_account for update;
    if v_org_balance >= v_cost then
      update ai_credit_accounts
        set balance = balance - v_cost, lifetime_consumed = lifetime_consumed + v_cost, updated_at = now()
        where id = v_org_account
        returning balance into v_org_balance;
      insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, metadata)
      values (v_org_id, v_org_account, v_user_id, 'consumption', -v_cost, v_org_balance + v_cost, v_org_balance, p_operation_key, p_reference_id, jsonb_build_object('operation', p_operation_key))
      returning id into v_txn_id;
      return jsonb_build_object('authorized', true, 'consumed_from', 'organization', 'cost', v_cost, 'transaction_id', v_txn_id, 'org_balance', v_org_balance);
    end if;
  end if;

  -- Organization credits exhausted or no organization - try the learner's
  -- own personal account.
  v_learner_account := get_or_create_learner_credit_account(v_user_id, v_org_id);
  select balance into v_learner_balance from ai_credit_accounts where id = v_learner_account for update;
  if v_learner_balance >= v_cost then
    update ai_credit_accounts
      set balance = balance - v_cost, lifetime_consumed = lifetime_consumed + v_cost, updated_at = now()
      where id = v_learner_account
      returning balance into v_learner_balance;
    insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, metadata)
    values (v_org_id, v_learner_account, v_user_id, 'consumption', -v_cost, v_learner_balance + v_cost, v_learner_balance, p_operation_key, p_reference_id, jsonb_build_object('operation', p_operation_key))
    returning id into v_txn_id;
    return jsonb_build_object('authorized', true, 'consumed_from', 'learner', 'cost', v_cost, 'transaction_id', v_txn_id, 'learner_balance', v_learner_balance);
  end if;

  -- Both exhausted - hard block, per spec ("do not allow AI requests to
  -- continue"). No row is written for a denied request - there is nothing
  -- to refund because nothing was ever consumed.
  return jsonb_build_object('authorized', false, 'reason', 'insufficient_credits', 'cost', v_cost);
end;
$$;
create or replace function refund_ai_credits(p_transaction_id uuid, p_reason text default 'provider_failure')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_txn ai_credit_transactions%rowtype;
  v_new_balance int;
begin
  -- This must never be a user-triggerable action - a learner refunding
  -- their own AI usage on demand would make the whole hard-limit
  -- pointless. Only a genuine service-role caller (the Edge Function's
  -- own internal "the AI provider failed after I already deducted
  -- credits" handling, invoked with the service-role key) or a
  -- super_admin correction may call this.
  --
  -- NOTE ON A BUG CAUGHT DURING THIS SAME IMPLEMENTATION PASS: an earlier
  -- version of this check used `current_user <> 'authenticated'`, copied
  -- from a different function's pattern without checking it actually
  -- applies here. It does not: current_user inside any SECURITY DEFINER
  -- function is always the function's OWNER, never the real caller - so
  -- that check was true for every single caller, including an ordinary
  -- learner, and never blocked anyone. Confirmed by testing (a learner
  -- successfully self-refunded before this fix), not just reasoned about.
  -- auth.role() is the correct mechanism - it reads the JWT's own role
  -- claim ('service_role' vs 'authenticated'), independent of which
  -- Postgres role is executing the function body.
  if not (is_super_admin(auth.uid()) or auth.role() = 'service_role') then
    raise exception 'Not authorized to issue AI credit refunds';
  end if;

  select * into v_txn from ai_credit_transactions where id = p_transaction_id and transaction_type = 'consumption' for update;
  if v_txn.id is null then
    raise exception 'No matching consumption transaction to refund';
  end if;
  if exists (select 1 from ai_credit_transactions where reference_type = 'refund_of' and reference_id = p_transaction_id::text) then
    return jsonb_build_object('refunded',false,'already_refunded',true);
  end if;

  update ai_credit_accounts
    set balance = balance + abs(v_txn.amount), lifetime_consumed = greatest(0, lifetime_consumed - abs(v_txn.amount)), updated_at = now()
    where id = v_txn.account_id
    returning balance into v_new_balance;

  insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, metadata)
  values (v_txn.organization_id, v_txn.account_id, v_txn.user_id, 'refund', abs(v_txn.amount), v_new_balance - abs(v_txn.amount), v_new_balance, 'refund_of', p_transaction_id::text, jsonb_build_object('reason', p_reason));

  return jsonb_build_object('refunded', true, 'new_balance', v_new_balance);
end;
$$;
revoke all on function public.get_or_create_learner_credit_account(uuid,uuid) from public,anon,authenticated;
revoke all on function public.refund_ai_credits(uuid,text) from public,anon,authenticated;
grant execute on function public.refund_ai_credits(uuid,text) to service_role;
revoke all on function public.consume_ai_credits(text,text) from public,anon;
grant execute on function public.consume_ai_credits(text,text),public.get_my_ai_credits() to authenticated;
-- Adjust only identifiable unused welcome credits. Paid grants are preserved.
-- For mixed ledgers, historical spending uses welcome credits first.
do $$ declare a record; v_welcome int; v_remove int; begin
 for a in select * from public.ai_credit_accounts where account_type='learner' and public.get_affiliated_organization(owner_user_id) is null for update loop
 select coalesce(sum(amount),0) into v_welcome from public.ai_credit_transactions where account_id=a.id and reference_type='welcome_grant' and amount>0;
 if not exists(select 1 from public.ai_credit_transactions where account_id=a.id and reference_type='welcome_limit_3') then
 v_remove:=least(a.balance,greatest(0,v_welcome-greatest(3,a.lifetime_consumed)));
 if v_remove>0 then
 update public.ai_credit_accounts set balance=balance-v_remove,lifetime_credited=lifetime_credited-v_remove,updated_at=now() where id=a.id;
 insert into public.ai_credit_transactions(organization_id,account_id,user_id,transaction_type,amount,balance_before,balance_after,reference_type)
 values(a.organization_id,a.id,a.owner_user_id,'adjustment',-v_remove,a.balance,a.balance-v_remove,'welcome_limit_3');
 end if;
 end if;
 end loop;
end $$;
commit;
