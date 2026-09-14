-- ============================================================================
-- Demo Requests - B2B lead capture for the landing page's "Book a Demo" CTA
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor for the shared project
-- (Dashboard -> SQL Editor -> paste this file -> Run), after 0100.
--
-- Context: the landing page previously funnelled every visitor into an
-- individual-consumer "join the waitlist / pay NGN 10,000 to skip the line"
-- flow (see the `waitlist` / `waitlist_tiers` / `paid_waitlist` tables from
-- 0004_community_gamification_admin.sql). That's a B2C motion. Train AI's
-- actual positioning (per the Enterprise Platform roadmap doc) is B2B
-- organisations book a demo / pilot, not individual learners paying to skip
-- a line - so the landing page CTA needed a real backing table shaped for
-- that: who's asking, what company, how big a team, what they want to pilot.
--
-- This does not touch or remove any existing table - the old waitlist tables
-- still exist and still work for anything still using them.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  work_email text NOT NULL,
  company_name text NOT NULL,
  team_size text, -- freeform band, e.g. "1-50", "51-200", "201-1000", "1000+"
  message text,
  source text DEFAULT 'landing_page',
  status text NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'scheduled' | 'closed'
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.demo_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.demo_requests TO authenticated;
GRANT ALL ON public.demo_requests TO service_role;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not - this is a public marketing form) can submit a
-- demo request. There's no "own row" concept for an anonymous visitor, so
-- this is intentionally a blanket insert allowance, same posture as the
-- pre-existing `waitlist` table.
DROP POLICY IF EXISTS "demo_requests_public_insert" ON public.demo_requests;
CREATE POLICY "demo_requests_public_insert"
ON public.demo_requests FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Only platform staff can read/triage submitted leads (contains company +
-- personal contact info, so this is staff-only, not a "select own row" case
-- like course_applications).
DROP POLICY IF EXISTS "demo_requests_staff_select" ON public.demo_requests;
CREATE POLICY "demo_requests_staff_select"
ON public.demo_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "demo_requests_staff_update" ON public.demo_requests;
CREATE POLICY "demo_requests_staff_update"
ON public.demo_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON public.demo_requests(status);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at ON public.demo_requests(created_at);
