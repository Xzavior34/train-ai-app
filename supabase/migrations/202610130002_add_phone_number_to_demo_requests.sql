-- ============================================================================
-- Migration: Add phone_number and phone to demo_requests and organization_inquiries
-- ============================================================================

ALTER TABLE IF EXISTS public.demo_requests
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE IF EXISTS public.organization_inquiries
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.demo_requests.phone_number IS 'Primary attendee contact phone or WhatsApp number for meeting reminders';
COMMENT ON COLUMN public.organization_inquiries.phone_number IS 'Contact phone number for organizational follow-up';
