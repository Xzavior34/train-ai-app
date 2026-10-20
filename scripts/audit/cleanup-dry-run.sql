-- Read-only cleanup inventory. No UPDATE, DELETE, DROP or proposed deletions.
-- Run privately against a restored/staging snapshot first. IDs are for owner review.
begin read only;
select 'auth_without_profile' as issue, count(*) as affected from auth.users au left join public.user_profiles up on up.id=au.id where up.id is null;
select 'profile_org_without_active_membership' as issue, up.id as user_id, up.organization_id,
 'Review membership history; do not automatically activate or move this account' as proposed_action
from public.user_profiles up where up.organization_id is not null and not exists(select 1 from public.organization_members om where om.user_id=up.id and om.organization_id=up.organization_id and om.status='active');
select 'cohort_member_without_active_org_membership' as issue, cm.id as membership_id,cm.cohort_id,cm.user_id,
 'Owner must confirm intended assignment before any repair' as proposed_action
from public.cohort_members cm join public.cohorts c on c.id=cm.cohort_id where not exists(select 1 from public.organization_members om where om.user_id=cm.user_id and om.organization_id=c.organization_id and om.status='active');
select 'mentor_profile_without_platform_mentor_role' as issue,m.id as mentor_id,m.user_id,
 'Verify role intent; never automatically grant administrator access' as proposed_action
from public.mentors m where not exists(select 1 from public.user_roles ur where ur.user_id=m.user_id and ur.role='mentor');
select 'possible_fixture_or_placeholder' as issue, up.id as user_id,
 case when coalesce(au.raw_user_meta_data->>'is_demo','')='true' then 'explicit_demo_metadata'
 when coalesce(up.avatar_url,'')~* '(unsplash|pravatar|placeholder)' then 'generic_avatar_url'
 else 'name_requires_review' end as reason,
 'Review only; suspicious names are insufficient grounds for deletion' as proposed_action
from public.user_profiles up join auth.users au on au.id=up.id
where coalesce(au.raw_user_meta_data->>'is_demo','')='true'
 or coalesce(up.display_name,'')~* '(^test[ _-]|^demo[ _-]|^placeholder$)'
 or coalesce(up.avatar_url,'')~* '(unsplash|pravatar|placeholder)';
select 'cap_team_without_cohort' as issue,id as team_id,'Resolve historical cohort ownership before exposing this team' as proposed_action from public.cap_teams where cohort_id is null;
select 'duplicate_cohort_name' as issue,organization_id, count(*) as affected from public.cohorts group by organization_id,lower(trim(name)) having count(*)>1;
rollback;
