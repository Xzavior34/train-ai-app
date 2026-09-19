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

async function testPhase4PlatformOwner() {
  const ts = Date.now();
  const tag = `TRAINAI_P4_${ts}`;
  console.log(`================================================================`);
  console.log(`PHASE 4: PLATFORM OWNER GLOBAL WORKFLOWS VERIFICATION`);
  console.log(`Tag: ${tag}`);
  console.log(`================================================================\n`);

  const results = [];
  function logStep(stepNum, name, pass, detail) {
    const s = pass ? "PASS" : "FAIL";
    console.log(`[${s}] Step 4.${stepNum}: ${name}`);
    if (detail) console.log(`       -> ${detail}`);
    results.push({ step: `4.${stepNum}`, name, pass, detail });
  }

  let ownerUserId = null;
  let testOrgId = null;

  try {
    // 1. Provision Platform Owner User
    const ownerAuth = await querySQL(`
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
      VALUES (gen_random_uuid(), 'owner_${ts}@trainai-hq.com', crypt('OwnerPass123!', gen_salt('bf')), now())
      RETURNING id;
    `);
    ownerUserId = ownerAuth[0]?.id;
    await querySQL(`
      INSERT INTO user_profiles (id, display_name, role) VALUES ('${ownerUserId}', 'Platform SuperAdmin', 'super_admin');
      INSERT INTO user_roles (user_id, role) VALUES ('${ownerUserId}', 'super_admin');
    `);
    const isSuper = await querySQL(`SELECT is_super_admin('${ownerUserId}') as is_super;`);
    logStep(1, "Platform Owner super_admin verification RPC", isSuper[0]?.is_super === true, `SuperAdmin status: ${isSuper[0]?.is_super}`);

    // 2. Global Organization Visibility
    const allOrgs = await querySQL(`
      SELECT o.id, o.name, o.status, o.subscription_tier, count(om.id) as member_count
      FROM organizations o
      LEFT JOIN organization_members om ON om.organization_id = o.id
      GROUP BY o.id
      LIMIT 10;
    `);
    logStep(2, "Global cross-tenant organization inventory and member aggregation", allOrgs.length > 0, `Discovered ${allOrgs.length} active organizations`);

    // 3. Create QA Tenant as Platform Owner
    const orgRes = await querySQL(`
      INSERT INTO organizations (name, slug, status, subscription_tier, max_users, created_by)
      VALUES ('${tag} Global Corp', '${tag.toLowerCase()}-global', 'active', 'enterprise', 200, '${ownerUserId}')
      RETURNING id, name;
    `);
    testOrgId = orgRes[0]?.id;
    logStep(3, "Platform Owner provisions new enterprise tenant", !!testOrgId, `Org ID: ${testOrgId}`);

    // 4. Set Tenant Feature Flag Override
    await querySQL(`
      INSERT INTO organization_feature_flags (organization_id, feature_key, enabled, set_by, negotiated_price_minor, currency)
      VALUES ('${testOrgId}', 'ai_intelligence_advanced', true, '${ownerUserId}', 5000, 'USD')
      ON CONFLICT (organization_id, feature_key) DO UPDATE SET enabled = true;
    `);
    const flagCheck = await querySQL(`
      SELECT enabled, negotiated_price_minor FROM organization_feature_flags WHERE organization_id = '${testOrgId}' AND feature_key = 'ai_intelligence_advanced';
    `);
    logStep(4, "Platform Owner configures custom tenant feature override & pricing", flagCheck[0]?.enabled === true && (flagCheck[0]?.negotiated_price_minor === "5000" || flagCheck[0]?.negotiated_price_minor === 5000), `Flag enabled: ${flagCheck[0]?.enabled}, Price: $${(flagCheck[0]?.negotiated_price_minor || 0)/100}`);

    // 5. Suspend and Reactivate Tenant
    await querySQL(`UPDATE organizations SET status = 'suspended' WHERE id = '${testOrgId}';`);
    const suspCheck = await querySQL(`SELECT status FROM organizations WHERE id = '${testOrgId}';`);
    await querySQL(`UPDATE organizations SET status = 'active' WHERE id = '${testOrgId}';`);
    const reactCheck = await querySQL(`SELECT status FROM organizations WHERE id = '${testOrgId}';`);
    logStep(5, "Platform Owner suspend / reactivate tenant status lifecycle", suspCheck[0]?.status === 'suspended' && reactCheck[0]?.status === 'active', `Suspended: ${suspCheck[0]?.status} -> Reactivated: ${reactCheck[0]?.status}`);

    // 6. Global Platform Settings & Academy Commission
    const commConfig = await querySQL(`
      INSERT INTO academy_commission_configs (organization_id, commission_percent, created_by)
      VALUES ('${testOrgId}', 15.5, '${ownerUserId}')
      RETURNING commission_percent;
    `);
    logStep(6, "Academy commission configuration and platform fee settings", commConfig[0]?.commission_percent === "15.50" || commConfig[0]?.commission_percent === "15.5" || commConfig[0]?.commission_percent === 15.5, `Commission rate: ${commConfig[0]?.commission_percent}%`);

  } catch (e) {
    console.error("Phase 4 Execution Error:", e);
    logStep(99, "Phase 4 Execution Safety", false, e.message);
  } finally {
    if (testOrgId) {
      await querySQL(`
        DELETE FROM academy_commission_configs WHERE organization_id = '${testOrgId}';
        DELETE FROM organization_feature_flags WHERE organization_id = '${testOrgId}';
        DELETE FROM organizations WHERE id = '${testOrgId}';
        DELETE FROM user_roles WHERE user_id = '${ownerUserId}';
        DELETE FROM user_profiles WHERE id = '${ownerUserId}';
        DELETE FROM auth.users WHERE id = '${ownerUserId}';
      `);
      console.log(`\n[CLEANUP] Phase 4 QA Org ${testOrgId} purged cleanly.`);
    }
  }

  const passedCount = results.filter(r => r.pass).length;
  console.log(`\n================================================================`);
  console.log(`PHASE 4 SUMMARY: ${passedCount} / ${results.length} PASSED`);
  console.log(`================================================================\n`);
  return passedCount === results.length;
}

testPhase4PlatformOwner();
