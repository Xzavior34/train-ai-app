// ============================================================================
// Shared project-aware demo data - used when no real Supabase project is
// connected (`if (!supabase)` branches throughout lib/api/*.js).
// Supports Sara Foundation, Digital Training Org (+ Super Admin), and B2B Orgs.
// ============================================================================

export const DEMO_PROJECT_DATA = {
  sara_foundation: {
    orgs: [
      { id: "sara-org-1", name: "Sara Foundation Africa", slug: "sara-foundation", status: "active", subscription_tier: "enterprise", created_at: "2025-01-15T00:00:00.000Z", user_count: 1420 },
      { id: "sara-org-2", name: "Sara Youth Tech Fellowship", slug: "sara-fellowship", status: "active", subscription_tier: "growth", created_at: "2025-03-10T00:00:00.000Z", user_count: 350 },
      { id: "sara-org-3", name: "Sara Digital Women Initiative", slug: "sara-women", status: "active", subscription_tier: "growth", created_at: "2025-05-20T00:00:00.000Z", user_count: 280 }
    ],
    stats: { organizations: 3, totalUsers: 2050, activeInWeek: 1480, totalCourses: 24, totalEnrollments: 4200, pendingInvitations: 12 },
    aiUsage: { total: 4820, last30d: 1840, last7d: 520 },
    websiteStats: { demoRequestsTotal: 84, demoRequestsNew: 14, demoRequestsLast30d: 32, inquiriesTotal: 120, inquiriesNew: 22, inquiriesLast30d: 45 },
    activity: [
      { text: "Certificate issued: Amara Chen (Sara AI Fellow)", time: "2 hours ago" },
      { text: "New cohort registered: Nairobi Youth Batch 4 (120 learners)", time: "5 hours ago" },
      { text: "Course published: Mobile App Development in Flutter", time: "Yesterday" },
      { text: "Mentor session completed: Jordan Reyes with 24 fellows", time: "2 days ago" }
    ],
    tracks: [
      { id: "sara-t1", name: "Emerging Tech & AI Literacy", courses: 8, learners: 850, courseTitles: ["AI Foundations for Africa", "Python for Emerging Data", "Prompt Design Basics"] },
      { id: "sara-t2", name: "Full-Stack Web & Cloud", courses: 10, learners: 720, courseTitles: ["React Web Engineering", "Cloud & Microservices", "Database Architecture"] },
      { id: "sara-t3", name: "Digital Entrepreneurship", courses: 6, learners: 480, courseTitles: ["Product Strategy", "Growth Marketing", "Startup Operations"] }
    ]
  },
  digital_training: {
    orgs: [
      { id: "dt-org-1", name: "Global Digital Training Institute (+ Super Admin)", slug: "digital-training-hq", status: "active", subscription_tier: "enterprise", created_at: "2024-11-01T00:00:00.000Z", user_count: 3850 },
      { id: "dt-org-2", name: "Train AI Executive Leadership Academy", slug: "trainai-exec", status: "active", subscription_tier: "enterprise", created_at: "2025-01-08T00:00:00.000Z", user_count: 850 },
      { id: "dt-org-3", name: "Advanced AI Engineering Academy", slug: "ai-engineering-academy", status: "active", subscription_tier: "growth", created_at: "2025-02-14T00:00:00.000Z", user_count: 1200 }
    ],
    stats: { organizations: 5, totalUsers: 5900, activeInWeek: 4120, totalCourses: 48, totalEnrollments: 12800, pendingInvitations: 34 },
    aiUsage: { total: 18450, last30d: 5920, last7d: 1840 },
    websiteStats: { demoRequestsTotal: 240, demoRequestsNew: 48, demoRequestsLast30d: 96, inquiriesTotal: 380, inquiriesNew: 64, inquiriesLast30d: 140 },
    activity: [
      { text: "Super Admin created: info@trainailtd.com with platform-wide privileges", time: "1 hour ago" },
      { text: "Platform tenant status updated: Enterprise SLA verified", time: "3 hours ago" },
      { text: "AI Assessment edge pipeline processed 450 requests", time: "6 hours ago" },
      { text: "Global course sync completed: 48 active courses verified", time: "Yesterday" }
    ],
    tracks: [
      { id: "dt-t1", name: "Generative AI & Agentic Systems", courses: 16, learners: 2400, courseTitles: ["Autonomous Agents in LangChain", "Enterprise RAG Architecture", "Multi-Modal AI Engineering"] },
      { id: "dt-t2", name: "Cloud Native & DevOps Engineering", courses: 18, learners: 1950, courseTitles: ["Kubernetes Microservices", "CI/CD at Enterprise Scale", "Cloud Infrastructure as Code"] },
      { id: "dt-t3", name: "Spatial UI & Design Systems", courses: 14, learners: 1550, courseTitles: ["Design Systems in Figma", "Spatial Three.js UX", "Accessibility & Motion"] }
    ]
  },
  b2b: {
    orgs: [
      { id: "b2b-org-1", name: "Acme Corp AI Labs", slug: "acme-corp", status: "active", subscription_tier: "enterprise", created_at: "2025-01-20T00:00:00.000Z", user_count: 650 },
      { id: "b2b-org-2", name: "Starlight Financial Skilling", slug: "starlight-fin", status: "active", subscription_tier: "enterprise", created_at: "2025-02-11T00:00:00.000Z", user_count: 1100 },
      { id: "b2b-org-3", name: "Nexus Health Tech Group", slug: "nexus-health", status: "active", subscription_tier: "growth", created_at: "2025-03-04T00:00:00.000Z", user_count: 420 },
      { id: "b2b-org-4", name: "FinTech Innovation Academy", slug: "fintech-academy", status: "active", subscription_tier: "growth", created_at: "2025-04-18T00:00:00.000Z", user_count: 310 }
    ],
    stats: { organizations: 8, totalUsers: 3480, activeInWeek: 2650, totalCourses: 32, totalEnrollments: 7890, pendingInvitations: 18 },
    aiUsage: { total: 12100, last30d: 4100, last7d: 1150 },
    websiteStats: { demoRequestsTotal: 160, demoRequestsNew: 28, demoRequestsLast30d: 65, inquiriesTotal: 210, inquiriesNew: 36, inquiriesLast30d: 82 },
    activity: [
      { text: "SSO Integration verified: Starlight Financial Okta SAML 2.0", time: "3 hours ago" },
      { text: "Department skill gap matrix exported: Acme Corp Engineering (85 users)", time: "6 hours ago" },
      { text: "Compliance assignment auto-assigned: Nexus Health HIPAA Module", time: "Yesterday" },
      { text: "New enterprise tenant onboarded: FinTech Innovation Academy", time: "2 days ago" }
    ],
    tracks: [
      { id: "b2b-t1", name: "Enterprise AI & Workforce Transformation", courses: 12, learners: 1450, courseTitles: ["Corporate AI Productivity", "Enterprise Data Governance", "Security in AI Workflows"] },
      { id: "b2b-t2", name: "Regulatory Compliance & Security", courses: 8, learners: 1200, courseTitles: ["Cybersecurity Fundamentals", "SOC2 & GDPR Compliance", "Workplace Safety & Standards"] },
      { id: "b2b-t3", name: "FinTech & Automated Analytics", courses: 12, learners: 830, courseTitles: ["Financial Modeling with Python", "Algorithmic Risk Management", "Decentralized Systems"] }
    ]
  }
};

