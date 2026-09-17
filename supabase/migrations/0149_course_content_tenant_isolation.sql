-- ============================================================================
-- P0 tenant-isolation remediation: courses, lessons, quizzes, assessments,
-- certificate_templates, certificates, and issue_certificate_directly().
-- ============================================================================
-- ROOT CAUSE (confirmed by reading the actual function bodies, not assumed):
--
-- effective_has_permission(user, 'manage_courses') (0005_functions.sql) is a
-- pure ROLE-capability check via role_has_permission()/role_permissions_matrix
-- - "does this user's role have this capability at all" - with NO
-- organization comparison anywhere in it. Every RLS policy below was built
-- on top of that function alone, so every org admin / content manager in
-- EVERY organization satisfies it simultaneously. This is the exact same
-- class of bug already found and fixed once in this codebase for
-- learning_paths (0110_learning_paths_rls_fix.sql, see its comment), but the
-- identical fix was never applied to courses/lessons/quizzes/assessments/
-- certificates, and courses itself never had an organization_id column to
-- scope against in the first place.
--
-- DESIGN DECISION - why courses gets a nullable organization_id rather than
-- deriving ownership purely through instructor_id -> user_profiles.organization_id:
--   1. courses.instructor_id is nullable BY DESIGN and already has real rows
--      with it null and no other org linkage - the persistent demo course
--      (0132_seed_demo_course.sql, "instructor_id is left null - a fresh
--      deployment has no way to know which real user_profiles row should
--      own this") and external-partner courses (course_source = 'external',
--      e.g. the seeded "Advanced Project Management" in
--      0134_comprehensive_demo_data.sql, instructor_id null). These are
--      genuinely, intentionally platform-wide content, not an org's private
--      catalog - deriving org purely from instructor_id would either break
--      them or force an arbitrary org onto content that isn't org-owned.
--   2. Every OTHER seeded course has a single instructor_id that maps
--      deterministically to exactly one organization (confirmed by reading
--      0134's seed data) - so backfilling organization_id from the
--      instructor's own org is safe and lossless for real, org-owned courses.
--   3. Conclusion: organization_id nullable on courses. NULL means
--      "platform-wide content" (the demo course, external-partner courses) -
--      readable by any signed-in user same as before, but now WRITABLE ONLY
--      BY SUPER_ADMIN (tightened - no org admin should be editing platform
--      demo/external content, and none currently need to). Non-null means
--      "this org's own course" - readable and writable only within that org
--      (plus the owning instructor and super_admin), matching the same
--      pattern already proven safe for cohorts, organizations, and
--      ai_usage_events elsewhere in this schema.
--
-- lessons/quizzes/assessments/certificate_templates/certificates all
-- already derive ownership through course_id (or lesson_id -> course_id) or
-- (for certificates) already carry their own organization_id column that
-- was simply never checked in RLS - fixed the same way, no new columns
-- needed for those.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. courses: add organization_id, backfill deterministically, do NOT force
--    NOT NULL (intentionally nullable - see design decision above).
-- ----------------------------------------------------------------------------
alter table courses add column if not exists organization_id uuid references organizations(id);

update courses c
set organization_id = up.organization_id
from user_profiles up
where c.instructor_id = up.id
  and c.organization_id is null
  and up.organization_id is not null;

create index if not exists idx_courses_organization_id on courses(organization_id);

comment on column courses.organization_id is
  'NULL = platform-wide content (demo/external-partner courses), writable only by super_admin. Non-null = owned by that organization, matching the cohorts/organizations isolation pattern.';

-- ----------------------------------------------------------------------------
-- 2. courses RLS - replace the two unscoped policies from 0006.
-- ----------------------------------------------------------------------------
drop policy if exists courses_select_published on courses;
create policy courses_select_published on courses for select
  using (
    (organization_id is null and is_published)
    or (
      organization_id = get_user_organization_id(auth.uid())
      and (is_published or instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses'))
    )
    or instructor_id = auth.uid()
    or is_super_admin(auth.uid())
  );

drop policy if exists courses_write_authorized on courses;
create policy courses_write_authorized on courses for all
  using (
    instructor_id = auth.uid()
    or (organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
    or is_super_admin(auth.uid())
  )
  with check (
    instructor_id = auth.uid()
    or (organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
    or is_super_admin(auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 3. lessons RLS - same shape, joined through the parent course.
-- ----------------------------------------------------------------------------
drop policy if exists lessons_select_published on lessons;
create policy lessons_select_published on lessons for select
  using (
    exists (
      select 1 from courses c where c.id = lessons.course_id
      and (
        (c.organization_id is null and (lessons.is_published or c.is_published))
        or (c.organization_id = get_user_organization_id(auth.uid()) and (lessons.is_published or c.instructor_id = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses')))
        or c.instructor_id = auth.uid()
        or is_super_admin(auth.uid())
      )
    )
  );

drop policy if exists lessons_write_authorized on lessons;
create policy lessons_write_authorized on lessons for all
  using (
    exists (
      select 1 from courses c where c.id = lessons.course_id
      and (
        c.instructor_id = auth.uid()
        or (c.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
        or is_super_admin(auth.uid())
      )
    )
  )
  with check (
    exists (
      select 1 from courses c where c.id = lessons.course_id
      and (
        c.instructor_id = auth.uid()
        or (c.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
        or is_super_admin(auth.uid())
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 4. quizzes RLS - course_id and lesson_id are both nullable on quizzes, so
--    resolve org through whichever is set. Read policy previously had NO
--    ownership check at all beyond is_published; write policy previously
--    had NO course/lesson join at all - both fixed here.
-- ----------------------------------------------------------------------------
drop policy if exists quizzes_select_published on quizzes;
create policy quizzes_select_published on quizzes for select
  using (
    is_published
    or exists (
      select 1 from courses c
      where (c.id = quizzes.course_id or c.id = (select l.course_id from lessons l where l.id = quizzes.lesson_id))
      and (c.instructor_id = auth.uid() or c.organization_id = get_user_organization_id(auth.uid()))
    )
    or is_super_admin(auth.uid())
  );

drop policy if exists quizzes_write_authorized on quizzes;
create policy quizzes_write_authorized on quizzes for all
  using (
    exists (
      select 1 from courses c
      where (c.id = quizzes.course_id or c.id = (select l.course_id from lessons l where l.id = quizzes.lesson_id))
      and (
        c.instructor_id = auth.uid()
        or (c.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
      )
    )
    or is_super_admin(auth.uid())
  )
  with check (
    exists (
      select 1 from courses c
      where (c.id = quizzes.course_id or c.id = (select l.course_id from lessons l where l.id = quizzes.lesson_id))
      and (
        c.instructor_id = auth.uid()
        or (c.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
      )
    )
    or is_super_admin(auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 5. assessments RLS - same shape as quizzes (course_id/lesson_id both
--    nullable). Read stays intentionally open per the original 0112
--    reasoning (no gradeable content in the row itself) - only WRITE is
--    tenant-scoped here, since write is the actual cross-tenant mutation risk.
-- ----------------------------------------------------------------------------
drop policy if exists assessments_write_authorized on assessments;
create policy assessments_write_authorized on assessments for all
  using (
    exists (
      select 1 from courses c
      where (c.id = assessments.course_id or c.id = (select l.course_id from lessons l where l.id = assessments.lesson_id))
      and (
        c.instructor_id = auth.uid()
        or (c.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
      )
    )
    or is_super_admin(auth.uid())
  )
  with check (
    exists (
      select 1 from courses c
      where (c.id = assessments.course_id or c.id = (select l.course_id from lessons l where l.id = assessments.lesson_id))
      and (
        c.instructor_id = auth.uid()
        or (c.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
      )
    )
    or is_super_admin(auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 6. certificate_templates / certificates - both ALREADY carry
--    organization_id (0120_certificates.sql); it was simply never checked.
--    No schema change needed here, only the policy fix.
-- ----------------------------------------------------------------------------
drop policy if exists ct_write_authorized on certificate_templates;
create policy ct_write_authorized on certificate_templates for all
  using (
    exists (select 1 from courses c where c.id = certificate_templates.course_id and c.instructor_id = auth.uid())
    or (certificate_templates.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from courses c where c.id = certificate_templates.course_id and c.instructor_id = auth.uid())
    or (certificate_templates.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
    or is_super_admin(auth.uid())
  );

drop policy if exists cert_select_reviewer on certificates;
create policy cert_select_reviewer on certificates for select
  using (
    exists (select 1 from courses c where c.id = certificates.course_id and c.instructor_id = auth.uid())
    or (certificates.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
    or is_super_admin(auth.uid())
  );

drop policy if exists cert_update_reviewer on certificates;
create policy cert_update_reviewer on certificates for update
  using (
    exists (select 1 from courses c where c.id = certificates.course_id and c.instructor_id = auth.uid())
    or (certificates.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
    or is_super_admin(auth.uid())
  )
  with check (
    exists (select 1 from courses c where c.id = certificates.course_id and c.instructor_id = auth.uid())
    or (certificates.organization_id = get_user_organization_id(auth.uid()) and effective_has_permission(auth.uid(), 'manage_courses'))
    or is_super_admin(auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 7. issue_certificate_directly() - the most serious single finding in this
--    migration. The function took p_organization_id AND p_user_id straight
--    from the client with ZERO validation that either belonged to the
--    caller's own organization - only checking "is this caller *an* org
--    admin somewhere", not "*this* org's admin". A non-super-admin org
--    admin could issue a certificate to an arbitrary user_id, tagged with
--    an arbitrary organization_id, entirely of their own choosing. Fixed to
--    derive/validate the organization server-side and confirm the target
--    user actually belongs to it, exactly matching the "do not trust a
--    client-supplied organization ID when the server can derive it" rule.
-- ----------------------------------------------------------------------------
create or replace function issue_certificate_directly(
  p_user_id uuid, p_organization_id uuid, p_title text, p_course_id uuid, p_file_url text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cert_id uuid;
  v_cert_number text;
  v_caller_org uuid;
  v_target_org uuid;
begin
  if not (is_org_admin(auth.uid()) or is_super_admin(auth.uid()) or (has_role(auth.uid(), 'mentor'::platform_role) and effective_org_permission(auth.uid(), 'issue_certificates'))) then
    raise exception 'Not authorized to issue certificates';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'A certificate title is required';
  end if;

  -- Server-side tenant derivation/validation - a non-super-admin caller may
  -- only issue within their own organization, to a learner who is actually
  -- in that organization. A mismatched or spoofed p_organization_id is
  -- rejected outright rather than silently substituted, so the caller finds
  -- out immediately rather than getting a quietly-wrong certificate.
  if not is_super_admin(auth.uid()) then
    v_caller_org := get_user_organization_id(auth.uid());
    if v_caller_org is null or p_organization_id is distinct from v_caller_org then
      raise exception 'Cannot issue a certificate for another organization';
    end if;
    select organization_id into v_target_org from user_profiles where id = p_user_id;
    if v_target_org is distinct from v_caller_org then
      raise exception 'That learner is not a member of your organization';
    end if;
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
  'Admin-initiated certificate issuance. Non-super-admin callers are hard-restricted server-side to their own organization_id and to learners who are members of it - p_organization_id/p_user_id are validated, never trusted outright.';
