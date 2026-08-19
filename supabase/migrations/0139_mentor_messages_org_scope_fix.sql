-- ============================================================================
-- Fixes a real, previously flagged cross-tenant gap in mentor_messages -
-- found while adding Fellow Instructors messaging (confirmed directly
-- against the real 1.0 reference codebase), not introduced by that
-- feature. The existing rule (mm_insert_sender,
-- 0108_messaging_restriction.sql) only required that either party have
-- the mentor role - it never checked which organization either party
-- belonged to. As written, nothing stopped an instructor in one
-- organization from messaging any person - instructor or learner - in a
-- completely different organization.
-- ============================================================================
-- This is a genuine security fix, not a feature addition - explicitly
-- flagged rather than fixed in the previous round so it could get its
-- own careful, standalone pass instead of being bundled quietly into an
-- unrelated feature.
-- ============================================================================

drop policy if exists mm_insert_sender on mentor_messages;
create policy mm_insert_sender on mentor_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      has_role(auth.uid(), 'mentor'::platform_role)
      or has_role(receiver_id, 'mentor'::platform_role)
    )
    -- The real fix: both parties must actually belong to the same
    -- organization. get_user_organization_id() is the same helper
    -- already used throughout this project's other cross-tenant fixes
    -- (study_groups, admin_audit_log) - not new logic invented for this
    -- specific case.
    and get_user_organization_id(sender_id) is not null
    and get_user_organization_id(sender_id) = get_user_organization_id(receiver_id)
  );

comment on policy mm_insert_sender on mentor_messages is
  'Requires same-organization membership for both parties - fixes a real cross-tenant gap found while adding Fellow Instructors messaging. See migration header.';
