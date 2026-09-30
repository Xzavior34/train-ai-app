-- ============================================================================
-- Demo Requests Scheduling Enhancement
-- Adds scheduled_date / scheduled_time columns to demo_requests and creates
-- a public, privacy-safe view that lets the booking page show which slots are
-- already taken -- without exposing any PII.
-- ============================================================================
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> Run).
-- Safe to run against a project that already has 0101_demo_requests.sql.
-- ============================================================================

-- 1. Add scheduling columns to demo_requests (idempotent via IF NOT EXISTS
--    column check pattern; ALTER TABLE ADD COLUMN IF NOT EXISTS requires PG 9.6+
--    which Supabase always satisfies).
ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time text,
  ADD COLUMN IF NOT EXISTS org_type text,
  ADD COLUMN IF NOT EXISTS timezone text;

-- Index for fast slot-availability queries
CREATE INDEX IF NOT EXISTS idx_demo_requests_slot
  ON public.demo_requests (scheduled_date, scheduled_time)
  WHERE scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL;

-- 2. Public view: exposes ONLY the date + time of confirmed/scheduled bookings.
--    No name, no email, no company — just enough for the calendar to show
--    "this slot is taken" without leaking any PII.
CREATE OR REPLACE VIEW public.booked_demo_slots AS
SELECT
  scheduled_date,
  scheduled_time,
  count(*) AS booking_count
FROM public.demo_requests
WHERE
  scheduled_date IS NOT NULL
  AND scheduled_time IS NOT NULL
  AND status NOT IN ('cancelled', 'closed')
GROUP BY scheduled_date, scheduled_time;

-- Grant anon + authenticated read on the view (no PII exposed)
GRANT SELECT ON public.booked_demo_slots TO anon, authenticated;

-- RLS on the underlying table already restricts full row access.
-- The view is a SECURITY INVOKER view (default), so it inherits RLS.
-- However, since the view only aggregates and we want anon to read it,
-- we recreate it as SECURITY DEFINER owned by postgres so anon can
-- read aggregated counts without having SELECT on the base table.
DROP VIEW IF EXISTS public.booked_demo_slots;

CREATE OR REPLACE VIEW public.booked_demo_slots
WITH (security_invoker = false)
AS
SELECT
  scheduled_date,
  scheduled_time,
  count(*) AS booking_count
FROM public.demo_requests
WHERE
  scheduled_date IS NOT NULL
  AND scheduled_time IS NOT NULL
  AND status NOT IN ('cancelled', 'closed')
GROUP BY scheduled_date, scheduled_time;

-- Re-grant after recreate
GRANT SELECT ON public.booked_demo_slots TO anon, authenticated;

-- 3. RPC to fetch booked slots for a date range (callable by anon).
--    Returns rows: { scheduled_date, scheduled_time, booking_count }
CREATE OR REPLACE FUNCTION public.get_booked_slots(
  p_from_date date DEFAULT CURRENT_DATE,
  p_to_date   date DEFAULT CURRENT_DATE + INTERVAL '30 days'
)
RETURNS TABLE (
  scheduled_date date,
  scheduled_time text,
  booking_count  bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    dr.scheduled_date,
    dr.scheduled_time,
    count(*) AS booking_count
  FROM public.demo_requests dr
  WHERE
    dr.scheduled_date IS NOT NULL
    AND dr.scheduled_time IS NOT NULL
    AND dr.scheduled_date BETWEEN p_from_date AND p_to_date
    AND dr.status NOT IN ('cancelled', 'closed')
  GROUP BY dr.scheduled_date, dr.scheduled_time;
$$;

-- Allow anon + authenticated to call the RPC
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date, date) TO anon, authenticated;
