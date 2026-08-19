-- ============================================================================
-- Course Quality Review - confirmed directly against the real 1.0
-- reference codebase (CourseQualityReviewPanel.tsx). Deliberately
-- additive - an admin can already publish/unpublish/archive a course
-- directly, and this migration changes none of that. This adds a
-- separate, optional quality-review record (status, score, notes) an
-- admin can attach to any course, useful for content QA tracking without
-- adding friction to the existing publish flow.
-- ============================================================================

create table if not exists course_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  reviewer_id uuid references user_profiles(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'needs_changes', 'rejected')),
  quality_score int check (quality_score between 1 and 10),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table course_quality_reviews enable row level security;

-- Same real authorization shape already proven for lessons/materials on
-- this same course relationship - a course's own instructor or an admin
-- can read/write its quality reviews, not a new pattern invented here.
drop policy if exists cqr_select_authorized on course_quality_reviews;
create policy cqr_select_authorized on course_quality_reviews for select
  using (
    exists (select 1 from courses c where c.id = course_quality_reviews.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
  );

drop policy if exists cqr_write_admin on course_quality_reviews;
create policy cqr_write_admin on course_quality_reviews for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create index if not exists idx_course_quality_reviews_course on course_quality_reviews(course_id);
create index if not exists idx_course_quality_reviews_status on course_quality_reviews(status);
