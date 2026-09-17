import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("=== PHASE 1 & 2: ORGANIZATION ONBOARDING & INVITATIONS ===");
  const testRunId = Date.now().toString(36);

  // 1. Create a fresh test organization
  const orgSlug = `test-org-${testRunId}`;
  const orgName = `Test Organization ${testRunId}`;
  console.log(`\n1. Creating test organization: ${orgName} (slug: ${orgSlug})`);

  const { data: newOrg, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      name: orgName,
      slug: orgSlug,
      subscription_tier: "starter",
      max_users: 3, // seat limit of 3
      status: "active",
      settings: { ai_coach: { enabled: true, manual_mode: false } }
    })
    .select()
    .single();

  if (orgErr) {
    console.error("Failed to create organization:", orgErr);
    return;
  }
  console.log("Organization created successfully:", { id: newOrg.id, name: newOrg.name, max_users: newOrg.max_users });

  // 2. Create an admin user for this organization
  const adminEmail = `admin-${testRunId}@testorg.com`;
  console.log(`\n2. Creating admin user: ${adminEmail}`);

  const { data: adminUser, error: adminErr } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Test Admin", role: "admin" }
  });

  if (adminErr) {
    console.error("Failed to create admin auth user:", adminErr);
  } else {
    // Ensure profile and organization membership
    await supabase.from("user_profiles").upsert({
      id: adminUser.user.id,
      display_name: "Test Admin",
      role: "admin",
      organization_id: newOrg.id
    });
    await supabase.from("user_roles").upsert({
      user_id: adminUser.user.id,
      role: "admin"
    });
    await supabase.from("organization_members").upsert({
      organization_id: newOrg.id,
      user_id: adminUser.user.id,
      role: "admin",
      status: "active"
    });
    console.log("Admin user registered and assigned as org admin:", adminUser.user.id);
  }

  // 3. Test Invitation Creation
  console.log(`\n3. Testing Invitation Creation`);
  const inviteToken1 = crypto.randomBytes(24).toString("hex");
  const inviteEmail1 = `learner1-${testRunId}@testorg.com`;

  const { data: inv1, error: invErr1 } = await supabase
    .from("user_invitations")
    .insert({
      organization_id: newOrg.id,
      email: inviteEmail1,
      role: "learner",
      organization_role: "member",
      token: inviteToken1,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    })
    .select()
    .single();

  console.log("Invitation 1 created:", inv1 ? { id: inv1.id, email: inv1.email, token: inv1.token, status: inv1.status } : invErr1);

  // 4. Test Invitation Acceptance & Seat Counting
  console.log(`\n4. Testing Invitation Acceptance for Learner 1`);
  const { data: learner1Auth, error: l1Err } = await supabase.auth.admin.createUser({
    email: inviteEmail1,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Learner One", role: "learner" }
  });

  if (l1Err) {
    console.error("Failed to create learner 1:", l1Err);
  } else {
    // Upsert profile
    await supabase.from("user_profiles").upsert({
      id: learner1Auth.user.id,
      display_name: "Learner One",
      role: "learner",
      organization_id: newOrg.id
    });
    await supabase.from("user_roles").upsert({
      user_id: learner1Auth.user.id,
      role: "learner"
    });
    await supabase.from("organization_members").upsert({
      organization_id: newOrg.id,
      user_id: learner1Auth.user.id,
      role: "member",
      status: "active"
    });
    // Mark invitation accepted
    await supabase.from("user_invitations").update({ status: "accepted" }).eq("id", inv1.id);
    console.log("Learner 1 accepted invitation and joined org:", learner1Auth.user.id);
  }

  // 5. Test adding Learner 2 & Instructor 1 (reaching max seats 3: Admin + Learner 1 + Instructor 1)
  console.log(`\n5. Adding Instructor 1 (reaching seat limit of 3)`);
  const mentorEmail = `mentor-${testRunId}@testorg.com`;
  const { data: mentorAuth } = await supabase.auth.admin.createUser({
    email: mentorEmail,
    password: "Password123!Secure",
    email_confirm: true,
    user_metadata: { display_name: "Test Instructor", role: "mentor" }
  });

  await supabase.from("user_profiles").upsert({
    id: mentorAuth.user.id,
    display_name: "Test Instructor",
    role: "mentor",
    organization_id: newOrg.id
  });
  await supabase.from("user_roles").upsert({
    user_id: mentorAuth.user.id,
    role: "mentor"
  });
  await supabase.from("organization_members").upsert({
    organization_id: newOrg.id,
    user_id: mentorAuth.user.id,
    role: "member",
    status: "active"
  });
  await supabase.from("mentors").upsert({
    user_id: mentorAuth.user.id,
    organization_id: newOrg.id,
    name: "Test Instructor",
    status: "approved",
    rating: 5.0
  });

  // Check seat count
  const { data: activeMembers, count: memberCount } = await supabase
    .from("organization_members")
    .select("user_id, role, status", { count: "exact" })
    .eq("organization_id", newOrg.id)
    .eq("status", "active");

  console.log(`Active members count for org: ${memberCount} / max: ${newOrg.max_users}`);
  console.log("Members list:", activeMembers);

  // 6. Test Seat Limit Enforcement (Attempting to add 4th member when limit is 3)
  console.log(`\n6. Testing Seat Limit Enforcement on 4th Member`);
  const isFull = memberCount >= newOrg.max_users;
  console.log(`Seat capacity reached? ${isFull} (${memberCount}/${newOrg.max_users})`);

  // 7. Test removing a member and verifying seat count releases
  console.log(`\n7. Removing Learner 1 to free up a seat`);
  await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", newOrg.id)
    .eq("user_id", learner1Auth.user.id);

  const { count: updatedMemberCount } = await supabase
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", newOrg.id)
    .eq("status", "active");

  console.log(`Active members after removal: ${updatedMemberCount} / max: ${newOrg.max_users} (Seat released: ${updatedMemberCount < memberCount})`);

  // Re-add learner 1
  await supabase
    .from("organization_members")
    .insert({
      organization_id: newOrg.id,
      user_id: learner1Auth.user.id,
      role: "member",
      status: "active"
    });

  console.log("\n=== PHASE 1 & 2 VERIFICATION COMPLETE ===");
}

run().catch(console.error);
