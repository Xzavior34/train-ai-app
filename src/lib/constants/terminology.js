// Train AI Standardized Product Terminology & Enums
// Standardizes terminology across all B2B and Academy workflows.

export const TERMINOLOGY = {
  ORGANIZATION: {
    singular: "Organization",
    plural: "Organizations",
    definition: "A company, foundation, NGO, school, or enterprise training provider using Train AI privately.",
  },
  ACADEMY: {
    singular: "Academy",
    plural: "Academies",
    definition: "A training provider selling or delivering courses to independent learners and cohorts.",
  },
  COHORT: {
    singular: "Cohort",
    plural: "Cohorts",
    definition: "A group of learners enrolled into a time-bound training programme.",
  },
  COURSE: {
    singular: "Course",
    plural: "Courses",
    definition: "Structured learning content, modules, lessons, and assignments.",
  },
  TRAINING_PROGRAMME: {
    singular: "Training Programme",
    plural: "Training Programmes",
    definition: "A comprehensive learning programme containing courses, projects, mentorship, milestones, and cohorts.",
  },
};

export const PROGRAMME_TYPES = {
  TRAINING_PROGRAMME: "Training Programme",
  INTERNAL_TRAINING: "Internal Training",
  GRADUATE_TRAINING: "Graduate Training",
  EXECUTIVE_ACADEMY: "Executive Academy",
  CAP_ACCELERATOR: "Career Acceleration Programme (CAP)",
};

export const COHORT_STATUSES = {
  DRAFT: "Draft",
  UPCOMING: "Upcoming",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export const KPI_STATUSES = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
};

export const CAP_PHASES = {
  LEARN: {
    key: "LEARN",
    label: "Phase A: Learn",
    weeks: "Weeks 1–2",
    description: "Core modules, skill foundation, CV & cover letter development, soft skills.",
  },
  BUILD: {
    key: "BUILD",
    label: "Phase B: Build",
    weeks: "Weeks 3–5",
    description: "Cross-functional team sprint, problem solving, GitHub repository & live demo build.",
  },
  LAUNCH: {
    key: "LAUNCH",
    label: "Phase C: Launch",
    weeks: "Week 6",
    description: "Final project submission, Demo Day pitch, judges & mentor feedback, graduation.",
  },
};

export const CAP_ROLES = [
  "Product Manager",
  "Software Engineer",
  "Data Analyst",
  "UI/UX Designer",
  "AI Engineer",
];

export const DEMO_STATUSES = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  NO_SHOW: "No Show",
  CANCELLED: "Cancelled",
  FOLLOW_UP: "Follow-up Required",
};

export const MARKETPLACE_COMMISSION_DEFAULT = 15.0; // 15% Platform Commission

export const INSTRUCTOR_SEAT_PLANS = [
  {
    id: "1-instructor",
    name: "Solo Academy",
    instructorLimit: 1,
    monthlyPriceCents: 4900,
    yearlyPriceCents: 47000,
    features: ["1 Active Instructor", "Unlimited Courses", "Basic AI Credit Bundle (5,000 credits)", "15% Marketplace Fee"],
  },
  {
    id: "3-instructors",
    name: "Team Academy",
    instructorLimit: 3,
    monthlyPriceCents: 11900,
    yearlyPriceCents: 114000,
    features: ["3 Active Instructors", "Cohort Management", "Pro AI Credit Bundle (20,000 credits)", "15% Marketplace Fee", "Custom Branding"],
  },
  {
    id: "5-instructors",
    name: "Growth Academy",
    instructorLimit: 5,
    monthlyPriceCents: 18900,
    yearlyPriceCents: 180000,
    features: ["5 Active Instructors", "Dedicated Mentorship Engine", "Growth AI Bundle (50,000 credits)", "Priority Support", "15% Marketplace Fee"],
  },
  {
    id: "custom",
    name: "Custom / Enterprise",
    instructorLimit: 25,
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    features: ["Unlimited Instructors", "Custom AI Fine-tuning", "Dedicated SLA", "White-label Portal", "Negotiable Commission"],
  },
];
