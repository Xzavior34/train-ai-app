import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== MENTORS TABLE DETAILED INSPECTION ===");

  const { data: mentors } = await supabase.from("mentors").select("*");
  console.log(`Total mentors rows: ${mentors?.length || 0}`);
  
  const userIds = (mentors || []).map(m => m.user_id);
  const { data: profiles } = await supabase.from("user_profiles").select("id, display_name, role, email").in("id", userIds);
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  console.log("\nMentors with profile display names:");
  console.table((mentors || []).map(m => ({
    id: m.id,
    user_id: m.user_id,
    display_name: profileMap[m.user_id]?.display_name || "NO PROFILE",
    title: m.title,
    is_active: m.is_active,
    is_approved: m.is_approved
  })));

  // Also check all courses to see who instructor_id is
  const { data: courses } = await supabase.from("courses").select("id, title, instructor_id");
  const courseInstIds = [...new Set((courses || []).map(c => c.instructor_id).filter(Boolean))];
  const { data: courseInstProfiles } = await supabase.from("user_profiles").select("id, display_name, role, email").in("id", courseInstIds);
  
  console.log("\nCourse Instructors:");
  console.table((courseInstProfiles || []).map(p => ({
    id: p.id,
    display_name: p.display_name,
    role: p.role,
    email: p.email
  })));

  // Check all user_profiles for role = mentor/instructor/admin
  const { data: allProfiles } = await supabase.from("user_profiles").select("id, display_name, role, email");
  const instructorRoles = (allProfiles || []).filter(p => {
    const r = (p.role || "").toLowerCase();
    return r === "mentor" || r === "instructor" || r === "admin" || r === "teacher";
  });
  
  console.log("\nProfiles with instructor roles:");
  console.table(instructorRoles);
}

main().catch(console.error);
