import { supabase } from "../supabaseClient.js";
import { CAP_PHASES, CAP_ROLES } from "../constants/terminology.js";

const LOCAL_STORAGE_TEAMS_KEY = "trainai_cap_teams_cache_v2";

const SEED_CAP_TEAMS = [
  {
    id: "cap-team-1",
    cohort_id: "cap-cohort-3",
    name: "Nexus AI Healthcare",
    project_title: "Intelligent Patient Triage & Diagnostics Assistant",
    problem_statement: "Reducing ER triage wait times across African urban hospitals using multilingual LLMs.",
    technologies: ["React", "Python", "FastAPI", "OpenAI", "Supabase"],
    github_url: "https://github.com/trainai-cap/nexus-ai-health",
    demo_url: "https://nexus-health.trainailtd.com",
    presentation_url: "https://slides.trainailtd.com/nexus-health",
    demo_video_url: "https://youtube.com/watch?v=demo-nexus",
    screenshot_url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80",
    mentor_id: null,
    mentor_name: "Dr. Amara Okafor",
    phase: CAP_PHASES.BUILD.key,
    demo_day_status: "Demo Day Ready",
    final_score: 94.5,
    judges_feedback: "Exceptional live demo, robust multilingual support, and clear hospital integration path.",
    mentor_feedback: "Team executed sprint goals on schedule. Great architecture and clear division of labor.",
    members: [
      { id: "mem-1", name: "Kofi Mensah", role: "Product Manager", email: "kofi@example.com" },
      { id: "mem-2", name: "Zainab Bello", role: "Software Engineer", email: "zainab@example.com" },
      { id: "mem-3", name: "Tunde Bakare", role: "UI/UX Designer", email: "tunde@example.com" },
      { id: "mem-4", name: "Chiamaka Eze", role: "Data Analyst", email: "chiamaka@example.com" },
    ],
  },
  {
    id: "cap-team-2",
    cohort_id: "cap-cohort-3",
    name: "AgriSense Africa",
    project_title: "Satellite & Computer Vision Crop Disease Detection",
    problem_statement: "Empowering smallholder maize farmers with instant mobile leaf analysis and fertilizer advisory.",
    technologies: ["PyTorch", "React Native", "TensorFlow Lite", "Node.js"],
    github_url: "https://github.com/trainai-cap/agrisense",
    demo_url: "https://agrisense.trainailtd.com",
    presentation_url: "https://slides.trainailtd.com/agrisense",
    demo_video_url: "",
    screenshot_url: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=800&auto=format&fit=crop&q=80",
    mentor_id: null,
    mentor_name: "Engr. David Adeleke",
    phase: CAP_PHASES.BUILD.key,
    demo_day_status: "Pending Review",
    final_score: 88.0,
    judges_feedback: "Strong problem statement and real farmer pilot data.",
    mentor_feedback: "Refining edge inference model for low-connectivity rural deployment.",
    members: [
      { id: "mem-5", name: "Emeka Obi", role: "Product Manager", email: "emeka@example.com" },
      { id: "mem-6", name: "Fatima Aliyu", role: "Software Engineer", email: "fatima@example.com" },
      { id: "mem-7", name: "David K.", role: "AI Engineer", email: "davidk@example.com" },
    ],
  },
  {
    id: "cap-team-3",
    cohort_id: "cap-cohort-3",
    name: "PayFlow AI",
    project_title: "Automated Cross-Border Invoicing & FX Hedging for MSMEs",
    problem_statement: "Eliminating FX volatility losses for cross-border African merchants.",
    technologies: ["Next.js", "Python", "Stripe", "Paystack", "PostgreSQL"],
    github_url: "https://github.com/trainai-cap/payflow-ai",
    demo_url: "https://payflow.trainailtd.com",
    presentation_url: "https://slides.trainailtd.com/payflow",
    demo_video_url: "",
    screenshot_url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80",
    mentor_id: null,
    mentor_name: "Dr. Amara Okafor",
    phase: CAP_PHASES.LAUNCH.key,
    demo_day_status: "Featured",
    final_score: 96.0,
    judges_feedback: "Commercial readiness is remarkable. Ready for seed incubation.",
    mentor_feedback: "Flawless presentation and highly defensible pricing architecture.",
    members: [
      { id: "mem-8", name: "Sarah N.", role: "Product Manager", email: "sarah@example.com" },
      { id: "mem-9", name: "Ibrahim S.", role: "Software Engineer", email: "ibrahim@example.com" },
      { id: "mem-10", name: "Grace O.", role: "UI/UX Designer", email: "grace@example.com" },
      { id: "mem-11", name: "Samuel T.", role: "Data Analyst", email: "samuel@example.com" },
    ],
  },
];

function getCachedTeams() {
  if (typeof window === "undefined") return SEED_CAP_TEAMS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TEAMS_KEY);
    return raw ? JSON.parse(raw) : SEED_CAP_TEAMS;
  } catch {
    return SEED_CAP_TEAMS;
  }
}

