-- ============================================================================
-- Admin can directly issue/upload a certificate to a specific learner - a
-- real, confirmed gap: the only certificate path built before this was
-- learner-requests -> admin-approves (request_certificate()/
-- review_certificate(), 0120_certificates.sql). There was no way for an
-- admin to hand a certificate to someone directly, and no way to attach
-- an actual uploaded file (PDF/image) to a certificate at all - only an
-- auto-generated certificate number existed.
-- ============================================================================

alter table certificates add column if not exists file_url text;
alter table certificates add column if not exists issued_by uuid references user_profiles(id);
-- template_id/course_id are both `not null` today (0120) - a direct issue
-- may not correspond to any course/template the learner is enrolled in at
-- all (e.g. an external achievement, a manually-recognized credential).
-- Relaxed to nullable rather than force-fitting every direct issue into
-- an existing course, and added a real `title` for exactly that case.
alter table certificates alter column course_id drop not null;
alter table certificates alter column template_id drop not null;
alter table certificates add column if not exists title text;

comment on column certificates.file_url is 'An admin-uploaded certificate file (PDF/image) for a directly-issued certificate - separate from the auto-generated certificate_number.';
comment on column certificates.issued_by is 'Who issued this - set for direct admin issuance; review_certificate() already tracks reviewed_by separately for the request/approve path.';

create or replace function issue_certificate_directly(
  p_user_id uuid, p_organization_id uuid, p_title text, p_course_id uuid, p_file_url text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cert_id uuid;
  v_cert_number text;
begin
  if not (is_org_admin(auth.uid()) or is_super_admin(auth.uid()) or (has_role(auth.uid(), 'mentor'::platform_role) and effective_org_permission(auth.uid(), 'issue_certificates'))) then
    raise exception 'Not authorized to issue certificates';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'A certificate title is required';
  end if;

  v_cert_number := 'TAI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into certificates (user_id, organization_id, course_id, title, status, issued_at, issued_by, certificate_number, file_url)
  values (p_user_id, p_organization_id, p_course_id, trim(p_title), 'issued', now(), auth.uid(), v_cert_number, p_file_url)
  returning id into v_cert_id;

  perform log_admin_action('issue_certificate_directly', 'certificate', v_cert_id, p_title, null, jsonb_build_object('user_id', p_user_id, 'title', p_title), jsonb_build_object('file_url', p_file_url is not null));

  return v_cert_id;
end;
$$;

comment on function issue_certificate_directly(uuid, uuid, text, uuid, text) is
  'Admin-initiated certificate issuance, independent of the request/approve flow - supports an uploaded file and does not require an existing course/template.';
