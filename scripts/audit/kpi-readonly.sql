-- Aggregate operational counts. No contact details, private messages or fabricated conversions.
begin read only;
select status,contact_verification,count(*) as submissions,count(distinct lower(trim(work_email))) as distinct_contacts
from public.demo_requests group by status,contact_verification order by status,contact_verification;
select organization_id,count(*) as active_members from public.organization_members where status='active' group by organization_id;
select cohort_id,count(*) as assigned_members from public.cohort_members group by cohort_id;
select feature,date_trunc('day',created_at)::date as day,count(*) as recorded_provider_calls from public.ai_usage_events group by feature,day order by day desc;
select transaction_type,reference_type,date_trunc('day',created_at)::date as day,count(*) as ledger_entries,sum(amount) as credit_delta
from public.ai_credit_transactions group by transaction_type,reference_type,day order by day desc;
-- Closed leads are NOT verified sales; completed demos are NOT verified purchases.
-- Outreach conversion, attendance and mentor-access failure rates require additional evidence.
rollback;
