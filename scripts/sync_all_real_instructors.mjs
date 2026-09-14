import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=== SYNC ALL REAL INSTRUCTORS ===");

  // 1. Fetch all auth users
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data: res } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const users = res?.users || [];
    if (!users.length) break;
    allAuthUsers = allAuthUsers.concat(users);
    if (users.length < 1000) break;
    page++;
  }

  const realAuthUsers = allAuthUsers.filter(u => {
    const email = (u.email || "").toLowerCase();
    const id = u.id || "";
    return !id.startsWith("d0000000-") &&
      !email.endsWith("@demoacademy.sample") &&
      !email.includes("demoacademy") &&
      !email.endsWith("@sample") &&
      !email.endsWith(".sample");
  });

  const authUserMap = Object.fromEntries(realAuthUsers.map(u => [u.id, u]));

  // 2. Fetch all user_profiles
  const { data: profiles } = await supabase.from("user_profiles").select("*");
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  // 3. Find instructor candidates:
  // - Mentors table rows
  // - Roles in user_profiles: mentor, instructor, admin, teacher, manager
  // - Courses instructor_id
  const { data: mentors } = await supabase.from("mentors").select("*");
  const { data: courses } = await supabase.from("courses").select("id, title, instructor_id");

  const candidateIds = new Set();
  (mentors || []).forEach(m => { if (authUserMap[m.user_id]) candidateIds.add(m.user_id); });
  (courses || []).forEach(c => { if (c.instructor_id && authUserMap[c.instructor_id]) candidateIds.add(c.instructor_id); });
  (profiles || []).forEach(p => {
    if (authUserMap[p.id]) {
      const r = (p.role || "").toLowerCase();
      if (r === "mentor" || r === "instructor" || r === "admin" || r === "teacher") {
        candidateIds.add(p.id);
      }
    }
  });

  console.log(`Found ${candidateIds.size} distinct candidate instructor IDs.`);

  // 4. Ensure user_profiles row exists with display_name for every candidate instructor
  for (const uid of candidateIds) {
    const u = authUserMap[uid];
    if (!u) continue;
    const p = profileMap[uid] || {};
    const meta = u.user_metadata || {};
    const displayName = p.display_name || meta.display_name || meta.full_name || meta.name || u.email.split("@")[0];

    await supabase.from("user_profiles").upsert({
      id: uid,
      display_name: displayName.trim(),
      role: p.role || "mentor",
      last_active_at: new Date().toISOString()
    }, { onConflict: "id" });

    // Also update profileMap
    profileMap[uid] = { ...p, id: uid, display_name: displayName.trim() };
  }

  // 5. Ensure mentors row exists and is active for every candidate instructor
  for (const uid of candidateIds) {
    const existing = (mentors || []).find(m => m.user_id === uid);
    const prof = profileMap[uid];
    const name = prof?.display_name || "Instructor";

    const title = existing?.title || "Instructor & Technical Mentor";
    const bio = existing?.bio || `Instructor at Sara Foundation / Train AI platform. Guiding learners in technology and career skills.`;
    const specializations = existing?.specializations || ["Artificial Intelligence", "Software Engineering"];

    await supabase.from("mentors").upsert({
      user_id: uid,
      title,
      bio,
      specializations,
      is_active: true,
      is_approved: true,
      rating: existing?.rating || 5.0
    }, { onConflict: "user_id" });
  }

  // 6. Query mentors table again and display final instructors list
  const { data: finalMentors } = await supabase.from("mentors").select("*");
  const { data: finalProfiles } = await supabase.from("user_profiles").select("*");
  const finalProfileMap = Object.fromEntries((finalProfiles || []).map(p => [p.id, p.display_name]));

  const activeRealMentors = (finalMentors || [])
    .filter(m => authUserMap[m.user_id] && m.is_active)
    .map(m => ({
      mentor_id: m.id,
      user_id: m.user_id,
      name: finalProfileMap[m.user_id] || "Instructor",
      title: m.title,
      email: authUserMap[m.user_id]?.email
    }));

  console.log("\n==========================================================");
  console.log(" FINAL LIST OF REAL INSTRUCTORS / MENTORS IN DATABASE");
  console.log("==========================================================");
  console.table(activeRealMentors);
}

main().catch(console.error);
