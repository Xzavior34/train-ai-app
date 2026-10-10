-- ============================================================
-- Migration: CAP Cohort 3 6-Week Timeline, Admin Extension, & Accelerator Tables
-- 1. Adds duration_weeks and timeline management to cohorts table
-- 2. Adds RPC extend_cohort_timeline to give admins full control to extend cohort periods
-- 3. Ensures cap_teams, cap_team_members, and mentorship_checkins tables exist and accept cohort IDs
-- 4. Ensures CAP Cohort 3 has a proper 6-week timeline (42 days) with active countdown
-- ============================================================

-- 1. Enhance cohorts table with duration_weeks if not present
ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS duration_weeks integer DEFAULT 6,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

-- 2. Ensure CAP Cohort 3 has a real 6-week active timeline
-- If starts_at or ends_at are null, default to a 6-week schedule (e.g. 14 days elapsed, 28 days left)
UPDATE public.cohorts
SET
  starts_at = COALESCE(starts_at, now() - interval '14 days'),
  ends_at = COALESCE(ends_at, now() + interval '28 days'),
  duration_weeks = COALESCE(duration_weeks, 6),
  status = 'Active'
WHERE name ILIKE '%CAP%Cohort%3%'
  AND (starts_at IS NULL OR ends_at IS NULL);

-- 3. RPC for Admins & Mentors to Extend Cohort Timeline
CREATE OR REPLACE FUNCTION public.extend_cohort_timeline(
  p_cohort_id text,
  p_extension_days integer DEFAULT 7,
  p_new_end_date timestamptz DEFAULT NULL,
  p_new_start_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cohort public.cohorts;
  v_old_ends_at timestamptz;
  v_new_ends_at timestamptz;
  v_new_starts_at timestamptz;
  v_days_remaining integer;
  v_total_days integer;
  v_total_weeks integer;
  v_post_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- Look up cohort by UUID or slug/name
  SELECT *
  INTO v_cohort
  FROM public.cohorts
  WHERE id::text = trim(p_cohort_id)
     OR name ILIKE '%' || trim(p_cohort_id) || '%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_cohort IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cohort not found.');
  END IF;

  v_old_ends_at := COALESCE(v_cohort.ends_at, now() + interval '42 days');
  v_new_starts_at := COALESCE(p_new_start_date, v_cohort.starts_at, now() - interval '14 days');

  IF p_new_end_date IS NOT NULL THEN
    v_new_ends_at := p_new_end_date;
  ELSE
    v_new_ends_at := v_old_ends_at + (COALESCE(p_extension_days, 7) || ' days')::interval;
  END IF;

  IF v_new_ends_at <= v_new_starts_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'End date must be after start date.');
  END IF;

  v_total_days := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (v_new_ends_at - v_new_starts_at)) / 86400));
  v_total_weeks := GREATEST(1, CEIL(v_total_days / 7.0));
  v_days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_new_ends_at - now())) / 86400));

  UPDATE public.cohorts
  SET
    starts_at = v_new_starts_at,
    ends_at = v_new_ends_at,
    duration_weeks = v_total_weeks,
    status = 'Active',
    updated_at = now()
  WHERE id = v_cohort.id;

  -- Post an automated announcement to the cohort feed informing learners
  INSERT INTO public.cohort_posts (
    cohort_id,
    author_id,
    content,
    is_announcement
  )
  VALUES (
    v_cohort.id,
    v_user_id,
    format('📢 Cohort Timeline Extended! The administration has extended this cohort by %s days. New completion date: %s (%s days remaining).',
           COALESCE(p_extension_days, ROUND(EXTRACT(EPOCH FROM (v_new_ends_at - v_old_ends_at)) / 86400)),
           to_char(v_new_ends_at, 'Mon DD, YYYY'),
           v_days_remaining),
    true
  )
  RETURNING id INTO v_post_id;

  RETURN jsonb_build_object(
    'success', true,
    'cohort_id', v_cohort.id,
    'starts_at', v_new_starts_at,
    'ends_at', v_new_ends_at,
    'duration_weeks', v_total_weeks,
    'total_days', v_total_days,
    'days_remaining', v_days_remaining,
    'message', format('Cohort extended successfully. New end date is %s (%s days remaining).', to_char(v_new_ends_at, 'Mon DD, YYYY'), v_days_remaining)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_cohort_timeline(text, integer, timestamptz, timestamptz) TO authenticated;

-- 4. CAP Teams Table Definition (Ensure columns exist and policies allow members to join/create)
CREATE TABLE IF NOT EXISTS public.cap_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  project_title text,
  problem_statement text,
  technologies text[] DEFAULT '{}',
  github_url text,
  demo_url text,
  presentation_url text,
  demo_video_url text,
  screenshot_url text,
  mentor_id uuid,
  mentor_name text,
  phase text NOT NULL DEFAULT 'BUILD',
  demo_day_status text NOT NULL DEFAULT 'Draft',
  final_score numeric(4,2) DEFAULT 0.0,
  judges_feedback text,
  mentor_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cap_teams ADD COLUMN IF NOT EXISTS mentor_name text;

CREATE TABLE IF NOT EXISTS public.cap_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.cap_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text,
  email text,
  role text NOT NULL DEFAULT 'Software Engineer',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.cap_team_members ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.cap_team_members ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.cap_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_team_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cap_teams' AND policyname = 'cap_teams_read_authenticated') THEN
    CREATE POLICY cap_teams_read_authenticated ON public.cap_teams FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cap_teams' AND policyname = 'cap_teams_write_authenticated') THEN
    CREATE POLICY cap_teams_write_authenticated ON public.cap_teams FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cap_team_members' AND policyname = 'cap_team_members_read_authenticated') THEN
    CREATE POLICY cap_team_members_read_authenticated ON public.cap_team_members FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cap_team_members' AND policyname = 'cap_team_members_write_authenticated') THEN
    CREATE POLICY cap_team_members_write_authenticated ON public.cap_team_members FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 5. Mentorship Check-ins Table Definition
CREATE TABLE IF NOT EXISTS public.mentorship_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.cap_teams(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  team_name text,
  mentor_id uuid,
  mentor_name text,
  checkin_date date NOT NULL DEFAULT current_date,
  notes text NOT NULL,
  progress_rating integer NOT NULL DEFAULT 4,
  issues_blockers text,
  recommended_actions text,
  next_checkin_date date,
  is_private_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mentorship_checkins ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.mentorship_checkins ADD COLUMN IF NOT EXISTS mentor_name text;

ALTER TABLE public.mentorship_checkins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mentorship_checkins' AND policyname = 'mentorship_checkins_read_authenticated') THEN
    CREATE POLICY mentorship_checkins_read_authenticated ON public.mentorship_checkins FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mentorship_checkins' AND policyname = 'mentorship_checkins_write_authenticated') THEN
    CREATE POLICY mentorship_checkins_write_authenticated ON public.mentorship_checkins FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