function saveCachedTeams(items) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_TEAMS_KEY, JSON.stringify(items));
  } catch {}
}

/**
 * Fetches all CAP teams for a cohort
 */
export async function fetchCapTeams(cohortId) {
  const cached = getCachedTeams();
  if (!supabase) return cached;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(cohortId || ""));
    let query = supabase.from("cap_teams").select("*, cap_team_members(*)").order("created_at", { ascending: false });
    if (isUuid) {
      query = query.eq("cohort_id", cohortId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return cached;

    const formatted = data.map((t) => ({
      ...t,
      members: (t.cap_team_members && t.cap_team_members.length > 0)
        ? t.cap_team_members.map((m) => ({
            id: m.id || m.user_id,
            user_id: m.user_id,
            name: m.name || "Team Member",
            role: m.role || "Software Engineer",
            email: m.email || "",
          }))
        : (cached.find((ct) => ct.id === t.id)?.members || []),
    }));

    // Merge with seeds if user is looking at CAP Cohort 3 so pre-configured tracks are always visible
    const existingIds = new Set(formatted.map((t) => t.id));
    const merged = [...formatted, ...cached.filter((t) => !existingIds.has(t.id))];
    saveCachedTeams(merged);
    return merged;
  } catch {
    return cached;
  }
}

/**
 * Creates or updates a CAP team
 */
export async function saveCapTeam(teamData) {
  const isNew = !teamData.id || teamData.id.startsWith("new-") || !teamData.id.includes("-");
  const id = isNew ? `cap-team-${Date.now()}` : teamData.id;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(teamData.cohort_id || ""));

  const payload = {
    ...teamData,
    id,
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const dbPayload = {
        name: teamData.name,
        project_title: teamData.project_title,
        problem_statement: teamData.problem_statement,
        technologies: teamData.technologies || [],
        github_url: teamData.github_url || null,
        demo_url: teamData.demo_url || null,
        presentation_url: teamData.presentation_url || null,
        demo_video_url: teamData.demo_video_url || null,
        screenshot_url: teamData.screenshot_url || null,
        mentor_name: teamData.mentor_name || null,
        phase: teamData.phase || "BUILD",
        demo_day_status: teamData.demo_day_status || "Pending Review",
        updated_at: new Date().toISOString(),
      };
      if (isUuid) {
        dbPayload.cohort_id = teamData.cohort_id;
      }

      if (isNew) {
        await supabase.from("cap_teams").insert(dbPayload);
      } else {
        await supabase.from("cap_teams").update(dbPayload).eq("id", id);
      }
    } catch (e) {
      console.warn("saveCapTeam Supabase sync notice:", e?.message || e);
    }
  }

  const existing = getCachedTeams();
  const updated = isNew ? [payload, ...existing] : existing.map((t) => (t.id === id ? { ...t, ...payload } : t));
  saveCachedTeams(updated);
  return { success: true, data: payload };
}

/**
 * Adds a member to a CAP team
 */
export async function joinCapTeam({ teamId, userId, name, email, role = "Software Engineer" }) {
  if (!teamId) throw new Error("Team ID is required.");

  const memberObj = {
    id: `mem-${Date.now()}`,
    user_id: userId,
    name: name || "Learner",
    email: email || "",
    role: role || "Software Engineer",
  };

  if (supabase && userId) {
    const isTeamUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(teamId));
    const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId));
    if (isTeamUuid && isUserUuid) {
      try {
        await supabase.from("cap_team_members").insert({
          team_id: teamId,
          user_id: userId,
          name: name || "Learner",
          email: email || "",
          role,
        });
      } catch (err) {
        console.warn("joinCapTeam Supabase sync notice:", err);
      }
    }
  }

  const existing = getCachedTeams();
  const updated = existing.map((t) => {
    if (t.id === teamId) {
      const currentMembers = t.members || [];
      const alreadyIn = currentMembers.some((m) => m.user_id === userId || m.email === email);
      if (alreadyIn) return t;
      return {
        ...t,
        members: [...currentMembers, memberObj],
      };
    }
    return t;
  });

  saveCachedTeams(updated);
  return { success: true, member: memberObj };
}

/**
 * Updates Demo Day submission status and score (Admin / Judges)
 */
export async function updateDemoDayReview(teamId, { demoDayStatus, finalScore, judgesFeedback, mentorFeedback }) {
  const patch = {
    demo_day_status: demoDayStatus,
    final_score: finalScore !== undefined ? finalScore : undefined,
    judges_feedback: judgesFeedback,
    mentor_feedback: mentorFeedback,
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      await supabase.from("cap_teams").update(patch).eq("id", teamId);
    } catch {}
  }

  const existing = getCachedTeams();
  const updated = existing.map((t) => (t.id === teamId ? { ...t, ...patch } : t));
  saveCachedTeams(updated);
  return { success: true };
}
