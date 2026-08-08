-- ============================================================================
-- Messaging restriction - enforced at the database, not just the UI
-- ============================================================================
-- Product brief: "Messaging is intentionally restricted. Learners may
-- message: Their Instructor... No unrestricted learner-to-learner
-- messaging." The learner UI (CommunityScreen.jsx) now only shows a
-- Message action for instructor-role members. But the existing
-- mm_insert_sender policy (0006_rls_policies.sql) only checked
-- `sender_id = auth.uid()` - it never checked who the *receiver* was, so a
-- learner could message another learner directly via the API regardless of
-- what the UI shows. A UI-only restriction protects against nothing but
-- accidental clicks; this is the actual enforcement.
--
-- Allowed after this migration: learner -> instructor, instructor ->
-- learner (replies), and instructor -> instructor. Blocked: learner ->
-- learner. Existing rows are untouched - this only affects new inserts.
-- ============================================================================

drop policy if exists mm_insert_sender on mentor_messages;
create policy mm_insert_sender on mentor_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      has_role(auth.uid(), 'mentor'::platform_role)
      or has_role(receiver_id, 'mentor'::platform_role)
    )
  );
