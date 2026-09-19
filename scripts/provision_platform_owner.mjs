import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const emails = ["trainailtd@gmail.com", "trainai@gmail.com"];

  // Find Digital Training Organization or first org
  const { data: orgs } = await supabase.from("organizations").select("*").limit(5);
  console.log("Existing organizations:", orgs?.map(o => ({ id: o.id, name: o.name, slug: o.slug })));
  const defaultOrgId = orgs?.[0]?.id;

  for (const email of emails) {
    console.log(`\n=== PROVISIONING SUPER ADMIN: ${email} ===`);
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    let user = authUsers?.users?.find(u => u.email?.toLowerCase() === email);

    if (!user) {
      console.log(`Creating auth user for ${email}...`);
      const res = await supabase.auth.admin.createUser({
        email,
        password: "SaraF123$",
        email_confirm: true,
        user_metadata: { display_name: "Platform Owner", role: "super_admin" }
      });
      user = res.data?.user;
    } else {
      console.log(`Updating auth metadata for ${email}...`);
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { display_name: "Platform Owner", role: "super_admin" },
        password: "SaraF123$",
        email_confirm: true
      });
    }

    if (user) {
      // Upsert user_profiles
      const { data: prof, error: pErr } = await supabase.from("user_profiles").upsert({
        id: user.id,
        display_name: "Platform Owner",
        role: "super_admin",
        organization_id: defaultOrgId
      }).select().single();
      console.log("Upserted user_profiles:", prof?.id, prof?.role, pErr?.message || "SUCCESS");

      // Upsert user_roles (both super_admin and admin)
      await supabase.from("user_roles").upsert([
        { user_id: user.id, role: "super_admin" },
        { user_id: user.id, role: "admin" }
      ]);
      console.log("Upserted user_roles: super_admin & admin");

      // Upsert organization_members
      if (defaultOrgId) {
        await supabase.from("organization_members").upsert({
          organization_id: defaultOrgId,
          user_id: user.id,
          role: "owner",
          status: "active"
        });
        console.log("Upserted organization_members: owner");
      }
    }
  }
}

main().catch(console.error);
