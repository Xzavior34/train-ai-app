import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== TEST INSERTION INTO MENTORSHIP_SESSIONS ===");

  const sampleSession = {
    learner_id: "c836deb6-ec9b-4817-b8de-9191757e83ab",
    mentor_id: "fd45fffe-311e-4ac0-84ac-0546658b03df",
    title: "Initial Strategy & Growth Mentorship Session",
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    status: "requested"
  };

  const { data: inserted, error: insErr } = await supabase
    .from("mentorship_sessions")
    .insert(sampleSession)
    .select()
    .single();

  if (insErr) {
    console.error("Insertion error:", insErr);
  } else {
    console.log("Successfully inserted session columns:", Object.keys(inserted));
    console.log("Inserted session:", inserted);
  }
}

main().catch(console.error);






