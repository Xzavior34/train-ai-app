import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== CHECK USER PROFILES & SARA ACCOUNT ===");

  const { data: authUsers, error: aErr } = await supabase.auth.admin.listUsers();
  console.log("Auth Users count:", authUsers?.users?.length, aErr);
  const saraAuth = authUsers?.users?.find(u => u.email?.includes("sara") || u.email?.includes("admin"));
  console.log("Sara / Admin Auth Users:", authUsers?.users?.map(u => ({ id: u.id, email: u.email, role: u.role, user_metadata: u.user_metadata })));

  const { data: profiles, error: pErr } = await supabase.from("user_profiles").select("*").limit(20);
  console.log("Sample User Profiles:", profiles, pErr);

  if (saraAuth) {
    const { data: saraProfile } = await supabase.from("user_profiles").select("*").eq("id", saraAuth.id);
    console.log("Sara Profile:", saraProfile);

    const { data: saraOrgMember } = await supabase.from("organization_members").select("*, organizations(*)").eq("user_id", saraAuth.id);
    console.log("Sara Organization Membership:", JSON.stringify(saraOrgMember, null, 2));
  }

  // Check helper functions / RLS
  // Let's test calling RPC or check org id functions
  try {
    const { data: orgIdRes, error: oErr } = await supabase.rpc("get_user_organization_id", { p_user_id: saraAuth?.id });
    console.log("get_user_organization_id(saraAuth.id):", orgIdRes, oErr);
  } catch (e) {
    console.log("RPC call error:", e);
  }
}

main().catch(console.error);
