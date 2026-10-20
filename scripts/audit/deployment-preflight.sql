-- Review catalog shape before applying any new migration to either deployed project.
begin read only;
select table_name,column_name,data_type from information_schema.columns where table_schema='public'
 and table_name in ('ai_credit_accounts','ai_credit_transactions','user_profiles','organization_members') order by table_name,ordinal_position;
select p.oid::regprocedure::text as signature,pg_get_function_result(p.oid) as returns,p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in ('get_or_create_learner_credit_account','consume_ai_credits','get_my_ai_credits','refund_ai_credits','bootstrap_auth_user_profile','join_organization_by_invite');
select tablename,policyname,cmd,roles from pg_policies where schemaname='public'
and tablename in ('cohorts','cohort_members','study_groups','study_group_members','cap_teams','mentorship_checkins');
rollback;
