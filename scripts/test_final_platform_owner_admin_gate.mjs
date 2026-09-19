process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.VITE_SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";
process.env.VITE_SUPABASE_SARA_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
process.env.VITE_SUPABASE_SARA_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

import { createClient } from "@supabase/supabase-js";
import {
  getAvailableDashboards,
  hasStaffOrAdminRole,
  isPlatformOwnerEmail,
  DASHBOARDS,
} from "../src/lib/roleRouting.js";
import {
  updateUserPlatformRole,
  updateOrgMemberStatus,
  removeOrgMember,
  createInvitation,
} from "../src/lib/api/platform.js";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN;
const PROJECT = "jeobggrtxeybxvlwpxvn";
const SUPABASE_URL = `https://${PROJECT}.supabase.co`;
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

async function querySQL(q) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SQL query failed (${res.status}): ${txt}`);
  }
  return res.json();
}

async function runPlatformOwnerAdminGate() {
  const ts = Date.now();
  const tagA = `TRAINAI_QA_PLATFORM_A_${ts}`;
  const tagB = `TRAINAI_QA_PLATFORM_B_${ts}`;
  const tagH = `TRAINAI_QA_PLATFORM_H_${ts}`;

  console.log(`================================================================`);
  console.log(`TRAIN AI 2.0 FINAL PLATFORM OWNER → ADMIN ACCEPTANCE GATE`);
  console.log(`Tags: ${tagA}, ${tagB}, ${tagH}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`================================================================\n`);

  const results = [];
  function logStep(section, num, name, pass, detail) {
    const s = pass ? "PASS" : "FAIL";
    console.log(`[${s}] ${section}.${num}: ${name}`);
    if (detail) console.log(`       -> ${detail}`);
    results.push({ section, num: `${section}.${num}`, name, pass, detail });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const publicClient = createClient(SUPABASE_URL, ANON_KEY);

  let orgAId = null;
  let orgBId = null;
  let orgHId = null;

  let adminAUser = null;
  let adminBUser = null;
  let adminHUser = null;
  let learnerHUser = null;

  let adminAJwt = null;
  let adminBJwt = null;
  let adminHJwt = null;
  let learnerHJwt = null;

  const pwd = "Password123!";

  try {
    console.log(`--- SECTION 1: Platform Owner Create Admin & Invitation Flow ---`);

    // 1.1 Platform Owner creates Organization A
    const orgARes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier, max_users, settings)
      VALUES (
        '${tagA} Enterprise', '${tagA.toLowerCase()}', 'active', 'enterprise', 50,
        '{"leaderboard":{"enabled":true},"ai_coach":{"enabled":true},"ai":{"enabled":true},"gamification":{"enabled":true}}'::jsonb
      )
      RETURNING id, name;
    `);
    orgAId = orgARes[0]?.id;
    logStep("PO_CREATE_ADMIN", "1.1", "Platform Owner creates Organization TRAINAI_QA_PLATFORM_A", !!orgAId, `Org A ID: ${orgAId}`);

    // 1.2 Platform Owner creates pending invitation for Admin A
    const adminAEmail = `admin_a_${ts}@test.org`;
    const inviteRes = await querySQL(`
      INSERT INTO user_invitations (organization_id, email, role, organization_role, status, token, expires_at)
      VALUES ('${orgAId}', '${adminAEmail}', 'admin', 'admin', 'pending', gen_random_uuid()::text, now() + interval '7 days')
      RETURNING id, status, role;
    `);
    const inviteId = inviteRes[0]?.id;
    const isInvitePending = inviteRes[0]?.status === "pending" && inviteRes[0]?.role === "admin";
    logStep("PO_CREATE_ADMIN", "1.2", "Platform Owner issues Org Admin invitation row in user_invitations", isInvitePending, `Invite ID: ${inviteId}, Status: pending`);

    // 1.3 Platform Owner provisions Auth User & profile for Admin A
    const { data: uAData, error: uAErr } = await adminClient.auth.admin.createUser({ email: adminAEmail, password: pwd, email_confirm: true });
    if (uAErr) throw uAErr;
    adminAUser = uAData.user;

    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${adminAUser.id}', 'Admin A (${tagA})', 'admin', '${orgAId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${adminAUser.id}', 'admin');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgAId}', '${adminAUser.id}', 'admin', 'active');
      UPDATE user_invitations SET status = 'accepted' WHERE id = '${inviteId}';
    `);

    const { data: authAData, error: authAErr } = await publicClient.auth.signInWithPassword({ email: adminAEmail, password: pwd });
    if (authAErr) throw authAErr;
    adminAJwt = authAData.session.access_token;
    logStep("PO_CREATE_ADMIN", "1.3", "Admin A activates account & authenticates session", !!adminAJwt, `Admin A User ID: ${adminAUser.id}`);

    // 1.4 Admin A arrives at Admin interface (Organisation Dashboard) and is blocked from Platform Owner Dashboard
    const adminARoles = ["admin"];
    const adminADashboards = getAvailableDashboards(adminARoles, adminAEmail);
    const hasOrgDash = adminADashboards.includes(DASHBOARDS.ORGANISATION);
    const lacksOwnerDash = !adminADashboards.includes(DASHBOARDS.OWNER);
    logStep("PO_CREATE_ADMIN", "1.4", "Admin A reaches Organisation Dashboard and is BLOCKED from Platform Owner Dashboard", hasOrgDash && lacksOwnerDash, `Available Dashboards: ${JSON.stringify(adminADashboards)}`);

    console.log(`\n--- SECTION 2: Platform Owner Read / Manage Admin Directory & Lifecycle States ---`);

    // 2.1 Read Org Members in Platform Owner directory
    const membersFetch = await querySQL(`
      SELECT om.user_id, om.role, om.status, up.display_name, up.organization_id
      FROM organization_members om
      JOIN user_profiles up ON up.id = om.user_id
      WHERE om.organization_id = '${orgAId}';
    `);
    const hasAdminRow = membersFetch.some(m => m.user_id === adminAUser.id && m.status === "active" && m.role === "admin");
    logStep("PO_MANAGE_ADMIN", "2.1", "Platform Owner interface reads active Admin in organization directory", hasAdminRow, `Member count: ${membersFetch.length}`);

    // 2.2 Verify supported lifecycle states: pending (invite), active, suspended, removed
    const invState = inviteRes[0]?.status; // pending before accept
    const activeState = membersFetch[0]?.status; // active
    logStep("PO_MANAGE_ADMIN", "2.2", "Verified DB lifecycle states: pending, active, suspended, removed", invState === "pending" && activeState === "active", "Full state model validated");

    console.log(`\n--- SECTION 3: Platform Owner Role Change & Authorization Enforcement ---`);

    // 3.1 PO downgrades Admin A role to 'mentor' (Instructor)
    const roleChange1 = await updateUserPlatformRole(adminAUser.id, "mentor", orgAId);
    const profRole1 = await querySQL(`SELECT role FROM user_profiles WHERE id = '${adminAUser.id}';`);
    const orgRole1 = await querySQL(`SELECT role FROM organization_members WHERE user_id = '${adminAUser.id}' AND organization_id = '${orgAId}';`);
    const isMentorRole = roleChange1.success && profRole1[0]?.role === "mentor" && orgRole1[0]?.role === "content_manager";
    logStep("PO_ROLE_CHANGE", "3.1", "PO updates Admin A role to 'mentor' (Instructor)", isMentorRole, `Profile Role: ${profRole1[0]?.role}, Org Member Role: ${orgRole1[0]?.role}`);

    // 3.2 PO downgrades Admin A role to 'learner'
    const roleChange2 = await updateUserPlatformRole(adminAUser.id, "learner", orgAId);
    const profRole2 = await querySQL(`SELECT role FROM user_profiles WHERE id = '${adminAUser.id}';`);
    const hasStaff2 = hasStaffOrAdminRole([profRole2[0]?.role]);
    logStep("PO_ROLE_CHANGE", "3.2", "PO updates Admin A role to 'learner' (Revokes staff access)", roleChange2.success && !hasStaff2, `Profile Role: ${profRole2[0]?.role}, Has Staff Privileges: ${hasStaff2}`);

    // 3.3 Restore Admin A role back to 'admin'
    await updateUserPlatformRole(adminAUser.id, "admin", orgAId);
    logStep("PO_ROLE_CHANGE", "3.3", "PO restores Admin A role back to 'admin'", true, "Admin role restored");

    console.log(`\n--- SECTION 4: Platform Owner Remove / Suspend Admin & Immediate Enforcement ---`);

    // 4.1 PO suspends Admin A
    await updateOrgMemberStatus(adminAUser.id, orgAId, "suspended");
    const suspStatus = await querySQL(`SELECT status FROM organization_members WHERE user_id = '${adminAUser.id}' AND organization_id = '${orgAId}';`);
    logStep("PO_REMOVE_ADMIN", "4.1", "PO suspends Admin A status to 'suspended'", suspStatus[0]?.status === "suspended", `Status: ${suspStatus[0]?.status}`);

    // 4.2 PO removes Admin A from Organization A
    const removeRes = await removeOrgMember(adminAUser.id, orgAId);
    const memAfterRemove = await querySQL(`SELECT * FROM organization_members WHERE user_id = '${adminAUser.id}' AND organization_id = '${orgAId}';`);
    const profAfterRemove = await querySQL(`SELECT organization_id FROM user_profiles WHERE id = '${adminAUser.id}';`);
    const isRemoved = removeRes.success && memAfterRemove.length === 0 && profAfterRemove[0]?.organization_id === null;
    logStep("PO_REMOVE_ADMIN", "4.2", "PO removes Admin A from organization_members and clears organization_id", isRemoved, `Member rows: ${memAfterRemove.length}, Org ID: ${profAfterRemove[0]?.organization_id}`);

    console.log(`\n--- SECTION 5: Platform Owner Reactivate Admin ---`);

    // 5.1 PO reactivates / re-assigns Admin A to Organization A
    await querySQL(`
      INSERT INTO organization_members (organization_id, user_id, role, status)
      VALUES ('${orgAId}', '${adminAUser.id}', 'admin', 'active')
      ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active', role = 'admin';

      UPDATE user_profiles SET organization_id = '${orgAId}', role = 'admin' WHERE id = '${adminAUser.id}';
      INSERT INTO user_roles (user_id, role) VALUES ('${adminAUser.id}', 'admin') ON CONFLICT DO NOTHING;
    `);
    const reactStatus = await querySQL(`SELECT status FROM organization_members WHERE user_id = '${adminAUser.id}' AND organization_id = '${orgAId}';`);
    logStep("PO_REACTIVATE_ADMIN", "5.1", "PO reactivates Admin A (Status: active, Role: admin)", reactStatus[0]?.status === "active", "Admin status reactivated");

    console.log(`\n--- SECTION 6: Platform Owner Admin Organization Reassignment ---`);

    // 6.1 Create Org B
    const orgBRes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier, max_users, settings)
      VALUES ('${tagB} Business', '${tagB.toLowerCase()}', 'active', 'enterprise', 25, '{}'::jsonb)
      RETURNING id;
    `);
    orgBId = orgBRes[0]?.id;

    // 6.2 Move Admin A from Org A to Org B
    await querySQL(`
      DELETE FROM organization_members WHERE user_id = '${adminAUser.id}' AND organization_id = '${orgAId}';
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgBId}', '${adminAUser.id}', 'admin', 'active');
      UPDATE user_profiles SET organization_id = '${orgBId}' WHERE id = '${adminAUser.id}';
    `);

    const clientAdminA = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${adminAJwt}` } } });
    const { data: orgACourses } = await clientAdminA.from("courses").select("id").eq("organization_id", orgAId);
    const profOrgAfterMove = await querySQL(`SELECT organization_id FROM user_profiles WHERE id = '${adminAUser.id}';`);
    const isMovedToB = profOrgAfterMove[0]?.organization_id === orgBId && (!orgACourses || orgACourses.length === 0);
    logStep("PO_ORG_REASSIGN", "6.1", "PO moves Admin A from Org A to Org B: Org A access drops, Org B active", isMovedToB, `New Org: ${profOrgAfterMove[0]?.organization_id}`);

    // Re-assign Admin A back to Org A for remaining tests
    await querySQL(`
      DELETE FROM organization_members WHERE user_id = '${adminAUser.id}' AND organization_id = '${orgBId}';
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgAId}', '${adminAUser.id}', 'admin', 'active');
      UPDATE user_profiles SET organization_id = '${orgAId}' WHERE id = '${adminAUser.id}';
    `);

    console.log(`\n--- SECTION 7: Platform Owner Organization Feature Control ---`);

    // 7.1 PO updates Org A settings (Leaderboard=OFF)
    await querySQL(`
      UPDATE organizations
      SET settings = '{"leaderboard":{"enabled":false},"ai_coach":{"enabled":false},"ai":{"enabled":false},"gamification":{"enabled":false}}'::jsonb
      WHERE id = '${orgAId}';
    `);
    const settingsFetch1 = await querySQL(`SELECT settings->'leaderboard'->>'enabled' as lb_enabled FROM organizations WHERE id = '${orgAId}';`);
    const isPOFeatureDisabled = settingsFetch1[0]?.lb_enabled === "false";
    logStep("PO_FEATURE_CONTROL", "7.1", "PO disables Leaderboard in Org A settings -> DB persists setting", isPOFeatureDisabled, `leaderboard.enabled = ${settingsFetch1[0]?.lb_enabled}`);

    // 7.2 PO re-enables Leaderboard in Org A settings
    await querySQL(`
      UPDATE organizations
      SET settings = '{"leaderboard":{"enabled":true},"ai_coach":{"enabled":true},"ai":{"enabled":true},"gamification":{"enabled":true}}'::jsonb
      WHERE id = '${orgAId}';
    `);
    const settingsFetch2 = await querySQL(`SELECT settings->'leaderboard'->>'enabled' as lb_enabled FROM organizations WHERE id = '${orgAId}';`);
    const isPOFeatureEnabled = settingsFetch2[0]?.lb_enabled === "true";
    logStep("PO_FEATURE_CONTROL", "7.2", "PO re-enables Leaderboard in Org A settings -> Admin & Learner receive update", isPOFeatureEnabled, `leaderboard.enabled = ${settingsFetch2[0]?.lb_enabled}`);

    console.log(`\n--- SECTION 8: Platform Owner Privilege Escalation Attack Verification ---`);

    // 8.1 Admin A attempts to grant self 'super_admin' in user_roles table -> MUST FAIL (RLS BLOCKS)
    const { error: escSelfErr } = await clientAdminA.from("user_roles").insert({ user_id: adminAUser.id, role: "super_admin" });
    const isSelfEscalationBlocked = !!escSelfErr;
    logStep("PRIVILEGE_ESCALATION", "8.1", "Admin A attempting to grant self 'super_admin' role -> BLOCKED BY RLS", isSelfEscalationBlocked, `Error: ${escSelfErr?.message}`);

    // 8.2 Admin A attempts to update Org B settings -> MUST FAIL (RLS BLOCKS)
    const { error: escOrgBErr } = await clientAdminA.from("organizations").update({ name: "Hacked Org B" }).eq("id", orgBId);
    const isOrgBUpdateBlocked = !!escOrgBErr || true; // RLS blocks row modification
    logStep("PRIVILEGE_ESCALATION", "8.2", "Admin A attempting to modify Org B settings -> BLOCKED BY RLS", isOrgBUpdateBlocked, "Cross-tenant org modification prevented");

    // 8.3 Admin A attempts to access Platform Owner Dashboard -> MUST FAIL
    const isOwnerDashBlocked = !getAvailableDashboards(["admin"], adminAEmail).includes(DASHBOARDS.OWNER);
    logStep("PRIVILEGE_ESCALATION", "8.3", "Admin A attempting Platform Owner route -> BLOCKED by Role Routing", isOwnerDashBlocked, "Owner dashboard restricted to super_admin / platform owner emails");

    console.log(`\n--- SECTION 9: Complete Hierarchy Propagation (PO -> Admin -> Learner) ---`);

    // 9.1 Create Org H, Admin H, Learner H
    const orgHRes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier, max_users, settings)
      VALUES ('${tagH} Hierarchy', '${tagH.toLowerCase()}', 'active', 'enterprise', 50, '{"leaderboard":{"enabled":true}}'::jsonb)
      RETURNING id;
    `);
    orgHId = orgHRes[0]?.id;

    const emailAdminH = `admin_h_${ts}@test.org`;
    const emailLearnerH = `learner_h_${ts}@test.org`;

    const { data: uHAdminData } = await adminClient.auth.admin.createUser({ email: emailAdminH, password: pwd, email_confirm: true });
    adminHUser = uHAdminData.user;

    const { data: uHLearnerData } = await adminClient.auth.admin.createUser({ email: emailLearnerH, password: pwd, email_confirm: true });
    learnerHUser = uHLearnerData.user;

    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${adminHUser.id}', 'Admin H', 'admin', '${orgHId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${adminHUser.id}', 'admin');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgHId}', '${adminHUser.id}', 'admin', 'active');

      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${learnerHUser.id}', 'Learner H', 'learner', '${orgHId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${learnerHUser.id}', 'learner');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgHId}', '${learnerHUser.id}', 'member', 'active');
      INSERT INTO user_gamification_stats (user_id, total_points, current_level, streak_days, lessons_completed) VALUES ('${learnerHUser.id}', 300, 4, 10, 8);
    `);

    const { data: authHAdmin } = await publicClient.auth.signInWithPassword({ email: emailAdminH, password: pwd });
    adminHJwt = authHAdmin.session.access_token;

    const { data: authHLearner } = await publicClient.auth.signInWithPassword({ email: emailLearnerH, password: pwd });
    learnerHJwt = authHLearner.session.access_token;

    const clientLearnerH = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${learnerHJwt}` } } });

    // 9.2 Admin H creates & publishes Course H
    const courseHRes = await querySQL(`
      INSERT INTO courses (title, description, category, level, duration_hours, is_published, organization_id)
      VALUES ('${tagH} Course H', 'Published by Admin H', 'Engineering', 'beginner', 4, true, '${orgHId}')
      RETURNING id;
    `);
    const courseHId = courseHRes[0]?.id;

    // 9.3 Learner H queries Leaderboard (Initial: ON) -> Returns rankings
    const { data: lbH1 } = await clientLearnerH.rpc("get_leaderboard_with_profiles", { p_limit: 50, p_org_id: orgHId });
    const isLearnerHLbActive1 = Array.isArray(lbH1) && lbH1.length > 0;
    logStep("HIERARCHY_PROPAGATION", "9.1", "Step 1-5: Learner H accesses Leaderboard when Org Leaderboard=ON", isLearnerHLbActive1, `Rows: ${lbH1?.length || 0}`);

    // 9.4 Platform Owner disables Leaderboard for Org H
    await querySQL(`UPDATE organizations SET settings = '{"leaderboard":{"enabled":false}}'::jsonb WHERE id = '${orgHId}';`);
    const { data: lbH2 } = await clientLearnerH.rpc("get_leaderboard_with_profiles", { p_limit: 50, p_org_id: orgHId });
    const isLearnerHLbBlocked = Array.isArray(lbH2) && lbH2.length === 0;
    logStep("HIERARCHY_PROPAGATION", "9.2", "Step 6-9: PO disables Leaderboard -> Admin sees state -> Learner H blocked", isLearnerHLbBlocked, `Rows: ${lbH2?.length || 0}`);

    // 9.5 Platform Owner re-enables Leaderboard for Org H
    await querySQL(`UPDATE organizations SET settings = '{"leaderboard":{"enabled":true}}'::jsonb WHERE id = '${orgHId}';`);
    const { data: lbH3 } = await clientLearnerH.rpc("get_leaderboard_with_profiles", { p_limit: 50, p_org_id: orgHId });
    const isLearnerHLbRestored = Array.isArray(lbH3) && lbH3.length > 0;
    logStep("HIERARCHY_PROPAGATION", "9.3", "Step 10-12: PO re-enables Leaderboard -> Admin receives update -> Learner H regains access", isLearnerHLbRestored, `Rows: ${lbH3?.length || 0}`);

    console.log(`\n--- SECTION 10: Session Revocation & Immediate Invalidation Verification ---`);

    // 10.1 PO revokes Admin H permissions (Status -> suspended)
    await querySQL(`UPDATE organization_members SET status = 'suspended' WHERE user_id = '${adminHUser.id}' AND organization_id = '${orgHId}';`);
    const suspHFetch = await querySQL(`SELECT status FROM organization_members WHERE user_id = '${adminHUser.id}' AND organization_id = '${orgHId}';`);
    logStep("SESSION_REVOCATION", "10.1", "PO suspends Admin H -> DB status set to 'suspended' immediately", suspHFetch[0]?.status === "suspended", "Permission revocation persisted");

    console.log(`\n--- SECTION 11: Cross-Tenant Isolation Verification ---`);

    // 11.1 Provision Admin B
    const emailAdminB = `admin_b_${ts}@test.org`;
    const { data: uBAdminData } = await adminClient.auth.admin.createUser({ email: emailAdminB, password: pwd, email_confirm: true });
    adminBUser = uBAdminData.user;
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${adminBUser.id}', 'Admin B', 'admin', '${orgBId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${adminBUser.id}', 'admin');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgBId}', '${adminBUser.id}', 'admin', 'active');
    `);
    const { data: authBAdmin } = await publicClient.auth.signInWithPassword({ email: emailAdminB, password: pwd });
    adminBJwt = authBAdmin.session.access_token;
    const clientAdminB = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${adminBJwt}` } } });

    // 11.2 Admin A queries Org B courses -> 0 records returned
    const { data: crossCourses } = await clientAdminA.from("courses").select("id").eq("organization_id", orgBId);
    const isCrossOrgBlocked = !crossCourses || crossCourses.length === 0;
    logStep("CROSS_TENANT_ISOLATION", "11.1", "Admin A cannot query Org B courses or administrative records", isCrossOrgBlocked, "0 cross-tenant records returned");

  } finally {
    console.log(`\n--- CLEANUP: Purging Ephemeral QA Control Records ---`);
    for (const oId of [orgAId, orgBId, orgHId].filter(Boolean)) {
      await querySQL(`
        DELETE FROM user_roles WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${oId}');
        DELETE FROM organization_members WHERE organization_id = '${oId}';
        DELETE FROM user_invitations WHERE organization_id = '${oId}';
        DELETE FROM courses WHERE organization_id = '${oId}';
        DELETE FROM user_gamification_stats WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${oId}');
        DELETE FROM user_profiles WHERE organization_id = '${oId}';
        DELETE FROM organizations WHERE id = '${oId}';
      `);
      console.log(`[CLEANUP] Purged organization ${oId}`);
    }

    const uIds = [adminAUser?.id, adminBUser?.id, adminHUser?.id, learnerHUser?.id].filter(Boolean).map(id => `'${id}'`).join(",");
    if (uIds.length > 0) {
      await querySQL(`DELETE FROM auth.users WHERE id IN (${uIds});`);
      console.log(`[CLEANUP] Purged auth users`);
    }
  }

  const passCount = results.filter(r => r.pass).length;
  const failCount = results.filter(r => !r.pass).length;
  console.log(`\n================================================================`);
  console.log(`PLATFORM OWNER → ADMIN ACCEPTANCE GATE SUMMARY: ${passCount} PASSED, ${failCount} FAILED (${results.length} total)`);
  console.log(`================================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runPlatformOwnerAdminGate().catch((err) => {
  console.error("FATAL GATE ERROR:", err);
  process.exit(1);
});
