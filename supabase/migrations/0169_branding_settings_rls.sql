-- =============================================================================
-- 0169: branding_settings RLS policies
--
-- The branding_settings table was created in 0001_init_schema.sql but never
-- got any RLS policies. Because 0006_rls_policies.sql enables RLS on every
-- table in a single loop (default-deny), the table was silently inaccessible
-- to all users — reads returned null, writes were rejected without an explicit
-- error — making the Branding screen appear broken even though the underlying
-- table and upsert logic were correct.
--
-- Policy design:
--   SELECT  – any member of the same org can read their org's branding (needed
--             for the learner portal to apply the white-label colors on load).
--             Super admins can read all rows.
--   INSERT  – org admins and super admins only.
--   UPDATE  – org admins and super admins only.
--   DELETE  – super admins only (cascade-deleted automatically when org is
--             deleted, so this is mainly a safety valve).
-- =============================================================================

-- Read: org members see their own org's branding; super_admin sees all
create policy bs_select_org_member on branding_settings for select
  using (
    organization_id = get_user_organization_id(auth.uid())
    or is_super_admin(auth.uid())
  );

-- Write (insert + update): org admin for own org, or super_admin for any org
create policy bs_write_org_admin on branding_settings for insert
  with check (
    (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  );

create policy bs_update_org_admin on branding_settings for update
  using (
    (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  )
  with check (
    (is_org_admin(auth.uid()) and organization_id = get_user_organization_id(auth.uid()))
    or is_super_admin(auth.uid())
  );

-- Delete: super_admin only (table has cascade from organizations, so this is
-- mainly a manual safety valve rather than a normal user action)
create policy bs_delete_super_admin on branding_settings for delete
  using (is_super_admin(auth.uid()));
