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
