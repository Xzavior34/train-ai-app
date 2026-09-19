// Train AI - accept-invitation Edge Function
// Handles both existing users and brand-new invitees setting a password.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token, password, display_name } = body || {};
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing invitation token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Look up invitation
    const { data: inv, error: invErr } = await adminClient
      .from("user_invitations")
      .select("*, organizations(name)")
      .eq("token", token)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: "This invitation is invalid or has expired." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = inv.email.trim().toLowerCase();
    const orgName = inv.organizations?.name || "Train AI";

    // 2. Check if user exists in auth.users
    const { data: userList } = await adminClient.auth.admin.listUsers();
    let targetUser = userList?.users?.find((u) => u.email?.toLowerCase() === email);
    let isNewUser = false;

    if (!targetUser) {
      // New user requires password to be set
      if (!password || password.length < 8) {
        return new Response(
          JSON.stringify({
            requires_signup: true,
            email,
            organization_name: orgName,
            role: inv.role,
            organization_role: inv.organization_role || "member",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create auth user with pre-confirmed email
      const { data: createdUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: display_name?.trim() || email.split("@")[0],
          role: inv.role || "learner",
        },
      });

      if (createErr || !createdUser?.user) {
        return new Response(JSON.stringify({ error: createErr?.message || "Failed to create user account." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      targetUser = createdUser.user;
      isNewUser = true;
    }

    const userId = targetUser.id;

    // 3. Ensure user profile exists & tag with organization_id
    const userRole = inv.role || "learner";
    const orgRole = inv.organization_role || (userRole === "admin" ? "admin" : "member");

    await adminClient.from("user_profiles").upsert(
      {
        id: userId,
        display_name: display_name?.trim() || targetUser.user_metadata?.display_name || email.split("@")[0],
        role: userRole,
        organization_id: inv.organization_id,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    // 4. Assign user_roles
    await adminClient.from("user_roles").upsert(
      {
        user_id: userId,
        role: userRole,
      },
      { onConflict: "user_id,role" }
    );

    // 5. Add to organization_members with active status
    if (inv.organization_id) {
      await adminClient.from("organization_members").upsert(
        {
          organization_id: inv.organization_id,
          user_id: userId,
          role: orgRole,
          status: "active",
          invited_by: inv.invited_by || null,
          joined_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" }
      );
    }

    // 6. Mark invitation as accepted
    await adminClient
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", inv.id);

    return new Response(
      JSON.stringify({
        success: true,
        is_new_user: isNewUser,
        user_id: userId,
        organization_id: inv.organization_id,
        organization_name: orgName,
        role: userRole,
        message: `Successfully joined ${orgName}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
