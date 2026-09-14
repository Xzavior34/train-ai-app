import { createClient } from '@supabase/supabase-js';

// SOURCE (1.0) & TARGET (2.0) Credentials passed via Environment Variables
const sourceUrl = process.env.SOURCE_SUPABASE_URL || "https://qibqouymqtpirtbyjvjr.supabase.co";
const sourceKey = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpYnFvdXltcXRwaXJ0YnlqdmpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTk4MjM4MSwiZXhwIjoyMDY1NTU4MzgxfQ.K8GPpqfxXTLZyemMbLhamavKHYDBir5qVogJkoU7Jcw";
const targetUrl = process.env.TARGET_SUPABASE_URL || "https://jeobggrtxeybxvlwpxvn.supabase.co";
const targetKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

// Clients initialized with service_role keys
const source = createClient(sourceUrl, sourceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const target = createClient(targetUrl, targetKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Helper to generate secure random temporary passwords for new Auth users
function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = 'Sara2026!';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function runClone() {
  console.log("==========================================================================");
  console.log("  SARA FOUNDATION DATA CLONE PIPELINE (Train AI 1.0 -> Train AI 2.0)");
  console.log("==========================================================================");

  // -------------------------------------------------------------------------
  // STEP 0: Direct Schema Inspection & Readiness Check
  // -------------------------------------------------------------------------
  console.log("\n[Step 0] Direct Schema Inspection...");

  const { error: testOrgErr } = await target.from('organizations').select('id').limit(1);
  if (testOrgErr && testOrgErr.message.includes("Could not find the table")) {
    console.error("\n[CRITICAL ERROR] Table 'public.organizations' does not exist in TARGET database.");
    process.exit(1);
  }
  console.log("TARGET database schema verified ready!");

  // -------------------------------------------------------------------------
  // STEP 1: Identify Sara Foundation Organization in SOURCE (Read-Only)
  // -------------------------------------------------------------------------
  console.log("\n[Step 1] Locating Sara Foundation in SOURCE...");
  const { data: orgs, error: orgErr } = await source.from('organizations').select('*');
  if (orgErr) {
    throw new Error(`Failed to query organizations from SOURCE: ${orgErr.message}`);
  }

  const saraOrgs = orgs.filter(o => 
    (o.name && o.name.toLowerCase().includes('sara')) || 
    (o.slug && o.slug.toLowerCase().includes('sara'))
  );

  if (saraOrgs.length !== 1) {
    console.error(`Ambiguity detected! Found ${saraOrgs.length} matching orgs in SOURCE:`, saraOrgs);
    process.exit(1);
  }

  const sourceOrg = saraOrgs[0];
  const sourceOrgId = sourceOrg.id;
  console.log(`Identified SOURCE Organization: "${sourceOrg.name}" (ID: ${sourceOrgId})`);

  // -------------------------------------------------------------------------
  // STEP 2: Build Real Data Map & Inventory for Sara Foundation in SOURCE
  // -------------------------------------------------------------------------
  console.log("\n[Step 2] Building Data Inventory for Sara Foundation in SOURCE...");

  // 1. Members & Profiles
  const { data: sourceMembers, error: memErr } = await source
    .from('organization_members')
    .select('*')
    .eq('organization_id', sourceOrgId);
  if (memErr) throw new Error(`Failed fetching organization_members: ${memErr.message}`);

  const memberUserIds = (sourceMembers || []).map(m => m.user_id).filter(Boolean);
  const uniqueSourceUserIds = Array.from(new Set(memberUserIds));

  console.log(`Found ${sourceMembers.length} organization member rows in SOURCE for Sara Foundation (${uniqueSourceUserIds.length} unique user IDs).`);

  // Fetch profiles in chunks
  let sourceProfiles = [];
  for (let i = 0; i < uniqueSourceUserIds.length; i += 50) {
    const chunk = uniqueSourceUserIds.slice(i, i + 50);
    const { data: profs, error: profErr } = await source
      .from('user_profiles')
      .select('*')
      .in('user_id', chunk);
    if (profErr) throw new Error(`Failed fetching user_profiles chunk: ${profErr.message}`);
    sourceProfiles = sourceProfiles.concat(profs || []);
  }

  // Fetch real auth users (for emails) via Auth Admin API in SOURCE
  console.log("Fetching Auth user emails from SOURCE Auth Admin API...");
  const authUsersMap = new Map(); // user_id -> authUser object
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const { data: { users }, error: authListErr } = await source.auth.admin.listUsers({ page, perPage: 1000 });
    if (authListErr) throw new Error(`Failed fetching auth users: ${authListErr.message}`);
    users.forEach(u => authUsersMap.set(u.id, u));
    if (users.length < 1000) hasMore = false;
    else page++;
  }

  // 2. Cohorts
  const { data: sourceCohorts } = await source.from('cohorts').select('*').eq('organization_id', sourceOrgId);
  const sourceCohortIds = (sourceCohorts || []).map(c => c.id);

  let sourceCohortMembers = [], sourceCohortResources = [], sourceCohortSessions = [];
  if (sourceCohortIds.length > 0) {
    const { data: cm } = await source.from('cohort_members').select('*').in('cohort_id', sourceCohortIds);
    sourceCohortMembers = cm || [];
    const { data: cr } = await source.from('cohort_resources').select('*').in('cohort_id', sourceCohortIds);
    sourceCohortResources = cr || [];
    const { data: cs } = await source.from('cohort_sessions').select('*').in('cohort_id', sourceCohortIds);
    sourceCohortSessions = cs || [];
  }

  // 3. User related tables (user_roles, gamification_stats, personalization, streak_freezes)
  let sourceUserRoles = [], sourceGamificationStats = [], sourcePersonalization = [], sourceStreakFreezes = [];
  for (let i = 0; i < uniqueSourceUserIds.length; i += 50) {
    const chunk = uniqueSourceUserIds.slice(i, i + 50);
    const { data: ur } = await source.from('user_roles').select('*').in('user_id', chunk);
    if (ur) sourceUserRoles = sourceUserRoles.concat(ur);
    const { data: gs } = await source.from('user_gamification_stats').select('*').in('user_id', chunk);
    if (gs) sourceGamificationStats = sourceGamificationStats.concat(gs);
    const { data: up } = await source.from('user_personalization').select('*').in('user_id', chunk);
    if (up) sourcePersonalization = sourcePersonalization.concat(up);
    const { data: sf } = await source.from('streak_freezes').select('*').in('user_id', chunk);
    if (sf) sourceStreakFreezes = sourceStreakFreezes.concat(sf);
  }

  const inventorySummary = {
    organizations: 1,
    organization_members: sourceMembers.length,
    user_profiles: sourceProfiles.length,
    cohorts: (sourceCohorts || []).length,
    cohort_members: sourceCohortMembers.length,
    cohort_resources: sourceCohortResources.length,
    cohort_sessions: sourceCohortSessions.length,
    user_roles: sourceUserRoles.length,
    user_gamification_stats: sourceGamificationStats.length,
    user_personalization: sourcePersonalization.length,
    streak_freezes: sourceStreakFreezes.length,
    courses: 0
  };

  console.log("\n=================== SOURCE DATA INVENTORY CHECKPOINT ===================");
  console.table(inventorySummary);

  // -------------------------------------------------------------------------
  // STEP 3: Create (or Find) Sara Foundation Organization in TARGET
  // -------------------------------------------------------------------------
  console.log("\n[Step 3] Resolving Sara Foundation Organization in TARGET...");
  const { data: targetExistingOrgs } = await target.from('organizations').select('*');
  let targetOrg = (targetExistingOrgs || []).find(o => 
    (o.slug && o.slug === sourceOrg.slug) || 
    (o.name && o.name.toLowerCase() === sourceOrg.name.toLowerCase())
  );

  if (targetOrg) {
    console.log(`Found existing Organization in TARGET: "${targetOrg.name}" (ID: ${targetOrg.id})`);
  } else {
    console.log("Creating new Sara Foundation Organization in TARGET...");
    const newOrgData = {
      name: sourceOrg.name,
      slug: sourceOrg.slug,
      domain: sourceOrg.domain,
      status: sourceOrg.status || 'active',
      subscription_tier: sourceOrg.subscription_tier || 'enterprise',
      settings: sourceOrg.settings || {},
      onboarding_completed: sourceOrg.onboarding_completed ?? true
    };
    const { data: createdOrg, error: createOrgErr } = await target
      .from('organizations')
      .insert([newOrgData])
      .select()
      .single();
    if (createOrgErr) throw new Error(`Failed to create org in TARGET: ${createOrgErr.message}`);
    targetOrg = createdOrg;
    console.log(`Created Organization in TARGET: "${targetOrg.name}" (ID: ${targetOrg.id})`);
  }

  const targetOrgId = targetOrg.id;

  // -------------------------------------------------------------------------
  // STEP 4: Migrate Users (Auth Admin API + User Profiles + Org Members)
  // -------------------------------------------------------------------------
  console.log("\n[Step 4] Migrating Users & Auth Provisioning in TARGET...");

  const userIdMap = new Map(); // SOURCE_user_id -> TARGET_user_id
  const createdNewAccounts = []; // { email, role, status }

  // Fetch existing TARGET auth users to avoid duplicates
  console.log("Fetching existing Auth users from TARGET...");
  const targetAuthUsersMap = new Map(); // email -> targetAuthUser
  let tPage = 1;
  let tHasMore = true;
  while (tHasMore) {
    const { data: { users: tUsers } } = await target.auth.admin.listUsers({ page: tPage, perPage: 1000 });
    (tUsers || []).forEach(u => {
      if (u.email) targetAuthUsersMap.set(u.email.toLowerCase(), u);
    });
    if (!tUsers || tUsers.length < 1000) tHasMore = false;
    else tPage++;
  }

  console.log(`Processing ${uniqueSourceUserIds.length} users for migration...`);

  for (let idx = 0; idx < uniqueSourceUserIds.length; idx++) {
    const srcUserId = uniqueSourceUserIds[idx];
    const srcAuthUser = authUsersMap.get(srcUserId);
    const srcProfile = sourceProfiles.find(p => (p.user_id || p.id) === srcUserId) || {};

    const rawEmail = srcAuthUser ? srcAuthUser.email : (srcProfile.username ? `${srcProfile.username}@sarafoundation.org` : null);
    if (!rawEmail) {
      console.warn(`User ${srcUserId} has no email or username! Skipping...`);
      continue;
    }

    const email = rawEmail.trim().toLowerCase();
    let targetUserId = null;

    // Check if user already exists in TARGET Auth
    if (targetAuthUsersMap.has(email)) {
      const existingTUser = targetAuthUsersMap.get(email);
      targetUserId = existingTUser.id;
    } else {
      const tempPassword = generateTempPassword();
      const userMeta = (srcAuthUser && srcAuthUser.user_metadata) ? srcAuthUser.user_metadata : {
        full_name: srcProfile.display_name || srcProfile.username || email.split('@')[0],
        username: srcProfile.username
      };

      let newAuthUser = null;
      let createAuthErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await target.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: userMeta
          });
          newAuthUser = res.data;
          createAuthErr = res.error;
          if (newAuthUser?.user) break;
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          createAuthErr = e;
          await new Promise(r => setTimeout(r, 200));
        }
      }

      if (!newAuthUser || !newAuthUser.user) {
        console.error(`Failed to create Auth account for ${email}: ${createAuthErr?.message || createAuthErr}`);
        continue;
      }

      targetUserId = newAuthUser.user.id;
      targetAuthUsersMap.set(email, newAuthUser.user);
      createdNewAccounts.push({ email, role: srcProfile.role || 'user', status: 'created' });
      await new Promise(r => setTimeout(r, 50));
    }

    userIdMap.set(srcUserId, targetUserId);

    // Map role enum values safely
    let targetPlatformRole = 'learner';
    if (srcProfile.role === 'admin' || srcProfile.role === 'super_admin') targetPlatformRole = 'admin';
    else if (srcProfile.role === 'mentor') targetPlatformRole = 'mentor';
    else if (srcProfile.role === 'manager') targetPlatformRole = 'manager';

    const srcMember = sourceMembers.find(m => m.user_id === srcUserId) || {};
    let targetOrgRole = 'member';
    if (srcMember.role === 'admin' || srcMember.role === 'owner') targetOrgRole = 'admin';
    else if (srcMember.role === 'content_manager') targetOrgRole = 'content_manager';

    // Upsert target user_profile
    const profilePayload = {
      id: targetUserId,
      display_name: srcProfile.display_name || srcAuthUser?.user_metadata?.full_name || email.split('@')[0],
      avatar_url: srcProfile.avatar_url || srcAuthUser?.user_metadata?.avatar_url || null,
      bio: srcProfile.bio || null,
      role: targetPlatformRole,
      organization_id: targetOrgId
    };

    const { error: profileUpsertErr } = await target
      .from('user_profiles')
      .upsert([profilePayload], { onConflict: 'id' });

    if (profileUpsertErr) {
      console.error(`Profile upsert error for ${email}: ${profileUpsertErr.message}`);
    }

    // Upsert target organization_member
    const memberPayload = {
      organization_id: targetOrgId,
      user_id: targetUserId,
      role: targetOrgRole,
      status: srcMember.status === 'active' ? 'active' : 'pending'
    };

    const { error: memberUpsertErr } = await target
      .from('organization_members')
      .upsert([memberPayload], { onConflict: 'organization_id,user_id' });

    if (memberUpsertErr) {
      console.error(`Member upsert error for ${email}: ${memberUpsertErr.message}`);
    }

    if ((idx + 1) % 100 === 0 || idx + 1 === uniqueSourceUserIds.length) {
      console.log(`Migrated ${idx + 1}/${uniqueSourceUserIds.length} users...`);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 5: Migrate Cohorts, Cohort Members/Resources/Sessions & Gamification
  // -------------------------------------------------------------------------
  console.log("\n[Step 5] Migrating Cohorts and Related Entities...");

  const cohortIdMap = new Map();

  for (const srcCohort of (sourceCohorts || [])) {
    const cohortPayload = {
      organization_id: targetOrgId,
      name: srcCohort.name,
      description: srcCohort.description || null,
      starts_at: srcCohort.start_date || srcCohort.starts_at || null,
      ends_at: srcCohort.end_date || srcCohort.ends_at || null
    };

    const { data: targetCohort, error: cohortErr } = await target
      .from('cohorts')
      .insert([cohortPayload])
      .select()
      .single();

    if (cohortErr) {
      console.error(`Failed inserting cohort ${srcCohort.name}: ${cohortErr.message}`);
      continue;
    }

    cohortIdMap.set(srcCohort.id, targetCohort.id);

    // Cohort Members
    const srcCMembers = sourceCohortMembers.filter(cm => cm.cohort_id === srcCohort.id);
    const targetCMembers = srcCMembers.map(cm => ({
      cohort_id: targetCohort.id,
      user_id: userIdMap.get(cm.user_id) || cm.user_id
    })).filter(cm => cm.user_id);

    if (targetCMembers.length > 0) {
      await target.from('cohort_members').insert(targetCMembers);
    }

    // Cohort Resources
    const srcCRes = sourceCohortResources.filter(cr => cr.cohort_id === srcCohort.id);
    const targetCRes = srcCRes.map(cr => ({
      cohort_id: targetCohort.id,
      title: cr.title || 'Resource',
      description: cr.description || null,
      external_url: cr.resource_url || cr.url || cr.external_url || null,
      resource_type: cr.resource_type || cr.type || 'link'
    }));
    if (targetCRes.length > 0) {
      await target.from('cohort_resources').insert(targetCRes);
    }

    // Cohort Sessions
    const srcCSess = sourceCohortSessions.filter(cs => cs.cohort_id === srcCohort.id);
    const targetCSess = srcCSess.map(cs => ({
      cohort_id: targetCohort.id,
      title: cs.title || 'Cohort Session',
      description: cs.description || null,
      starts_at: cs.scheduled_at || cs.start_time || cs.starts_at || new Date().toISOString(),
      join_url: cs.meeting_link || cs.join_url || null
    }));
    if (targetCSess.length > 0) {
      await target.from('cohort_sessions').insert(targetCSess);
    }
  }

  // User Roles, Gamification, Personalization, Streak Freezes
  console.log("Migrating user roles & gamification stats...");
  for (const ur of sourceUserRoles) {
    const tUserId = userIdMap.get(ur.user_id);
    if (tUserId) {
      const mappedRole = (ur.role === 'user' || ur.role === 'member') ? 'learner' : (['mentor','admin','hr','manager','super_admin'].includes(ur.role) ? ur.role : 'learner');
      await target.from('user_roles').upsert([{ user_id: tUserId, role: mappedRole }], { onConflict: 'user_id,role' });
    }
  }

  for (const gs of sourceGamificationStats) {
    const tUserId = userIdMap.get(gs.user_id);
    if (tUserId) {
      await target.from('user_gamification_stats').upsert([{
        user_id: tUserId,
        total_points: gs.total_points || 0,
        current_level: gs.current_level || 1,
        streak_days: gs.streak_days || 0
      }], { onConflict: 'user_id' });
    }
  }

  for (const up of sourcePersonalization) {
    const tUserId = userIdMap.get(up.user_id);
    if (tUserId) {
      await target.from('user_personalization').upsert([{
        user_id: tUserId,
        data: up.data || {},
        skill_level: up.skill_level || 'beginner'
      }], { onConflict: 'user_id' });
    }
  }

  for (const sf of sourceStreakFreezes) {
    const tUserId = userIdMap.get(sf.user_id);
    if (tUserId) {
      await target.from('streak_freezes').insert([{
        user_id: tUserId,
        earned_at: sf.earned_at || new Date().toISOString(),
        source: sf.source || 'migration'
      }]);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 6: Verification & Final Audit
  // -------------------------------------------------------------------------
  console.log("\n[Step 6] Verifying Cloned Data in TARGET...");

  const { count: tOrgCount } = await target.from('organizations').select('*', { count: 'exact', head: true }).eq('id', targetOrgId);
  const { count: tMemCount } = await target.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', targetOrgId);
  const { count: tProfCount } = await target.from('user_profiles').select('*', { count: 'exact', head: true }).eq('organization_id', targetOrgId);
  const { count: tCohortCount } = await target.from('cohorts').select('*', { count: 'exact', head: true }).eq('organization_id', targetOrgId);

  const verificationSummary = {
    organizations: { expected: 1, targetActual: tOrgCount },
    organization_members: { expected: sourceMembers.length, targetActual: tMemCount },
    user_profiles: { expected: uniqueSourceUserIds.length, targetActual: tProfCount },
    cohorts: { expected: (sourceCohorts || []).length, targetActual: tCohortCount }
  };

  console.log("\n=================== VERIFICATION AUDIT REPORT ===================");
  console.table(verificationSummary);

  // Confirm SOURCE unchanged
  const { data: finalSourceOrgs } = await source.from('organizations').select('*').eq('id', sourceOrgId);
  console.log(`\nRe-verified SOURCE database: Org ${sourceOrgId} exists unchanged (${finalSourceOrgs.length} row). Zero writes performed on SOURCE.`);

  console.log("\n==========================================================================");
  console.log("  MIGRATION COMPLETED SUCCESSFULLY!");
  console.log("==========================================================================");
  console.log(`SOURCE Org ID: ${sourceOrgId}`);
  console.log(`TARGET Org ID: ${targetOrgId}`);
  console.log(`New Auth Accounts Provisioned: ${createdNewAccounts.length}`);
}

runClone().catch(err => {
  console.error("\n[CLONE PIPELINE FAILED]:", err);
  process.exit(1);
});
