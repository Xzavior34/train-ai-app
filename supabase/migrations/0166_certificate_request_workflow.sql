-- ============================================================================
-- 0166_certificate_request_workflow.sql
-- Certificate approval requests workflow & seat role promotion helper
-- ============================================================================

create table if not exists certificate_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  cohort_id uuid references cohorts(id) on delete set null,
  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references user_profiles(id) on delete set null,
  rejection_reason text,
  unique (user_id, course_id)
);

alter table certificate_requests enable row level security;

drop policy if exists cert_req_read on certificate_requests;
create policy cert_req_read on certificate_requests for select
  using (
    user_id = auth.uid()
    or is_org_admin(auth.uid())
    or exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin', 'mentor', 'super_admin'))
  );

drop policy if exists cert_req_insert on certificate_requests;
create policy cert_req_insert on certificate_requests for insert
  with check (user_id = auth.uid());

drop policy if exists cert_req_update on certificate_requests;
create policy cert_req_update on certificate_requests for update
  using (is_org_admin(auth.uid()) or exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin', 'mentor', 'super_admin')));

-- Function to approve a certificate request and issue certificate directly
create or replace function approve_certificate_request(p_request_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_req record;
  v_cert_id uuid;
begin
  select * into v_req from certificate_requests where id = p_request_id;
  if v_req is null then
    raise exception 'Certificate request not found';
  end if;

  if v_req.status = 'approved' then
    select id into v_cert_id from course_certificates where user_id = v_req.user_id and course_id = v_req.course_id limit 1;
    return v_cert_id;
  end if;

  -- Issue certificate directly
  v_cert_id := issue_certificate_directly(v_req.user_id, v_req.course_id, v_req.cohort_id);

  -- Mark request approved
  update certificate_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;

  return v_cert_id;
end;
$$;

-- Function to update a user's role in an organization (role promotion/demotion)
create or replace function update_user_org_role(p_user_id uuid, p_org_id uuid, p_new_role text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not is_org_admin(auth.uid()) then
    raise exception 'Not authorized to manage organization roles';
  end if;

  if p_new_role not in ('learner', 'mentor', 'admin') then
    raise exception 'Invalid role specified';
  end if;

  update user_profiles
  set role = p_new_role
  where id = p_user_id and organization_id = p_org_id;

  insert into user_roles (user_id, role)
  values (p_user_id, p_new_role)
  on conflict (user_id, role) do update set role = excluded.role;

  return true;
end;
$$;
