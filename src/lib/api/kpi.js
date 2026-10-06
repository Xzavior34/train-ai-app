import { supabase } from "../supabaseClient.js";
import { KPI_STATUSES } from "../constants/terminology.js";

// Sample / seeded fallback data when in demo mode or initial setup
const SEED_KPI_ACTIVITIES = [
  {
    id: "kpi-1",
    title: "September 2026 Learner Cohort Onboarding",
    category: "Learner Acquisition",
    owner_name: "Philip Inem (Lead)",
    month_year: "2026-09",
    status: KPI_STATUSES.COMPLETED,
    progress_percent: 100,
    target_metric: "150 Enrolled",
    current_metric: "162 Enrolled",
    notes: "Exceeded target intake across partner organizations.",
    last_updated: "2026-09-30T16:00:00Z",
  },
  {
    id: "kpi-2",
    title: "CAP Cohort 3 Six-Week Trial Launch",
    category: "Curriculum Delivery",
    owner_name: "Training & Product Team",
    month_year: "2026-10",
    status: KPI_STATUSES.IN_PROGRESS,
    progress_percent: 65,
    target_metric: "6 Weeks Runtime",
    current_metric: "Phase B: Build Active",
    notes: "Teams assigned and building projects for Demo Day.",
    last_updated: "2026-10-06T10:00:00Z",
  },
  {
    id: "kpi-3",
    title: "Tamper-Proof Certificate Verification Engine",
    category: "Infrastructure",
    owner_name: "Engineering Team",
    month_year: "2026-10",
    status: KPI_STATUSES.COMPLETED,
    progress_percent: 100,
    target_metric: "100% Validated",
    current_metric: "Live & Public",
    notes: "Public route /certificate/:id enabled with QR support.",
    last_updated: "2026-10-06T11:30:00Z",
  },
  {
    id: "kpi-4",
    title: "Academy Marketplace 15% Revenue Ledger",
    category: "Monetization",
    owner_name: "Finance & Operations",
    month_year: "2026-10",
    status: KPI_STATUSES.IN_PROGRESS,
    progress_percent: 80,
    target_metric: "Automated Split",
    current_metric: "Ledger Enabled",
    notes: "15% platform commission calculation active in minor units.",
    last_updated: "2026-10-06T12:00:00Z",
  },
  {
    id: "kpi-5",
    title: "Executive Demo Walkthrough Bookings (Q4)",
    category: "Sales Operations",
    owner_name: "Growth Team",
    month_year: "2026-10",
    status: KPI_STATUSES.IN_PROGRESS,
    progress_percent: 45,
    target_metric: "25 Institutional Demos",
    current_metric: "12 Booked & Confirmed",
    notes: "Direct Google Meet link and notifications active.",
    last_updated: "2026-10-06T09:00:00Z",
  },
  {
    id: "kpi-6",
    title: "Alumni Network & Hiring Partner Placement",
    category: "Placement",
    owner_name: "Careers & Partnerships",
    month_year: "2026-11",
    status: KPI_STATUSES.NOT_STARTED,
    progress_percent: 0,
    target_metric: "75% Placement Rate",
    current_metric: "0% (Starts Nov)",
    notes: "Scheduled post CAP Cohort 3 Demo Day.",
    last_updated: "2026-10-01T08:00:00Z",
  },
];

const LOCAL_STORAGE_KEY = "trainai_kpi_activities_cache_v1";

function getCachedKpis() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCachedKpis(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export async function fetchKpiActivities({ organizationId, monthYear } = {}) {
  if (!supabase) {
    let items = getCachedKpis() || SEED_KPI_ACTIVITIES;
    if (monthYear && monthYear !== "all") {
      items = items.filter((k) => k.month_year === monthYear);
    }
    return items;
  }

  try {
    let query = supabase
      .from("kpi_activities")
      .select("*")
      .order("created_at", { ascending: false });

    if (organizationId && organizationId !== "demo-org-id") {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    }
    if (monthYear && monthYear !== "all") {
      query = query.eq("month_year", monthYear);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      const cached = getCachedKpis() || SEED_KPI_ACTIVITIES;
      if (monthYear && monthYear !== "all") {
        return cached.filter((k) => k.month_year === monthYear);
      }
      return cached;
    }
    saveCachedKpis(data);
    return data;
  } catch {
    return getCachedKpis() || SEED_KPI_ACTIVITIES;
  }
}

export async function updateKpiActivityStatus(kpiId, { status, progressPercent, notes }) {
  const patch = {
    status,
    last_updated: new Date().toISOString(),
  };
  if (typeof progressPercent === "number") patch.progress_percent = progressPercent;
  if (notes !== undefined) patch.notes = notes;

  if (supabase) {
    try {
      const { error } = await supabase.from("kpi_activities").update(patch).eq("id", kpiId);
      if (!error) return { success: true };
    } catch {}
  }

  // Update local cache
  const items = getCachedKpis() || SEED_KPI_ACTIVITIES;
  const updated = items.map((item) => (item.id === kpiId ? { ...item, ...patch } : item));
  saveCachedKpis(updated);
  return { success: true };
}

export async function createKpiActivity({ title, category, ownerName, monthYear, targetMetric, organizationId }) {
  const newRow = {
    id: `kpi-${Date.now()}`,
    organization_id: organizationId || null,
    title,
    category: category || "Operations",
    owner_name: ownerName || "Train AI Team",
    month_year: monthYear || new Date().toISOString().slice(0, 7),
    status: KPI_STATUSES.NOT_STARTED,
    progress_percent: 0,
    target_metric: targetMetric || "100%",
    current_metric: "0%",
    notes: "",
    last_updated: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data, error } = await supabase.from("kpi_activities").insert(newRow).select().maybeSingle();
      if (!error && data) return { success: true, data };
    } catch {}
  }

  const items = getCachedKpis() || SEED_KPI_ACTIVITIES;
  const updated = [newRow, ...items];
  saveCachedKpis(updated);
  return { success: true, data: newRow };
}
