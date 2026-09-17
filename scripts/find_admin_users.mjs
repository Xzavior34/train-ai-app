import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  console.log("Total auth users:", authUsers?.users?.length);
  
  const adminUsers = (authUsers?.users || []).filter(u => 
    u.email?.includes("sara") || 
    u.email?.includes("admin") || 
    u.email?.includes("info") ||
    u.email?.includes("foundation") ||
    u.email?.includes("trainai") ||
    u.role === "admin"
  );
  console.log("Potential Admin / Sara users in auth.users:");
  for (const u of adminUsers) {
    const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", u.id).single();
    const { data: orgMems } = await supabase.from("organization_members").select("*, organizations(*)").eq("user_id", u.id);
    console.log({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      profile,
      orgMems
    });
  }
}

main().catch(console.error);
