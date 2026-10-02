import { getSupabaseClientForProject, SUPABASE_PROJECTS } from '../src/services/supabaseClient.js';

async function auditProject(projectName, projectKey) {
  console.log(`\n======================================================`);
  console.log(`AUDITING PROJECT: ${projectName} (${projectKey})`);
  console.log(`======================================================`);
  
  const client = getSupabaseClientForProject(projectKey);
  if (!client) {
    console.error(`Client not configured for ${projectName}`);
    return;
  }

  // 1. Fetch all organizations
  const { data: orgs, error: orgsErr } = await client.from('organizations').select('id, name, slug, status');
  if (orgsErr) {
    console.error('Error fetching organizations:', orgsErr);
    return;
  }
  console.log(`\nOrganizations found (${orgs?.length || 0}):`);
  orgs?.forEach(o => console.log(`  - [${o.id}] "${o.name}" (slug: ${o.slug}, status: ${o.status})`));

  // 2. Fetch all user profiles
  const { data: profiles, error: profErr } = await client.from('user_profiles').select('id, display_name, created_at');
  if (profErr) {
    console.error('Error fetching user_profiles:', profErr);
    return;
  }
  console.log(`\nUser Profiles found (${profiles?.length || 0})`);

  // 3. Fetch all organization members
  const { data: members, error: memErr } = await client.from('organization_members').select('id, organization_id, user_id, role, status');
  if (memErr) {
    console.error('Error fetching organization_members:', memErr);
    return;
  }
  console.log(`Organization Members records found (${members?.length || 0})`);

  // 4. Fetch all user roles
  const { data: roles, error: rolesErr } = await client.from('user_roles').select('id, user_id, role, organization_id');
  if (rolesErr) {
    console.error('Error fetching user_roles:', rolesErr);
    return;
  }
  console.log(`User Roles records found (${roles?.length || 0})`);

  // Map users to their org memberships
  const userMemberships = new Map();
  members?.forEach(m => {
    if (!userMemberships.has(m.user_id)) userMemberships.set(m.user_id, []);
    userMemberships.get(m.user_id).push(m);
  });

  const usersWithoutOrg = [];
  const usersWithOrg = [];

  profiles?.forEach(u => {
    const userMems = userMemberships.get(u.id) || [];
    if (userMems.length === 0) {
      usersWithoutOrg.push(u);
    } else {
      usersWithOrg.push({ user: u, memberships: userMems });
    }
  });

  console.log(`\n--- MEMBERSHIP SUMMARY ---`);
  console.log(`Total Users: ${profiles?.length || 0}`);
  console.log(`Users with Organization: ${usersWithOrg.length}`);
  console.log(`Users WITHOUT Organization: ${usersWithoutOrg.length}`);

  if (usersWithoutOrg.length > 0) {
    console.log(`\n⚠️ USERS MISSING ORGANIZATION MEMBERSHIP:`);
    usersWithoutOrg.forEach(u => console.log(`  - [${u.id}] ${u.display_name}`));
  } else {
    console.log(`\n✅ ALL users in this database are tied to at least one organization!`);
  }
}

async function run() {
  await auditProject('Train AI Shared Multi-Tenant Database', SUPABASE_PROJECTS.ORGANIZATION_DB);
  await auditProject('Sara Foundation Dedicated Database', SUPABASE_PROJECTS.SARA_FOUNDATION);
}

run().catch(console.error);