export const DEMO_LEARNERS = [
  { id: "demo-learner-1", name: "Amara Chen", email: "amara.chen@techafrica.org", initials: "AC", risk: "success", status: "On Track", attendance: 98, progress: 95, avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80" },
  { id: "demo-learner-2", name: "David Osei", email: "david.osei@sarafoundation.org", initials: "DO", risk: "success", status: "On Track", attendance: 92, progress: 85, avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80" },
  { id: "demo-learner-3", name: "Priya Nair", email: "priya.nair@digitaltraining.org", initials: "PN", risk: "warning", status: "Needs Attention", attendance: 78, progress: 60, avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" },
  { id: "demo-learner-4", name: "Marcus Webb", email: "marcus.webb@fintech.io", initials: "MW", risk: "success", status: "On Track", attendance: 96, progress: 90, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" },
  { id: "demo-learner-5", name: "Fatima Diallo", email: "fatima.diallo@youthfellows.org", initials: "FD", risk: "danger", status: "High Risk", attendance: 45, progress: 30, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
  { id: "demo-learner-6", name: "Liam Torres", email: "liam.torres@acmecorp.com", initials: "LT", risk: "danger", status: "High Risk", attendance: 52, progress: 25, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
  { id: "demo-learner-7", name: "Ngozi Adeyemi", email: "ngozi.adeyemi@trainai.co", initials: "NA", risk: "success", status: "On Track", attendance: 100, progress: 100, avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80" },
  { id: "demo-learner-8", name: "Sofia Kim", email: "sofia.kim@starlight.com", initials: "SK", risk: "warning", status: "Needs Attention", attendance: 80, progress: 65, avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80" },
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
