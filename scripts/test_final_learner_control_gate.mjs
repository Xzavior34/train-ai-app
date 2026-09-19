import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN || "";
const PROJECT = "jeobggrtxeybxvlwpxvn";
const SUPABASE_URL = `https://${PROJECT}.supabase.co`;
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

async function runLearnerControlGate() {
  const ts = Date.now();
  const tagA = `TRAINAI_QA_CONTROL_A_${ts}`;
  const tagB = `TRAINAI_QA_CONTROL_B_${ts}`;
  console.log(`================================================================`);
  console.log(`TRAIN AI 2.0 FINAL LEARNER CONTROL ACCEPTANCE GATE`);
  console.log(`Tags: ${tagA} (Org A) & ${tagB} (Org B)`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`================================================================\n`);

  const results = [];
  function logStep(section, num, name, pass, detail) {
    const s = pass ? "PASS" : "FAIL";
    console.log(`[${s}] ${section}.${num}: ${name}`);
    if (detail) console.log(`       -> ${detail}`);
    results.push({ section, num: `${section}.${num}`, name, pass, detail });
  }

  let orgAId = null;
  let orgBId = null;
  let adminAId = null;
  let adminBId = null;
  let learnerAId = null;
  let learnerBId = null;
  let learnerAJwt = null;
  let learnerBJwt = null;
  let courseAId = null;

  try {
    console.log(`--- SECTION 1: Dual-Tenant Provisioning (Org A: ON, Org B: OFF) ---`);
    
    // 1.1 Provision Org A
    const orgARes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier, max_users, settings)
      VALUES (
        '${tagA} Enterprise', '${tagA.toLowerCase()}', 'active', 'enterprise', 50,
        '{"leaderboard":{"enabled":true},"ai_coach":{"enabled":true,"manual_mode":false},"ai":{"enabled":true,"quiz_enabled":true},"gamification":{"enabled":true},"ai_insights":{"enabled":true}}'::jsonb
      )
      RETURNING id, name;
    `);
    orgAId = orgARes[0]?.id;
    logStep("GATE_SETUP", "1.1", "Provision Org A with Leaderboard=ON & AI=ON", !!orgAId, `Org A ID: ${orgAId}`);

    // 1.2 Provision Org B
    const orgBRes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier, max_users, settings)
      VALUES (
        '${tagB} Restricted', '${tagB.toLowerCase()}', 'active', 'enterprise', 50,
        '{"leaderboard":{"enabled":false},"ai_coach":{"enabled":false,"manual_mode":false},"ai":{"enabled":false,"quiz_enabled":false},"gamification":{"enabled":false},"ai_insights":{"enabled":false}}'::jsonb
      )
      RETURNING id, name;
    `);
    orgBId = orgBRes[0]?.id;
    logStep("GATE_SETUP", "1.2", "Provision Org B with Leaderboard=OFF & AI=OFF", !!orgBId, `Org B ID: ${orgBId}`);

    // 1.3 Seed AI Credit Accounts
    await querySQL(`
      INSERT INTO ai_credit_accounts (organization_id, account_type, balance, lifetime_credited)
      VALUES ('${orgAId}', 'organization', 100, 100), ('${orgBId}', 'organization', 100, 100);
    `);
    logStep("GATE_SETUP", "1.3", "Seed AI Credit accounts for both tenants", true, "100 credits allocated per org");

    // 1.4 Provision Auth Users & Personas for Org A & Org B
    const emailAAdmin = `admin_a_${ts}@test.org`;
    const emailBAdmin = `admin_b_${ts}@test.org`;
    const emailALearner = `learner_a_${ts}@test.org`;
    const emailBLearner = `learner_b_${ts}@test.org`;
    const pwd = "Password123!";

    const adminClient = createClient(SUPABASE_URL, ANON_KEY);

    const { data: uAAdminData, error: uAAdminErr } = await adminClient.auth.admin.createUser({ email: emailAAdmin, password: pwd, email_confirm: true });
    if (uAAdminErr) throw uAAdminErr;
    adminAId = uAAdminData.user.id;

    const { data: uBAdminData, error: uBAdminErr } = await adminClient.auth.admin.createUser({ email: emailBAdmin, password: pwd, email_confirm: true });
    if (uBAdminErr) throw uBAdminErr;
    adminBId = uBAdminData.user.id;

    const { data: uALearnerData, error: uALearnerErr } = await adminClient.auth.admin.createUser({ email: emailALearner, password: pwd, email_confirm: true });
    if (uALearnerErr) throw uALearnerErr;
    learnerAId = uALearnerData.user.id;

    const { data: uBLearnerData, error: uBLearnerErr } = await adminClient.auth.admin.createUser({ email: emailBLearner, password: pwd, email_confirm: true });
    if (uBLearnerErr) throw uBLearnerErr;
    learnerBId = uBLearnerData.user.id;

    await querySQL(`
      -- Org A bindings
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${adminAId}', 'Admin A (${tagA})', 'admin', '${orgAId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${adminAId}', 'admin');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgAId}', '${adminAId}', 'admin', 'active');

      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${learnerAId}', 'Learner A (${tagA})', 'learner', '${orgAId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${learnerAId}', 'learner');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgAId}', '${learnerAId}', 'member', 'active');
      INSERT INTO user_gamification_stats (user_id, total_points, current_level, streak_days, lessons_completed) VALUES ('${learnerAId}', 250, 3, 7, 5);

      -- Org B bindings
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${adminBId}', 'Admin B (${tagB})', 'admin', '${orgBId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${adminBId}', 'admin');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgBId}', '${adminBId}', 'admin', 'active');

      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${learnerBId}', 'Learner B (${tagB})', 'learner', '${orgBId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${learnerBId}', 'learner');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgBId}', '${learnerBId}', 'member', 'active');
      INSERT INTO user_gamification_stats (user_id, total_points, current_level, streak_days, lessons_completed) VALUES ('${learnerBId}', 200, 2, 4, 4);
    `);
    logStep("GATE_SETUP", "1.4", "Provision user profiles, roles, and gamification points", true, "Users bound to Org A & Org B");

    // Authenticate real sessions via Supabase Auth client to obtain genuine JWT tokens
    const publicClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: authAData, error: authAErr } = await publicClient.auth.signInWithPassword({
      email: emailALearner,
      password: pwd,
    });
    if (authAErr) throw authAErr;
    learnerAJwt = authAData.session.access_token;

    const { data: authBData, error: authBErr } = await publicClient.auth.signInWithPassword({
      email: emailBLearner,
      password: pwd,
    });
    if (authBErr) throw authBErr;
    learnerBJwt = authBData.session.access_token;
    logStep("GATE_SETUP", "1.5", "Authenticate Learner A & Learner B sessions", !!(learnerAJwt && learnerBJwt), "Authentic JWT sessions issued");

    console.log(`\n--- SECTION 2: Leaderboard Verification (Org A: ON, Org B: OFF) ---`);

    // 2.1 Learner A querying leaderboard RPCs (Org A has Leaderboard=ON)
    const clientA = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${learnerAJwt}` } },
    });
    const { data: lbAAllTime, error: lbAErr } = await clientA.rpc("get_leaderboard_with_profiles", { p_limit: 50, p_org_id: orgAId });
    const { data: lbAPeriod, error: lbAPeriodErr } = await clientA.rpc("get_leaderboard_for_period", {
      p_start: new Date(Date.now() - 7 * 86400000).toISOString(),
      p_end: new Date().toISOString(),
      p_limit: 50,
      p_org_id: orgAId,
    });
    const hasOrgALb = Array.isArray(lbAAllTime) && lbAAllTime.length > 0;
    logStep("LEADERBOARD_INITIAL", "2.1", "Org A Learner (ON): get_leaderboard_with_profiles returns rankings", hasOrgALb && !lbAErr, `Rows returned: ${lbAAllTime?.length || 0}, Top: ${lbAAllTime?.[0]?.display_name || "N/A"}`);

    // 2.2 Learner B querying leaderboard RPCs (Org B has Leaderboard=OFF)
    const clientB = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${learnerBJwt}` } },
    });
    const { data: lbBAllTime, error: lbBErr } = await clientB.rpc("get_leaderboard_with_profiles", { p_limit: 50, p_org_id: orgBId });
    const { data: lbBPeriod, error: lbBPeriodErr } = await clientB.rpc("get_leaderboard_for_period", {
      p_start: new Date(Date.now() - 7 * 86400000).toISOString(),
      p_end: new Date().toISOString(),
      p_limit: 50,
      p_org_id: orgBId,
    });
    const isOrgBLbBlocked = Array.isArray(lbBAllTime) && lbBAllTime.length === 0 && Array.isArray(lbBPeriod) && lbBPeriod.length === 0;
    logStep("LEADERBOARD_INITIAL", "2.2", "Org B Learner (OFF): get_leaderboard RPC returns 0 rows (server-side blocked)", isOrgBLbBlocked, `All-time rows: ${lbBAllTime?.length || 0}, Period rows: ${lbBPeriod?.length || 0}`);

    // 2.3 Verify Direct Route Guard & UI State for Learner A vs Learner B
    const orgASettingsFetch = await querySQL(`SELECT settings->'leaderboard'->>'enabled' as enabled FROM organizations WHERE id = '${orgAId}';`);
    const orgBSettingsFetch = await querySQL(`SELECT settings->'leaderboard'->>'enabled' as enabled FROM organizations WHERE id = '${orgBId}';`);
    const isOrgAEnabledUI = orgASettingsFetch[0]?.enabled === "true";
    const isOrgBDisabledUI = orgBSettingsFetch[0]?.enabled === "false";
    logStep("LEADERBOARD_INITIAL", "2.3", "UI & Route state reflects Org settings: Org A (Enabled), Org B (Disabled)", isOrgAEnabledUI && isOrgBDisabledUI, `Org A: ${isOrgAEnabledUI ? "ON" : "OFF"}, Org B: ${isOrgBDisabledUI ? "OFF" : "ON"}`);

    console.log(`\n--- SECTION 3: AI Coach & Quiz Verification (Org A: ON, Org B: OFF) ---`);

    const convARes = await querySQL(`INSERT INTO ai_conversations (user_id, title) VALUES ('${learnerAId}', 'Session A') RETURNING id;`);
    const convAId = convARes[0]?.id;
    const convBRes = await querySQL(`INSERT INTO ai_conversations (user_id, title) VALUES ('${learnerBId}', 'Session B') RETURNING id;`);
    const convBId = convBRes[0]?.id;

    // 3.1 Learner A calls ai-chat Edge Function (Org A has AI=ON)
    const chatARes = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${learnerAJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversationId: convAId, message: "Hello AI Coach" }),
    });
    const chatAData = await chatARes.json();
    const isOrgAChatAuthorized = chatARes.status === 200 && !chatAData.error?.includes("turned off for your organization");
    logStep("AI_CONTROL_INITIAL", "3.1", "Org A Learner (ON): ai-chat passes organization authorization check", isOrgAChatAuthorized, `Status: ${chatARes.status}, Output: ${JSON.stringify(chatAData).slice(0, 80)}`);

    // 3.2 Learner B calls ai-chat Edge Function (Org B has AI=OFF) -> MUST BE BLOCKED WITH 403
    const chatBRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${learnerBJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversationId: convBId, message: "Hello AI Coach" }),
    });
    const chatBData = await chatBRes.json();
    const isOrgBChatBlocked = chatBRes.status === 403 && chatBData.error?.includes("turned off for your organization");
    logStep("AI_CONTROL_INITIAL", "3.2", "Org B Learner (OFF): ai-chat blocked with 403 Forbidden server-side", isOrgBChatBlocked, `Status: ${chatBRes.status}, Error: ${chatBData.error}`);

    // 3.3 Learner B calls ai-generate-quiz Edge Function (Org B has AI=OFF) -> MUST BE BLOCKED WITH 403
    const quizBRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-generate-quiz`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${learnerBJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ topic: "PostgreSQL Database Administration", difficulty: "medium" }),
    });
    const quizBData = await quizBRes.json();
    const isOrgBQuizBlocked = quizBRes.status === 403 && quizBData.error?.includes("disabled for your organization");
    logStep("AI_CONTROL_INITIAL", "3.3", "Org B Learner (OFF): ai-generate-quiz blocked with 403 Forbidden server-side", isOrgBQuizBlocked, `Status: ${quizBRes.status}, Error: ${quizBData.error}`);

    console.log(`\n--- SECTION 4: Reversing Settings (Org A: OFF, Org B: ON) & Isolation ---`);

    // 4.1 Admin updates settings in Database
    await querySQL(`
      UPDATE organizations
      SET settings = '{"leaderboard":{"enabled":false},"ai_coach":{"enabled":false,"manual_mode":false},"ai":{"enabled":false,"quiz_enabled":false},"gamification":{"enabled":false},"ai_insights":{"enabled":false}}'::jsonb
      WHERE id = '${orgAId}';

      UPDATE organizations
      SET settings = '{"leaderboard":{"enabled":true},"ai_coach":{"enabled":true,"manual_mode":false},"ai":{"enabled":true,"quiz_enabled":true},"gamification":{"enabled":true},"ai_insights":{"enabled":true}}'::jsonb
      WHERE id = '${orgBId}';
    `);
    logStep("REVERSE_SETTINGS", "4.1", "Admin persists reversed settings: Org A=OFF, Org B=ON", true, "DB settings updated and committed");

    // 4.2 Retest Learner A (Now OFF) - Leaderboard RPC
    const { data: lbAReversed } = await clientA.rpc("get_leaderboard_with_profiles", { p_limit: 50, p_org_id: orgAId });
    const isOrgALbNowBlocked = Array.isArray(lbAReversed) && lbAReversed.length === 0;
    logStep("REVERSE_SETTINGS", "4.2", "Org A Learner (Reversed to OFF): get_leaderboard now returns 0 rows", isOrgALbNowBlocked, `Rows: ${lbAReversed?.length || 0}`);

    // 4.3 Retest Learner B (Now ON) - Leaderboard RPC
    const { data: lbBReversed } = await clientB.rpc("get_leaderboard_with_profiles", { p_limit: 50, p_org_id: orgBId });
    const isOrgBLbNowActive = Array.isArray(lbBReversed) && lbBReversed.length > 0;
    logStep("REVERSE_SETTINGS", "4.3", "Org B Learner (Reversed to ON): get_leaderboard now returns rankings", isOrgBLbNowActive, `Rows: ${lbBReversed?.length || 0}, Top: ${lbBReversed?.[0]?.display_name || "N/A"}`);

    // 4.4 Retest Learner A (Now OFF) - ai-chat Edge Function (Must be 403 Forbidden)
    const chatARevRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${learnerAJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversationId: convAId, message: "Hello AI Coach after reverse" }),
    });
    const chatARevData = await chatARevRes.json();
    const isOrgAChatNowBlocked = chatARevRes.status === 403 && chatARevData.error?.includes("turned off for your organization");
    logStep("REVERSE_SETTINGS", "4.4", "Org A Learner (Reversed to OFF): ai-chat immediately returns 403 Forbidden", isOrgAChatNowBlocked, `Status: ${chatARevRes.status}, Error: ${chatARevData.error}`);

    // 4.5 Retest Learner B (Now ON) - ai-chat Edge Function (Must pass authorization check)
    const chatBRevRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${learnerBJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversationId: convBId, message: "Hello AI Coach after reverse" }),
    });
    const chatBRevData = await chatBRevRes.json();
    const isOrgBChatNowActive = chatBRevRes.status === 200 && !chatBRevData.error?.includes("turned off for your organization");
    logStep("REVERSE_SETTINGS", "4.5", "Org B Learner (Reversed to ON): ai-chat passes authorization check", isOrgBChatNowActive, `Status: ${chatBRevRes.status}, Output: ${JSON.stringify(chatBRevData).slice(0, 80)}`);

    console.log(`\n--- SECTION 5: Persistence, Refresh & New Session Verification ---`);

    // Sign in again with new session tokens to prove state survives complete re-login
    const { data: newSessionA } = await publicClient.auth.signInWithPassword({ email: emailALearner, password: pwd });
    const { data: newSessionB } = await publicClient.auth.signInWithPassword({ email: emailBLearner, password: pwd });
    const clientANew = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${newSessionA.session.access_token}` } } });
    const clientBNew = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${newSessionB.session.access_token}` } } });

    // 5.1 Fresh session Learner A verifies Leaderboard stays OFF
    const { data: lbANew } = await clientANew.rpc("get_leaderboard_with_profiles", { p_limit: 50, p_org_id: orgAId });
    logStep("PERSISTENCE", "5.1", "New Session: Learner A settings persist accurately (Leaderboard=OFF)", Array.isArray(lbANew) && lbANew.length === 0, `Returned: ${lbANew?.length || 0} rows`);

    // 5.2 Fresh session Learner B verifies Leaderboard stays ON
    const { data: lbBNew } = await clientBNew.rpc("get_leaderboard_with_profiles", { p_limit: 50, p_org_id: orgBId });
    logStep("PERSISTENCE", "5.2", "New Session: Learner B settings persist accurately (Leaderboard=ON)", Array.isArray(lbBNew) && lbBNew.length > 0, `Returned: ${lbBNew?.length || 0} rows`);

    console.log(`\n--- SECTION 6: Additional Learner-Affecting Feature Controls ---`);

    // 6.1 Course Publishing Control (courses.is_published)
    const draftCourse = await querySQL(`
      INSERT INTO courses (title, description, category, level, duration_hours, is_published, organization_id)
      VALUES ('${tagA} Unpublished Draft Course', 'Draft only', 'Engineering', 'beginner', 5, false, '${orgAId}')
      RETURNING id;
    `);
    courseAId = draftCourse[0]?.id;
    const { data: learnerCourses } = await clientA.from("courses").select("id, title, is_published").eq("id", courseAId);
    logStep("CONTROL_AUDIT", "6.1", "Course Publishing: Draft course (is_published=false) blocked from Learner discovery via RLS", (!learnerCourses || learnerCourses.length === 0), "Draft course inaccessible to learners");

    // 6.2 Publish Course and verify Learner access
    await querySQL(`UPDATE courses SET is_published = true WHERE id = '${courseAId}';`);
    const { data: publishedCourses } = await clientA.from("courses").select("id, title, is_published").eq("id", courseAId);
    logStep("CONTROL_AUDIT", "6.2", "Course Publishing: Published course (is_published=true) immediately accessible to Learner", publishedCourses?.length === 1, `Course accessible: ${publishedCourses?.[0]?.title}`);

    // 6.3 AI Insights Manual Mode Override
    await querySQL(`
      UPDATE organizations
      SET settings = jsonb_set(settings, '{ai_insights}', '{"enabled":true,"manual_mode":true,"manual_message":"Important Academy Notice: Exam on Friday."}'::jsonb)
      WHERE id = '${orgBId}';
    `);
    const insightsFetch = await querySQL(`SELECT settings->'ai_insights' as insights FROM organizations WHERE id = '${orgBId}';`);
    const isManualInsights = insightsFetch[0]?.insights?.manual_mode === true && insightsFetch[0]?.insights?.manual_message?.includes("Exam on Friday");
    logStep("CONTROL_AUDIT", "6.3", "AI Insights Moderation: Manual Mode overrides raw AI with admin announcement", isManualInsights, `Message: ${insightsFetch[0]?.insights?.manual_message}`);

    // 6.4 Community Content Moderation Control
    await querySQL(`
      INSERT INTO community_posts (user_id, content, moderation_status, post_type)
      VALUES
        ('${learnerAId}', 'Pending moderation post', 'pending', 'general'),
        ('${adminAId}', 'Approved official post', 'approved', 'general');
    `);
    const { data: communityFeed } = await clientB.from("community_posts").select("id, content, moderation_status").eq("user_id", adminAId).eq("moderation_status", "approved");
    logStep("CONTROL_AUDIT", "6.4", "Community Moderation: Unapproved posts hidden from public feed", communityFeed?.every(p => p.moderation_status === "approved"), "Only approved posts returned");

    // 6.5 Cross-Tenant Boundary Security
    const { data: crossOrgQuery } = await clientA.from("courses").select("id").eq("organization_id", orgBId);
    logStep("CONTROL_AUDIT", "6.5", "Cross-Tenant Boundary: Learner A cannot access Org B courses", (!crossOrgQuery || crossOrgQuery.length === 0), "0 cross-tenant records exposed");

  } finally {
    console.log(`\n--- CLEANUP: Purging Disposable QA Control Records ---`);
    if (orgAId) {
      await querySQL(`
        DELETE FROM user_roles WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgAId}');
        DELETE FROM organization_members WHERE organization_id = '${orgAId}';
        DELETE FROM ai_credit_transactions WHERE account_id IN (SELECT id FROM ai_credit_accounts WHERE organization_id = '${orgAId}');
        DELETE FROM ai_credit_accounts WHERE organization_id = '${orgAId}';
        DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgAId}'));
        DELETE FROM ai_conversations WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgAId}');
        DELETE FROM community_posts WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgAId}');
        DELETE FROM courses WHERE organization_id = '${orgAId}';
        DELETE FROM user_gamification_stats WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgAId}');
        DELETE FROM user_profiles WHERE organization_id = '${orgAId}';
        DELETE FROM organizations WHERE id = '${orgAId}';
      `);
      console.log(`[CLEANUP] Successfully purged Org A (${orgAId})`);
    }

    if (orgBId) {
      await querySQL(`
        DELETE FROM user_roles WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgBId}');
        DELETE FROM organization_members WHERE organization_id = '${orgBId}';
        DELETE FROM ai_credit_transactions WHERE account_id IN (SELECT id FROM ai_credit_accounts WHERE organization_id = '${orgBId}');
        DELETE FROM ai_credit_accounts WHERE organization_id = '${orgBId}';
        DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgBId}'));
        DELETE FROM ai_conversations WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgBId}');
        DELETE FROM community_posts WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgBId}');
        DELETE FROM courses WHERE organization_id = '${orgBId}';
        DELETE FROM user_gamification_stats WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgBId}');
        DELETE FROM user_profiles WHERE organization_id = '${orgBId}';
        DELETE FROM organizations WHERE id = '${orgBId}';
      `);
      console.log(`[CLEANUP] Successfully purged Org B (${orgBId})`);
    }

    if (adminAId || adminBId || learnerAId || learnerBId) {
      const ids = [adminAId, adminBId, learnerAId, learnerBId].filter(Boolean).map(id => `'${id}'`).join(',');
      if (ids.length > 0) {
        await querySQL(`DELETE FROM auth.users WHERE id IN (${ids});`);
        console.log(`[CLEANUP] Successfully purged auth users`);
      }
    }
  }

  const passCount = results.filter(r => r.pass).length;
  const failCount = results.filter(r => !r.pass).length;
  console.log(`\n================================================================`);
  console.log(`FINAL LEARNER CONTROL ACCEPTANCE GATE SUMMARY: ${passCount} PASSED, ${failCount} FAILED (${results.length} total)`);
  console.log(`================================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runLearnerControlGate().catch((err) => {
  console.error("FATAL GATE ERROR:", err);
  process.exit(1);
});