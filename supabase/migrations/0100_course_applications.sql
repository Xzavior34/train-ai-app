-- ============================================================================
-- Course Applications - "Apply for a course" approval workflow
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor for the shared project
-- (qibqouymqtpirtbyjvjr): Dashboard -> SQL Editor -> paste this file -> Run.
--
-- What this adds:
--   1. courses.requires_approval - a course can be flagged so learners must
--      request to join instead of enrolling instantly.
--   2. course_applications - one row per learner's request to join a course
--      that requires approval, with a pending/approved/rejected status that
--      the course's instructor/owner or an admin/super_admin reviews.
--
-- This does not touch or remove any existing table, column, or policy
-- courses without requires_approval=true keep working exactly as before
-- (instant self-enrollment).
-- ============================================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.course_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

GRANT SELECT, INSERT, UPDATE ON public.course_applications TO authenticated;
GRANT ALL ON public.course_applications TO service_role;
ALTER TABLE public.course_applications ENABLE ROW LEVEL SECURITY;

-- A learner can see and create their own applications.
DROP POLICY IF EXISTS "course_applications_learner_select_own" ON public.course_applications;
CREATE POLICY "course_applications_learner_select_own"
ON public.course_applications FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "course_applications_learner_insert_own" ON public.course_applications;
CREATE POLICY "course_applications_learner_insert_own"
ON public.course_applications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- A learner whose application was rejected can re-apply (flip their own row
-- back to pending) - but cannot self-approve.
DROP POLICY IF EXISTS "course_applications_learner_reapply" ON public.course_applications;
CREATE POLICY "course_applications_learner_reapply"
ON public.course_applications FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'rejected')
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- The course's instructor, or any admin/super_admin, can see and
-- decide (approve/reject/delete) applications to that course.
-- (Previously also checked c.owner_id, but courses has no such column
-- that's a course_files column, copied here from the wrong table. Found by
-- running this migration against a genuinely fresh database rather than an
-- already-patched one, where it hard-failed instead of silently matching
-- nothing.)
DROP POLICY IF EXISTS "course_applications_staff_manage" ON public.course_applications;
CREATE POLICY "course_applications_staff_manage"
ON public.course_applications FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_applications.course_id
      AND c.instructor_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_applications.course_id
      AND c.instructor_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_course_applications_course_id ON public.course_applications(course_id);
CREATE INDEX IF NOT EXISTS idx_course_applications_status ON public.course_applications(status);
CREATE INDEX IF NOT EXISTS idx_course_applications_user_id ON public.course_applications(user_id);
