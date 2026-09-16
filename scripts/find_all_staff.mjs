import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  console.log("Searching for admins and instructors...");
  
  for (const u of authUsers?.users || []) {
    const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", u.id).single();
    if (profile?.role !== "learner" || u.email?.includes("sara") || u.email?.includes("admin") || profile?.display_name?.toLowerCase().includes("sara") || profile?.display_name?.toLowerCase().includes("admin")) {
      const { data: orgMems } = await supabase.from("organization_members").select("*").eq("user_id", u.id);
      console.log({
        email: u.email,
        id: u.id,
        role: profile?.role,
        display_name: profile?.display_name,
        profile_org_id: profile?.organization_id,
        orgMemberships: orgMems
      });
    }
  }
}

main().catch(console.error);
