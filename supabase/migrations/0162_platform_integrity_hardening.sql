-- Server-only payment credentials and atomic learner progress.

create table if not exists organization_payment_credentials (
  organization_id uuid primary key references organizations(id) on delete cascade,
  paystack_secret_key text,
  stripe_secret_key text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table organization_payment_credentials enable row level security;
revoke all on organization_payment_credentials from anon, authenticated;

create table if not exists password_reset_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_attempts_email_time_idx
  on password_reset_attempts (email_hash, created_at desc);
create index if not exists password_reset_attempts_ip_time_idx
  on password_reset_attempts (ip_hash, created_at desc);
alter table password_reset_attempts enable row level security;
revoke all on password_reset_attempts from anon, authenticated;

-- Move any legacy secrets out of the member-readable organizations.settings
-- document before removing them from that JSON object.
insert into organization_payment_credentials (organization_id, paystack_secret_key, stripe_secret_key)
select id,
       nullif(settings #>> '{payment_gateways,paystack_secret_key}', ''),
       nullif(settings #>> '{payment_gateways,stripe_secret_key}', '')
from organizations
where coalesce(settings #>> '{payment_gateways,paystack_secret_key}', '') <> ''
   or coalesce(settings #>> '{payment_gateways,stripe_secret_key}', '') <> ''
on conflict (organization_id) do update set
  paystack_secret_key = coalesce(excluded.paystack_secret_key, organization_payment_credentials.paystack_secret_key),
  stripe_secret_key = coalesce(excluded.stripe_secret_key, organization_payment_credentials.stripe_secret_key),
  updated_at = now();

update organizations
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{payment_gateways}',
  (coalesce(settings->'payment_gateways', '{}'::jsonb) - 'paystack_secret_key' - 'stripe_secret_key'),
  true
)
where settings ? 'payment_gateways';

create or replace function complete_lesson_and_update_progress(
  p_lesson_id uuid,
  p_course_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_course_id uuid;
  v_course_org uuid;
  v_user_org uuid;
  v_inserted boolean := false;
  v_total integer := 0;
  v_completed integer := 0;
  v_percentage integer := 0;
  v_previous_percentage numeric := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select l.course_id, c.organization_id
    into v_course_id, v_course_org
  from lessons l
  join courses c on c.id = l.course_id
  where l.id = p_lesson_id
    and c.is_published = true
    and c.archived_at is null;

  if v_course_id is null then raise exception 'Lesson is not available'; end if;
  if p_course_id is not null and p_course_id <> v_course_id then raise exception 'Lesson does not belong to course'; end if;

  select organization_id into v_user_org from user_profiles where id = v_user_id;
  if v_course_org is not null and v_course_org is distinct from v_user_org then
    raise exception 'Course is not available to this organization';
  end if;

  insert into lesson_progress (user_id, lesson_id, is_completed, completed_at)
  values (v_user_id, p_lesson_id, true, now())
  on conflict (user_id, lesson_id) do update set
    is_completed = true,
    completed_at = coalesce(lesson_progress.completed_at, now())
  where lesson_progress.is_completed = false
  returning true into v_inserted;

  select coalesce(progress_percentage, 0) into v_previous_percentage
  from course_enrollments
  where user_id = v_user_id and course_id = v_course_id;

  select count(*) into v_total from lessons where course_id = v_course_id;
  select count(*) into v_completed
  from lesson_progress lp
  join lessons l on l.id = lp.lesson_id
  where lp.user_id = v_user_id and lp.is_completed = true and l.course_id = v_course_id;
  v_percentage := case when v_total = 0 then 0 else least(100, round(v_completed * 100.0 / v_total)) end;

  insert into course_enrollments (user_id, course_id, progress_percentage, enrolled_at, completed_at)
  values (v_user_id, v_course_id, v_percentage, now(), case when v_percentage = 100 then now() end)
  on conflict (user_id, course_id) do update set
    progress_percentage = excluded.progress_percentage,
    completed_at = case
      when excluded.progress_percentage = 100 then coalesce(course_enrollments.completed_at, now())
      else course_enrollments.completed_at
    end;

  if v_inserted then
    insert into user_gamification_stats (user_id, total_points, lessons_completed, courses_completed)
    values (v_user_id, 50, 1, case when v_percentage = 100 and v_previous_percentage < 100 then 1 else 0 end)
    on conflict (user_id) do update set
      total_points = user_gamification_stats.total_points + 50,
      lessons_completed = user_gamification_stats.lessons_completed + 1,
      courses_completed = user_gamification_stats.courses_completed + case when v_percentage = 100 and v_previous_percentage < 100 then 1 else 0 end;
  end if;

  return jsonb_build_object('success', true, 'new_completion', v_inserted, 'progress_percentage', v_percentage);
end;
$$;

revoke all on function complete_lesson_and_update_progress(uuid, uuid) from public, anon;
grant execute on function complete_lesson_and_update_progress(uuid, uuid) to authenticated;

-- Keep invitation validation consistent with the public acceptance screen.
drop function if exists validate_invitation_token(text);
create function validate_invitation_token(p_token text)
returns table (
  invitation_id uuid,
  email text,
  organization_id uuid,
  organization_name text,
  role platform_role,
  organization_role org_member_role,
  expires_at timestamptz,
  is_valid boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.email, i.organization_id, o.name, i.role,
         i.organization_role, i.expires_at,
         (i.status = 'pending' and i.expires_at > now())
  from user_invitations i
  left join organizations o on o.id = i.organization_id
  where i.token = p_token
  limit 1;
$$;
grant execute on function validate_invitation_token(text) to anon, authenticated;

-- Edge-function-only invitation acceptance for signed-out invitees. This
-- preserves the seat lock from migration 0159 while binding the invited
-- email to the exact Auth user selected by the server.
create or replace function accept_invitation_for_user(p_token text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv user_invitations;
  v_auth_email text;
  v_org_locked uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  select * into v_inv from user_invitations
    where token = p_token and status = 'pending' and expires_at > now()
    for update;
  if not found then raise exception 'invitation is invalid or expired'; end if;
  select lower(email) into v_auth_email from auth.users where id = p_user_id;
  if v_auth_email is null or v_auth_email <> lower(v_inv.email) then
    raise exception 'invitation email does not match account';
  end if;
  if v_inv.organization_id is not null then
    select id into v_org_locked from organizations where id = v_inv.organization_id for update;
    if not check_seat_available(v_inv.organization_id) then
      raise exception 'No seats available in this organization';
    end if;
  end if;
  insert into user_profiles (id, display_name, organization_id, role)
  values (p_user_id, split_part(v_inv.email, '@', 1), v_inv.organization_id, v_inv.role)
  on conflict (id) do update set organization_id = excluded.organization_id;
  insert into user_roles (user_id, role) values (p_user_id, v_inv.role) on conflict do nothing;
  if v_inv.organization_id is not null then
    insert into organization_members (organization_id, user_id, role, status, invited_by, joined_at)
    values (v_inv.organization_id, p_user_id, v_inv.organization_role, 'active', v_inv.invited_by, now())
    on conflict (organization_id, user_id) do update set
      role = excluded.role, status = 'active', joined_at = coalesce(organization_members.joined_at, now());
  end if;
  update user_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
  return jsonb_build_object('success', true, 'user_id', p_user_id, 'organization_id', v_inv.organization_id, 'role', v_inv.role);
end;
$$;
revoke all on function accept_invitation_for_user(text, uuid) from public, anon, authenticated;
grant execute on function accept_invitation_for_user(text, uuid) to service_role;
