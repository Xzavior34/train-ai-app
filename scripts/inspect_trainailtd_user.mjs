import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_SARA_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== INSPECT TRAINAILTD@GMAIL.COM ===");
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = authUsers?.users?.find(u => u.email?.toLowerCase() === "trainailtd@gmail.com");
  console.log("Auth User:", user?.id, user?.email, user?.user_metadata);

  if (user) {
    const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle();
    console.log("user_profiles:", profile);

    const { data: roles } = await supabase.from("user_roles").select("*").eq("user_id", user.id);
    console.log("user_roles:", roles);

    const { data: orgMems } = await supabase.from("organization_members").select("*").eq("user_id", user.id);
    console.log("organization_members:", orgMems);
  }
}

main().catch(console.error);
