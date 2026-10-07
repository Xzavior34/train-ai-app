import { createClient } from "@supabase/supabase-js";


const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_EMAILS = (process.env.ADMIN_PASSWORD_RESET_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const NEW_PASSWORD = process.env.ADMIN_PASSWORD_RESET_VALUE;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TARGET_EMAILS.length || !NEW_PASSWORD) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD_RESET_EMAILS, and ADMIN_PASSWORD_RESET_VALUE are required."
  );
}
if (NEW_PASSWORD.length < 12) throw new Error("The new password must be at least 12 characters.");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Searching for the requested exact email addresses:", TARGET_EMAILS);

  const { data: authUsers, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("Error listing users:", listErr);
    return;
  }

  const matches = authUsers.users.filter((u) => TARGET_EMAILS.includes(u.email?.toLowerCase()));

  console.log("Found matches in Auth users:", matches.map(u => ({ id: u.id, email: u.email })));

  for (const email of TARGET_EMAILS) {
    const user = matches.find((candidate) => candidate.email?.toLowerCase() === email);
    if (!user) {
      console.warn(`No existing user found for ${email}; no account was created.`);
      continue;
    }
    const { data: updated, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: NEW_PASSWORD,
      email_confirm: true,
    });
    console.log(`Updated password for ${email}:`, updated?.user?.id, error?.message || "SUCCESS");
  }
}

main().catch(console.error);
