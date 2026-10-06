import { supabase } from "../supabaseClient.js";
import { MARKETPLACE_COMMISSION_DEFAULT, INSTRUCTOR_SEAT_PLANS } from "../constants/terminology.js";

const LOCAL_STORAGE_ACADEMIES_KEY = "trainai_marketplace_academies_v1";
const LOCAL_STORAGE_COURSES_KEY = "trainai_marketplace_courses_v1";
const LOCAL_STORAGE_PURCHASES_KEY = "trainai_marketplace_purchases_v1";

const SEED_ACADEMIES = [
  {
    id: "acad-1",
    name: "AfriTech Applied AI Academy",
    slug: "afritech-ai",
    logo_url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=200&auto=format&fit=crop&q=80",
    description: "Leading pan-African academy specializing in production Machine Learning and enterprise LLM deployment.",
    instructor_seat_limit: 5,
    instructor_plan: "5-instructors",
    is_verified: true,
    created_at: "2026-08-15T00:00:00Z",
  },
  {
    id: "acad-2",
    name: "Apex Data & Analytics Institute",
    slug: "apex-data",
    logo_url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&auto=format&fit=crop&q=80",
    description: "Hands-on data analytics, business intelligence, and predictive modeling for high-growth tech careers.",
    instructor_seat_limit: 3,
    instructor_plan: "3-instructors",
    is_verified: true,
    created_at: "2026-09-01T00:00:00Z",
  },
];

const SEED_COURSES = [
  {
    id: "mcourse-1",
    academy_id: "acad-1",
    academy_name: "AfriTech Applied AI Academy",
    title: "Building Production AI Agents with LLMs & Vector Databases",
    slug: "production-ai-agents-llms",
    description: "Master autonomous multi-agent systems, retrieval-augmented generation (RAG), and production deployment with Supabase Vector and LangChain.",
    category: "Artificial Intelligence",
    skill_level: "Intermediate",
    thumbnail_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    price_amount: 4900, // $49.00
    currency: "USD",
    status: "Published",
    platform_commission_percent: 15.0,
    enrolled_count: 86,
    rating: 4.9,
    modules_count: 6,
    lessons_count: 24,
    created_at: "2026-09-05T00:00:00Z",
  },
  {
    id: "mcourse-2",
    academy_id: "acad-2",
    academy_name: "Apex Data & Analytics Institute",
    title: "Executive Business Analytics with SQL & PowerBI",
    slug: "executive-business-analytics-sql",
    description: "Transform complex operational datasets into executive dashboards, financial forecasts, and automated reports.",
    category: "Data Science",
    skill_level: "Beginner",
    thumbnail_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
    price_amount: 3500, // $35.00
    currency: "USD",
    status: "Published",
    platform_commission_percent: 15.0,
    enrolled_count: 124,
    rating: 4.8,
    modules_count: 5,
    lessons_count: 18,
    created_at: "2026-09-12T00:00:00Z",
  },
  {
    id: "mcourse-3",
    academy_id: "acad-1",
    academy_name: "AfriTech Applied AI Academy",
    title: "Full-Stack AI Product Development (React, FastAPI, Supabase)",
    slug: "full-stack-ai-product-dev",
    description: "Design and ship venture-backed AI micro-SaaS applications from scratch with seamless payments and authentication.",
    category: "Software Engineering",
    skill_level: "Advanced",
    thumbnail_url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
    price_amount: 6500, // $65.00
    currency: "USD",
    status: "Published",
    platform_commission_percent: 15.0,
    enrolled_count: 42,
    rating: 5.0,
    modules_count: 8,
    lessons_count: 32,
    created_at: "2026-09-20T00:00:00Z",
  },
];

function getCachedAcademies() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ACADEMIES_KEY);
    return raw ? JSON.parse(raw) : SEED_ACADEMIES;
  } catch {
    return SEED_ACADEMIES;
  }
}

function saveCachedAcademies(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_ACADEMIES_KEY, JSON.stringify(items));
  } catch {}
}

function getCachedCourses() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_COURSES_KEY);
    return raw ? JSON.parse(raw) : SEED_COURSES;
  } catch {
    return SEED_COURSES;
  }
}

function saveCachedCourses(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_COURSES_KEY, JSON.stringify(items));
  } catch {}
}

function getCachedPurchases() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PURCHASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedPurchases(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PURCHASES_KEY, JSON.stringify(items));
  } catch {}
}

/**
 * Calculates marketplace financial split in minor units (cents)
 * Platform fee defaults to 15%.
 */
export function calculateMarketplaceSplit(priceInCents, commissionPercent = MARKETPLACE_COMMISSION_DEFAULT) {
  const gross = Math.max(0, parseInt(priceInCents || 0, 10));
  const rate = Math.max(0, Math.min(100, Number(commissionPercent)));
  const platformFee = Math.round((gross * rate) / 100);
  const instructorRevenue = gross - platformFee;

  return {
    grossAmount: gross,
    platformFeeAmount: platformFee,
    instructorRevenueAmount: instructorRevenue,
    commissionPercent: rate,
  };
}

/**
 * Fetches public marketplace courses with filters
 */
export async function fetchMarketplaceCourses({ category, skillLevel, searchQuery, academyId } = {}) {
  let courses = getCachedCourses().filter((c) => c.status === "Published");

  if (category && category !== "all") {
    courses = courses.filter((c) => c.category?.toLowerCase() === category.toLowerCase());
  }
  if (skillLevel && skillLevel !== "all") {
    courses = courses.filter((c) => c.skill_level?.toLowerCase() === skillLevel.toLowerCase());
  }
  if (academyId) {
    courses = courses.filter((c) => c.academy_id === academyId);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    courses = courses.filter(
      (c) => c.title?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.academy_name?.toLowerCase().includes(q)
    );
  }

  return courses;
}

/**
 * Fetches course details by ID or slug
 */
export async function fetchMarketplaceCourseById(idOrSlug) {
  const courses = getCachedCourses();
  return courses.find((c) => c.id === idOrSlug || c.slug === idOrSlug) || null;
}

/**
 * Records a marketplace purchase with 15% platform commission ledger
 */
export async function recordMarketplacePurchase({ courseId, userId, txId, commissionPercent = 15.0 }) {
  const course = await fetchMarketplaceCourseById(courseId);
  if (!course) return { success: false, error: "Course not found." };

  const split = calculateMarketplaceSplit(course.price_amount, commissionPercent);

  const newPurchase = {
    id: `pur-${Date.now()}`,
    course_id: course.id,
    course_title: course.title,
    academy_id: course.academy_id,
    academy_name: course.academy_name,
    user_id: userId || "user-current",
    gross_amount: split.grossAmount,
    platform_fee_amount: split.platformFeeAmount,
    instructor_revenue_amount: split.instructorRevenueAmount,
    currency: course.currency || "USD",
    payment_provider_tx_id: txId || `tx-${Date.now()}`,
    settlement_status: "settled",
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      await supabase.from("marketplace_purchases").insert(newPurchase);
    } catch {}
  }

  const purchases = getCachedPurchases();
  saveCachedPurchases([newPurchase, ...purchases]);

  return { success: true, data: newPurchase };
}

/**
 * Fetches instructor seat plans
 */
export function fetchInstructorSeatPlans() {
  return INSTRUCTOR_SEAT_PLANS;
}
