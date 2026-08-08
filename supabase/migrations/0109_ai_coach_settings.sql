-- ============================================================================
-- AI Coach settings (enable/disable, Manual Mode) + an admin permission fix
-- ============================================================================
-- Product brief: "Organizations can enable or disable [AI Coach]...
-- Organizations can switch AI into Manual Mode. Manual Mode allows admins to
-- replace AI responses with custom messages instead of automatic AI
-- replies." Also: "Organization Admin... Responsibilities: ... AI
-- controls." No new table needed - organizations.settings (jsonb, already
-- in the schema, previously completely unused by any code) stores this as:
--   settings->'ai_coach' = { "enabled": bool, "manual_mode": bool, "manual_message": text }
-- Missing keys default to enabled=true, manual_mode=false client-side (see
-- lib/api/organizations.js) - this migration doesn't need to backfill
-- existing rows.
--
-- Found while building this: org_update_owner (0006_rls_policies.sql) only
-- allowed the literal org *owner* (organization_members.role = 'owner') to
-- update organizations, not a regular org *admin* - but the brief lists "AI
-- controls" as an Admin responsibility, and an admin who isn't specifically
-- the owner would have been unable to toggle these settings at all. Fixed
-- by using is_org_admin() (owner OR admin) instead of is_org_owner()
-- (owner only).
-- ============================================================================

drop policy if exists org_update_owner on organizations;
create policy org_update_admin on organizations for update
  using (
    (is_org_admin(auth.uid()) and id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  );
