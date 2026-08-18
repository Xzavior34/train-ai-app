// ============================================================================
// Shared demo data - used ONLY when no real Supabase project is connected
// (`if (!supabase)` branches throughout lib/api/*.js). Confirmed directly:
// "i dont see any mock data" - because every one of those branches
// previously returned an empty array or null, meaning the entire app
// showed nothing at all without a real database. This is a single,
// consistent dataset every affected function pulls from, so the numbers
// agree with each other across screens (the same 8 learners appear with
// the same progress everywhere they're referenced) rather than each
// function inventing its own random, contradictory numbers.
// ============================================================================

export const DEMO_LEARNERS = [
  { id: "demo-learner-1", name: "Amara Chen", initials: "AC", risk: "success" },
  { id: "demo-learner-2", name: "David Osei", initials: "DO", risk: "success" },
  { id: "demo-learner-3", name: "Priya Nair", initials: "PN", risk: "warning" },
  { id: "demo-learner-4", name: "Marcus Webb", initials: "MW", risk: "success" },
  { id: "demo-learner-5", name: "Fatima Diallo", initials: "FD", risk: "danger" },
  { id: "demo-learner-6", name: "Liam Torres", initials: "LT", risk: "danger" },
  { id: "demo-learner-7", name: "Ngozi Adeyemi", initials: "NA", risk: "success" },
  { id: "demo-learner-8", name: "Sofia Kim", initials: "SK", risk: "warning" },
];

export const DEMO_INSTRUCTORS = [
  { id: "demo-instructor-1", name: "Jordan Reyes", specialization: "AI & Data", sessionsCompleted: 34, rating: 4.8, isActive: true },
  { id: "demo-instructor-2", name: "Wale Adebayo", specialization: "Leadership", sessionsCompleted: 21, rating: 4.6, isActive: true },
];

export const DEMO_COURSES = [
  { id: "demo-course-ai", title: "AI Fundamentals", category: "AI", level: "beginner", source: "internal", durationHours: 4, lessonsCount: 5 },
  { id: "demo-course-leadership", title: "Leadership Essentials", category: "Leadership", level: "intermediate", source: "internal", durationHours: 6, lessonsCount: 6 },
  { id: "demo-course-compliance", title: "Workplace Compliance 101", category: "Compliance", level: "beginner", source: "internal", durationHours: 2, lessonsCount: 4 },
  { id: "demo-course-data", title: "Data Literacy for Teams", category: "Data", level: "beginner", source: "internal", durationHours: 3, lessonsCount: 5 },
  { id: "demo-course-pm", title: "Advanced Project Management", category: "Management", level: "advanced", source: "external", durationHours: 8, lessonsCount: 8 },
];

// Per-learner progress by course - the same numbers referenced by
// dashboard stats, top courses, skill gaps, and the learner's own
// enrolled-course view, so they never contradict each other.
export const DEMO_ENROLLMENTS = [
  { learnerId: "demo-learner-1", courseId: "demo-course-ai", progress: 100, completed: true },
  { learnerId: "demo-learner-1", courseId: "demo-course-leadership", progress: 100, completed: true },
  { learnerId: "demo-learner-2", courseId: "demo-course-ai", progress: 85, completed: false },
  { learnerId: "demo-learner-2", courseId: "demo-course-leadership", progress: 40, completed: false },
  { learnerId: "demo-learner-3", courseId: "demo-course-ai", progress: 60, completed: false },
  { learnerId: "demo-learner-3", courseId: "demo-course-compliance", progress: 100, completed: true },
  { learnerId: "demo-learner-4", courseId: "demo-course-ai", progress: 100, completed: true },
  { learnerId: "demo-learner-4", courseId: "demo-course-data", progress: 55, completed: false },
  { learnerId: "demo-learner-5", courseId: "demo-course-ai", progress: 30, completed: false },
  { learnerId: "demo-learner-6", courseId: "demo-course-ai", progress: 15, completed: false },
  { learnerId: "demo-learner-7", courseId: "demo-course-ai", progress: 100, completed: true },
  { learnerId: "demo-learner-7", courseId: "demo-course-leadership", progress: 100, completed: true },
  { learnerId: "demo-learner-8", courseId: "demo-course-ai", progress: 45, completed: false },
];

export const DEMO_CERTIFICATES = [
  { id: "demo-cert-1", learnerName: "Amara Chen", courseTitle: "AI Fundamentals", issuedAt: "2026-01-10", certificateNumber: "TAI-DEMO0001" },
  { id: "demo-cert-2", learnerName: "Marcus Webb", courseTitle: "AI Fundamentals", issuedAt: "2026-01-12", certificateNumber: "TAI-DEMO0002" },
  { id: "demo-cert-3", learnerName: "Amara Chen", courseTitle: "Leadership Essentials", issuedAt: "2026-01-14", certificateNumber: "TAI-DEMO0003" },
  { id: "demo-cert-4", learnerName: "Ngozi Adeyemi", courseTitle: "Leadership Essentials", issuedAt: "2026-01-15", certificateNumber: "TAI-DEMO0004" },
];

export const DEMO_COHORT = {
  id: "demo-cohort-1", name: "Q1 Onboarding Cohort",
  memberNames: ["Amara Chen", "David Osei", "Priya Nair", "Marcus Webb"],
  endsAt: "2026-04-01",
};

export const DEMO_STUDY_GROUP = { id: "demo-group-1", name: "AI Fundamentals Study Circle", memberCount: 3 };

export function demoTotalUsersBreakdown() {
  return { learners: DEMO_LEARNERS.length, instructors: DEMO_INSTRUCTORS.length, other: 2 };
}

export function demoTopCourses() {
  return DEMO_COURSES.slice(0, 4).map((c) => {
    const rows = DEMO_ENROLLMENTS.filter((e) => e.courseId === c.id);
    return { courseId: c.id, title: c.title, enrolled: rows.length, completed: rows.filter((r) => r.completed).length };
  }).sort((a, b) => b.enrolled - a.enrolled);
}

export function demoSkillGapsDetail() {
  return DEMO_LEARNERS.map((l) => {
    const rows = DEMO_ENROLLMENTS.filter((e) => e.learnerId === l.id);
    const byCategory = {};
    for (const r of rows) {
      const course = DEMO_COURSES.find((c) => c.id === r.courseId);
      const cat = course?.category || "General";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(r);
    }
    const completedSkills = [];
    const gapSkills = [];
    for (const [cat, catRows] of Object.entries(byCategory)) {
      const avgProgress = Math.round(catRows.reduce((a, r) => a + r.progress, 0) / catRows.length);
      if (catRows.some((r) => r.completed) && avgProgress >= 70) completedSkills.push({ category: cat, avgProgress });
      else gapSkills.push({ category: cat, avgProgress });
    }
    return { learnerId: l.id, name: l.name, completedSkills, gapSkills };
  });
}

export function demoLearnerProgressOverview() {
  return DEMO_LEARNERS.map((l, i) => {
    const rows = DEMO_ENROLLMENTS.filter((e) => e.learnerId === l.id);
    const avgProgress = rows.length ? Math.round(rows.reduce((a, r) => a + r.progress, 0) / rows.length) : 0;
    return {
      id: l.id, name: l.name, avgProgress,
      assignedCount: rows.length, completedCount: rows.filter((r) => r.completed).length,
      pace: avgProgress < 40 ? "behind" : "on_track",
      daysSinceActive: l.risk === "danger" ? 8 + i : null,
    };
  });
}
