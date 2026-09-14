-- ============================================================================
-- Certificates - explicitly in-scope for v1, confirmed entirely unbuilt
-- ============================================================================
-- PRD Summary v4.0, Section 4.1 lists "Certificates" as in-scope for v1.
-- Section 7.3: "Assessments... feed completion, certificates, and
-- reporting." Section 8.3 lists "certificate settings" as an Admin
-- capability, and the original brief's Section 5 spells out the full
-- workflow: detect completion, check passing score, determine
-- eligibility, send for approval, allow admin approval, issue, store
-- against learner, let the learner access/download it.
--
-- Checked the actual codebase before building this: "certificate" appeared
-- in exactly one place as a real reference (a code comment in learner.js
-- about assessments feeding certificates conceptually) and nowhere as an
-- actual table, screen, or workflow. This is not a small gap - the entire
-- feature was unbuilt.
--
-- Workflow implemented, matching the original brief's numbered steps:
--   1. Detect assessment completion
--   2. Check passing score
--   3. Determine eligibility
--   4. Send for approval
--   5. Allow admin approval
--   6. Issue certificate
--   7. Store against learner
--   8. Learner can access/download
-- ============================================================================

create type certificate_status as enum ('pending', 'issued', 'rejected');

-- One template per course - "certificate settings" (Section 8.3) and
-- "Certificate templates" (Section 22). Admin-configured; org-branded per
-- the confirmed Open Question answer ("Should certificates be
-- organisation-branded... Org branded").
create table if not exists certificate_templates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade unique,
  organization_id uuid references organizations(id) on delete cascade,
  title text not null default 'Certificate of Completion',
  passing_score_pct numeric not null default 70,
  requires_admin_approval boolean not null default true,
  template_text text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  template_id uuid references certificate_templates(id) on delete set null,
  organization_id uuid references organizations(id) on delete cascade,
  score_pct numeric,
  status certificate_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references user_profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  issued_at timestamptz,
  certificate_number text unique,
  unique (user_id, course_id)
);

alter table certificate_templates enable row level security;
alter table certificates enable row level security;

drop policy if exists ct_select_all on certificate_templates;
create policy ct_select_all on certificate_templates for select using (true);

drop policy if exists ct_write_authorized on certificate_templates;
create policy ct_write_authorized on certificate_templates for all
  using (
    exists (select 1 from courses c where c.id = certificate_templates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from courses c where c.id = certificate_templates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

drop policy if exists cert_select_own on certificates;
create policy cert_select_own on certificates for select using (user_id = auth.uid());

drop policy if exists cert_insert_own on certificates;
create policy cert_insert_own on certificates for insert with check (user_id = auth.uid());

drop policy if exists cert_select_reviewer on certificates;
create policy cert_select_reviewer on certificates for select
  using (
    exists (select 1 from courses c where c.id = certificates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

drop policy if exists cert_update_reviewer on certificates;
create policy cert_update_reviewer on certificates for update
  using (
    exists (select 1 from courses c where c.id = certificates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from courses c where c.id = certificates.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  );

create or replace function request_certificate(p_course_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_template certificate_templates%rowtype;
  v_best_score numeric;
  v_cert_id uuid;
  v_auto_issue boolean;
begin
  select * into v_template from certificate_templates where course_id = p_course_id;
  if v_template.id is null then
    raise exception 'No certificate is configured for this course';
  end if;

  select max(aa.score) into v_best_score
  from assessment_attempts aa
  join assessments a on a.id = aa.assessment_id
  where a.course_id = p_course_id and aa.user_id = auth.uid();

  if v_best_score is null then
    raise exception 'Complete this course''s assessment before requesting a certificate';
  end if;
  if v_best_score < v_template.passing_score_pct then
    raise exception 'Score does not meet the required passing threshold';
  end if;

  v_auto_issue := not v_template.requires_admin_approval;

  insert into certificates (user_id, course_id, template_id, organization_id, score_pct, status, issued_at, certificate_number)
  values (
    auth.uid(), p_course_id, v_template.id, v_template.organization_id, v_best_score,
    (case when v_auto_issue then 'issued' else 'pending' end)::certificate_status,
    case when v_auto_issue then now() else null end,
    case when v_auto_issue then 'TAI-' || upper(substr(md5(random()::text), 1, 10)) else null end
  )
  on conflict (user_id, course_id) do update set score_pct = excluded.score_pct
  returning id into v_cert_id;

  return jsonb_build_object('success', true, 'certificate_id', v_cert_id, 'status', case when v_auto_issue then 'issued' else 'pending' end);
end;
$$;

create or replace function review_certificate(p_certificate_id uuid, p_approve boolean, p_rejection_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cert certificates%rowtype;
  v_prev_hash text;
  v_row_hash text;
  v_course_title text;
begin
  select * into v_cert from certificates where id = p_certificate_id;
  if v_cert.id is null then
    raise exception 'Certificate request not found';
  end if;
  if not (
    exists (select 1 from courses c where c.id = v_cert.course_id and (c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to review this certificate';
  end if;

  update certificates set
    status = (case when p_approve then 'issued' else 'rejected' end)::certificate_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    issued_at = case when p_approve then now() else null end,
    rejection_reason = case when p_approve then null else p_rejection_reason end,
    certificate_number = case when p_approve then coalesce(v_cert.certificate_number, 'TAI-' || upper(substr(md5(random()::text), 1, 10))) else v_cert.certificate_number end
  where id = p_certificate_id;

  select title into v_course_title from courses where id = v_cert.course_id;
  select row_hash into v_prev_hash from admin_audit_log order by created_at desc limit 1;
  v_row_hash := encode(digest(coalesce(v_prev_hash, '') || 'certificate_review' || p_certificate_id::text || now()::text, 'sha256'), 'hex');
  insert into admin_audit_log (admin_user_id, action_type, target_type, target_id, target_identifier, metadata, prev_hash, row_hash)
  values (
    auth.uid(), 'certificate_review', 'certificate', p_certificate_id, v_course_title,
    jsonb_build_object('approved', p_approve, 'learner_id', v_cert.user_id, 'reason', p_rejection_reason),
    v_prev_hash, v_row_hash
  );

  return jsonb_build_object('success', true, 'status', case when p_approve then 'issued' else 'rejected' end);
end;
$$;

comment on function request_certificate(uuid) is 'Steps 1-4 of the certificate workflow: verifies real completion/passing score server-side, creates a pending (or auto-issued) request.';
comment on function review_certificate(uuid, boolean, text) is 'Steps 5-6: admin/instructor approval or rejection, audited unconditionally.';
