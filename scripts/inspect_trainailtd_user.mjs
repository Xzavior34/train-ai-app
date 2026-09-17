import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

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
