import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const targetEmail1 = "trainai@gmail.com";
  const targetEmail2 = "trainailtd@gmail.com";
  const newPassword = "SaraF123$";

  console.log("Searching for users with email matching:", targetEmail1, "or", targetEmail2);

  const { data: authUsers, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("Error listing users:", listErr);
    return;
  }

  const matches = authUsers.users.filter(u => 
    u.email?.toLowerCase().includes("trainai") || 
    u.email?.toLowerCase().includes("sara") ||
    u.email?.toLowerCase() === targetEmail1 ||
    u.email?.toLowerCase() === targetEmail2
  );

  console.log("Found matches in Auth users:", matches.map(u => ({ id: u.id, email: u.email })));

  // If trainai@gmail.com exists, update password
  let user1 = authUsers.users.find(u => u.email?.toLowerCase() === targetEmail1);
  if (user1) {
    const { data: updated, error: uErr } = await supabase.auth.admin.updateUserById(user1.id, {
      password: newPassword,
      email_confirm: true
    });
    console.log(`Updated password for ${targetEmail1}:`, updated?.user?.id, uErr?.message || "SUCCESS");
  } else {
    // Create user if it does not exist
    console.log(`${targetEmail1} does not exist in Auth. Creating account...`);
    const { data: created, error: cErr } = await supabase.auth.admin.createUser({
      email: targetEmail1,
      password: newPassword,
      email_confirm: true,
      user_metadata: { display_name: "Platform Owner", role: "super_admin" }
    });
    console.log(`Created ${targetEmail1}:`, created?.user?.id, cErr?.message || "SUCCESS");
    if (created?.user) {
      await supabase.from("user_profiles").upsert({
        id: created.user.id,
        display_name: "Platform Owner",
        role: "super_admin"
      });
      await supabase.from("user_roles").upsert({
        user_id: created.user.id,
        role: "super_admin"
      });
    }
  }

  // Also check trainailtd@gmail.com if it exists, update its password too
  let user2 = authUsers.users.find(u => u.email?.toLowerCase() === targetEmail2);
  if (user2) {
    const { data: updated2, error: uErr2 } = await supabase.auth.admin.updateUserById(user2.id, {
      password: newPassword,
      email_confirm: true
    });
    console.log(`Updated password for ${targetEmail2}:`, updated2?.user?.id, uErr2?.message || "SUCCESS");
  }
}

main().catch(console.error);
