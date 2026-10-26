begin;
-- Admin content sourcing has its own organization-funded operation. Keep the
-- existing learner/personal credit policy (including Sara's policy) unchanged.
create or replace function public.get_youtube_discovery_credit_balance(p_org_id uuid)
returns integer language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not can_administer_organization(p_org_id) then raise exception 'Organization admin access required' using errcode='42501'; end if;
 return coalesce((select balance from ai_credit_accounts where organization_id=p_org_id and account_type='organization'),0);
end; $$;

create or replace function public.consume_youtube_discovery_credits(p_search_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s youtube_course_searches; v_account uuid; v_balance integer; v_transaction uuid;
begin
 select * into s from youtube_course_searches where id=p_search_id for update;
 if not found or s.created_by is distinct from auth.uid() or not can_administer_organization(s.organization_id) then
 raise exception 'Organization admin access required' using errcode='42501'; end if;
 if s.status<>'searching' or s.created_at<now()-interval '10 minutes' then raise exception 'Start a new course search'; end if;
 if exists(select 1 from ai_credit_transactions where reference_type='youtube_course_discovery' and reference_id=p_search_id::text and transaction_type='consumption') then
 raise exception 'This search has already been charged. Start a new search.'; end if;
 select id,balance into v_account,v_balance from ai_credit_accounts where organization_id=s.organization_id and account_type='organization' for update;
 if v_account is null or v_balance<1 then return jsonb_build_object('authorized',false,'reason','insufficient_credits','organization_balance',coalesce(v_balance,0),'cost',1); end if;
 update ai_credit_accounts set balance=balance-1,lifetime_consumed=lifetime_consumed+1,updated_at=now() where id=v_account;
 insert into ai_credit_transactions(organization_id,account_id,user_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,metadata)
 values(s.organization_id,v_account,auth.uid(),'consumption',-1,v_balance,v_balance-1,'youtube_course_discovery',p_search_id::text,jsonb_build_object('operation','youtube_course_discovery','cost',1)) returning id into v_transaction;
 return jsonb_build_object('authorized',true,'consumed_from','organization','cost',1,'transaction_id',v_transaction,'organization_balance',v_balance-1);
end; $$;
revoke all on function public.get_youtube_discovery_credit_balance(uuid),public.consume_youtube_discovery_credits(uuid) from public,anon;
grant execute on function public.get_youtube_discovery_credit_balance(uuid),public.consume_youtube_discovery_credits(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
