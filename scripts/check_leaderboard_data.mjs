import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== CHECK LEADERBOARD DATA ===");
  const { data: stats } = await supabase
    .from("user_gamification_stats")
    .select("user_id, total_points, streak_days, current_level, lessons_completed, courses_completed")
    .order("total_points", { ascending: false })
    .limit(10);
  console.log("Top 10 from user_gamification_stats:");
  console.table(stats || []);

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url, role")
    .in("id", (stats || []).map(s => s.user_id));
  console.log("Matched Profiles:");
  console.table(profiles || []);
}

main().catch(console.error);
