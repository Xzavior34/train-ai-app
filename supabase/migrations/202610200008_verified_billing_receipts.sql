begin;
create table public.verified_payment_receipts (
 provider text not null check(provider in ('stripe','paystack')), reference text not null,
 user_id uuid not null references public.user_profiles(id), context text not null,
 amount numeric not null check(amount>0), currency text not null, metadata jsonb not null,
 verified_at timestamptz not null default now(), fulfilled_at timestamptz,
 primary key(provider,reference)
);
alter table public.verified_payment_receipts enable row level security;
revoke all on public.verified_payment_receipts from anon,authenticated;
grant all on public.verified_payment_receipts to service_role;
create or replace function public.record_verified_payment(p_provider text,p_reference text,p_user_id uuid,p_context text,p_amount numeric,p_currency text,p_metadata jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r verified_payment_receipts;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Provider verification required' using errcode='42501'; end if;
 if p_context not in ('credits','seat_purchase','organization_subscription','course_enrollment') or p_reference is null or length(p_reference)<5 or jsonb_typeof(p_metadata) is distinct from 'object' then raise exception 'Invalid verified payment'; end if;
 insert into verified_payment_receipts(provider,reference,user_id,context,amount,currency,metadata)
 values(p_provider,p_reference,p_user_id,p_context,p_amount,upper(p_currency),p_metadata) on conflict do nothing;
 select * into r from verified_payment_receipts where provider=p_provider and reference=p_reference for update;
 if r.user_id is distinct from p_user_id or r.context is distinct from p_context or r.amount is distinct from p_amount or r.currency is distinct from upper(p_currency) or r.metadata is distinct from p_metadata then raise exception 'Payment reference already belongs to another purchase'; end if;
end $$;
revoke all on function public.record_verified_payment(text,text,uuid,text,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_verified_payment(text,text,uuid,text,numeric,text,jsonb) to service_role;

create or replace function public.purchase_seats(p_organization_id uuid,p_seats int,p_amount numeric,p_payment_reference text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r verified_payment_receipts;
begin
 if not can_administer_org(p_organization_id) then raise exception 'Organization administrator required' using errcode='42501'; end if;
 select * into r from verified_payment_receipts where reference=p_payment_reference and user_id=auth.uid() and context='seat_purchase' for update;
 if not found or r.metadata->>'org_id' is distinct from p_organization_id::text or (r.metadata->>'seats')::int is distinct from p_seats or r.amount is distinct from p_amount then raise exception 'A matching server-verified seat payment is required'; end if;
 if r.fulfilled_at is null then
   insert into seat_purchases(organization_id,seats_purchased,amount_paid,currency,payment_reference,purchased_by)
   values(p_organization_id,p_seats,r.amount,r.currency,r.reference,auth.uid());
   update verified_payment_receipts set fulfilled_at=now() where provider=r.provider and reference=r.reference;
 end if;
 return get_org_seats_summary(p_organization_id);
end $$;

create or replace function public.apply_organization_subscription_payment(p_org_id uuid,p_tier subscription_tier,p_provider text,p_reference text,p_amount numeric default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r verified_payment_receipts; v_prev_hash text; v_row_hash text;
begin
 if not can_administer_org(p_org_id) then raise exception 'Organization administrator required' using errcode='42501'; end if;
 select * into r from verified_payment_receipts where provider=p_provider and reference=p_reference and user_id=auth.uid() and context='organization_subscription' for update;
 if not found or r.metadata->>'org_id' is distinct from p_org_id::text or r.metadata->>'tier' is distinct from p_tier::text or r.amount is distinct from p_amount then raise exception 'A matching server-verified subscription payment is required'; end if;
 if r.fulfilled_at is null then
   update organizations set subscription_tier=p_tier,status='active' where id=p_org_id;
   select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
   v_row_hash:=encode(extensions.digest(coalesce(v_prev_hash,'')||p_org_id::text||p_reference||now()::text,'sha256'),'hex');
   insert into admin_audit_log(admin_user_id,action_type,target_type,target_id,target_identifier,metadata,prev_hash,row_hash)
   values(auth.uid(),'organization_subscription_payment','organization',p_org_id,(select name from organizations where id=p_org_id),jsonb_build_object('tier',p_tier,'provider',p_provider,'reference',p_reference,'amount',r.amount),v_prev_hash,v_row_hash);
   update verified_payment_receipts set fulfilled_at=now() where provider=r.provider and reference=r.reference;
 end if;
 return jsonb_build_object('success',true,'organization_id',p_org_id,'tier',p_tier,'status','active');
end $$;
commit;
