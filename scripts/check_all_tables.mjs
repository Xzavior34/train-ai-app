import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("=== CHECK EXISTING TABLES ===");

  const tablesToCheck = [
    "organizations",
    "user_profiles",
    "user_roles",
    "organization_members",
    "user_invitations",
    "courses",
    "lessons",
    "cohorts",
    "cohort_members",
    "cohort_courses",
    "enrollments",
    "lesson_completions",
    "assessments",
    "assessment_submissions",
    "certificates",
    "mentor_availability",
    "mentorship_sessions",
    "community_posts",
    "community_comments",
    "community_reactions",
    "messages",
    "study_groups",
    "study_group_members",
    "achievements",
    "user_achievements",
    "ai_credit_accounts",
    "ai_credit_transactions",
    "billing_prices",
    "organization_subscriptions",
    "organization_payments",
    "organization_feature_flags",
    "organization_branding",
    "org_integrations",
    "support_tickets"
  ];

  const results = {};
  for (const table of tablesToCheck) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      results[table] = `ERROR: ${error.message}`;
    } else {
      results[table] = `EXISTS (count: ${count})`;
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
