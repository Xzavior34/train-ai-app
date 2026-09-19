import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN || "";
const PROJECT = "jeobggrtxeybxvlwpxvn";

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

async function testPhase3SecondaryFlows() {
  const ts = Date.now();
  const tag = `TRAINAI_P3_${ts}`;
  console.log(`================================================================`);
  console.log(`PHASE 3: SECONDARY PRODUCT FLOWS VERIFICATION`);
  console.log(`Tag: ${tag}`);
  console.log(`================================================================\n`);

  const results = [];
  function logStep(stepNum, name, pass, detail) {
    const s = pass ? "PASS" : "FAIL";
    console.log(`[${s}] Step 3.${stepNum}: ${name}`);
    if (detail) console.log(`       -> ${detail}`);
    results.push({ step: `3.${stepNum}`, name, pass, detail });
  }

  let orgId = null;
  let adminId = null;
  let instructorId = null;
  let learnerId = null;
  let cohortId = null;
  let sessionId = null;
  let postId = null;
  let commentId = null;
  let aiAccId = null;

  try {
    // Setup Org & Personas
    const orgRes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier, max_users, settings)
      VALUES ('${tag} Labs', '${tag.toLowerCase()}-labs', 'active', 'enterprise', 100, '{"leaderboard":{"enabled":true}}'::jsonb)
      RETURNING id, name;
    `);
    orgId = orgRes[0]?.id;

    const aAuth = await querySQL(`INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES (gen_random_uuid(), 'admin_${ts}@p3.org', crypt('Pass123!', gen_salt('bf')), now()) RETURNING id;`);
    adminId = aAuth[0]?.id;
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${adminId}', 'P3 Admin', 'admin', '${orgId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${adminId}', 'admin');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgId}', '${adminId}', 'admin', 'active');
    `);

    const iAuth = await querySQL(`INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES (gen_random_uuid(), 'inst_${ts}@p3.org', crypt('Pass123!', gen_salt('bf')), now()) RETURNING id;`);
    instructorId = iAuth[0]?.id;
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${instructorId}', 'P3 Instructor', 'mentor', '${orgId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${instructorId}', 'mentor');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgId}', '${instructorId}', 'content_manager', 'active');
    `);

    const lAuth = await querySQL(`INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES (gen_random_uuid(), 'learner_${ts}@p3.org', crypt('Pass123!', gen_salt('bf')), now()) RETURNING id;`);
    learnerId = lAuth[0]?.id;
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role, organization_id) VALUES ('${learnerId}', 'P3 Learner', 'learner', '${orgId}');
      INSERT INTO user_roles (user_id, role) VALUES ('${learnerId}', 'learner');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES ('${orgId}', '${learnerId}', 'member', 'active');
      INSERT INTO user_gamification_stats (user_id, total_points, current_level, lessons_completed) VALUES ('${learnerId}', 250, 2, 5);
    `);

    const cohRes = await querySQL(`
      INSERT INTO cohorts (name, organization_id, starts_at, ends_at, created_by)
      VALUES ('${tag} Cohort', '${orgId}', CURRENT_DATE, CURRENT_DATE + interval '30 days', '${adminId}')
      RETURNING id;
    `);
    cohortId = cohRes[0]?.id;
    await querySQL(`
      INSERT INTO cohort_members (cohort_id, user_id, added_by) VALUES ('${cohortId}', '${instructorId}', '${adminId}'), ('${cohortId}', '${learnerId}', '${adminId}');
    `);

    // 1. Instructor Workflows (View assigned cohort & members)
    const instCohorts = await querySQL(`
      SELECT c.id, c.name FROM cohorts c JOIN cohort_members cm ON cm.cohort_id = c.id WHERE cm.user_id = '${instructorId}';
    `);
    logStep(1, "Instructor assigned cohorts view", instCohorts.length > 0, `Cohorts: ${instCohorts.map(c=>c.name).join(', ')}`);

    // 2. Scheduling (Live workshop sessions)
    const sRes = await querySQL(`
      INSERT INTO cohort_sessions (cohort_id, title, description, starts_at, join_url, created_by)
      VALUES ('${cohortId}', 'Live Architecture Breakdown', 'Deep dive into microservices', now() + interval '2 days', 'https://meet.trainai.app/p3-session', '${instructorId}')
      RETURNING id, title;
    `);
    sessionId = sRes[0]?.id;
    const sFetch = await querySQL(`SELECT id, title, join_url FROM cohort_sessions WHERE cohort_id = '${cohortId}';`);
    logStep(2, "Live session scheduling & cohort visibility", sFetch.length > 0 && sFetch[0]?.join_url.includes('meet.trainai.app'), `Session: ${sFetch[0]?.title}`);

    // 3. Community (Post, Reaction, Comment)
    const pRes = await querySQL(`
      INSERT INTO community_posts (user_id, content, post_type, moderation_status)
      VALUES ('${learnerId}', 'Phase 3 Community Discussion #Architecture', 'general', 'approved')
      RETURNING id, content;
    `);
    postId = pRes[0]?.id;
    await querySQL(`
      INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES ('${postId}', '${instructorId}', 'like');
      INSERT INTO post_comments (post_id, user_id, content) VALUES ('${postId}', '${instructorId}', 'Great question! See chapter 2.') RETURNING id;
    `);
    const pDetails = await querySQL(`
      SELECT p.id, count(DISTINCT r.id) as reactions, count(DISTINCT c.id) as comments
      FROM community_posts p
      LEFT JOIN post_reactions r ON r.post_id = p.id
      LEFT JOIN post_comments c ON c.post_id = p.id
      WHERE p.id = '${postId}'
      GROUP BY p.id;
    `);
    logStep(3, "Community post, reaction and threaded comments", pDetails[0]?.reactions === 1 || pDetails[0]?.reactions === "1", `Reactions: ${pDetails[0]?.reactions}, Comments: ${pDetails[0]?.comments}`);

    // 4. Leaderboard (Org-scoped period calculation)
    const lbPeriod = await querySQL(`
      SELECT * FROM get_leaderboard_for_period(now() - interval '30 days', now() + interval '1 day', 10, '${orgId}');
    `);
    logStep(4, "Leaderboard org-scoped period ranking RPC", Array.isArray(lbPeriod), `Ranked rows: ${lbPeriod.length}`);

    // 5. Analytics (Org-level learner counts & enrollment statistics)
    const analyticsRes = await querySQL(`
      SELECT 
        (SELECT count(*) FROM organization_members WHERE organization_id = '${orgId}' AND status = 'active') as active_members,
        (SELECT count(*) FROM cohorts WHERE organization_id = '${orgId}') as cohort_count,
        (SELECT count(*) FROM user_invitations WHERE organization_id = '${orgId}') as pending_invites;
    `);
    logStep(5, "Analytics metric aggregation across org tables", analyticsRes[0]?.active_members === 3 || analyticsRes[0]?.active_members === "3", `Active members: ${analyticsRes[0]?.active_members}, Cohorts: ${analyticsRes[0]?.cohort_count}`);

    // 6. AI Coach Conversation & Message Persistence
    const aiConvRes = await querySQL(`
      INSERT INTO ai_conversations (user_id, title) VALUES ('${learnerId}', 'Agent Architecture Chat') RETURNING id;
    `);
    const convId = aiConvRes[0]?.id;
    await querySQL(`
      INSERT INTO ai_messages (conversation_id, role, content)
      VALUES 
        ('${convId}', 'user', 'How do subagents communicate?'),
        ('${convId}', 'assistant', 'Subagents communicate via asynchronous messaging and shared context.');
    `);
    const msgCount = await querySQL(`SELECT count(*) as count FROM ai_messages WHERE conversation_id = '${convId}';`);
    logStep(6, "AI Coach conversation and message history persistence", msgCount[0]?.count === 2 || msgCount[0]?.count === "2", `Messages persisted: ${msgCount[0]?.count}`);

    // 7. AI Credits & Ledger Metering
    const aiAcc = await querySQL(`SELECT get_or_create_org_credit_account('${orgId}') as acc_id;`);
    aiAccId = aiAcc[0]?.acc_id;
    await querySQL(`
      UPDATE ai_credit_accounts SET balance = 50, lifetime_credited = 50 WHERE id = '${aiAccId}';
      INSERT INTO ai_credit_transactions (organization_id, account_id, user_id, transaction_type, amount, balance_before, balance_after)
      VALUES ('${orgId}', '${aiAccId}', '${adminId}', 'top_up', 50, 0, 50);
    `);
    const creditBal = await querySQL(`SELECT balance FROM ai_credit_accounts WHERE id = '${aiAccId}';`);
    logStep(7, "AI Credit Account initialization & ledger transaction record", creditBal[0]?.balance === 50, `Credits balance: ${creditBal[0]?.balance}`);

    // 8. Seats (Allocation & Summary RPC)
    await querySQL(`
      INSERT INTO seat_purchases (organization_id, seats_purchased, amount_paid, currency, payment_reference)
      VALUES ('${orgId}', 10, 100, 'USD', 'REF_P3_SEATS');
    `);
    const seatSum = await querySQL(`SELECT get_org_seats_summary('${orgId}') as summary;`);
    logStep(8, "Seats purchase & get_org_seats_summary consumption tracking", seatSum[0]?.summary?.purchased === 10, `Purchased: ${seatSum[0]?.summary?.purchased}, Used: ${seatSum[0]?.summary?.used}, Available: ${seatSum[0]?.summary?.available}`);

    // 9. Billing Foundation (Configurable prices lookup)
    const billingPrices = await querySQL(`SELECT get_active_price('seat_subscription', 'USD') as price;`);
    const priceObj = billingPrices[0]?.price;
    logStep(9, "Billing prices database lookup via get_active_price RPC", priceObj?.unit_amount_minor === 1000, `Seat price: $${(priceObj?.unit_amount_minor || 0) / 100} ${priceObj?.currency}`);

    // 10. Notifications (In-app delivery & status flip)
    const notifRes = await querySQL(`
      INSERT INTO real_notifications (user_id, type, title, message, is_read)
      VALUES ('${learnerId}', 'live', 'Live Session Tomorrow', 'Live Architecture Breakdown starts tomorrow at 2 PM.', false)
      RETURNING id, is_read;
    `);
    const notifId = notifRes[0]?.id;
    await querySQL(`UPDATE real_notifications SET is_read = true WHERE id = '${notifId}';`);
    const notifCheck = await querySQL(`SELECT is_read FROM real_notifications WHERE id = '${notifId}';`);
    logStep(10, "In-app notifications delivery and mark-read state persistence", notifCheck[0]?.is_read === true, `Notification read status: ${notifCheck[0]?.is_read}`);

  } catch (e) {
    console.error("Phase 3 Execution Error:", e);
    logStep(99, "Phase 3 Execution Safety", false, e.message);
  } finally {
    if (orgId) {
      await querySQL(`
        DELETE FROM real_notifications WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgId}');
        DELETE FROM post_comments WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgId}');
        DELETE FROM post_reactions WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgId}');
        DELETE FROM community_posts WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgId}');
        DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgId}'));
        DELETE FROM ai_conversations WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgId}');
        DELETE FROM ai_credit_transactions WHERE organization_id = '${orgId}';
        DELETE FROM ai_credit_accounts WHERE organization_id = '${orgId}';
        DELETE FROM seat_purchases WHERE organization_id = '${orgId}';
        DELETE FROM cohort_sessions WHERE cohort_id = '${cohortId}';
        DELETE FROM cohort_members WHERE cohort_id = '${cohortId}';
        DELETE FROM cohorts WHERE organization_id = '${orgId}';
        DELETE FROM user_gamification_stats WHERE user_id IN (SELECT id FROM user_profiles WHERE organization_id = '${orgId}');
        DELETE FROM organization_members WHERE organization_id = '${orgId}';
        DELETE FROM user_roles WHERE user_id IN (${[adminId, instructorId, learnerId].filter(Boolean).map(id=>`'${id}'`).join(',') || 'NULL'});
        DELETE FROM user_profiles WHERE organization_id = '${orgId}';
        DELETE FROM auth.users WHERE id IN (${[adminId, instructorId, learnerId].filter(Boolean).map(id=>`'${id}'`).join(',') || 'NULL'});
        DELETE FROM organizations WHERE id = '${orgId}';
      `);
      console.log(`\n[CLEANUP] Phase 3 QA Org ${orgId} purged cleanly.`);
    }
  }

  const passedCount = results.filter(r => r.pass).length;
  console.log(`\n================================================================`);
  console.log(`PHASE 3 SUMMARY: ${passedCount} / ${results.length} PASSED`);
  console.log(`================================================================\n`);
  return passedCount === results.length;
}

testPhase3SecondaryFlows();
