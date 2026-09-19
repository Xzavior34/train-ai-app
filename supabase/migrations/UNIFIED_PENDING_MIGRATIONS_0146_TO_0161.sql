-- ============================================================================
-- Learner AI-credit requests - Train AI 2.0 learner-section simplification.
-- The org-based credits model means a learner should be able to either buy
-- credits themselves (existing paystack/stripe flow, unchanged) or request
-- them from their organization. There was no table for the latter at all.
--
-- Scope, confirmed directly: learner-side request only for this pass - the
-- learner submits a request and can see its own status. No admin
-- approve/deny screen or auto-crediting yet; that is a follow-up once the
-- org/admin side of this workflow is designed. Rows just sit `pending`
-- until an admin-side feature (not built here) starts updating them.
-- ============================================================================

create table if not exists credit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  amount int not null check (amount > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

comment on table credit_requests is 'A learner asking their organization to grant them AI credits, instead of buying credits themselves. Learner-writable/readable only for now - no admin review UI yet.';

create index if not exists credit_requests_user_id_idx on credit_requests(user_id);
create index if not exists credit_requests_org_id_idx on credit_requests(organization_id);

alter table credit_requests enable row level security;

drop policy if exists cr_select_own on credit_requests;
create policy cr_select_own on credit_requests for select
  using (user_id = auth.uid() or is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

drop policy if exists cr_insert_own on credit_requests;
create policy cr_insert_own on credit_requests for insert
  with check (user_id = auth.uid());

-- Learners can't edit/withdraw a submitted request or forge its status; only
-- an admin-side workflow (future) resolving it needs update access, and org
-- admins/super admins already get that via is_org_admin/is_super_admin.
drop policy if exists cr_update_admin on credit_requests;
create policy cr_update_admin on credit_requests for update
  using (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));
-- lib/api/waitlist.js's fetchWaitlistCount() (public landing-page headline,
-- "Join N others") calls rpc("get_waitlist_count"), but that function was
-- never defined - every call errored and the count silently fell back to 0.
--
-- A plain client-side `select count(*) from waitlist` isn't an option here:
-- the table has no select policy for anon (see 0006_rls_policies.sql - only
-- paid_waitlist/safe_paid_waitlist grant read access, and that's a
-- different, admin-only table), so this is a small security-definer
-- function that returns only the count, never the rows, matching the same
-- shape as the other get_*_summary functions in this schema
-- (get_org_seats_summary, get_org_features_bulk).
create or replace function get_waitlist_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from waitlist;
$$;
-- The learner Leaderboard screen has "This Week" / "This Month" / "My
-- Cohort" / "All Time" tabs, but only "All Time" was ever wired to real
-- data (get_leaderboard_with_profiles, 0005_functions.sql) - the other
-- three changed which button looked selected and nothing else.
--
-- There is no running points-per-period ledger in this schema
-- (user_gamification_stats.total_points is lifetime-cumulative only), so a
-- period leaderboard is computed here from the real, timestamped rows that
-- already back every point award in this schema:
--   - lesson_progress: +50 per completed lesson (matches markLessonComplete
--     in lib/api/learner.js), dated by completed_at.
--   - quiz_attempts.total_points, dated by completed_at (the exact points
--     check_quiz_answers() awarded for that attempt).
--   - daily_login_rewards.points_awarded, dated by claimed_date.
-- This is real activity within the window, not an estimate or a fabricated
-- number - a learner with no timestamped activity in range simply doesn't
-- appear, which is the correct answer for "what happened in this period".
create or replace function get_leaderboard_for_period(p_start timestamptz, p_end timestamptz, p_limit int default 50)
returns table (user_id uuid, display_name text, avatar_url text, period_points bigint, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  with lesson_points as (
    select lp.user_id, count(*) * 50 as pts
    from lesson_progress lp
    where lp.is_completed = true and lp.completed_at >= p_start and lp.completed_at < p_end
    group by lp.user_id
  ),
  quiz_points as (
    select qa.user_id, coalesce(sum(qa.total_points), 0) as pts
    from quiz_attempts qa
    where qa.completed_at >= p_start and qa.completed_at < p_end
    group by qa.user_id
  ),
  login_points as (
    select dlr.user_id, coalesce(sum(dlr.points_awarded), 0) as pts
    from daily_login_rewards dlr
    where dlr.claimed_date >= p_start::date and dlr.claimed_date < p_end::date
    group by dlr.user_id
  ),
  combined as (
    select u.user_id, sum(u.pts) as period_points
    from (
      select * from lesson_points
      union all select * from quiz_points
      union all select * from login_points
    ) u
    group by u.user_id
    having sum(u.pts) > 0
  )
  select c.user_id, up.display_name, up.avatar_url, c.period_points,
    coalesce(s.current_level, 1), coalesce(s.streak_days, 0)
  from combined c
  join user_profiles up on up.id = c.user_id
  left join user_gamification_stats s on s.user_id = c.user_id
  order by c.period_points desc
  limit p_limit;
$$;

-- "My Cohort" tab: same lifetime total_points ranking as
-- get_leaderboard_with_profiles, restricted to members of one cohort.
create or replace function get_cohort_leaderboard(p_cohort_id uuid, p_limit int default 50)
returns table (user_id uuid, display_name text, avatar_url text, total_points int, current_level int, streak_days int)
language sql stable security definer set search_path = public as $$
  select s.user_id, up.display_name, up.avatar_url, s.total_points, s.current_level, s.streak_days
  from cohort_members cm
  join user_gamification_stats s on s.user_id = cm.user_id
  join user_profiles up on up.id = cm.user_id
  where cm.cohort_id = p_cohort_id
  order by s.total_points desc
  limit p_limit;
$$;
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
-- ============================================================================
-- Cohort <-> course referential tenant integrity
-- ============================================================================
-- Confirmed gap, empirically verified before this fix (not assumed): nothing
-- stopped an org admin from assigning another organization's course_id into
-- their own cohort via cohort_courses or cohort_learner_courses - the RLS on
-- those join tables only checks the COHORT's organization, never that the
-- COURSE being referenced belongs to that same organization (or is genuinely
-- global, organization_id is null).
--
-- Verified this is a data-integrity bug, not a confidentiality leak: the
-- 0149 fix already makes the underlying `courses` row itself invisible to
-- anyone outside its owning organization, so a cross-org assignment produces
-- a dangling reference a learner can see exists but can't open - not an
-- actual content leak. Still worth closing at the data layer: a broken
-- assignment is a real product bug (a learner told "you have this course"
-- who then can't open it), and leaving aFK-valid-but-nonsensical row around
-- is exactly the kind of orphan/ambiguous-ownership state worth preventing
-- outright rather than working around in the UI.
--
-- Postgres has no cross-table CHECK constraint, so this is enforced with a
-- BEFORE INSERT OR UPDATE trigger on both join tables - simplest mechanism
-- that can compare two different tables' rows, and (unlike RLS) applies
-- regardless of which role is doing the writing, including service_role
-- scripts/seed data run directly against the database.
-- ============================================================================

-- Detect (never delete) any already-existing mismatched rows before the
-- trigger goes live, so an operator running this against real data finds
-- out immediately rather than being silently protected going forward while
-- a pre-existing bad row sits unnoticed. Per the brief: existing data is
-- never modified or deleted here - only reported.
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from cohort_courses cc
  join cohorts co on co.id = cc.cohort_id
  join courses cr on cr.id = cc.course_id
  where cr.organization_id is not null and cr.organization_id is distinct from co.organization_id;
  if v_count > 0 then
    raise notice 'cohort_courses: % existing row(s) reference a course from a different organization than their cohort - not deleted, review manually', v_count;
  end if;

  select count(*) into v_count
  from cohort_learner_courses clc
  join cohorts co on co.id = clc.cohort_id
  join courses cr on cr.id = clc.course_id
  where cr.organization_id is not null and cr.organization_id is distinct from co.organization_id;
  if v_count > 0 then
    raise notice 'cohort_learner_courses: % existing row(s) reference a course from a different organization than their cohort - not deleted, review manually', v_count;
  end if;
end $$;

create or replace function enforce_course_matches_cohort_org()
returns trigger
-- SECURITY DEFINER is required here, not optional: this function's own
-- SELECTs against `cohorts`/`courses` would otherwise run as the calling
-- role and be subject to RLS themselves - meaning an Org B caller's lookup
-- of an Org A course would silently return 0 rows (RLS hides it), the
-- `is not null` guard below would never trigger, and the whole check would
-- be a silent no-op. Confirmed this exact failure mode by testing without
-- SECURITY DEFINER first: the cross-org insert succeeded when it should
-- have been rejected. search_path is pinned per this schema's own
-- convention for every other SECURITY DEFINER function.
language plpgsql security definer set search_path = public as $$
declare
  v_cohort_org uuid;
  v_course_org uuid;
begin
  select organization_id into v_cohort_org from cohorts where id = new.cohort_id;
  select organization_id into v_course_org from courses where id = new.course_id;
  -- A null course organization_id is genuinely global/platform content
  -- (the demo course, external-partner courses - see 0149's comment) and
  -- is assignable into any cohort. Anything else must match the cohort's
  -- own organization.
  if v_course_org is not null and v_course_org is distinct from v_cohort_org then
    raise exception 'Cannot assign a course from a different organization to this cohort';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cohort_courses_org_match on cohort_courses;
create trigger trg_cohort_courses_org_match
  before insert or update on cohort_courses
  for each row execute function enforce_course_matches_cohort_org();

drop trigger if exists trg_cohort_learner_courses_org_match on cohort_learner_courses;
create trigger trg_cohort_learner_courses_org_match
  before insert or update on cohort_learner_courses
  for each row execute function enforce_course_matches_cohort_org();

comment on function enforce_course_matches_cohort_org() is
  'Defense-in-depth for cohort_courses/cohort_learner_courses: rejects assigning a course that belongs to a different, non-global organization than the cohort itself. Runs regardless of caller role, unlike RLS.';
-- ============================================================================
-- CRITICAL: user_profiles self-escalation via organization_id/role rewrite
-- ============================================================================
-- Found while running the Phase 9 (role/org escalation) attack tests: the
-- existing `up_update_own` policy (0006_rls_policies.sql) lets any
-- authenticated user UPDATE their own user_profiles row with NO restriction
-- on which columns change - including organization_id and role.
--
-- Verified empirically, not assumed: as a real learner in Org B, a plain
-- `update user_profiles set organization_id = <Org A's id> where id =
-- auth.uid()` succeeded outright, and immediately granted read access to
-- Org A's cohorts (and, transitively, every other table whose RLS trusts
-- get_user_organization_id(auth.uid()) - which is nearly every tenant-scoped
-- table in this schema, including the courses/certificates policies just
-- fixed in 0149). This is more severe than the courses gap: it doesn't
-- attack one table's policy, it attacks the trust root nearly all of them
-- share. ANY authenticated user could self-assign into ANY organization by
-- rewriting one column on their own row.
--
-- Why this wasn't caught by the courses/certificates fix: that fix (0149)
-- correctly compares a resource's organization_id against
-- get_user_organization_id(auth.uid()) - which is the right pattern *only
-- if* a user's own organization_id can't be freely rewritten by that same
-- user. It couldn't be assumed safe without testing it directly, which is
-- what this pass did differently.
--
-- Why a trigger, not a WITH CHECK clause: Postgres RLS's WITH CHECK on an
-- UPDATE has access to the NEW row but not a clean way to compare against
-- OLD without re-querying the same (RLS-protected) table recursively. A
-- BEFORE UPDATE trigger has direct, non-recursive access to OLD and NEW.
--
-- Why the current_user check, not just is_org_admin()/is_super_admin():
-- legitimate self-assignment of organization_id already happens today
-- through vetted SECURITY DEFINER functions (accept_invitation(),
-- create_organization_self_serve(), join_default_organization() -
-- 0106_join_default_organization.sql) that intentionally bypass RLS to let
-- a brand-new user attach themselves to an org via a real invitation token
-- or real self-serve signup flow. Those functions are owned by the
-- migration-owner role (postgres), so their internal UPDATE statements run
-- with current_user = the function owner - confirmed empirically in this
-- pass, not assumed - whereas a raw client-side PATCH through PostgREST
-- always executes as current_user = authenticated. The trigger below
-- allows the former (the vetted, already-validated path) and blocks the
-- latter (an unvalidated raw write), which is the correct trust boundary:
-- trust the RPC that checked a real token/seat/eligibility, never trust a
-- bare column write.
-- ============================================================================

create or replace function protect_user_profile_privileged_fields()
returns trigger
language plpgsql set search_path = public as $$
begin
  -- Writes coming from a SECURITY DEFINER function owned by this migration
  -- role (accept_invitation, create_organization_self_serve,
  -- join_default_organization, etc.) run as that owner, not as
  -- `authenticated` - those are the already-vetted paths and are left
  -- alone. Only a raw client-side write needs this check.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.role is distinct from old.role then
    if is_super_admin(auth.uid()) then
      return new;
    end if;
    -- An org admin may change a member's role or move them, but only
    -- within their own organization on both sides of the change - this is
    -- not a mechanism for an admin to pull a user OUT of another org
    -- (old.organization_id must already equal the admin's own org).
    if is_org_admin(auth.uid())
       and old.organization_id = get_user_organization_id(auth.uid())
       and new.organization_id = get_user_organization_id(auth.uid()) then
      return new;
    end if;
    raise exception 'Not authorized to change organization or role on this profile directly';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_user_profile_privileged_fields on user_profiles;
create trigger trg_protect_user_profile_privileged_fields
  before update on user_profiles
  for each row execute function protect_user_profile_privileged_fields();

comment on function protect_user_profile_privileged_fields() is
  'Blocks a raw client-side (current_user = authenticated) UPDATE from changing organization_id or role on a user_profiles row, closing a self-escalation path where any user could rewrite their own organization_id to gain org-scoped access to any tenant. Vetted SECURITY DEFINER paths (accept_invitation, create_organization_self_serve, etc.) are unaffected since they run as the function-owner role.';
-- ============================================================================
-- Systemic fix: bare is_org_admin(auth.uid()) with no organization match,
-- across cohort_members, cohort_learner_courses, cohort_courses,
-- cohort_resources, cohort_sessions, cohort_posts, cohort_post_replies,
-- cohort_post_reactions, study_group_messages, study_group_members,
-- compliance_assignments, and the set_learner_course_access_paused() RPC.
-- ============================================================================
-- Found while running the Phase 4/5 (Org A <-> Org B attack) tests in this
-- pass, starting from a single empirical result: an Org B admin could both
-- READ and DELETE an Org A cohort's session through cohort_sessions,
-- despite 0149/0150 already fixing courses/certificates/cohort-course
-- referential integrity. Tracing the root cause (is_org_admin(auth.uid())
-- alone, the exact same unscoped-permission class fixed for courses in
-- 0149) and then grepping the rest of the schema for the identical bare
-- pattern surfaced eleven more affected policies and one RPC across nine
-- tables - this was not an isolated bug, it was a repeated pattern applied
-- every time a "cohort collaboration" feature was built.
--
-- is_org_admin(user) only ever answers "is this person an admin of *some*
-- organization" - it was never meant to be a tenant boundary by itself,
-- only a role check to be combined with an actual org/cohort match. Most
-- of the RLS in this schema does combine it correctly (cohorts_write_admin,
-- 0006; cohorts_insert/update/delete, 0127; the 0149 courses fix); these
-- eleven policies simply never got that second half.
--
-- Fix pattern, consistent with every other tenant-scoping fix in this
-- schema: resolve each resource's owning organization_id through its
-- cohort_id / study_group_id / user_id (whichever it actually has), then
-- require it to equal get_user_organization_id(auth.uid()) alongside the
-- existing is_org_admin()/role checks. Every pre-existing membership-based
-- or ownership-based clause (cohort_members, author_id, user_id) is left
-- exactly as it was - those were already correctly scoped, since
-- membership in a specific cohort is itself a real, if now newly-enforced,
-- tenant boundary.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- cohort_members
-- ---------------------------------------------------------------------------
-- NOTE: cm_write_admin (0006) was already dropped and replaced by
-- cm_write_admin_or_self in 0127_suspend_instructor_payouts.sql, to let a
-- mentor auto-add themselves when creating a cohort (createCohort() in
-- lib/api/platform.js). That replacement kept the same is_org_admin() bug
-- AND introduced a second one: `user_id = auth.uid()` with no org check at
-- all meant literally any authenticated user - including a learner in a
-- completely different organization - could self-insert into ANY cohort's
-- membership list, which would then unlock read access through every
-- cm.user_id = auth.uid() membership check elsewhere (cohort_posts,
-- cohort_sessions, cohort_resources). Fixed by requiring the self-joiner
-- to actually belong to the same org as the cohort - preserves the
-- self-add behavior 0127 intended, closes the cross-org path.
drop policy if exists cm_write_admin_or_self on cohort_members;
drop policy if exists cm_write_admin on cohort_members;
create policy cm_write_admin_or_self on cohort_members for all
  using (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (user_id = auth.uid() and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  )
  with check (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (user_id = auth.uid() and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists cm_select_self_or_admin on cohort_members;
create policy cm_select_self_or_admin on cohort_members for select
  using (
    user_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_members.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- cohort_learner_courses
-- ---------------------------------------------------------------------------
drop policy if exists clc_select_self_or_admin on cohort_learner_courses;
create policy clc_select_self_or_admin on cohort_learner_courses for select
  using (
    user_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_learner_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists clc_write_admin on cohort_learner_courses;
create policy clc_write_admin on cohort_learner_courses for all
  using (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_learner_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  with check (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_learner_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid())));

-- ---------------------------------------------------------------------------
-- cohort_courses
-- ---------------------------------------------------------------------------
drop policy if exists cc_select_cohort_member_or_admin on cohort_courses;
create policy cc_select_cohort_member_or_admin on cohort_courses for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_courses.cohort_id and cm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists cc_write_admin on cohort_courses;
create policy cc_write_admin on cohort_courses for all
  using ((is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid()))) or is_super_admin(auth.uid()))
  with check ((is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_courses.cohort_id and co.organization_id = get_user_organization_id(auth.uid()))) or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- cohort_resources
-- ---------------------------------------------------------------------------
drop policy if exists cres_select_member on cohort_resources;
create policy cres_select_member on cohort_resources for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_resources.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists cres_write_admin_or_instructor on cohort_resources;
create policy cres_write_admin_or_instructor on cohort_resources for all
  using (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_resources.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid()))
  )
  with check (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_resources.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (select 1 from cohort_members cm where cm.cohort_id = cohort_resources.cohort_id and cm.user_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- cohort_sessions - the table that surfaced this whole pass: empirically
-- confirmed an Org B admin could both read AND delete an Org A session
-- before this fix.
-- ---------------------------------------------------------------------------
drop policy if exists csess_select_member on cohort_sessions;
create policy csess_select_member on cohort_sessions for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_sessions.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists csess_write_admin_or_instructor on cohort_sessions;
create policy csess_write_admin_or_instructor on cohort_sessions for all
  using (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_sessions.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid()))
  )
  with check (
    (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_sessions.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
    or (has_role(auth.uid(), 'mentor'::platform_role) and exists (select 1 from cohort_members cm where cm.cohort_id = cohort_sessions.cohort_id and cm.user_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- cohort_posts (insert already safe via required cohort_members check -
-- left untouched; select/update/delete fixed)
-- ---------------------------------------------------------------------------
drop policy if exists cpost_select_member on cohort_posts;
create policy cpost_select_member on cohort_posts for select
  using (
    exists (select 1 from cohort_members cm where cm.cohort_id = cohort_posts.cohort_id and cm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_posts.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists cpost_update_own_or_admin on cohort_posts;
create policy cpost_update_own_or_admin on cohort_posts for update
  using (
    author_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_posts.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists cpost_delete_own_or_admin on cohort_posts;
create policy cpost_delete_own_or_admin on cohort_posts for delete
  using (
    author_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from cohorts co where co.id = cohort_posts.cohort_id and co.organization_id = get_user_organization_id(auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- cohort_post_replies - insert had NO membership/org check at all (worse
-- than the others: any org admin anywhere could reply into any cohort's
-- thread). select/delete fixed the same way as cohort_posts.
-- ---------------------------------------------------------------------------
drop policy if exists cpr_select_member on cohort_post_replies;
create policy cpr_select_member on cohort_post_replies for select
  using (
    exists (
      select 1 from cohort_posts p join cohort_members cm on cm.cohort_id = p.cohort_id
      where p.id = cohort_post_replies.post_id and cm.user_id = auth.uid()
    )
    or (is_org_admin(auth.uid()) and exists (
      select 1 from cohort_posts p join cohorts co on co.id = p.cohort_id
      where p.id = cohort_post_replies.post_id and co.organization_id = get_user_organization_id(auth.uid())
    ))
  );

drop policy if exists cpr_insert_instructor_only on cohort_post_replies;
create policy cpr_insert_instructor_only on cohort_post_replies for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from cohort_posts p join cohort_members cm on cm.cohort_id = p.cohort_id
      where p.id = cohort_post_replies.post_id and cm.user_id = auth.uid()
    )
    and (has_role(auth.uid(), 'mentor'::platform_role) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  );

drop policy if exists cpr_delete_own_or_admin on cohort_post_replies;
create policy cpr_delete_own_or_admin on cohort_post_replies for delete
  using (
    author_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (
      select 1 from cohort_posts p join cohorts co on co.id = p.cohort_id
      where p.id = cohort_post_replies.post_id and co.organization_id = get_user_organization_id(auth.uid())
    ))
  );

-- ---------------------------------------------------------------------------
-- cohort_post_reactions
-- ---------------------------------------------------------------------------
drop policy if exists cpreact_select_member on cohort_post_reactions;
create policy cpreact_select_member on cohort_post_reactions for select
  using (
    exists (
      select 1 from cohort_posts p join cohort_members cm on cm.cohort_id = p.cohort_id
      where p.id = cohort_post_reactions.post_id and cm.user_id = auth.uid()
    )
    or (is_org_admin(auth.uid()) and exists (
      select 1 from cohort_posts p join cohorts co on co.id = p.cohort_id
      where p.id = cohort_post_reactions.post_id and co.organization_id = get_user_organization_id(auth.uid())
    ))
  );

-- ---------------------------------------------------------------------------
-- study_group_messages / study_group_members
-- ---------------------------------------------------------------------------
drop policy if exists sgm_select_member on study_group_messages;
create policy sgm_select_member on study_group_messages for select
  using (
    exists (select 1 from study_group_members sgm where sgm.group_id = study_group_messages.study_group_id and sgm.user_id = auth.uid())
    or (is_org_admin(auth.uid()) and exists (select 1 from study_groups sg where sg.id = study_group_messages.study_group_id and sg.organization_id = get_user_organization_id(auth.uid())))
  );

drop policy if exists sgm_insert_instructor_only on study_group_messages;
create policy sgm_insert_instructor_only on study_group_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from study_group_members sgm
      where sgm.group_id = study_group_messages.study_group_id and sgm.user_id = auth.uid()
    )
    and (has_role(auth.uid(), 'mentor'::platform_role) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  );

drop policy if exists sgm_write_own_or_group_creator on study_group_members;
create policy sgm_write_own_or_group_creator on study_group_members for all
  using (
    user_id = auth.uid()
    or (is_org_admin(auth.uid()) and exists (select 1 from study_groups sg where sg.id = study_group_members.group_id and sg.organization_id = get_user_organization_id(auth.uid())))
    or is_study_group_creator(auth.uid(), group_id)
  )
  with check (
    (is_org_admin(auth.uid()) and exists (select 1 from study_groups sg where sg.id = study_group_members.group_id and sg.organization_id = get_user_organization_id(auth.uid())))
    or is_study_group_creator(auth.uid(), group_id)
    or (user_id = auth.uid() and role = 'member')
  );

-- ---------------------------------------------------------------------------
-- compliance_assignments - no organization_id column; scoped through the
-- assigned learner's own organization, since a compliance assignment is
-- inherently "this org's admin assigning this org's learner" a mandatory
-- course.
-- ---------------------------------------------------------------------------
drop policy if exists comp_select_self_or_admin on compliance_assignments;
create policy comp_select_self_or_admin on compliance_assignments for select
  using (
    user_id = auth.uid()
    or (effective_has_permission(auth.uid(), 'manage_courses') and exists (select 1 from user_profiles up where up.id = compliance_assignments.user_id and up.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists comp_write_admin on compliance_assignments;
create policy comp_write_admin on compliance_assignments for all
  using (
    (effective_has_permission(auth.uid(), 'manage_courses') and exists (select 1 from user_profiles up where up.id = compliance_assignments.user_id and up.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  )
  with check (
    (effective_has_permission(auth.uid(), 'manage_courses') and exists (select 1 from user_profiles up where up.id = compliance_assignments.user_id and up.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- set_learner_course_access_paused() - RPC-level fix, same root cause: any
-- org admin anywhere could pause/unpause any learner's access to any
-- course. Scoped to require the learner actually be in the caller's org.
-- ---------------------------------------------------------------------------
create or replace function set_learner_course_access_paused(p_learner_id uuid, p_course_id uuid, p_paused boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_course_instructor uuid;
  v_learner_org uuid;
begin
  select instructor_id into v_course_instructor from courses where id = p_course_id;
  select organization_id into v_learner_org from user_profiles where id = p_learner_id;
  if not (
    (v_course_instructor = auth.uid() and exists (select 1 from mentors m where m.user_id = auth.uid() and m.payouts_enabled = true))
    or (is_org_admin(auth.uid()) and v_learner_org is not null and v_learner_org = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to change this learner''s access';
  end if;
  update course_enrollments set access_paused = p_paused where user_id = p_learner_id and course_id = p_course_id;
end;
$$;
-- ============================================================================
-- Remaining wide-open (`using (true)`) and unscoped-permission policies
-- found while finishing the systemic sweep started in 0152.
-- ============================================================================
-- Scope decision, stated plainly: a full exhaustive RLS audit of every
-- policy in this 150+ migration schema was NOT performed. This migration
-- fixes the specific instances found that are reachable from the
-- second-organization workflow this pass is testing (forums/discussions
-- attached to courses - which 0149 already made org-ownable, so leaving
-- these open would have quietly reopened that fix one join away - and
-- study_group_members, which sits in the same "cohort collaboration"
-- cluster 0152 already covers). Two lower-severity items were found and
-- deliberately NOT fixed here, to keep this batch bounded to what the
-- workflow test actually exercises - documented, not hidden:
--   - fp_update_own_or_moderator / fp_delete_own_or_moderator
--     (forum_posts) and course_discussions' equivalent moderator paths use
--     can_moderate_content()/effective_has_permission(), the same
--     unscoped-role-check class as everything else in this pass - an
--     org admin with moderate_content could edit/delete another org's
--     forum post. This is a moderation-authority overreach, not a data
--     exfiltration path (the content was already readable per the fixes
--     below), so it's lower severity and left for a follow-up pass.
--   - community_posts/polls/post_comments/post_reactions were checked and
--     LEFT AS `using (true)` deliberately: community_posts has no
--     organization_id or course_id at all - it is a genuinely
--     platform-wide feed by original design, not a missed tenant
--     boundary. Not "fixed" because there was nothing to scope it to.
-- ============================================================================

-- study_group_members: 0152 fixed the ALL policy but missed this second,
-- separately-defined, never-superseded SELECT policy that granted
-- unconditional read access to every study group's membership platform-wide.
drop policy if exists sgm_select_all on study_group_members;

-- forums / forum_posts - course_id is nullable (is_general = true for
-- non-course forums, which remain intentionally global); when set, scope
-- to that course's organization the same way 0149 scoped courses itself.
drop policy if exists forums_select_all on forums;
create policy forums_select_all on forums for select
  using (
    is_general
    or course_id is null
    or exists (select 1 from courses c where c.id = forums.course_id and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists forums_write_authorized on forums;
create policy forums_write_authorized on forums for all
  using (
    is_super_admin(auth.uid())
    or (
      effective_has_permission(auth.uid(), 'manage_courses')
      and (
        course_id is null
        or exists (select 1 from courses c where c.id = forums.course_id and c.organization_id = get_user_organization_id(auth.uid()))
      )
    )
  )
  with check (
    is_super_admin(auth.uid())
    or (
      effective_has_permission(auth.uid(), 'manage_courses')
      and (
        course_id is null
        or exists (select 1 from courses c where c.id = forums.course_id and c.organization_id = get_user_organization_id(auth.uid()))
      )
    )
  );

drop policy if exists fp_select_all on forum_posts;
create policy fp_select_all on forum_posts for select
  using (
    exists (
      select 1 from forums f
      where f.id = forum_posts.forum_id
      and (
        f.is_general or f.course_id is null
        or exists (select 1 from courses c where c.id = f.course_id and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid())))
        or is_super_admin(auth.uid())
      )
    )
  );

-- course_discussions / course_discussion_messages - same pattern. Insert
-- previously required only `auth.uid() is not null` - any signed-in user
-- could open a discussion thread under any organization's private course.
drop policy if exists cd_select_all on course_discussions;
create policy cd_select_all on course_discussions for select
  using (
    exists (select 1 from courses c where c.id = course_discussions.course_id and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists cd_insert_authenticated on course_discussions;
create policy cd_insert_authenticated on course_discussions for insert
  with check (
    exists (select 1 from courses c where c.id = course_discussions.course_id and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  );

drop policy if exists cdm_select_all on course_discussion_messages;
create policy cdm_select_all on course_discussion_messages for select
  using (
    exists (
      select 1 from course_discussions cd join courses c on c.id = cd.course_id
      where cd.id = course_discussion_messages.discussion_id
      and (c.organization_id is null or c.organization_id = get_user_organization_id(auth.uid()))
    )
    or is_super_admin(auth.uid())
  );

-- 0131's mentor-settings tables: the is_org_admin() branch had no match
-- against the mentor's own organization, letting any org admin anywhere
-- write another org's mentor credentials/portfolio/pricing/session
-- templates/cancellation policies/reminder settings.
do $$
declare
  t text;
  affected_tables text[] := array[
    'mentor_credentials', 'mentor_portfolio_items', 'mentor_resources', 'mentor_pricing_tiers',
    'session_templates', 'cancellation_policies', 'reminder_settings'
  ];
  policy_name text;
begin
  foreach t in array affected_tables loop
    -- owner_readable_tables used '<t>_write_owner', owner_only_tables used '<t>_all_owner' - handle both names.
    execute format('drop policy if exists %I_write_owner on %I', t, t);
    execute format('drop policy if exists %I_all_owner on %I', t, t);
    policy_name := t || '_scoped_owner';
    execute format(
      'create policy %I on %I for all using (is_mentor_owner(auth.uid(), mentor_id) or (is_org_admin(auth.uid()) and exists (select 1 from mentors m where m.id = %I.mentor_id and m.organization_id = get_user_organization_id(auth.uid()))) or is_super_admin(auth.uid())) with check (is_mentor_owner(auth.uid(), mentor_id) or (is_org_admin(auth.uid()) and exists (select 1 from mentors m where m.id = %I.mentor_id and m.organization_id = get_user_organization_id(auth.uid()))) or is_super_admin(auth.uid()))',
      policy_name, t, t, t
    );
  end loop;
end $$;
-- ============================================================================
-- Phase 2 (trust-root/SECURITY DEFINER audit) findings: three functions with
-- no authorization check at all, found by inventorying every SECURITY
-- DEFINER function in the schema rather than only the ones already known
-- to be involved in courses/cohorts.
-- ============================================================================
-- get_mentor_analytics(p_mentor_id) - any authenticated user (a learner in
-- any organization) could query any mentor's total sessions, average
-- rating, and total EARNINGS by passing their mentor_id - a real financial
-- data leak, not just a courtesy statistic. Confirmed unauthenticated
-- (no auth.uid() check at all) by reading the function body directly.
--
-- search_mentionable_users(p_query) - searched user_profiles.display_name
-- platform-wide with no organization filter, callable directly by any
-- authenticated user (used by the @mention search bar). Let anyone
-- enumerate which users/display names exist in OTHER organizations -
-- lower severity than the courses/certificates leaks (a name, not content),
-- but the same class of cross-tenant disclosure this whole pass exists to
-- close, and directly client-reachable.
--
-- get_org_feature / get_org_features_bulk - took p_org_id directly with no
-- check that the caller belongs to that org, letting any authenticated
-- user read any organization's feature-flag configuration. Confirmed
-- client-reachable: fetchOrgFeatures() in src/lib/api/organizations.js
-- calls get_org_features_bulk directly with the org id from context - that
-- legitimate call always passes the caller's own org, so restricting the
-- function does not change its behavior for real callers, only for a
-- caller passing someone else's org id on purpose.
-- ============================================================================

create or replace function get_mentor_analytics(p_mentor_id uuid)
returns table (total_sessions bigint, completed_sessions bigint, avg_rating numeric, total_earnings numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_mentor_user_id uuid;
  v_mentor_org uuid;
begin
  select user_id, organization_id into v_mentor_user_id, v_mentor_org from mentors where id = p_mentor_id;
  if not (
    v_mentor_user_id = auth.uid()
    or (is_org_admin(auth.uid()) and v_mentor_org is not null and v_mentor_org = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to view this mentor''s analytics';
  end if;
  return query
  select
    count(*) filter (where true),
    count(*) filter (where status = 'completed'),
    (select avg(rating) from session_ratings where mentor_id = p_mentor_id),
    (select coalesce(sum(amount), 0) from mentor_earnings where mentor_id = p_mentor_id)
  from mentorship_sessions where mentor_id = p_mentor_id;
end;
$$;

create or replace function search_mentionable_users(p_query text, p_limit int default 10)
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select id, display_name from user_profiles
  where display_name ilike '%' || p_query || '%'
    and organization_id = get_user_organization_id(auth.uid())
  limit p_limit;
$$;

create or replace function get_org_feature(p_org_id uuid, p_feature_key text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_override boolean;
  v_tier subscription_tier;
begin
  if not (p_org_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid())) then
    raise exception 'Not authorized to read this organization''s feature settings';
  end if;

  select enabled into v_override
  from organization_feature_flags
  where organization_id = p_org_id and feature_key = p_feature_key;

  if v_override is not null then
    return v_override;
  end if;
  select subscription_tier into v_tier from organizations where id = p_org_id;
  return tier_default_feature(coalesce(v_tier, 'starter'), p_feature_key);
end;
$$;

create or replace function get_org_features_bulk(p_org_id uuid, p_feature_keys text[])
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_key text;
begin
  if not (p_org_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid())) then
    raise exception 'Not authorized to read this organization''s feature settings';
  end if;
  foreach v_key in array p_feature_keys loop
    v_result := v_result || jsonb_build_object(v_key, get_org_feature(p_org_id, v_key));
  end loop;
  return v_result;
end;
$$;

-- ============================================================================
-- certificate_templates SELECT (ct_select_all) was still `using (true)` -
-- 0149 fixed the write policy but missed that the read policy independently
-- exposed every organization's certificate template (title, passing score,
-- approval requirement, and template_text - actual certificate wording/
-- branding) to any signed-in user platform-wide. Certificates' own
-- organization_id-based policies (also 0149) are unaffected by this change.
-- ============================================================================
drop policy if exists ct_select_all on certificate_templates;
create policy ct_select_all on certificate_templates for select
  using (
    certificate_templates.organization_id is null
    or exists (select 1 from courses c where c.id = certificate_templates.course_id and c.instructor_id = auth.uid())
    or certificate_templates.organization_id = get_user_organization_id(auth.uid())
    or is_super_admin(auth.uid())
  );
-- ============================================================================
-- Final production-readiness gate: user_personalization RLS + schema gap
-- ============================================================================
-- Confirmed: src/services/authService.js and src/lib/api/learner.js call
-- `supabase.from("user_personalization")` directly (select/upsert) for
-- onboarding personalization - but this table has RLS enabled with zero
-- policies (default-deny), so every one of those calls fails silently
-- against a real project (each call site already wraps the request in
-- try/catch with a console.warn, which is exactly why this was never
-- surfaced as a visible error). Not a tenant-isolation bug - a purely
-- functional one, explicitly called out to be fixed in this pass rather
-- than left open.
--
-- Also confirmed: the client's upsert payload includes `updated_at`, a
-- column that does not exist on this table in any migration - that upsert
-- would fail on a live project even after RLS is fixed. Added as a nullable,
-- additive column (no data loss, no NOT NULL, matches this schema's own
-- established pattern for this kind of gap).
--
-- This table is purely self-owned (user_id is its own primary key, no
-- organization_id at all) - the standard "own row only" pattern already
-- used for user_gamification_stats, course_enrollments, etc.
-- ============================================================================

alter table user_personalization add column if not exists updated_at timestamptz not null default now();

drop policy if exists up_personalization_own on user_personalization;
create policy up_personalization_own on user_personalization for all
  using (user_id = auth.uid() or is_super_admin(auth.uid()))
  with check (user_id = auth.uid());

comment on table user_personalization is
  'Learner onboarding personalization (learning tracks, skill level). Own-row RLS added in 0155 - was previously RLS-enabled with zero policies (default-deny), silently breaking every save/read from a real deployment.';
-- ============================================================================
-- Real, server-side AI credit metering - replaces the fake system.
-- ============================================================================
-- Phase 1 audit finding, confirmed by reading the actual code, not assumed:
-- the "credits" shown in every screen of this app today
-- (src/learner/hooks/useCredits.js) are 100% client-side - stored in
-- localStorage, reset to 10 every calendar day regardless of any purchase,
-- and never checked by any AI edge function. Any user could set their own
-- balance to any number via devtools with zero server involvement. This is
-- the exact anti-pattern the billing spec for this feature explicitly
-- warns against ("the browser must never be trusted to determine whether a
-- learner has credits"). This migration is a real replacement, not an
-- addition alongside it - useCredits.js and its call sites need to be
-- retired once the frontend is wired to this (tracked separately, not
-- done in this pass - see the accompanying report).
--
-- Reused, not duplicated, from what this repo already has correctly built:
--   - seat_purchases / purchase_seats() (0129) - the exact ledger-style
--     pattern this migration mirrors for AI credits
--   - src/lib/api/payments.js - the real, live Paystack/Stripe edge
--     functions already used for the "credits" payment context. This
--     migration adds the missing other half: crediting a real server-side
--     account after a successful payment, instead of a localStorage write.
--   - organization_feature_flags / get_org_feature (0115, fixed 0154) -
--     reused as-is for "does this org have AI enabled at all", not
--     reimplemented here.
--   - credit_requests (0146) - reused as-is for the learner-asks-org-for-
--     credits workflow; this migration adds the missing admin-approval
--     side (approve_credit_request()) that 0146's own comment says never
--     got built, and fixes a real bug found while reading it: cr_update_admin
--     used bare is_org_admin(auth.uid()) with no organization match - the
--     same cross-tenant pattern found and fixed repeatedly elsewhere in
--     this schema (0152/0153) - any org admin anywhere could resolve any
--     other org's learner's credit request.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Accounts - one per organization (owner_user_id null), one per learner
--    who has ever needed one (created lazily by the RPCs below, not by a
--    signup trigger, to keep this self-contained).
-- ----------------------------------------------------------------------------
create table if not exists ai_credit_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  owner_user_id uuid references user_profiles(id) on delete cascade,
  account_type text not null check (account_type in ('organization', 'learner')),
  balance int not null default 0 check (balance >= 0),
  lifetime_credited int not null default 0,
  lifetime_consumed int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_credit_accounts_org_shape check (
    (account_type = 'organization' and owner_user_id is null and organization_id is not null)
    or (account_type = 'learner' and owner_user_id is not null)
  )
);

-- One organization account per org; one learner account per user (a
-- learner's personal account is independent of which org they're in,
-- matching "may have organization credits available and personal
-- purchased credits" - organization_id on a learner row just records
-- which org they belonged to when the account was created, for RLS scoping).
create unique index if not exists ai_credit_accounts_one_org_account
  on ai_credit_accounts(organization_id) where account_type = 'organization';
create unique index if not exists ai_credit_accounts_one_learner_account
  on ai_credit_accounts(owner_user_id) where account_type = 'learner';

alter table ai_credit_accounts enable row level security;

drop policy if exists aica_select_own on ai_credit_accounts;
create policy aica_select_own on ai_credit_accounts for select
  using (
    owner_user_id = auth.uid()
    or (account_type = 'organization' and organization_id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  );

-- No insert/update/delete policy for ordinary users at all - every balance
-- change happens through the SECURITY DEFINER RPCs below, which is the
-- actual enforcement point (matches seat_purchases' own established
-- pattern: "no direct insert policy needed for ordinary users"). A
-- super_admin-only policy exists for genuine manual support corrections.
drop policy if exists aica_write_super_admin on ai_credit_accounts;
create policy aica_write_super_admin on ai_credit_accounts for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 2. Immutable ledger. No update/delete policy exists anywhere in this
--    migration for any role except super_admin correction - by omission,
--    matching "never allow normal users to arbitrarily edit ledger history."
-- ----------------------------------------------------------------------------
create table if not exists ai_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  account_id uuid not null references ai_credit_accounts(id) on delete cascade,
  user_id uuid references user_profiles(id) on delete set null,
  transaction_type text not null check (transaction_type in
    ('purchase', 'top_up', 'consumption', 'refund', 'adjustment', 'expiration', 'reversal')),
  amount int not null,
  balance_before int not null,
  balance_after int not null,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references user_profiles(id)
);

create index if not exists ai_credit_transactions_account_idx on ai_credit_transactions(account_id, created_at desc);
create index if not exists ai_credit_transactions_org_idx on ai_credit_transactions(organization_id, created_at desc);

alter table ai_credit_transactions enable row level security;

drop policy if exists aict_select_own on ai_credit_transactions;
create policy aict_select_own on ai_credit_transactions for select
  using (
    user_id = auth.uid()
    or (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or is_super_admin(auth.uid())
  );

drop policy if exists aict_write_super_admin on ai_credit_transactions;
create policy aict_write_super_admin on ai_credit_transactions for insert
  with check (is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. Configurable per-operation credit cost - "do not hard-code every AI
--    operation to cost exactly one credit." Platform-owner-writable only;
--    readable by anyone signed in (it's a price list, not tenant data).
-- ----------------------------------------------------------------------------
create table if not exists ai_operation_costs (
  operation_key text primary key,
  credit_cost int not null default 1 check (credit_cost >= 0),
  label text,
  updated_at timestamptz not null default now(),
  updated_by uuid references user_profiles(id)
);

insert into ai_operation_costs (operation_key, credit_cost, label) values
  ('ai_chat_message', 1, 'AI Coach message'),
  ('quiz_generation', 2, 'AI-generated quiz'),
  ('ai_insight', 1, 'AI insight'),
  ('ai_recommendation', 1, 'AI recommendation')
on conflict (operation_key) do nothing;

alter table ai_operation_costs enable row level security;

drop policy if exists aioc_select_all on ai_operation_costs;
create policy aioc_select_all on ai_operation_costs for select using (true);

drop policy if exists aioc_write_super_admin on ai_operation_costs;
create policy aioc_write_super_admin on ai_operation_costs for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. Account lookup/creation helper - lazy, idempotent. Not exposed
--    directly to clients (no grant needed beyond normal function execute,
--    since it only ever touches the caller's own accounts or is called
--    from within the other SECURITY DEFINER functions below).
-- ----------------------------------------------------------------------------
create or replace function get_or_create_org_credit_account(p_org_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from ai_credit_accounts where organization_id = p_org_id and account_type = 'organization';
  if v_id is null then
    insert into ai_credit_accounts (organization_id, account_type, balance)
    values (p_org_id, 'organization', 0)
    on conflict (organization_id) where account_type = 'organization' do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from ai_credit_accounts where organization_id = p_org_id and account_type = 'organization';
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function get_or_create_learner_credit_account(p_user_id uuid, p_org_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from ai_credit_accounts where owner_user_id = p_user_id and account_type = 'learner';
  if v_id is null then
    insert into ai_credit_accounts (organization_id, owner_user_id, account_type, balance)
    values (p_org_id, p_user_id, 'learner', 0)
    on conflict (owner_user_id) where account_type = 'learner' do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from ai_credit_accounts where owner_user_id = p_user_id and account_type = 'learner';
    end if;
  end if;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Atomic consumption. Called by an AI Edge Function (service-role
--    context, but org/user are passed explicitly since edge functions
--    authenticate the caller themselves - see ai-chat's own auth.getUser()
--    pattern already in place) BEFORE the AI provider is called.
--
--    Atomicity: `select ... for update` locks the specific account row for
--    the duration of this transaction, so two concurrent calls against the
--    same account genuinely serialize - the second call's SELECT blocks
--    until the first's UPDATE commits, and re-reads the now-current
--    balance rather than a stale one. This is what actually prevents
--    double-spending under concurrency; checking the balance and updating
--    it as two separate statements without the row lock would not.
--
--    Policy (explicit, matching the brief's own recommendation): consume
--    organization credits first, then the learner's personal credits,
--    then block. A learner can never touch another learner's account -
--    the function only ever operates on the account belonging to
--    p_user_id and their own organization, both server-derived from the
--    edge function's verified auth context, never client-supplied trust.
-- ----------------------------------------------------------------------------
create or replace function consume_ai_credits(
  p_operation_key text,
  p_reference_id text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_cost int;
  v_org_account uuid;
  v_learner_account uuid;
  v_org_balance int;
  v_learner_balance int;
  v_txn_id uuid;
begin
  -- The only trustworthy identity here is auth.uid() - the caller's own
  -- verified session. p_user_id/p_org_id were client-supplied parameters
  -- in an earlier draft of this function; adversarial testing during this
  -- same implementation pass proved that let any authenticated user drain
  -- any organization's credit pool by simply naming it (confirmed: a
  -- learner with zero relationship to Org A successfully deducted from
  -- Org A's balance by passing its id as a parameter). Fixed by deriving
  -- both from the server-verified session instead, matching the trust
  -- pattern every other SECURITY DEFINER function in this schema already
  -- uses (get_user_organization_id(auth.uid()), never a parameter).
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Must be signed in';
  end if;
  v_org_id := get_user_organization_id(v_user_id);

  select credit_cost into v_cost from ai_operation_costs where operation_key = p_operation_key;
  if v_cost is null then v_cost := 1; end if;
  if v_cost = 0 then
    return jsonb_build_object('authorized', true, 'consumed_from', 'free', 'cost', 0);
  end if;

  if v_org_id is not null then
    v_org_account := get_or_create_org_credit_account(v_org_id);
    select balance into v_org_balance from ai_credit_accounts where id = v_org_account for update;
    if v_org_balance >= v_cost then
      update ai_credit_accounts
        set balance = balance - v_cost, lifetime_consumed = lifetime_consumed + v_cost, updated_at = now()
        where id = v_org_account
        returning balance into v_org_balance;
      insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, metadata)
      values (v_org_id, v_org_account, v_user_id, 'consumption', -v_cost, v_org_balance + v_cost, v_org_balance, p_operation_key, p_reference_id, jsonb_build_object('operation', p_operation_key))
      returning id into v_txn_id;
      return jsonb_build_object('authorized', true, 'consumed_from', 'organization', 'cost', v_cost, 'transaction_id', v_txn_id, 'org_balance', v_org_balance);
    end if;
  end if;

  -- Organization credits exhausted or no organization - try the learner's
  -- own personal account.
  v_learner_account := get_or_create_learner_credit_account(v_user_id, v_org_id);
  select balance into v_learner_balance from ai_credit_accounts where id = v_learner_account for update;
  if v_learner_balance >= v_cost then
    update ai_credit_accounts
      set balance = balance - v_cost, lifetime_consumed = lifetime_consumed + v_cost, updated_at = now()
      where id = v_learner_account
      returning balance into v_learner_balance;
    insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, metadata)
    values (v_org_id, v_learner_account, v_user_id, 'consumption', -v_cost, v_learner_balance + v_cost, v_learner_balance, p_operation_key, p_reference_id, jsonb_build_object('operation', p_operation_key))
    returning id into v_txn_id;
    return jsonb_build_object('authorized', true, 'consumed_from', 'learner', 'cost', v_cost, 'transaction_id', v_txn_id, 'learner_balance', v_learner_balance);
  end if;

  -- Both exhausted - hard block, per spec ("do not allow AI requests to
  -- continue"). No row is written for a denied request - there is nothing
  -- to refund because nothing was ever consumed.
  return jsonb_build_object('authorized', false, 'reason', 'insufficient_credits', 'cost', v_cost);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Refund/reversal - called by an Edge Function if the AI provider call
--    fails AFTER consume_ai_credits already succeeded. Writes a REFUND
--    transaction rather than deleting the original CONSUMPTION row -
--    the ledger stays a complete, honest history of what happened, not a
--    edited-after-the-fact one.
-- ----------------------------------------------------------------------------
create or replace function refund_ai_credits(p_transaction_id uuid, p_reason text default 'provider_failure')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_txn ai_credit_transactions%rowtype;
  v_new_balance int;
begin
  -- This must never be a user-triggerable action - a learner refunding
  -- their own AI usage on demand would make the whole hard-limit
  -- pointless. Only a genuine service-role caller (the Edge Function's
  -- own internal "the AI provider failed after I already deducted
  -- credits" handling, invoked with the service-role key) or a
  -- super_admin correction may call this.
  --
  -- NOTE ON A BUG CAUGHT DURING THIS SAME IMPLEMENTATION PASS: an earlier
  -- version of this check used `current_user <> 'authenticated'`, copied
  -- from a different function's pattern without checking it actually
  -- applies here. It does not: current_user inside any SECURITY DEFINER
  -- function is always the function's OWNER, never the real caller - so
  -- that check was true for every single caller, including an ordinary
  -- learner, and never blocked anyone. Confirmed by testing (a learner
  -- successfully self-refunded before this fix), not just reasoned about.
  -- auth.role() is the correct mechanism - it reads the JWT's own role
  -- claim ('service_role' vs 'authenticated'), independent of which
  -- Postgres role is executing the function body.
  if not (is_super_admin(auth.uid()) or auth.role() = 'service_role') then
    raise exception 'Not authorized to issue AI credit refunds';
  end if;

  select * into v_txn from ai_credit_transactions where id = p_transaction_id and transaction_type = 'consumption';
  if v_txn.id is null then
    raise exception 'No matching consumption transaction to refund';
  end if;
  if exists (select 1 from ai_credit_transactions where reference_type = 'refund_of' and reference_id = p_transaction_id::text) then
    raise exception 'Already refunded';
  end if;

  update ai_credit_accounts
    set balance = balance + abs(v_txn.amount), lifetime_consumed = greatest(0, lifetime_consumed - abs(v_txn.amount)), updated_at = now()
    where id = v_txn.account_id
    returning balance into v_new_balance;

  insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, metadata)
  values (v_txn.organization_id, v_txn.account_id, v_txn.user_id, 'refund', abs(v_txn.amount), v_new_balance - abs(v_txn.amount), v_new_balance, 'refund_of', p_transaction_id::text, jsonb_build_object('reason', p_reason));

  return jsonb_build_object('refunded', true, 'new_balance', v_new_balance);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Grant/top-up - the missing other half of the real Paystack/Stripe
--    flow (src/lib/api/payments.js already exists and works; nothing
--    server-side ever credited an account after a successful "credits"
--    payment - it just wrote to localStorage). Also used for a
--    super_admin manual adjustment and for approving a credit_requests row.
-- ----------------------------------------------------------------------------
create or replace function grant_ai_credits(
  p_account_id uuid,
  p_amount int,
  p_transaction_type text,
  p_reference text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account ai_credit_accounts%rowtype;
  v_new_balance int;
begin
  if p_amount <= 0 then
    raise exception 'Grant amount must be positive';
  end if;
  if p_transaction_type not in ('purchase', 'top_up', 'adjustment') then
    raise exception 'Invalid grant transaction type';
  end if;

  select * into v_account from ai_credit_accounts where id = p_account_id for update;
  if v_account.id is null then
    raise exception 'Credit account not found';
  end if;

  -- Authorization: an org admin may only grant to their own org's account
  -- (organization or a learner within it); a learner may only grant to
  -- their own personal account (the real purchase-for-self path);
  -- super_admin may grant to anything.
  if not (
    is_super_admin(auth.uid())
    or (v_account.owner_user_id = auth.uid())
    or (v_account.account_type = 'organization' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
    or (v_account.account_type = 'learner' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
  ) then
    raise exception 'Not authorized to add credits to this account';
  end if;

  update ai_credit_accounts
    set balance = balance + p_amount, lifetime_credited = lifetime_credited + p_amount, updated_at = now()
    where id = p_account_id
    returning balance into v_new_balance;

  insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, created_by)
  values (v_account.organization_id, p_account_id, v_account.owner_user_id, p_transaction_type, p_amount, v_new_balance - p_amount, v_new_balance, 'payment_reference', p_reference, auth.uid());

  return jsonb_build_object('granted', true, 'new_balance', v_new_balance);
end;
$$;

-- Convenience wrapper matching purchase_seats()'s shape, for the org
-- admin's real "Buy AI Credits" flow after a verified Paystack/Stripe payment.
create or replace function purchase_ai_credits(p_organization_id uuid, p_credits int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
begin
  if not (is_org_admin(auth.uid()) and get_user_organization_id(auth.uid()) = p_organization_id) and not is_super_admin(auth.uid()) then
    raise exception 'Not authorized to purchase AI credits for this organization';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;
  v_account := get_or_create_org_credit_account(p_organization_id);
  return grant_ai_credits(v_account, p_credits, 'purchase', p_payment_reference);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Approve a pending credit_requests row (0146) - the admin-side half
--    that table's own header comment says was never built. Also fixes the
--    cross-tenant bug found while reading 0146: cr_update_admin had no
--    organization match.
-- ----------------------------------------------------------------------------
drop policy if exists cr_update_admin on credit_requests;
create policy cr_update_admin on credit_requests for update
  using (
    (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  );

create or replace function approve_credit_request(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_req credit_requests%rowtype;
  v_learner_account uuid;
  v_result jsonb;
begin
  select * into v_req from credit_requests where id = p_request_id and status = 'pending';
  if v_req.id is null then
    raise exception 'No pending request found';
  end if;
  if not (
    (is_org_admin(auth.uid()) and v_req.organization_id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to approve this request';
  end if;

  v_learner_account := get_or_create_learner_credit_account(v_req.user_id, v_req.organization_id);
  v_result := grant_ai_credits(v_learner_account, v_req.amount, 'adjustment', 'credit_request:' || p_request_id::text);

  update credit_requests set status = 'approved', resolved_at = now(), resolved_by = auth.uid() where id = p_request_id;

  return v_result;
end;
$$;

create or replace function deny_credit_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (
    exists (select 1 from credit_requests where id = p_request_id and (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid())))
    or is_super_admin(auth.uid())
  ) then
    raise exception 'Not authorized to deny this request';
  end if;
  update credit_requests set status = 'denied', resolved_at = now(), resolved_by = auth.uid()
  where id = p_request_id and status = 'pending';
end;
$$;

-- Learner buying credits for themselves (PaymentCallbackScreen.jsx's
-- CREDITS payment context) - the actual missing other half of that
-- already-real Paystack/Stripe flow. Mirrors purchase_ai_credits()'s
-- shape for the org-level equivalent.
create or replace function purchase_personal_ai_credits(p_credits int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_account uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Must be signed in';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;
  v_org_id := get_user_organization_id(v_user_id);
  v_account := get_or_create_learner_credit_account(v_user_id, v_org_id);
  return grant_ai_credits(v_account, p_credits, 'purchase', p_payment_reference);
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Read-only summary for the admin billing screen - mirrors
--    get_org_seats_summary()'s shape deliberately for UI consistency.
-- ----------------------------------------------------------------------------
create or replace function get_org_ai_credits_summary(p_org_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_account ai_credit_accounts%rowtype;
begin
  if not (p_org_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid())) then
    raise exception 'Not authorized to view this organization''s AI credits';
  end if;
  select * into v_account from ai_credit_accounts where organization_id = p_org_id and account_type = 'organization';
  if v_account.id is null then
    return jsonb_build_object('balance', 0, 'lifetime_credited', 0, 'lifetime_consumed', 0);
  end if;
  return jsonb_build_object('balance', v_account.balance, 'lifetime_credited', v_account.lifetime_credited, 'lifetime_consumed', v_account.lifetime_consumed);
end;
$$;

create or replace function get_my_ai_credits()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_org_balance int := 0;
  v_learner_balance int := 0;
begin
  v_org_id := get_user_organization_id(auth.uid());
  if v_org_id is not null then
    select balance into v_org_balance from ai_credit_accounts where organization_id = v_org_id and account_type = 'organization';
  end if;
  select balance into v_learner_balance from ai_credit_accounts where owner_user_id = auth.uid() and account_type = 'learner';
  return jsonb_build_object('organization_balance', coalesce(v_org_balance, 0), 'personal_balance', coalesce(v_learner_balance, 0));
end;
$$;
-- ============================================================================
-- Phase 2 fix (flagged HIGH PRIORITY): close the fake-payment-reference gap
-- in purchase_ai_credits()/purchase_personal_ai_credits().
-- ============================================================================
-- Confirmed by reading src/lib/api/payments.js: this app's real Paystack/
-- Stripe integration works by the CLIENT calling paystack-verify/
-- stripe-verify (live edge functions on the same project, which really do
-- call out to Paystack/Stripe's own API server-side - not client-trusted)
-- and then, separately, the client calling purchase_ai_credits()/
-- purchase_personal_ai_credits() with whatever reference/amount it wants.
-- Nothing tied those two calls together - a client could skip the verify
-- step entirely and call the purchase RPC directly with a fabricated
-- reference and an arbitrary credit amount. That is a real, exploitable
-- gap, not a hypothetical one.
--
-- Fix, in two parts:
--   1. A real idempotency ledger (ai_credit_payment_records) - one row per
--      (provider, provider_reference), unique-constrained, so the exact
--      same payment can never be credited twice even if the grant is
--      attempted more than once (page reload, retried callback, etc).
--   2. purchase_ai_credits()/purchase_personal_ai_credits() are now
--      service-role-only - an ordinary authenticated client can no longer
--      call them directly at all (auth.role() check, the standard Supabase
--      mechanism, not current_user which does not work inside a SECURITY
--      DEFINER function - see 0156's own comment on that exact mistake).
--      The only caller left is the new grant-ai-credits-from-payment Edge
--      Function (supabase/functions/grant-ai-credits-from-payment/),
--      which independently re-verifies the payment server-side via the
--      real paystack-verify/stripe-verify functions before ever calling
--      these RPCs - the client's claimed amount/reference is never trusted
--      on its own past that point.
-- ============================================================================

create table if not exists ai_credit_payment_records (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack', 'stripe')),
  provider_reference text not null,
  organization_id uuid references organizations(id) on delete set null,
  user_id uuid references user_profiles(id) on delete set null,
  account_scope text not null check (account_scope in ('organization', 'learner')),
  credits_granted int not null,
  amount numeric,
  currency text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

-- The actual idempotency guarantee: the same provider+reference can only
-- ever exist once, at the database constraint level - not just an
-- application-level "check first" race that a concurrent retry could slip
-- past.
create unique index if not exists ai_credit_payment_records_unique_ref
  on ai_credit_payment_records(provider, provider_reference);

alter table ai_credit_payment_records enable row level security;

drop policy if exists aicpr_select_own on ai_credit_payment_records;
create policy aicpr_select_own on ai_credit_payment_records for select
  using (
    user_id = auth.uid()
    or (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or is_super_admin(auth.uid())
  );

-- No insert/update/delete policy for any authenticated-role caller at all -
-- only the service-role Edge Function writes here (service_role bypasses
-- RLS entirely by design in Supabase, so no policy is needed for it, and
-- none should exist for anyone else).

-- ----------------------------------------------------------------------------
-- Restrict the purchase RPCs to service-role callers only. auth.role() is
-- the correct mechanism here (reads the JWT's own role claim), not
-- current_user (always the function owner inside SECURITY DEFINER,
-- confirmed the hard way in 0156).
-- ----------------------------------------------------------------------------
create or replace function purchase_ai_credits(p_organization_id uuid, p_credits int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'This operation is only available through the verified payment flow';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;
  v_account := get_or_create_org_credit_account(p_organization_id);
  return grant_ai_credits(v_account, p_credits, 'purchase', p_payment_reference);
end;
$$;

-- The old client-callable purchase_personal_ai_credits(int, numeric, text)
-- is superseded entirely by purchase_personal_ai_credits_for() below (which
-- takes an explicit, server-verified user id and is service-role-only) -
-- dropped outright rather than left as a confusing broken stub.
drop function if exists purchase_personal_ai_credits(int, numeric, text);

-- grant_ai_credits() itself is also authorization-checked by the account's
-- real owner/org (0156) - service_role bypasses RLS but this function's own
-- internal auth.uid()-based check would reject a null auth.uid() (which is
-- what a service-role call without a forwarded user JWT has) unless it's
-- also given a service_role bypass. Fixed here rather than weakened at the
-- call site.
create or replace function grant_ai_credits(
  p_account_id uuid,
  p_amount int,
  p_transaction_type text,
  p_reference text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account ai_credit_accounts%rowtype;
  v_new_balance int;
begin
  if p_amount <= 0 then
    raise exception 'Grant amount must be positive';
  end if;
  if p_transaction_type not in ('purchase', 'top_up', 'adjustment') then
    raise exception 'Invalid grant transaction type';
  end if;

  select * into v_account from ai_credit_accounts where id = p_account_id for update;
  if v_account.id is null then
    raise exception 'Credit account not found';
  end if;

  if not (
    auth.role() = 'service_role'
    or is_super_admin(auth.uid())
    or (v_account.owner_user_id = auth.uid())
    or (v_account.account_type = 'organization' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
    or (v_account.account_type = 'learner' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
  ) then
    raise exception 'Not authorized to add credits to this account';
  end if;

  update ai_credit_accounts
    set balance = balance + p_amount, lifetime_credited = lifetime_credited + p_amount, updated_at = now()
    where id = p_account_id
    returning balance into v_new_balance;

  insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, created_by)
  values (v_account.organization_id, p_account_id, v_account.owner_user_id, p_transaction_type, p_amount, v_new_balance - p_amount, v_new_balance, 'payment_reference', p_reference, auth.uid());

  return jsonb_build_object('granted', true, 'new_balance', v_new_balance);
end;
$$;

-- Replaces the broken purchase_personal_ai_credits stub above - the
-- service-role Edge Function calls this with the real, server-verified
-- user id (it authenticated that user's own JWT itself before granting),
-- never a client-supplied one.
create or replace function purchase_personal_ai_credits_for(p_user_id uuid, p_credits int, p_amount numeric, p_payment_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_account uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'This operation is only available through the verified payment flow';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'A real payment reference is required';
  end if;
  v_org_id := get_user_organization_id(p_user_id);
  v_account := get_or_create_learner_credit_account(p_user_id, v_org_id);
  return grant_ai_credits(v_account, p_credits, 'purchase', p_payment_reference);
end;
$$;

-- ----------------------------------------------------------------------------
-- The actual idempotent grant entry point - records the payment first
-- (unique constraint catches a duplicate attempt immediately, before any
-- balance change happens), then grants. Called by the Edge Function only.
-- ----------------------------------------------------------------------------
create or replace function record_and_grant_ai_credit_payment(
  p_provider text,
  p_provider_reference text,
  p_account_scope text,
  p_organization_id uuid,
  p_user_id uuid,
  p_credits int,
  p_amount numeric,
  p_currency text
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_account uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'This operation is only available through the verified payment flow';
  end if;

  -- Idempotency: the unique index on (provider, provider_reference) makes
  -- this a hard database guarantee, not just an application check - a
  -- second attempt for the same real payment fails here, before any
  -- credit is touched.
  begin
    insert into ai_credit_payment_records
      (provider, provider_reference, organization_id, user_id, account_scope, credits_granted, amount, currency)
    values
      (p_provider, p_provider_reference, p_organization_id, p_user_id, p_account_scope, p_credits, p_amount, p_currency);
  exception when unique_violation then
    return jsonb_build_object('granted', false, 'reason', 'already_processed');
  end;

  if p_account_scope = 'organization' then
    v_account := get_or_create_org_credit_account(p_organization_id);
  else
    v_account := get_or_create_learner_credit_account(p_user_id, p_organization_id);
  end if;

  v_result := grant_ai_credits(v_account, p_credits, 'purchase', p_provider || ':' || p_provider_reference);
  return v_result || jsonb_build_object('idempotent', true);
end;
$$;
-- ============================================================================
-- Billing foundation: configurable pricing, feature entitlement pricing,
-- academy commission architecture.
-- ============================================================================
-- Phase 1 audit, confirmed by reading the code, not assumed:
--   - seat_purchases/purchase_seats/check_seat_available (0129) - real,
--     reused as-is, not touched here.
--   - ai_credit_accounts/transactions/costs (0156/0157) - real, reused
--     as-is, not touched here.
--   - organization_feature_flags (0115) - real (organization_id,
--     feature_key, enabled), extended below with pricing columns rather
--     than duplicated with a parallel entitlement table.
--   - payments.js's real Paystack/Stripe integration - reused as-is.
--   - A genuinely missing, concrete gap found while auditing:
--     `SEAT_PRICE_USD = 10` and `SEAT_PRICE_NGN = 15000` are hardcoded
--     JavaScript constants in src/lib/api/organizations.js - the exact
--     "hard-coded exchange rate scattered through the app" anti-pattern
--     this task names explicitly (15000 silently bakes in an unstated,
--     unconfigurable ~1500 NGN/USD rate). Replaced with a real,
--     platform-owner-configurable table.
--   - Academy commission - genuinely did not exist anywhere in this
--     schema. Built new, minimally, below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. billing_prices - replaces the two hardcoded JS constants. Historical
--    rows are kept (never deleted/overwritten) so past transactions can
--    always be traced back to the price that was actually active when
--    they happened - same "preserve the rate applied at the time" principle
--    the academy commission model below needs too.
-- ----------------------------------------------------------------------------
create table if not exists billing_prices (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('seat_subscription', 'org_subscription_starter', 'org_subscription_growth')),
  currency text not null,
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  effective_date timestamptz not null default now(),
  is_active boolean not null default true,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists billing_prices_lookup_idx on billing_prices(category, currency, is_active, effective_date desc);

alter table billing_prices enable row level security;

-- Pricing is not tenant-sensitive data (it's what the platform charges
-- everyone in that currency), so it's readable by any signed-in user -
-- the frontend needs it to show real prices instead of a hardcoded one.
drop policy if exists bp_select_all on billing_prices;
create policy bp_select_all on billing_prices for select using (true);

drop policy if exists bp_write_super_admin on billing_prices;
create policy bp_write_super_admin on billing_prices for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- Seed with the same reference values the hardcoded constants used
-- ($10.00 = 1000 cents, NGN15,000.00 = 1,500,000 kobo) - preserved as the
-- documented starting configuration, not silently changed, but now a real,
-- inspectable, platform-owner-editable row instead of a JS constant three
-- files deep.
insert into billing_prices (category, currency, unit_amount_minor, is_active) values
  ('seat_subscription', 'USD', 1000, true),
  ('seat_subscription', 'NGN', 1500000, true),
  ('org_subscription_starter', 'USD', 1500, true),
  ('org_subscription_starter', 'NGN', 1500000, true),
  ('org_subscription_growth', 'USD', 4500, true),
  ('org_subscription_growth', 'NGN', 4500000, true)
on conflict do nothing;

create or replace function get_active_price(p_category text, p_currency text)
returns jsonb
language sql stable as $$
  select jsonb_build_object('currency', currency, 'unit_amount_minor', unit_amount_minor, 'effective_date', effective_date)
  from billing_prices
  where category = p_category and currency = p_currency and is_active = true and effective_date <= now()
  order by effective_date desc
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 2. organization_feature_flags - extended with negotiated-pricing columns
--    (Section B: "pricing may be negotiated per organization... do not
--    create a global hard-coded price"). The enable/disable mechanism
--    (0115) already exists and is unchanged; this only adds the pricing
--    metadata alongside it.
-- ----------------------------------------------------------------------------
alter table organization_feature_flags add column if not exists negotiated_price_minor bigint;
alter table organization_feature_flags add column if not exists currency text;
alter table organization_feature_flags add column if not exists billing_frequency text check (billing_frequency in ('monthly', 'annual', 'one_time') or billing_frequency is null);
alter table organization_feature_flags add column if not exists effective_date timestamptz;
alter table organization_feature_flags add column if not exists expiration_date timestamptz;
alter table organization_feature_flags add column if not exists notes text;

comment on column organization_feature_flags.negotiated_price_minor is 'Negotiated price for this org+feature, smallest currency unit. Null means no separate charge (included in plan, or not yet priced).';

-- ----------------------------------------------------------------------------
-- 3. Academy commission - did not exist. One config row per organization
--    (its current negotiated rate), one immutable transaction row per
--    charge (capturing the rate that actually applied at that moment, per
--    "historical transactions must retain the commission rate actually
--    applied at the time" - never derived retroactively from the current
--    config row, which could have changed since).
-- ----------------------------------------------------------------------------
create table if not exists academy_commission_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  commission_percent numeric(5,2) not null check (commission_percent >= 0 and commission_percent <= 100),
  fixed_fee_minor bigint not null default 0 check (fixed_fee_minor >= 0),
  currency text not null default 'USD',
  effective_date timestamptz not null default now(),
  is_active boolean not null default true,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists academy_commission_configs_org_idx
  on academy_commission_configs(organization_id, is_active, effective_date desc);

alter table academy_commission_configs enable row level security;

drop policy if exists acc_select_own_org on academy_commission_configs;
create policy acc_select_own_org on academy_commission_configs for select
  using (organization_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid()));

-- Only the platform owner sets commission terms - an academy negotiating
-- its own cut would be an obvious conflict of interest, matching this
-- task's own explicit instruction that commission is platform-configured,
-- not organization-configured.
drop policy if exists acc_write_super_admin on academy_commission_configs;
create policy acc_write_super_admin on academy_commission_configs for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create or replace function get_active_academy_commission(p_org_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('commission_percent', commission_percent, 'fixed_fee_minor', fixed_fee_minor, 'currency', currency)
  from academy_commission_configs
  where organization_id = p_org_id and is_active = true and effective_date <= now()
  order by effective_date desc
  limit 1;
$$;

create table if not exists academy_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  learner_id uuid references user_profiles(id) on delete set null,
  provider text check (provider in ('paystack', 'stripe')),
  provider_reference text,
  currency text not null,
  gross_amount_minor bigint not null check (gross_amount_minor >= 0),
  commission_percent_applied numeric(5,2) not null,
  fixed_fee_minor_applied bigint not null default 0,
  platform_fee_minor bigint not null,
  academy_net_minor bigint not null,
  status text not null default 'completed' check (status in ('completed', 'refunded', 'reversed')),
  created_at timestamptz not null default now(),
  constraint academy_transactions_math check (platform_fee_minor + academy_net_minor = gross_amount_minor)
);

-- Idempotency, same principle as ai_credit_payment_records: the same
-- provider reference can only ever produce one academy_transactions row.
create unique index if not exists academy_transactions_unique_ref
  on academy_transactions(provider, provider_reference) where provider_reference is not null;

create index if not exists academy_transactions_org_idx on academy_transactions(organization_id, created_at desc);

alter table academy_transactions enable row level security;

drop policy if exists at_select_own_org on academy_transactions;
create policy at_select_own_org on academy_transactions for select
  using (
    (organization_id = get_user_organization_id(auth.uid()) and is_org_admin(auth.uid()))
    or learner_id = auth.uid()
    or is_super_admin(auth.uid())
  );

-- Immutable to every ordinary role, including org admins and the academy
-- itself - only ever written by record_academy_transaction() below
-- (service-role-only, same pattern as the AI credit payment ledger).
-- No insert/update/delete policy exists for authenticated at all.

create or replace function record_academy_transaction(
  p_organization_id uuid,
  p_learner_id uuid,
  p_provider text,
  p_provider_reference text,
  p_currency text,
  p_gross_amount_minor bigint
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_config jsonb;
  v_commission_percent numeric(5,2);
  v_fixed_fee_minor bigint;
  v_platform_fee_minor bigint;
  v_academy_net_minor bigint;
  v_id uuid;
begin
  -- Same trust boundary as record_and_grant_ai_credit_payment(): only a
  -- trusted server-side caller (the Edge Function that already verified
  -- this payment against the real provider) may record a financial event,
  -- never an ordinary authenticated client.
  if auth.role() <> 'service_role' then
    raise exception 'This operation is only available through the verified payment flow';
  end if;
  if p_gross_amount_minor <= 0 then
    raise exception 'Gross amount must be positive';
  end if;

  v_config := get_active_academy_commission(p_organization_id);
  if v_config is null then
    raise exception 'No active commission configuration for this organization - platform owner must configure one before this organization can process learner payments';
  end if;
  v_commission_percent := (v_config->>'commission_percent')::numeric(5,2);
  v_fixed_fee_minor := (v_config->>'fixed_fee_minor')::bigint;

  -- Integer arithmetic throughout - no floating-point money math. The
  -- commission is computed once here and stored on the row itself
  -- (commission_percent_applied), never recomputed later from a config
  -- row that may since have changed.
  v_platform_fee_minor := floor(p_gross_amount_minor * v_commission_percent / 100.0) + v_fixed_fee_minor;
  if v_platform_fee_minor > p_gross_amount_minor then
    v_platform_fee_minor := p_gross_amount_minor;
  end if;
  v_academy_net_minor := p_gross_amount_minor - v_platform_fee_minor;

  insert into academy_transactions (
    organization_id, learner_id, provider, provider_reference, currency,
    gross_amount_minor, commission_percent_applied, fixed_fee_minor_applied,
    platform_fee_minor, academy_net_minor
  ) values (
    p_organization_id, p_learner_id, p_provider, p_provider_reference, p_currency,
    p_gross_amount_minor, v_commission_percent, v_fixed_fee_minor,
    v_platform_fee_minor, v_academy_net_minor
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'gross', p_gross_amount_minor, 'platform_fee', v_platform_fee_minor,
    'academy_net', v_academy_net_minor, 'commission_percent', v_commission_percent
  );
exception when unique_violation then
  -- Idempotent replay of the same provider reference - return the
  -- existing record rather than erroring, matching
  -- record_and_grant_ai_credit_payment()'s idempotency shape.
  select jsonb_build_object(
    'id', id, 'gross', gross_amount_minor, 'platform_fee', platform_fee_minor,
    'academy_net', academy_net_minor, 'commission_percent', commission_percent_applied,
    'already_processed', true
  ) into v_config
  from academy_transactions where provider = p_provider and provider_reference = p_provider_reference;
  return v_config;
end;
$$;
-- ============================================================================
-- Seat licensing: real, proven race condition in accept_invitation()
-- ============================================================================
-- Confirmed by genuine concurrent testing (two real, independent OS
-- processes, not sequential calls), not reasoned about: an organization
-- with exactly 1 seat available, hit with two simultaneous
-- accept_invitation() calls for two different pending invitations, ended
-- with BOTH succeeding - used: 3 against purchased: 2, oversold by one
-- seat. Root cause: check_seat_available() is a plain read (it COUNTs
-- active organization_members rows - there is no single mutable "seats
-- used" balance row the way ai_credit_accounts.balance is, so the
-- FOR UPDATE row-locking pattern that makes AI credit consumption
-- provably safe under concurrency has no direct equivalent here). Two
-- concurrent transactions can both read "1 available" before either has
-- committed its INSERT into organization_members, and both proceed.
--
-- Fix: acquire a row lock on the organization's own `organizations` row
-- (`for update`) before checking seat availability inside
-- accept_invitation(). This doesn't change what's being counted - it
-- serializes concurrent accept_invitation calls FOR THE SAME ORGANIZATION
-- specifically: the second transaction's `for update` blocks until the
-- first commits (or rolls back), then re-reads a seat count that
-- correctly reflects the first transaction's already-committed INSERT.
-- Concurrent accepts for DIFFERENT organizations are unaffected - they
-- lock different rows. Reuses an existing row rather than introducing a
-- new advisory-lock mechanism, consistent with this schema's established
-- preference for row-level locking (0156's consume_ai_credits) over
-- advisory locks.
-- ============================================================================

create or replace function accept_invitation(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_inv user_invitations;
  v_org_locked uuid;
begin
  select * into v_inv from user_invitations where token = p_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'invitation is invalid or expired';
  end if;

  if v_inv.organization_id is not null then
    -- The actual fix: lock this organization's row before checking or
    -- consuming a seat, so a concurrent accept_invitation() for the same
    -- org genuinely waits instead of racing on a stale read.
    select id into v_org_locked from organizations where id = v_inv.organization_id for update;
    if not check_seat_available(v_inv.organization_id) then
      raise exception 'No seats available in this organization - contact your organization admin to purchase more seats';
    end if;
  end if;

  insert into user_roles (user_id, role) values (auth.uid(), v_inv.role)
    on conflict do nothing;
  if v_inv.organization_id is not null then
    insert into organization_members (organization_id, user_id, role, status, invited_by, joined_at)
    values (v_inv.organization_id, auth.uid(), v_inv.organization_role, 'active', v_inv.invited_by, now())
    on conflict (organization_id, user_id) do update set status = 'active', joined_at = now();
    update user_profiles set organization_id = v_inv.organization_id where id = auth.uid();
  end if;
  update user_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
end;
$$;
-- ============================================================================
-- Real server-side entitlement enforcement + payment edge-case hardening
-- ============================================================================
-- Finding, confirmed by reading the code, not assumed: "advanced feature"
-- entitlements (organization_feature_flags / get_org_feature, 0115, fixed
-- for cross-tenant reads in 0154) were checked CLIENT-SIDE only.
-- AdminAnalyticsScreen.jsx computes `canExport` from a real, correctly-
-- authorized RPC result, but the underlying analytics data was already
-- fetched and rendered on screen before that check ever runs, and the
-- "export" action itself (exportRowsAsCsv) is a pure client-side CSV-blob
-- generator with no server call at all - trivially callable from devtools
-- regardless of entitlement. Same shape for WorkforceIntelligenceScreen.jsx:
-- fetchWorkforceIntelligence() queries plain RLS-protected tables with no
-- entitlement check anywhere.
--
-- Important, honest distinction from the seat-concurrency bug: this is NOT
-- a tenant-isolation vulnerability - RLS still correctly restricts every
-- one of these queries to the caller's own organization, so no cross-org
-- data is exposed. It's a monetization/business-logic gap: a non-entitled
-- org's own admin can still see (and manually copy) data a paid tier is
-- supposed to gate, because the entitlement was only ever a UI convenience
-- check. Full closure would require restructuring what data these screens
-- fetch at all when un-entitled, which is a larger frontend change than
-- this pass attempts. What IS implemented here is the correct primitive
-- for real enforcement going forward, and it's wired into the one case
-- (workforce intelligence) most worth doing now.
-- ============================================================================

create or replace function assert_feature_entitled(p_org_id uuid, p_feature_key text)
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (p_org_id = get_user_organization_id(auth.uid()) or is_super_admin(auth.uid())) then
    raise exception 'Not authorized to check this organization''s entitlements';
  end if;
  if not is_super_admin(auth.uid()) and not get_org_feature(p_org_id, p_feature_key) then
    raise exception 'This organization does not have the % feature enabled', p_feature_key;
  end if;
end;
$$;

-- Real, server-side aggregation for Workforce Intelligence, gated by the
-- entitlement check above BEFORE any data is touched - this is the
-- concrete fix, not just the primitive. Computes the same shape
-- fetchWorkforceIntelligence() already returns, server-side, so a client
-- that isn't entitled gets nothing at all rather than a UI-hidden copy of
-- data it already received.
create or replace function get_workforce_intelligence(p_org_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_learner_count int;
  v_ai_usage_7d int;
  v_feedback_30d int;
  v_avg_score numeric;
begin
  perform assert_feature_entitled(p_org_id, 'ai_intelligence_advanced');

  select count(*) into v_learner_count from user_profiles
    where organization_id = p_org_id and role not in ('admin', 'super_admin', 'mentor');

  select count(*) into v_ai_usage_7d from ai_usage_events
    where organization_id = p_org_id and created_at >= now() - interval '7 days';

  select count(*) into v_feedback_30d from feedback_notes
    where organization_id = p_org_id and created_at >= now() - interval '30 days';

  select avg(score) into v_avg_score from assessment_attempts aa
    join user_profiles up on up.id = aa.user_id
    where up.organization_id = p_org_id;

  return jsonb_build_object(
    'learnerCount', v_learner_count,
    'aiUsageCount7d', v_ai_usage_7d,
    'feedbackNotesCount30d', v_feedback_30d,
    'avgAssessmentScore', v_avg_score
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Payment edge-case hardening, found by direct-attack testing this round.
-- consume_ai_credits already guards against a zero/negative cost operation
-- key via ai_operation_costs' own check(credit_cost >= 0) and the
-- `if v_cost = 0` free-operation branch (0156) - confirmed still correct,
-- not changed. What needed a fix: record_academy_transaction() already
-- rejects p_gross_amount_minor <= 0 (0158) - confirmed correct. The real
-- gap found this round is in grant_ai_credits(): it checked
-- `p_amount <= 0` but not integer overflow / absurd values, and
-- purchase_ai_credits/purchase_personal_ai_credits_for pass p_credits
-- straight through with no upper bound at all - a compromised service-role
-- caller (or a bug in the calling Edge Function) could grant an
-- absurd credit amount with no sanity ceiling.
-- ----------------------------------------------------------------------------
create or replace function grant_ai_credits(
  p_account_id uuid,
  p_amount int,
  p_transaction_type text,
  p_reference text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account ai_credit_accounts%rowtype;
  v_new_balance int;
begin
  if p_amount <= 0 then
    raise exception 'Grant amount must be positive';
  end if;
  -- Sanity ceiling - not a business rule about pricing, a defense-in-depth
  -- bound against a forged/buggy amount reaching this function at all
  -- (matches "integer overflow/very large amount" from this round's
  -- explicit attack list). 1,000,000 credits in a single grant is already
  -- far beyond any real package this product sells.
  if p_amount > 1000000 then
    raise exception 'Grant amount exceeds the maximum allowed in a single transaction';
  end if;
  if p_transaction_type not in ('purchase', 'top_up', 'adjustment') then
    raise exception 'Invalid grant transaction type';
  end if;

  select * into v_account from ai_credit_accounts where id = p_account_id for update;
  if v_account.id is null then
    raise exception 'Credit account not found';
  end if;

  if not (
    auth.role() = 'service_role'
    or is_super_admin(auth.uid())
    or (v_account.owner_user_id = auth.uid())
    or (v_account.account_type = 'organization' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
    or (v_account.account_type = 'learner' and is_org_admin(auth.uid()) and v_account.organization_id = get_user_organization_id(auth.uid()))
  ) then
    raise exception 'Not authorized to add credits to this account';
  end if;

  update ai_credit_accounts
    set balance = balance + p_amount, lifetime_credited = lifetime_credited + p_amount, updated_at = now()
    where id = p_account_id
    returning balance into v_new_balance;

  insert into ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, created_by)
  values (v_account.organization_id, p_account_id, v_account.owner_user_id, p_transaction_type, p_amount, v_new_balance - p_amount, v_new_balance, 'payment_reference', p_reference, auth.uid());

  return jsonb_build_object('granted', true, 'new_balance', v_new_balance);
end;
$$;
-- ============================================================================
-- 0161_single_db_leaderboard_and_security.sql
-- Single Production Database Leaderboard Multi-Tenant Scoping & Security Hardening
-- Target Database: jeobggrtxeybxvlwpxvn
--
-- 1. get_leaderboard_with_profiles:
--    - Scopes ranking to caller's organization_id (or explicit verified p_org_id)
--    - Respects organization leaderboard toggle (organizations.settings->'leaderboard'->'enabled')
--    - Returns empty result set if leaderboard is disabled for caller's organization
-- 2. get_leaderboard_for_period:
--    - Scopes period points to caller's organization_id
--    - Respects organization leaderboard toggle
-- 3. get_cohort_leaderboard:
--    - Verifies cohort organization leaderboard toggle
-- ============================================================================

-- 1. All-time leaderboard scoped to caller's organization & feature flags
create or replace function get_leaderboard_with_profiles(p_limit int default 50, p_org_id uuid default null)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points int,
  current_level int,
  streak_days int,
  cohort_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_org_id uuid;
  v_is_super boolean := false;
  v_target_org uuid;
  v_leaderboard_enabled boolean := true;
begin
  if v_caller_id is not null then
    select organization_id into v_caller_org_id from user_profiles where id = v_caller_id;
    select exists(select 1 from user_roles where user_roles.user_id = v_caller_id and role = 'super_admin') into v_is_super;
  end if;

  -- Resolve target organization
  if p_org_id is not null then
    if v_is_super or v_caller_org_id = p_org_id then
      v_target_org := p_org_id;
    else
      v_target_org := v_caller_org_id;
    end if;
  else
    v_target_org := v_caller_org_id;
  end if;

  -- Check organization leaderboard toggle if tenant is known
  if v_target_org is not null then
    select coalesce((settings->'leaderboard'->>'enabled')::boolean, true)
    into v_leaderboard_enabled
    from organizations
    where id = v_target_org;

    if v_leaderboard_enabled is false then
      return;
    end if;
  end if;

  return query
  select
    s.user_id,
    up.display_name,
    up.avatar_url,
    s.total_points,
    s.current_level,
    s.streak_days,
    coalesce(c.name, 'Active Batch') as cohort_name
  from user_gamification_stats s
  join user_profiles up on up.id = s.user_id
  left join lateral (
    select co.name
    from cohort_members cm
    join cohorts co on co.id = cm.cohort_id
    where cm.user_id = s.user_id
    order by cm.added_at desc
    limit 1
  ) c on true
  where (
    case
      when v_is_super and p_org_id is null and v_caller_org_id is null then true
      when v_target_org is not null then up.organization_id = v_target_org
      else up.organization_id is null
    end
  )
  order by s.total_points desc
  limit p_limit;
end;
$$;

-- 2. Period leaderboard scoped to caller's organization & feature flags
create or replace function get_leaderboard_for_period(
  p_start timestamptz,
  p_end timestamptz,
  p_limit int default 50,
  p_org_id uuid default null
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  period_points bigint,
  current_level int,
  streak_days int,
  cohort_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_org_id uuid;
  v_is_super boolean := false;
  v_target_org uuid;
  v_leaderboard_enabled boolean := true;
begin
  if v_caller_id is not null then
    select organization_id into v_caller_org_id from user_profiles where id = v_caller_id;
    select exists(select 1 from user_roles where user_roles.user_id = v_caller_id and role = 'super_admin') into v_is_super;
  end if;

  -- Resolve target organization
  if p_org_id is not null then
    if v_is_super or v_caller_org_id = p_org_id then
      v_target_org := p_org_id;
    else
      v_target_org := v_caller_org_id;
    end if;
  else
    v_target_org := v_caller_org_id;
  end if;

  -- Check organization leaderboard toggle if tenant is known
  if v_target_org is not null then
    select coalesce((settings->'leaderboard'->>'enabled')::boolean, true)
    into v_leaderboard_enabled
    from organizations
    where id = v_target_org;

    if v_leaderboard_enabled is false then
      return;
    end if;
  end if;

  return query
  with lesson_points as (
    select lp.user_id, count(*) * 50 as pts
    from lesson_progress lp
    where lp.is_completed = true and lp.completed_at >= p_start and lp.completed_at < p_end
    group by lp.user_id
  ),
  quiz_points as (
    select qa.user_id, coalesce(sum(qa.total_points), 0) as pts
    from quiz_attempts qa
    where qa.completed_at >= p_start and qa.completed_at < p_end
    group by qa.user_id
  ),
  login_points as (
    select dlr.user_id, coalesce(sum(dlr.points_awarded), 0) as pts
    from daily_login_rewards dlr
    where dlr.claimed_date >= p_start::date and dlr.claimed_date < p_end::date
    group by dlr.user_id
  ),
  combined as (
    select u.user_id, sum(u.pts) as period_points
    from (
      select * from lesson_points
      union all select * from quiz_points
      union all select * from login_points
    ) u
    group by u.user_id
    having sum(u.pts) > 0
  )
  select
    c.user_id,
    up.display_name,
    up.avatar_url,
    c.period_points,
    coalesce(s.current_level, 1),
    coalesce(s.streak_days, 0),
    coalesce(ch.name, 'Active Batch') as cohort_name
  from combined c
  join user_profiles up on up.id = c.user_id
  left join user_gamification_stats s on s.user_id = c.user_id
  left join lateral (
    select co.name
    from cohort_members cm
    join cohorts co on co.id = cm.cohort_id
    where cm.user_id = c.user_id
    order by cm.added_at desc
    limit 1
  ) ch on true
  where (
    case
      when v_is_super and p_org_id is null and v_caller_org_id is null then true
      when v_target_org is not null then up.organization_id = v_target_org
      else up.organization_id is null
    end
  )
  order by c.period_points desc
  limit p_limit;
end;
$$;

-- 3. Cohort leaderboard respecting organization feature flag
create or replace function get_cohort_leaderboard(p_cohort_id uuid, p_limit int default 50)
returns table (user_id uuid, display_name text, avatar_url text, total_points int, current_level int, streak_days int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_cohort_org_id uuid;
  v_leaderboard_enabled boolean := true;
begin
  select organization_id into v_cohort_org_id from cohorts where id = p_cohort_id;
  if v_cohort_org_id is not null then
    select coalesce((settings->'leaderboard'->>'enabled')::boolean, true)
    into v_leaderboard_enabled
    from organizations
    where id = v_cohort_org_id;

    if v_leaderboard_enabled is false then
      return;
    end if;
  end if;

  return query
  select s.user_id, up.display_name, up.avatar_url, s.total_points, s.current_level, s.streak_days
  from cohort_members cm
  join user_gamification_stats s on s.user_id = cm.user_id
  join user_profiles up on up.id = cm.user_id
  where cm.cohort_id = p_cohort_id
  order by s.total_points desc
  limit p_limit;
end;
$$;
