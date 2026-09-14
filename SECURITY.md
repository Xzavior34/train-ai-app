# Security Model

This describes what's actually implemented in `supabase/migrations/`, verified
against a real Postgres instance before delivery (see "How this was verified"
below) - not aspirational claims.

## Layers

1. **Authentication** - handled entirely by Supabase Auth (`auth.users`,
   email/password + OAuth). This project's migrations never touch that schema;
   they only read `auth.uid()` inside RLS policies and functions.

2. **Row-Level Security (RLS)** - the real authorization layer, enforced by
   Postgres itself, not by application code. Every table has RLS **enabled**
   (`0006_rls_policies.sql`), which means: **no policy = no access**, by
   default, for every role except the table owner/superuser. Explicit
   policies are then added for the ~20 most security-critical tables
   (`user_profiles`, `organizations`, `course_enrollments`, `mentorship_sessions`,
   `admin_audit_log`, etc.) following three repeating patterns:
   - **User-owned data**: `user_id = auth.uid()`
   - **Org-scoped data**: matched against the caller's `organization_id`, or
     `is_org_admin(auth.uid())`
   - **Platform-wide/admin data**: `is_super_admin(auth.uid())`

   Because RLS is enabled on every table, even tables that don't yet have a
   custom policy written are **safe by default** - they simply deny all
   access until a policy is added, rather than being silently exposed.

3. **SECURITY DEFINER functions** - used for anything requiring cross-user
   logic (e.g. `get_leaderboard_with_profiles`, `check_quiz_answers`) that a
   plain per-row RLS policy can't express safely. Every one of these
   explicitly sets `search_path = public` - without that, a SECURITY DEFINER
   function can be tricked into resolving a same-named object from a
   different schema that an attacker controls. This is a real, commonly
   missed Postgres footgun, not a theoretical one.

4. **Permission overrides** - `user_permission_overrides` lets an org admin
   grant or revoke one specific capability for one specific person, without
   touching their role. Resolution order (implemented in
   `effective_has_permission()`): an explicit **revoke always wins**, then an
   explicit **grant**, then the **role-level default**. This is tested, not
   just documented - see below.

5. **Append-only audit log** - `admin_audit_log` has select/insert policies
   but **no update or delete policy at all**. With RLS enabled and no such
   policy, Postgres denies those operations unconditionally - this isn't
   application logic that could be bypassed by calling the database
   directly, it's enforced at the row-security layer itself. Each row's
   `row_hash` is derived from the previous row's `row_hash`
   (`log_admin_action()`), so tampering with historical data would be
   detectable by re-walking the chain.

## Known limitations, stated plainly

- The RLS policy set covers the ~20 highest-value tables in depth. The
  remaining tables in the 137-table schema follow the exact same three
  patterns above but don't each have a hand-written policy yet - extending
  them is mechanical, not a design problem, and can be done on request.
- MFA, OAuth (Google/Apple), and password-reset flows are Supabase Auth
  features you configure in the dashboard/config - this repo doesn't
  reimplement them, since reimplementing auth primitives from scratch would
  be less secure than the vetted implementation Supabase already provides.
- Rate limiting and brute-force lockout have a data model
  (`auth_failed_attempts`, `auth_lockouts`) but the actual lockout
  enforcement logic (checking these tables before allowing a login attempt)
  needs to be wired into an auth hook - noted as a TODO rather than silently
  omitted.

## How this was verified

Before this schema was handed to you, it was applied to a real local Postgres
16 instance and exercised with actual test data - not just checked for valid
SQL syntax:

- All 4 schema migrations + functions + RLS policies applied cleanly to a
  fresh database with zero errors (`ON_ERROR_STOP=1`).
- `get_primary_role()` correctly resolves priority order for a dual-role user.
- `effective_has_permission()` correctly resolves revoke > grant > role
  default, tested with actual override rows, not just read from the code.
- `check_quiz_answers()` correctly computes a score server-side from raw
  answers, and `safe_quiz_questions` was confirmed (by inspecting
  `information_schema.columns`) to never expose `correct_answer`.
- The audit-log hash chain was confirmed to actually link - a second log
  entry's `prev_hash` was checked equal to the first entry's `row_hash`.
- RLS enforcement itself was tested as a genuine non-superuser role (Postgres
  superusers always bypass RLS - standard Postgres behavior, not a gap in
  this schema) - confirming a "stranger" user gets 0 rows querying another
  user's quiz attempts or profile, and that a direct `UPDATE` against
  `admin_audit_log` affects 0 rows for anyone.
