-- ============================================================================
-- Organization Inquiries - secondary B2B contact path, distinct from Book a
-- Demo
-- ============================================================================
-- Backlog item: "Contact Form Revamp" - replace a single generic contact
-- form with two distinct paths: Book a Demo (0101_demo_requests.sql, ready
-- to buy/pilot) and Organisation Inquiry (this table - procurement
-- questions, partnership enquiries, custom requirements; not ready for a
-- demo yet, and routed to sales rather than support). Mirrors
-- 0101_demo_requests.sql's shape and RLS posture exactly, on purpose, so
-- the two leads queues behave identically for staff.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  work_email text NOT NULL,
  company_name text NOT NULL,
  inquiry_type text NOT NULL DEFAULT 'other', -- 'procurement' | 'partnership' | 'custom_requirements' | 'other'
  message text,
  source text DEFAULT 'landing_page',
  status text NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'closed'
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.organization_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE ON public.organization_inquiries TO authenticated;
GRANT ALL ON public.organization_inquiries TO service_role;
ALTER TABLE public.organization_inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not - this is a public marketing form) can submit an
-- inquiry, same posture as demo_requests_public_insert.
DROP POLICY IF EXISTS "organization_inquiries_public_insert" ON public.organization_inquiries;
CREATE POLICY "organization_inquiries_public_insert"
ON public.organization_inquiries FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Only platform staff can read/triage submitted inquiries - contains
-- personal + company contact info, staff-only same as demo_requests.
DROP POLICY IF EXISTS "organization_inquiries_staff_select" ON public.organization_inquiries;
CREATE POLICY "organization_inquiries_staff_select"
ON public.organization_inquiries FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "organization_inquiries_staff_update" ON public.organization_inquiries;
CREATE POLICY "organization_inquiries_staff_update"
ON public.organization_inquiries FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::platform_role)
  OR public.is_super_admin(auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_organization_inquiries_status ON public.organization_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_organization_inquiries_created_at ON public.organization_inquiries(created_at);
