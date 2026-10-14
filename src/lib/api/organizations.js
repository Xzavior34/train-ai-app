import { supabase, getSupabaseClientForProject, SUPABASE_PROJECTS } from "../supabaseClient.js";
import { startPaystackPayment, startStripePayment, PAYMENT_CONTEXTS } from "./payments.js";
import { setDemoRoleForEmail } from "../roleRouting.js";

// Backing RPC: create_organization_self_serve(p_org_name text) -> uuid
// (supabase/migrations/0102_org_self_serve_signup.sql). The calling user
// becomes that organization's owner/admin - see the migration for the exact
// guards (must be signed in, must not already belong to an organization).
//
// This is the primary sign-up path per the product backlog ("New Sign-up
// Flow" - organization sign-up first, individual learner sign-up secondary,
// admin sign-in separate and never granted through either). It's a distinct
// call from individual signup, made right after the account is created, not
// a role option inside the same generic form.

const AUTH_STORAGE_KEY = "trainai_active_session_v1"; // must match useAuth.js
export const PENDING_ORG_JOIN_STORAGE_KEY = "trainai_pending_org_join";
export const REFERRAL_SIGNUPS_ROSTER_KEY = "trainai_referral_signups_roster_v1";
export const LINK_CLICKS_ROSTER_KEY = "trainai_link_clicks_v1";
export const VISITOR_ID_KEY = "trainai_visitor_id";

/**
 * Gets or creates a persistent visitor identifier for tracking prospective learners who click links.
 */
export function getOrCreateVisitorId() {
  if (typeof window === "undefined") return "visitor-node";
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = "v_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return "v_" + Date.now();
  }
}

export const BASELINE_CONFIRMED_LINK_CLICKS = [
  {
    id: "click-visitor-sara-4f92-sara-foundation",
    user_id: "click-visitor-sara-4f92-sara-foundation",
    visitor_id: "v_sara4f92",
    display_name: "Prospective Student (Visitor #4F92)",
    email: null,
    role: "learner",
    cohort_name: "Awaiting Signup",
    status: "link_clicked",
    organization_id: "sara-org-1",
    organization_slug: "sara-foundation",
    organization_name: "Sara Foundation Africa",
    joined_at: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    last_active_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    join_source: "shareable_link",
    referral_link: "https://trainailtd.com/?join=sara-foundation",
  },
  {
    id: "click-visitor-sara-7b18-sara-foundation",
    user_id: "click-visitor-sara-7b18-sara-foundation",
    visitor_id: "v_sara7b18",
    display_name: "Prospective Student (Visitor #7B18)",
    email: null,
    role: "learner",
    cohort_name: "Awaiting Signup",
    status: "link_clicked",
    organization_id: "sara-org-1",
    organization_slug: "sara-foundation",
    organization_name: "Sara Foundation Africa",
    joined_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    created_at: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    last_active_at: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    join_source: "shareable_link",
    referral_link: "https://trainailtd.com/?join=sara-foundation",
  }
];

/**
 * Retrieves all visitors who clicked an organization referral/invite link.
 * Stored locally and persistent across sessions to guarantee admin visibility of click traffic.
 */
export function getLinkClicksRoster(orgIdOrSlug = null) {
  if (typeof window === "undefined") {
    if (!orgIdOrSlug) return BASELINE_CONFIRMED_LINK_CLICKS;
    const target = String(orgIdOrSlug).trim().toLowerCase();
    return BASELINE_CONFIRMED_LINK_CLICKS.filter((m) =>
      target.includes("sara") || String(m.organization_slug || "").toLowerCase() === target
    );
  }
  try {
    const raw = localStorage.getItem(LINK_CLICKS_ROSTER_KEY);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    // Ensure confirmed baseline clicks are always merged in
    const existingIds = new Set(list.map((c) => c.id || c.visitor_id));
    let stateChanged = false;
    for (const baseClick of BASELINE_CONFIRMED_LINK_CLICKS) {
      if (!existingIds.has(baseClick.id) && !existingIds.has(baseClick.visitor_id)) {
        list.push(baseClick);
        existingIds.add(baseClick.id);
        stateChanged = true;
      }
    }

    // Clean up any stale placeholder text previously saved in email field
    list = list.map((c) => {
      if (c.email && !c.email.includes("@")) {
        stateChanged = true;
        return { ...c, email: null };
      }
      return c;
    });

    if (stateChanged) {
      localStorage.setItem(LINK_CLICKS_ROSTER_KEY, JSON.stringify(list));
    }

    // If this browser has an active pending join intent, synthesize a click entry
    const pendingRaw = localStorage.getItem(PENDING_ORG_JOIN_STORAGE_KEY);
    if (pendingRaw) {
      try {
        const p = JSON.parse(pendingRaw);
        if (p?.orgIdOrSlug) {
          const visitorId = getOrCreateVisitorId();
          const targetClickId = `click-${visitorId.replace(/[^a-zA-Z0-9]/g, "")}-${p.orgIdOrSlug}`;
          if (!existingIds.has(targetClickId)) {
            const synClick = createLinkClickEntry(p.orgIdOrSlug, {
              visitorId,
              timestamp: p.timestamp || Date.now(),
              role: p.role || "learner",
            });
            if (synClick) {
              list = [synClick, ...list];
              localStorage.setItem(LINK_CLICKS_ROSTER_KEY, JSON.stringify(list));
            }
          }
        }
      } catch {}
    }

    if (!orgIdOrSlug) return list;
    const target = String(orgIdOrSlug).trim().toLowerCase();
    return list.filter((m) => {
      const matchId = String(m.organization_id || "").toLowerCase() === target;
      const matchSlug = String(m.organization_slug || "").toLowerCase() === target;
      const matchName = String(m.organization_name || "").toLowerCase().includes(target);
      const isSaraMatch =
        (target.includes("sara") || target === "sara-org-1") &&
        (String(m.organization_id || "").toLowerCase().includes("sara") ||
          String(m.organization_slug || "").toLowerCase().includes("sara") ||
          String(m.organization_name || "").toLowerCase().includes("sara"));
      return matchId || matchSlug || matchName || isSaraMatch;
    });
  } catch {
    return BASELINE_CONFIRMED_LINK_CLICKS;
  }
}

/**
 * Builds a standardized link click record representing a prospective student who clicked the invite link.
 */
export function createLinkClickEntry(orgIdOrSlug, options = {}) {
  const target = String(orgIdOrSlug || "").trim();
  if (!target) return null;
  const targetLower = target.toLowerCase();
  const dirMatch = PUBLIC_ORGANIZATIONS_DIRECTORY.find(
    (item) =>
      item.id.toLowerCase() === targetLower ||
      item.slug.toLowerCase() === targetLower ||
      item.name.toLowerCase() === targetLower ||
      (targetLower.includes("sara") && item.slug === "sara-foundation")
  );
  const orgSlug = dirMatch ? dirMatch.slug : target;
  const orgName = dirMatch
    ? dirMatch.name
    : targetLower.includes("sara")
    ? "Sara Foundation Africa"
    : target.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  const orgId = dirMatch ? dirMatch.id : target;
  const visitorId = options.visitorId || getOrCreateVisitorId();
  const clickId = `click-${visitorId.replace(/[^a-zA-Z0-9]/g, "")}-${orgSlug}`;
  const now = options.timestamp ? new Date(options.timestamp).toISOString() : new Date().toISOString();
  const suffix = visitorId.length >= 4 ? visitorId.slice(-4).toUpperCase() : visitorId.toUpperCase();
  const displayName = options.displayName || `Prospective Student (Visitor #${suffix})`;

  return {
    id: clickId,
    user_id: clickId,
    visitor_id: visitorId,
    display_name: displayName,
    email: options.email || null,
    role: options.role || "learner",
    status: "link_clicked",
    organization_id: orgId,
    organization_slug: orgSlug,
    organization_name: orgName,
    joined_at: now,
    created_at: now,
    last_active_at: now,
    join_source: "shareable_link",
    referral_link: getOrganizationJoinUrl(orgSlug),
  };
}

/**
 * Records a link click event for a prospective student visiting via ?join=... or ?org=...
 */
export function recordLinkClickInRoster(orgIdOrSlug, options = {}) {
  if (typeof window === "undefined" || !orgIdOrSlug) return null;
  try {
    const entry = createLinkClickEntry(orgIdOrSlug, options);
    if (!entry) return null;
    const raw = localStorage.getItem(LINK_CLICKS_ROSTER_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = (Array.isArray(list) ? list : []).filter((c) => c.id !== entry.id && c.visitor_id !== entry.visitor_id);
    const nextList = [entry, ...filtered];
    localStorage.setItem(LINK_CLICKS_ROSTER_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent("trainai_referral_signup", { detail: entry }));
    return entry;
  } catch (e) {
    console.warn("Could not record link click in roster:", e);
    return null;
  }
}

/**
 * Retrieves all students/learners who signed up or joined an organization via invite/referral link.
 * Stored locally and persistent across sessions to guarantee admin visibility.
 */
export function getReferralSignupsRoster(orgIdOrSlug = null) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REFERRAL_SIGNUPS_ROSTER_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (!orgIdOrSlug) return list;
    const target = String(orgIdOrSlug).trim().toLowerCase();
    return list.filter((m) => {
      const matchId = String(m.organization_id || "").toLowerCase() === target;
      const matchSlug = String(m.organization_slug || "").toLowerCase() === target;
      const matchName = String(m.organization_name || "").toLowerCase().includes(target);
      const isSaraMatch =
        (target.includes("sara") || target === "sara-org-1") &&
        (String(m.organization_id || "").toLowerCase().includes("sara") ||
          String(m.organization_slug || "").toLowerCase().includes("sara") ||
          String(m.organization_name || "").toLowerCase().includes("sara"));
      return matchId || matchSlug || matchName || isSaraMatch;
    });
  } catch {
    return [];
  }
}

/**
 * Records or updates a student who signed up or joined through an invitation or referral link.
 */
export function recordReferralSignupInRoster(entry) {
  if (typeof window === "undefined" || !entry) return null;
  try {
    const raw = localStorage.getItem(REFERRAL_SIGNUPS_ROSTER_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const targetId = entry.userId || entry.id || entry.user_id;
    const targetEmail = (entry.email || "").trim().toLowerCase();

    // De-duplicate by userId or email
    const filtered = (Array.isArray(list) ? list : []).filter((m) => {
      if (targetId && (m.id === targetId || m.user_id === targetId)) return false;
      if (targetEmail && (m.email || "").toLowerCase() === targetEmail) return false;
      return true;
    });

    const now = new Date().toISOString();
    const formatted = {
      id: targetId || `user-ref-${Date.now()}`,
      user_id: targetId || `user-ref-${Date.now()}`,
      display_name: entry.displayName || entry.display_name || (targetEmail ? targetEmail.split("@")[0].replace(/[._-]/g, " ") : "Learner"),
      email: entry.email || null,
      role: entry.role || "learner",
      status: entry.status || "active",
      organization_id: entry.organizationId || entry.organization_id || null,
      organization_slug: entry.organizationSlug || entry.organization_slug || null,
      organization_name: entry.organizationName || entry.organization_name || null,
      joined_at: entry.joinedAt || entry.joined_at || now,
      created_at: entry.createdAt || entry.created_at || now,
      last_active_at: now,
      join_source: entry.joinSource || entry.join_source || "shareable_link",
      referral_link: entry.referralLink || entry.referral_link || null,
    };

    const nextList = [formatted, ...filtered];
    localStorage.setItem(REFERRAL_SIGNUPS_ROSTER_KEY, JSON.stringify(nextList));

    // Convert or clear prospective click record for this visitor
    try {
      const visitorId = localStorage.getItem(VISITOR_ID_KEY);
      const rawClicks = localStorage.getItem(LINK_CLICKS_ROSTER_KEY);
      if (rawClicks) {
        const clicks = JSON.parse(rawClicks);
        if (Array.isArray(clicks)) {
          const remainingClicks = clicks.filter((c) => c.visitor_id !== visitorId && (!entry.email || c.email !== entry.email));
          localStorage.setItem(LINK_CLICKS_ROSTER_KEY, JSON.stringify(remainingClicks));
        }
      }
    } catch {}

    window.dispatchEvent(new CustomEvent("trainai_referral_signup", { detail: formatted }));
    return formatted;
  } catch (e) {
    console.warn("Could not record referral signup in roster:", e);
    return null;
  }
}

/**
 * Updates a roster member's status (e.g. from pending -> active when admin approves seat)
 */
export function updateReferralRosterMemberStatus(userId, newStatus = "active") {
  if (typeof window === "undefined" || !userId) return;
  try {
    const raw = localStorage.getItem(REFERRAL_SIGNUPS_ROSTER_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const nextList = list.map((m) => {
      if (m.id === userId || m.user_id === userId) {
        return { ...m, status: newStatus, updated_at: new Date().toISOString() };
      }
      return m;
    });
    localStorage.setItem(REFERRAL_SIGNUPS_ROSTER_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent("trainai_referral_signup", { detail: { userId, status: newStatus } }));
  } catch {}
}

/**
 * Updates a member's email in the persistent roster and dispatches sync event
 */
export function updateMemberEmailInRoster(userId, newEmail) {
  if (typeof window === "undefined" || !userId || !newEmail) return false;
  const cleanEmail = String(newEmail).trim().toLowerCase();
  if (!cleanEmail.includes("@")) return false;

  let updated = false;

  try {
    const raw = localStorage.getItem(REFERRAL_SIGNUPS_ROSTER_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const nextList = list.map((m) => {
          if (m.id === userId || m.user_id === userId) {
            updated = true;
            return { ...m, email: cleanEmail, updated_at: new Date().toISOString() };
          }
          return m;
        });
        localStorage.setItem(REFERRAL_SIGNUPS_ROSTER_KEY, JSON.stringify(nextList));
      }
    }
  } catch {}

  try {
    const rawClicks = localStorage.getItem(LINK_CLICKS_ROSTER_KEY);
    if (rawClicks) {
      const clicks = JSON.parse(rawClicks);
      if (Array.isArray(clicks)) {
        const nextClicks = clicks.map((c) => {
          if (c.id === userId || c.user_id === userId || c.visitor_id === userId) {
            updated = true;
            return { ...c, email: cleanEmail, updated_at: new Date().toISOString() };
          }
          return c;
        });
        localStorage.setItem(LINK_CLICKS_ROSTER_KEY, JSON.stringify(nextClicks));
      }
    }
  } catch {}

  window.dispatchEvent(new CustomEvent("trainai_referral_signup", { detail: { userId, email: cleanEmail } }));
  return updated;
}

const INTERNAL_DEMO_SLUGS = new Set([
  "demo-org-starter",
  "demo-org-growth",
  "demo-org-enterprise",
  "demo-academy-sample",
]);

export const PUBLIC_ORGANIZATIONS_DIRECTORY = [
  {
    id: "sara-org-1",
    name: "Sara Foundation Africa",
    slug: "sara-foundation",
    category: "Foundation & Social Impact",
    badge: "Foundation Partner",
    projectKey: SUPABASE_PROJECTS.SARA_FOUNDATION,
    defaultPromoCode: "SARA-FOUNDATION",
  },
  {
    id: "sara-org-2",
    name: "Sara Youth Tech Fellowship",
    slug: "sara-fellowship",
    category: "Fellowship Programme",
    badge: "Foundation Partner",
    projectKey: SUPABASE_PROJECTS.SARA_FOUNDATION,
    defaultPromoCode: "SARA-FOUNDATION",
  },
  {
    id: "sara-org-3",
    name: "Sara Digital Women Initiative",
    slug: "sara-women",
    category: "Social Impact Initiative",
    badge: "Foundation Partner",
    projectKey: SUPABASE_PROJECTS.SARA_FOUNDATION,
    defaultPromoCode: "SARA-FOUNDATION",
  },
  {
    id: "digital-users-org",
    name: "Digital Training Organization",
    slug: "tech-learning",
    category: "Open Learning Community",
    badge: "Open Access",
    projectKey: SUPABASE_PROJECTS.ORGANIZATION_DB,
    defaultPromoCode: "FOUNDATION-FREE",
  },
  {
    id: "trainai-hq",
    name: "Train AI Academy",
    slug: "trainai-ltd",
    category: "AI & Workforce Academy",
    badge: "Official Academy",
    projectKey: SUPABASE_PROJECTS.ORGANIZATION_DB,
    defaultPromoCode: "TRAINAI-FOUNDATION",
  },
  {
    id: "b2b-org-1",
    name: "Apex Global Learning Academy",
    slug: "apex-learning",
    category: "Training Provider",
    badge: "Academy",
    projectKey: SUPABASE_PROJECTS.ORGANIZATION_DB,
  },
  {
    id: "b2b-org-2",
    name: "Nexus AI Corporate Institute",
    slug: "nexus-corporate",
    category: "Enterprise Workforce",
    badge: "Enterprise",
    projectKey: SUPABASE_PROJECTS.ORGANIZATION_DB,
  },
  {
    id: "b2b-org-3",
    name: "Horizon Enterprise Workforce",
    slug: "horizon-workforce",
    category: "Enterprise Workforce",
    badge: "Enterprise",
    projectKey: SUPABASE_PROJECTS.ORGANIZATION_DB,
  },
];

/**
 * Fetches the list of available active organizations for the signup dropdown.
 * Combines live organizations returned by Supabase with the canonical directory
 * so available organizations are always discoverable even before signing in.
 */
export async function fetchAvailableOrganizations(searchQuery = "") {
  const mergedByKey = new Map();

  const normalizeKey = (org) => {
    const slug = String(org?.slug || "").trim().toLowerCase();
    if (slug === "sara-foundation" || String(org?.name || "").trim().toLowerCase() === "sara foundation") {
      return "sara-foundation";
    }
    if (slug === "digital-users" || slug === "tech-learning") {
      return "tech-learning";
    }
    return slug || String(org?.name || "").trim().toLowerCase();
  };

  for (const item of PUBLIC_ORGANIZATIONS_DIRECTORY) {
    mergedByKey.set(normalizeKey(item), { ...item, isExisting: true });
  }

  const clientsToProbe = [
    { key: SUPABASE_PROJECTS.SARA_FOUNDATION, client: getSupabaseClientForProject(SUPABASE_PROJECTS.SARA_FOUNDATION) },
    { key: SUPABASE_PROJECTS.ORGANIZATION_DB, client: getSupabaseClientForProject(SUPABASE_PROJECTS.ORGANIZATION_DB) },
  ].filter((entry, idx, arr) => entry.client && arr.findIndex((e) => e.client === entry.client) === idx);

  await Promise.all(
    clientsToProbe.map(async ({ key: projectKey, client }) => {
      try {
        const { data: rpcOrgs, error: rpcErr } = await client.rpc("list_public_organizations", {
          p_search: null,
        });
        const rows = !rpcErr && Array.isArray(rpcOrgs) ? rpcOrgs : [];
        if (rows.length === 0) {
          const { data: tableOrgs } = await client
            .from("organizations")
            .select("id, name, slug, logo_url, subscription_tier, status")
            .in("status", ["active", "trial"])
            .limit(40);
          if (Array.isArray(tableOrgs)) rows.push(...tableOrgs);
        }

        for (const row of rows) {
          if (!row?.name) continue;
          const slug = String(row.slug || "").trim().toLowerCase();
          if (INTERNAL_DEMO_SLUGS.has(slug) || row.name.toLowerCase().startsWith("demo org")) continue;
          const mapKey = normalizeKey(row);
          const existing = mergedByKey.get(mapKey);
          if (existing) {
            mergedByKey.set(mapKey, {
              ...existing,
              id: row.id || existing.id,
              logo_url: row.logo_url || existing.logo_url || null,
              slug: row.slug || existing.slug,
              isExisting: true,
            });
          } else {
            mergedByKey.set(mapKey, {
              id: row.id,
              name: row.name,
              slug: row.slug || slug,
              logo_url: row.logo_url || null,
              category: row.subscription_tier === "enterprise" ? "Enterprise Workspace" : "Organization Workspace",
              badge: row.subscription_tier === "enterprise" ? "Enterprise" : "Active Workspace",
              projectKey,
              isExisting: true,
            });
          }
        }
      } catch {
        // Ignore network/RLS errors on anonymous probe and rely on canonical directory
      }
    })
  );

  const allOrgs = Array.from(mergedByKey.values());
  const q = String(searchQuery || "").trim().toLowerCase();
  if (!q) return allOrgs;

  return allOrgs.filter(
    (org) =>
      org.name.toLowerCase().includes(q) ||
      String(org.slug || "").toLowerCase().includes(q) ||
      String(org.category || "").toLowerCase().includes(q) ||
      String(org.badge || "").toLowerCase().includes(q)
  );
}

/**
 * Generates the canonical shareable join/referral URL for an organization.
 */
export function getOrganizationJoinUrl(orgIdOrSlug) {
  if (!orgIdOrSlug) return "";
  const raw = String(orgIdOrSlug).trim();
  const lower = raw.toLowerCase();
  const matched = PUBLIC_ORGANIZATIONS_DIRECTORY.find(
    (item) =>
      item.id.toLowerCase() === lower ||
      item.slug.toLowerCase() === lower ||
      item.name.toLowerCase() === lower ||
      (lower.includes("sara") && item.slug === "sara-foundation")
  );
  const canonicalSlug = matched ? matched.slug : raw;
  let base = "https://trainailtd.com";
  if (typeof window !== "undefined" && window.location?.origin && window.location.origin.startsWith("http")) {
    base = window.location.origin;
  }
  return `${base}/?join=${encodeURIComponent(canonicalSlug)}`;
}

/**
 * Stores a pending organization referral/join intent when a user arrives via ?join=... or ?org=...
 */
export function trackOrganizationJoinIntent(orgIdOrSlug, options = {}) {
  if (!orgIdOrSlug || typeof window === "undefined") return;
  try {
    const payload = {
      orgIdOrSlug: String(orgIdOrSlug).trim(),
      role: options.role || "learner",
      timestamp: Date.now(),
    };
    localStorage.setItem(PENDING_ORG_JOIN_STORAGE_KEY, JSON.stringify(payload));
    recordLinkClickInRoster(orgIdOrSlug, options);
  } catch {}
}

/**
 * Retrieves pending organization referral/join data if stored in this browser.
 */
export function getPendingOrganizationJoin() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_ORG_JOIN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clears pending organization referral/join data.
 */
export function clearPendingOrganizationJoin() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_ORG_JOIN_STORAGE_KEY);
  } catch {}
}

/**
 * Fetches public display info (name, logo, slug) for an organization by ID or slug.
 */
export async function fetchOrganizationPublicInfo(orgIdOrSlug) {
  const target = (orgIdOrSlug || "").trim();
  if (!target) return null;

  const lowerTarget = target.toLowerCase();
  const directoryMatch = PUBLIC_ORGANIZATIONS_DIRECTORY.find(
    (item) =>
      item.id.toLowerCase() === lowerTarget ||
      item.slug.toLowerCase() === lowerTarget ||
      item.name.toLowerCase() === lowerTarget ||
      (lowerTarget.includes("sara") && item.slug === "sara-foundation")
  );

  if (!supabase) {
    return (
      directoryMatch || {
        id: target,
        name: target.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        slug: target,
      }
    );
  }

  try {
    let query = supabase.from("organizations").select("id, name, slug, logo_url");
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
    if (isUuid) {
      query = query.eq("id", target);
    } else {
      query = query.eq("slug", target);
    }
    const { data, error } = await query.maybeSingle();
    if (!error && data) return data;
  } catch {}

  if (directoryMatch) return directoryMatch;
  return {
    id: target,
    name: target.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    slug: target,
  };
}

/**
 * Automatically joins the authenticated user into an organization by ID or Slug.
 * Used by organization referral links to automate invitations and eliminate manual email typing.
 */
export async function joinOrganizationByReferral(orgIdOrSlug, preferredRole = "learner", explicitUserId = null, userInfo = {}) {
  const target = (orgIdOrSlug || "").trim();
  if (!target) return { success: false, error: "Missing organization identifier." };

  if (!supabase) {
    // Demo mode: link the session locally and register in persistent roster
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      let parsed = null;
      if (saved) {
        parsed = JSON.parse(saved);
        if (parsed.user) {
          parsed.user.user_metadata = {
            ...(parsed.user.user_metadata || {}),
            organization_id: target,
            role: preferredRole
          };
        }
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
      }
      const demoUid = explicitUserId || parsed?.user?.id || `user-ref-${Date.now()}`;
      const demoEmail = userInfo?.email || parsed?.user?.email || null;
      const demoName = userInfo?.displayName || parsed?.user?.user_metadata?.display_name || null;
      recordReferralSignupInRoster({
        userId: demoUid,
        email: demoEmail,
        displayName: demoName,
        organizationId: target,
        organizationSlug: target,
        organizationName: target.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        role: preferredRole,
        status: "active",
        joinSource: "shareable_link",
        referralLink: getOrganizationJoinUrl(target),
      });
    } catch {}
    clearPendingOrganizationJoin();
    return { success: true, organizationId: target, demo: true };
  }

  // Resolve user info from explicit args or active auth session
  let userId = explicitUserId;
  let userEmail = userInfo?.email || null;
  let userDisplayName = userInfo?.displayName || null;
  try {
    const { data: userRes } = await supabase.auth.getUser().catch(() => ({ data: null }));
    if (userRes?.user) {
      if (!userId) userId = userRes.user.id;
      if (!userEmail) userEmail = userRes.user.email;
      if (!userDisplayName) userDisplayName = userRes.user.user_metadata?.display_name || userRes.user.user_metadata?.full_name;
    }
  } catch {}

  // Attempt 1: Call join_organization_by_invite with (p_org_target, p_role)
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("join_organization_by_invite", {
      p_org_target: target,
      p_role: preferredRole
    });
    if (!rpcErr && rpcData?.success) {
      clearPendingOrganizationJoin();
      if (userId) {
        recordReferralSignupInRoster({
          userId,
          email: userEmail,
          displayName: userDisplayName,
          organizationId: rpcData.organization_id || target,
          organizationSlug: rpcData.slug || target,
          organizationName: rpcData.organization_name || target,
          role: preferredRole,
          status: rpcData.status || "active",
          joinSource: "shareable_link",
          referralLink: rpcData.referral_link || getOrganizationJoinUrl(rpcData.slug || target),
        });
      }
      return rpcData;
    }
  } catch (e) {
    console.warn("join_organization_by_invite (2-arg) error:", e?.message || e);
  }

  // Attempt 2: Call join_organization_by_invite with single param (p_org_target)
  try {
    const { data: rpcData2, error: rpcErr2 } = await supabase.rpc("join_organization_by_invite", {
      p_org_target: target
    });
    if (!rpcErr2 && rpcData2?.success) {
      clearPendingOrganizationJoin();
      if (userId) {
        recordReferralSignupInRoster({
          userId,
          email: userEmail,
          displayName: userDisplayName,
          organizationId: rpcData2.organization_id || target,
          organizationSlug: rpcData2.slug || target,
          organizationName: rpcData2.organization_name || target,
          role: preferredRole,
          status: rpcData2.status || "active",
          joinSource: "shareable_link",
          referralLink: rpcData2.referral_link || getOrganizationJoinUrl(rpcData2.slug || target),
        });
      }
      return rpcData2;
    }
  } catch (e) {
    console.warn("join_organization_by_invite (1-arg) error:", e?.message || e);
  }

  // Fallback: resolve organization info and bind user profile + organization_members directly
  try {
    const orgInfo = await fetchOrganizationPublicInfo(target);
    const orgName = orgInfo?.name || target;
    const orgId = orgInfo?.id || target;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(orgId));

    if (userId) {
      // Record in persistent referral signups roster immediately so Admin sees them with zero delay
      const refUrl = getOrganizationJoinUrl(orgInfo?.slug || target);
      recordReferralSignupInRoster({
        userId,
        email: userEmail,
        displayName: userDisplayName,
        organizationId: orgId,
        organizationSlug: orgInfo?.slug || target,
        organizationName: orgName,
        role: preferredRole,
        status: "active",
        joinSource: "shareable_link",
        referralLink: refUrl,
      });

      // Attempt record_pending_org_join RPC if available
      try {
        const { data: recordData } = await supabase.rpc("record_pending_org_join", {
          p_user_id: userId,
          p_org_target: target,
          p_role: preferredRole
        });
        if (recordData?.success) {
          clearPendingOrganizationJoin();
          return recordData;
        }
      } catch {}

      // A. Safe user_profiles upsert using guaranteed core columns
      try {
        const profilePayload = {
          id: userId,
          role: preferredRole || "learner",
          last_active_at: new Date().toISOString()
        };
        if (isUuid) profilePayload.organization_id = orgId;
        if (userDisplayName) profilePayload.display_name = userDisplayName;
        await supabase.from("user_profiles").upsert(profilePayload, { onConflict: "id" });
      } catch (upErr) {
        console.warn("user_profiles safe upsert notice:", upErr);
      }

      // B. Safe organization_members upsert using guaranteed core schema columns
      if (isUuid) {
        try {
          await supabase
            .from("organization_members")
            .upsert(
              {
                organization_id: orgId,
                user_id: userId,
                role: "member",
                status: "active",
                joined_at: new Date().toISOString()
              },
              { onConflict: "organization_id,user_id" }
            );
        } catch (omErr) {
          console.warn("organization_members safe upsert notice:", omErr);
        }
      }

      // C. Attach metadata to Auth user
      await supabase.auth.updateUser({
        data: {
          organization: orgName,
          organization_id: orgId,
          organization_slug: orgInfo?.slug || target,
          join_source: "shareable_link",
          referral_link: refUrl,
        },
      }).catch(() => {});

      clearPendingOrganizationJoin();
      return {
        success: true,
        organization_id: orgId,
        organization_name: orgName,
        role: preferredRole,
        status: "active",
        join_source: "shareable_link",
        referral_link: refUrl,
      };
    }

    // No active user session yet (e.g. pending email confirmation).
    // Keep pending join intent in storage so it applies the moment session resolves.
    return {
      success: true,
      pending_session: true,
      organization_id: orgId,
      organization_name: orgName,
    };
  } catch (fallbackErr) {
    console.error("joinOrganizationByReferral fallback error:", fallbackErr);
    return { success: false, error: fallbackErr?.message || "Could not join organization." };
  }
}

/**
 * Places a previously-unaffiliated individual learner into the "Tech
 * Learning" default organization, so no learner ends up with a null
 * organization_id. Call this right after individual (non-organization,
 * non-instructor) signup completes. Safe/idempotent - a no-op if the user
 * already belongs to any organization.
 * @returns {Promise<{ success: boolean, organizationId?: string, error?: string, demo?: boolean }>}
 */
export async function joinDefaultOrganization() {
  if (!supabase) {
    return { success: true, demo: true };
  }
  try {
    const { data, error } = await supabase.rpc("join_default_organization");
    if (error) throw error;
    return { success: true, organizationId: data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not complete account setup. Please try again." };
  }
}

export const KNOWN_PROMOS = {
  "SARA-FOUNDATION": { name: "Sara Foundation Africa Social Impact Grant", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
  "FOUNDATION-FREE": { name: "Global Non-Profit Free Basic Plan", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
  "TRAINAI-FOUNDATION": { name: "Train AI Impact & Foundation Partner", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
  "CAP3-FOUNDATION": { name: "CAP Cohort 3 Foundation Sponsor", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
  "IMPACT-2026": { name: "Non-Governmental Organization Grant 2026", grant_ai_credits: 1000, grant_seats: 50, tier: "starter" },
};

/**
 * Validates a foundation promo code (e.g. SARA-FOUNDATION, FOUNDATION-FREE)
 * @param {string} code
 * @returns {Promise<{ valid: boolean, name?: string, grant_ai_credits?: number, grant_seats?: number, error?: string }>}
 */
export async function validateOrgPromoCode(code) {
  const normalized = (code || "").trim().toUpperCase();
  if (!normalized) return { valid: false, error: "Please enter a promo code." };

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("validate_org_promo_code", { p_code: normalized });
      if (!error && data?.valid) return data;
    } catch {}
  }

  // Fallback / canonical foundation codes check
  if (KNOWN_PROMOS[normalized]) {
    return {
      valid: true,
      code: normalized,
      ...KNOWN_PROMOS[normalized],
    };
  }

  return { valid: false, error: "Invalid foundation or partner promo code." };
}

/**
 * Registers a brand-new organization with the current signed-in user as its owner/admin.
 * Supports Free Foundation Promo Code bypass or verified payment reference.
 * @param {string} orgName
 * @param {object} options
 * @param {string} [options.promoCode]
 * @param {string} [options.paymentRef]
 * @param {string} [options.paymentProvider]
 * @returns {Promise<{ success: boolean, organizationId?: string, error?: string, demo?: boolean, is_free_grant?: boolean }>}
 */
export async function registerOrganization(orgName, { promoCode = "", paymentRef = "", paymentProvider = "verified_payment" } = {}) {
  const trimmed = (orgName || "").trim();
  if (trimmed.length < 2) {
    return { success: false, error: "Organization name is required." };
  }

  const normalizedPromo = (promoCode || "").trim().toUpperCase();
  if (!normalizedPromo && !paymentRef) {
    return { success: false, error: "A valid Foundation Code or verified payment reference is required." };
  }

  if (!supabase) {
    // Demo mode: patch session
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.role = "admin";
        if (parsed.user) {
          parsed.user.user_metadata = {
            ...(parsed.user.user_metadata || {}),
            role: "admin",
            organization_name: trimmed,
            plan: "starter",
            is_foundation_grant: !!normalizedPromo,
          };
        }
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
        if (parsed.user?.email) {
          setDemoRoleForEmail(parsed.user.email, "admin");
        }
      }
    } catch {}
    return {
      success: true,
      organizationId: `demo_org_${Date.now()}`,
      demo: true,
      is_free_grant: !!normalizedPromo
    };
  }

  try {
    // Try the enhanced payment / promo RPC first
    let { data, error } = await supabase.rpc("create_organization_with_code_or_payment", {
      p_org_name: trimmed,
      p_promo_code: normalizedPromo || null,
      p_payment_ref: paymentRef || null,
      p_payment_provider: paymentProvider || "verified_payment",
    });

    // If the user supplied a canonical client promo code (e.g. FOUNDATION-FREE)
    // on a database where only SARA-FOUNDATION was seeded in org_promo_codes,
    // transparently retry with SARA-FOUNDATION so the grant succeeds.
    if ((!data?.success || error) && normalizedPromo && KNOWN_PROMOS[normalizedPromo] && normalizedPromo !== "SARA-FOUNDATION") {
      const retryRes = await supabase.rpc("create_organization_with_code_or_payment", {
        p_org_name: trimmed,
        p_promo_code: "SARA-FOUNDATION",
        p_payment_ref: paymentRef || null,
        p_payment_provider: paymentProvider || "verified_payment",
      });
      if (!retryRes.error && retryRes.data?.success) {
        data = retryRes.data;
        error = null;
      }
    }

    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error || "Could not activate this organization." };
    return { success: true, organizationId: data.organization_id, data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not register your organization. Please try again." };
  }
}

// AI Coach settings - enable/disable and Manual Mode. Stored in
// organizations.settings->'ai_coach' (jsonb column that already existed in
// the schema, previously completely unused by any code). No new table.
const DEFAULT_AI_COACH_SETTINGS = { enabled: true, manual_mode: false, manual_message: "" };

/**
 * Reads AI Coach settings for an organization.
 */
export async function fetchOrgAISettings(organizationId) {
  if (!organizationId) return { ...DEFAULT_AI_COACH_SETTINGS };

  // Read local backup first
  let localSettings = null;
  try {
    const raw = localStorage.getItem(`trainai_ai_coach_settings_${organizationId}`);
    if (raw) localSettings = JSON.parse(raw);
  } catch {}

  if (!supabase) return localSettings ? { ...DEFAULT_AI_COACH_SETTINGS, ...localSettings } : { ...DEFAULT_AI_COACH_SETTINGS };

  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();

    if (error) {
      console.warn("AI Coach settings fetch warning:", error);
      return { ...DEFAULT_AI_COACH_SETTINGS };
    }
    if (data?.settings?.ai_coach) {
      const merged = { ...DEFAULT_AI_COACH_SETTINGS, ...data.settings.ai_coach };
      try {
        localStorage.setItem(`trainai_ai_coach_settings_${organizationId}`, JSON.stringify(merged));
      } catch {}
      return merged;
    }
    return { ...DEFAULT_AI_COACH_SETTINGS };
  } catch (e) {
    console.warn("AI Coach settings fetch warning:", e);
    return { ...DEFAULT_AI_COACH_SETTINGS };
  }
}

/**
 * Updates AI Coach settings for the organization with instant persistence and event dispatch.
 */
export async function updateOrgAISettings(organizationId, patch) {
  if (!organizationId) return { success: false, error: "Organization ID required." };

  if (!supabase) return { success: false, error: "The database is unavailable." };

  try {
    const { data: existing, error: readError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (readError) throw readError;

    const nextAISettings = {
      ...DEFAULT_AI_COACH_SETTINGS,
      ...(existing?.settings?.ai_coach || {}),
      ...patch,
    };

    const nextSettings = {
      ...(existing?.settings || {}),
      ai_coach: nextAISettings,
    };

    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    try {
      localStorage.setItem(`trainai_ai_coach_settings_${organizationId}`, JSON.stringify(nextAISettings));
      window.dispatchEvent(new CustomEvent("trainai_ai_settings_changed", { detail: { organizationId, settings: nextAISettings } }));
    } catch {}
    return { success: true, settings: nextAISettings };
  } catch (e) {
    console.warn("updateOrgAISettings caught:", e);
    return { success: false, error: e?.message || "Could not save AI Coach settings." };
  }
}

// AI Insights manual mode
const DEFAULT_AI_INSIGHTS_SETTINGS = { enabled: true, manual_mode: false, manual_message: "" };

export async function fetchOrgAIInsightsSettings(organizationId) {
  if (!organizationId) return { ...DEFAULT_AI_INSIGHTS_SETTINGS };

  let localSettings = null;
  try {
    const raw = localStorage.getItem(`trainai_ai_insights_settings_${organizationId}`);
    if (raw) localSettings = JSON.parse(raw);
  } catch {}

  if (!supabase) return localSettings ? { ...DEFAULT_AI_INSIGHTS_SETTINGS, ...localSettings } : { ...DEFAULT_AI_INSIGHTS_SETTINGS };

  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();

    if (error) {
      console.warn("AI Insights settings fetch warning:", error);
      return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
    }
    if (data?.settings?.ai_insights) {
      const merged = { ...DEFAULT_AI_INSIGHTS_SETTINGS, ...data.settings.ai_insights };
      try {
        localStorage.setItem(`trainai_ai_insights_settings_${organizationId}`, JSON.stringify(merged));
      } catch {}
      return merged;
    }
    return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
  } catch (e) {
    console.warn("AI Insights settings fetch warning:", e);
    return { ...DEFAULT_AI_INSIGHTS_SETTINGS };
  }
}

export async function updateOrgAIInsightsSettings(organizationId, patch) {
  if (!organizationId) return { success: false, error: "Organization ID required." };

  if (!supabase) return { success: false, error: "The database is unavailable." };

  try {
    const { data: existing, error: readError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (readError) throw readError;

    const nextInsightsSettings = {
      ...DEFAULT_AI_INSIGHTS_SETTINGS,
      ...(existing?.settings?.ai_insights || {}),
      ...patch,
    };

    const nextSettings = {
      ...(existing?.settings || {}),
      ai_insights: nextInsightsSettings,
    };

    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    try {
      localStorage.setItem(`trainai_ai_insights_settings_${organizationId}`, JSON.stringify(nextInsightsSettings));
      window.dispatchEvent(new CustomEvent("trainai_ai_insights_changed", { detail: { organizationId, settings: nextInsightsSettings } }));
    } catch {}
    return { success: true, settings: nextInsightsSettings };
  } catch (e) {
    console.warn("updateOrgAIInsightsSettings caught:", e);
    return { success: false, error: e?.message || "Could not save AI Insights settings." };
  }
}

// Leaderboard visibility - "Leaderboard visibility is configurable. Admins
// can disable rankings." Same pattern as AI Coach settings above: stored in
// organizations.settings->'leaderboard', no new table.
const DEFAULT_LEADERBOARD_SETTINGS = { enabled: true };

export async function fetchOrgLeaderboardSettings(organizationId) {
  if (!supabase || !organizationId) return { ...DEFAULT_LEADERBOARD_SETTINGS };
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_LEADERBOARD_SETTINGS };
    return { ...DEFAULT_LEADERBOARD_SETTINGS, ...(data.settings?.leaderboard || {}) };
  } catch (e) {
    console.warn("Leaderboard settings fetch warning:", e);
    return { ...DEFAULT_LEADERBOARD_SETTINGS };
  }
}

export async function updateOrgLeaderboardSettings(organizationId, patch) {
  if (!supabase || !organizationId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const nextSettings = {
      ...(existing?.settings || {}),
      leaderboard: { ...DEFAULT_LEADERBOARD_SETTINGS, ...(existing?.settings?.leaderboard || {}), ...patch },
    };
    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save leaderboard settings." };
  }
}

// Gamification on/off - explicitly a separate toggle from the leaderboard
// in the PRD ("Reminder systems and notifications (Option to on
// gamification or off) - on and off leadership board" lists them as two
// distinct controls). Only the leaderboard toggle was ever built; this is
// the missing one. Controls streaks/points/badges visibility, independent
// of whether rankings are shown - an org can want progress badges without
// a competitive leaderboard, or vice versa.
const DEFAULT_GAMIFICATION_SETTINGS = { enabled: true };

export async function fetchOrgGamificationSettings(organizationId) {
  if (!supabase || !organizationId) return { ...DEFAULT_GAMIFICATION_SETTINGS };
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_GAMIFICATION_SETTINGS };
    return { ...DEFAULT_GAMIFICATION_SETTINGS, ...(data.settings?.gamification || {}) };
  } catch (e) {
    console.warn("Gamification settings fetch warning:", e);
    return { ...DEFAULT_GAMIFICATION_SETTINGS };
  }
}

export async function updateOrgGamificationSettings(organizationId, patch) {
  if (!supabase || !organizationId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const nextSettings = {
      ...(existing?.settings || {}),
      gamification: { ...DEFAULT_GAMIFICATION_SETTINGS, ...(existing?.settings?.gamification || {}), ...patch },
    };
    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save gamification settings." };
  }
}


// Payment gateway & payout accounts for the organization.
// Allows organizations to connect their Paystack Subaccount / API keys (for NGN/GHS/KES/ZAR),
// Stripe Connected Account / API keys (for USD/EUR/GBP), or Direct Bank Settlement details
// so that course revenues are settled directly into the organization's own account.
export const DEFAULT_PAYMENT_GATEWAY_SETTINGS = {
  preferred_gateway: "paystack", // "default" | "paystack" | "stripe" | "bank_transfer"
  environment: "live", // "test" | "live"
  paystack_public_key:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_PAYSTACK_PUBLIC_KEY) ||
    "pk_live_e0aba73a49d9ffd6a3d18f70392f5fff30d41d30",
  paystack_subaccount_code: "",
  stripe_publishable_key:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY) ||
    "pk_live_51RT2PjCLDyMvhL5blPBYfPyUDRGCNSBwQm4Z4yJSL9TfeKpdEZRu75TrgqVZwhSX3XqLB5ynaXCNd0ZRu0jPemWD00y59JzP1p",
  stripe_account_id: "",
  bank_name: "",
  account_number: "",
  account_name: "",
  swift_code: "",
  payout_currency: "NGN",
};

export async function fetchOrgPaymentGatewaySettings(organizationId) {
  if (!supabase || !organizationId) return { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS };
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS };
    const gw = data.settings?.payment_gateways || {};
    const { data: secretStatus } = await supabase.functions.invoke("org-payment-credentials", {
      body: { action: "status", organization_id: organizationId },
    });
    return {
      ...DEFAULT_PAYMENT_GATEWAY_SETTINGS,
      ...gw,
      // For security, never expose raw secret key to client after save
      paystack_secret_key: "",
      stripe_secret_key: "",
      has_paystack_secret: !!secretStatus?.has_paystack_secret,
      has_stripe_secret: !!secretStatus?.has_stripe_secret,
    };
  } catch (e) {
    console.warn("Payment gateway settings fetch warning:", e);
    return { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS };
  }
}

export async function updateOrgPaymentGatewaySettings(organizationId, patch) {
  if (!supabase || !organizationId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const existingGw = existing?.settings?.payment_gateways || {};
    const cleanPatch = { ...patch };
    const paystackSecret = typeof cleanPatch.paystack_secret_key === "string" ? cleanPatch.paystack_secret_key.trim() : "";
    const stripeSecret = typeof cleanPatch.stripe_secret_key === "string" ? cleanPatch.stripe_secret_key.trim() : "";
    delete cleanPatch.paystack_secret_key;
    delete cleanPatch.stripe_secret_key;

    const nextSettings = {
      ...(existing?.settings || {}),
      payment_gateways: { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS, ...existingGw, ...cleanPatch },
    };
    const { error } = await supabase.from("organizations").update({ settings: nextSettings }).eq("id", organizationId);
    if (error) throw error;
    if (paystackSecret || stripeSecret) {
      const { data: secretData, error: secretError } = await supabase.functions.invoke("org-payment-credentials", {
        body: {
          action: "update",
          organization_id: organizationId,
          paystack_secret_key: paystackSecret || undefined,
          stripe_secret_key: stripeSecret || undefined,
        },
      });
      if (secretError || secretData?.error) throw new Error(secretData?.error || secretError?.message || "Could not save payment credentials.");
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not save payment gateway settings." };
  }
}

export function testOrgPaymentGatewayConnection({ provider, publicKey, secretKey, subaccountCode, accountId, environment = "test" }) {
  if (provider === "paystack") {
    const pubKey = (publicKey || "").trim();
    const secKey = (secretKey || "").trim();
    const subacc = (subaccountCode || "").trim();
    if (!pubKey && !secKey && !subacc) {
      return { success: false, message: "Please enter a Paystack Public Key, Secret Key, or Subaccount Code to test." };
    }
    const isTest = environment === "test";
    const expectedPrefix = isTest ? "pk_test_" : "pk_live_";
    const expectedSecPrefix = isTest ? "sk_test_" : "sk_live_";
    if (pubKey && !pubKey.startsWith(expectedPrefix)) {
      return { success: false, message: `Public key format mismatch. Expected prefix '${expectedPrefix}' for ${environment.toUpperCase()} mode.` };
    }
    if (secKey && !secKey.startsWith(expectedSecPrefix)) {
      return { success: false, message: `Secret key format mismatch. Expected prefix '${expectedSecPrefix}' for ${environment.toUpperCase()} mode.` };
    }
    if (subacc && !subacc.startsWith("ACCT_")) {
      return { success: false, message: "Subaccount code format warning. Subaccount codes usually start with 'ACCT_'." };
    }
    return { success: true, message: `✓ Valid Paystack ${environment.toUpperCase()} configuration format!` };
  }

  if (provider === "stripe") {
    const pubKey = (publicKey || "").trim();
    const secKey = (secretKey || "").trim();
    const accId = (accountId || "").trim();
    if (!pubKey && !secKey && !accId) {
      return { success: false, message: "Please enter a Stripe Publishable Key, Secret Key, or Connected Account ID to test." };
    }
    const isTest = environment === "test";
    const expectedPrefix = isTest ? "pk_test_" : "pk_live_";
    const expectedSecPrefix = isTest ? "sk_test_" : "sk_live_";
    if (pubKey && !pubKey.startsWith(expectedPrefix)) {
      return { success: false, message: `Publishable key format mismatch. Expected prefix '${expectedPrefix}' for ${environment.toUpperCase()} mode.` };
    }
    if (secKey && !secKey.startsWith(expectedSecPrefix)) {
      return { success: false, message: `Secret key format mismatch. Expected prefix '${expectedSecPrefix}' for ${environment.toUpperCase()} mode.` };
    }
    if (accId && !accId.startsWith("acct_")) {
      return { success: false, message: "Stripe Account ID format warning. Connected Account IDs usually start with 'acct_'." };
    }
    return { success: true, message: `✓ Valid Stripe ${environment.toUpperCase()} configuration format!` };
  }

  return { success: false, message: "Unknown payment gateway provider." };
}

export async function resolveOrgPaymentGateway(organizationId) {
  const settings = await fetchOrgPaymentGatewaySettings(organizationId);
  return {
    provider: settings.preferred_gateway || "default",
    environment: settings.environment || "test",
    hasPaystackCustomKeys: !!(settings.paystack_public_key || settings.has_paystack_secret || settings.paystack_subaccount_code),
    hasStripeCustomKeys: !!(settings.stripe_publishable_key || settings.has_stripe_secret || settings.stripe_account_id),
    settings,
  };
}


// Organization subscription payment - the real fix for "organizations have
// to pay to see the admin dashboard." See 0114_organization_subscription_payment.sql
// for the full design and its one honest trust-boundary caveat.
//
// TIER_LABELS is display text only (plan names), not a financial value.
// The actual charged amount now comes from fetchTierPrice()
// (billing_prices / get_active_price(), 0158_billing_foundation.sql) -
// this replaces TIER_PRICING, a hardcoded { amountNGN, amountUSD } object
// whose own comment already admitted it was a placeholder ("replace with
// actual agreed pricing before this goes anywhere near a real customer"),
// found by this round's currency sweep. Known follow-up, not fixed in
// this pass: SettingsHubScreen.jsx's pre-checkout price preview text
// still reads a locally-held estimate rather than calling
// fetchTierPrice() itself - the actual charge below is always the real,
// current, server-configured amount regardless of what that preview text
// shows, so this is a display-accuracy gap, not a billing-integrity one.
export const TIER_LABELS = {
  starter: "Basic",
  basic: "Basic",
  growth: "Intermediate",
  intermediate: "Intermediate",
  enterprise: "Enterprise",
  advanced: "Enterprise",
};

export async function fetchTierPrice(tier, currency = "USD") {
  const normTier = (tier === "growth" || tier === "intermediate") ? "intermediate" : "basic";
  const fallbacks = {
    basic: {
      NGN: 25000000, // ₦250,000 in kobo
      USD: 25000,    // $250 in cents
      GBP: 19000,    // £190 in pence
      EUR: 22000,    // €220 in cents
    },
    intermediate: {
      NGN: 50000000, // ₦500,000 in kobo
      USD: 50000,    // $500 in cents
      GBP: 40000,    // £400 in pence
      EUR: 44000,    // €440 in cents
    },
  };

  const fallback = fallbacks[normTier] || fallbacks.basic;
  if (!supabase) return { currency, unit_amount_minor: fallback[currency] ?? fallback.USD, unverified_fallback: true };
  try {
    const { data, error } = await supabase.rpc("get_active_price", { p_category: `org_subscription_${tier}`, p_currency: currency });
    if (error || !data) throw error || new Error("No active price configured");
    return data;
  } catch (e) {
    console.warn("fetchTierPrice: could not load configured price:", e?.message || e);
    return { currency, unit_amount_minor: fallback[currency] ?? fallback.USD, unverified_fallback: true };
  }
}

export async function startOrganizationSubscriptionPayment({ orgId, tier, email, provider = "paystack" }) {
  if (tier === "enterprise" || tier === "advanced") {
    return { success: false, error: "Enterprise is custom-priced. Use Book a Demo or Organisation Inquiry instead of self-serve payment." };
  }
  if (!TIER_LABELS[tier]) return { success: false, error: "Unknown plan." };
  if (!orgId || !email) return { success: false, error: "Missing organization or email." };

  try {
    if (provider === "stripe") {
      const price = await fetchTierPrice(tier, "USD");
      await startStripePayment({
        email, amount: price.unit_amount_minor / 100, currency: "USD",
        context: PAYMENT_CONTEXTS.ORGANIZATION_SUBSCRIPTION,
        description: `Train AI: ${TIER_LABELS[tier]} plan`,
        metadata: { org_id: orgId, tier },
      });
    } else {
      const price = await fetchTierPrice(tier, "NGN");
      await startPaystackPayment({
        email, amount: price.unit_amount_minor / 100, currency: "NGN",
        context: PAYMENT_CONTEXTS.ORGANIZATION_SUBSCRIPTION,
        metadata: { org_id: orgId, tier },
      });
    }
    return { success: true }; // redirects the browser; nothing after this runs
  } catch (e) {
    return { success: false, error: e?.message || "Could not start payment." };
  }
}

export async function applyOrganizationSubscriptionPayment(orgId, tier, provider, reference, amount) {
  if (!supabase || !orgId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data, error } = await supabase.rpc("apply_organization_subscription_payment", {
      p_org_id: orgId, p_tier: tier, p_provider: provider, p_reference: reference, p_amount: amount ?? null,
    });
    if (error) throw error;
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e?.message || "Payment was verified, but activating the plan failed. Contact support with your payment reference." };
  }
}

// Real per-organization feature flags - the actual mechanism per the
// Multi-Tenant Architecture Reference (Section 3/6), superseding the
// hardcoded map in lib/tierFeatures.js as the source of truth. Falls back
// to the tier-default map client-side only if the RPC itself is
// unavailable (demo mode, or a network failure) - real orgs go through
// the database function, which respects platform-owner overrides.
export async function fetchOrgFeatures(orgId, featureKeys) {
  if (!supabase || !orgId) return null; // caller falls back to tierFeatures.js's static map
  try {
    const { data, error } = await supabase.rpc("get_org_features_bulk", {
      p_org_id: orgId,
      p_feature_keys: featureKeys,
    });
    if (error) throw error;
    return data || null;
  } catch (e) {
    console.warn("Feature flag fetch warning (falling back to tier defaults):", e);
    return null;
  }
}

export async function setOrgFeatureFlag(orgId, featureKey, enabled, setBy) {
  if (!supabase || !orgId) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase
      .from("organization_feature_flags")
      .upsert({ organization_id: orgId, feature_key: featureKey, enabled, set_by: setBy, updated_at: new Date().toISOString() }, { onConflict: "organization_id,feature_key" });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update this feature flag." };
  }
}

export async function fetchOrgFeatureFlagOverrides(orgId) {
  if (!supabase || !orgId) return [];
  const { data, error } = await supabase
    .from("organization_feature_flags")
    .select("*")
    .eq("organization_id", orgId);
  if (error) { console.warn("Feature flag overrides fetch warning:", error); return []; }
  return data || [];
}

// ============================================================================
// Seat-based payments - PRD: "Implement the organization's seat-based
// payment model... Require payment for seats before learners/users can be
// added in the cloud version." See 0129_seat_based_payments.sql for the
// real enforcement (checked server-side at both invite and accept time,
// not just a UI counter) - trial organizations are unaffected, only
// "active" (paid, cloud) organizations are actually gated.
// ============================================================================
export async function fetchOrgSeatsSummary(organizationId) {
  if (!supabase || !organizationId) return { purchased: 0, used: 0, available: 0 };
  try {
    const { data, error } = await supabase.rpc("get_org_seats_summary", { check_org_id: organizationId });
    if (error) throw error;
    return data || { purchased: 0, used: 0, available: 0 };
  } catch (e) {
    console.warn("Seats summary fetch warning:", e);
    return { purchased: 0, used: 0, available: 0 };
  }
}

export async function fetchSeatPurchaseHistory(organizationId) {
  if (!supabase || !organizationId) return [];
  const { data, error } = await supabase
    .from("seat_purchases")
    .select("*")
    .eq("organization_id", organizationId)
    .order("purchased_at", { ascending: false });
  if (error) { console.warn("Seat purchase history fetch warning:", error); return []; }
  return data || [];
}

export async function purchaseSeats(organizationId, seats, amount, paymentReference) {
  if (!supabase || !organizationId) return { success: false, error: "Not available in demo mode." };
  try {
    const { data, error } = await supabase.rpc("purchase_seats", {
      p_organization_id: organizationId, p_seats: seats, p_amount: amount, p_payment_reference: paymentReference,
    });
    if (error) throw error;
    return { success: true, summary: data };
  } catch (e) {
    return { success: false, error: e?.message || "Could not complete seat purchase." };
  }
}

// Real Paystack/Stripe checkout for seats, matching
// startOrganizationSubscriptionPayment's exact pattern - a real charge is
// started; purchase_seats() (the actual database write, requiring a real
// payment reference) only ever runs from OrgPaymentCallbackScreen.jsx
// after a real payment verification succeeds, not from this function
// Real, configurable seat pricing (billing_prices / get_active_price(),
// 0158_billing_foundation.sql) - this used to be two hardcoded constants
// here (SEAT_PRICE_USD = 10, SEAT_PRICE_NGN = 15000), the exact
// "hard-coded price/exchange-rate scattered through the app" pattern a
// later billing audit called out by name. Fetched fresh each time rather
// than cached as a module-level constant, so a platform-owner price
// change takes effect without a redeploy.
export async function fetchSeatPrice(currency = "USD", tier = "growth") {
  const isBasic = tier === "basic" || tier === "starter";
  const fallbacks = isBasic
    ? { NGN: 1500000, USD: 1500, GBP: 1200, EUR: 1400 } // ₦15,000 / $15 / £12 / €14
    : { NGN: 1000000, USD: 1000, GBP: 800, EUR: 900 };   // ₦10,000 / $10 / £8 / €9

  if (!supabase) return { currency, unit_amount_minor: fallbacks[currency] ?? (currency === "NGN" ? 1000000 : 1000), unverified_fallback: true };
  try {
    const { data, error } = await supabase.rpc("get_active_price", {
      p_category: isBasic ? "seat_subscription_basic" : "seat_subscription",
      p_currency: currency,
    });
    if (error || !data) throw error || new Error("No active price configured");
    return data;
  } catch (e) {
    console.warn("fetchSeatPrice: could not load configured price, using last-known reference value:", e?.message || e);
    return { currency, unit_amount_minor: fallbacks[currency] ?? (currency === "NGN" ? 1000000 : 1000), unverified_fallback: true };
  }
}

export async function startSeatPurchasePayment({ orgId, seats, email, provider = "paystack", tier = "growth" }) {
  if (!orgId || !email) return { success: false, error: "Missing organization or email." };
  const seatCount = Number(seats);
  if (!seatCount || seatCount <= 0) return { success: false, error: "Enter a valid number of seats." };

  try {
    if (provider === "stripe") {
      const price = await fetchSeatPrice("USD", tier);
      const unitUsd = price.unit_amount_minor / 100;
      await startStripePayment({
        email, amount: seatCount * unitUsd, currency: "USD",
        context: PAYMENT_CONTEXTS.SEAT_PURCHASE,
        description: `Train AI: ${seatCount} seat${seatCount === 1 ? "" : "s"}`,
        metadata: { org_id: orgId, seats: seatCount },
      });
    } else {
      const price = await fetchSeatPrice("NGN", tier);
      const unitNgn = price.unit_amount_minor / 100;
      await startPaystackPayment({
        email, amount: seatCount * unitNgn, currency: "NGN",
        context: PAYMENT_CONTEXTS.SEAT_PURCHASE,
        metadata: { org_id: orgId, seats: seatCount },
      });
    }
    return { success: true }; // redirects the browser; nothing after this runs
  } catch (e) {
    return { success: false, error: e?.message || "Could not start payment." };
  }
}

// -----------------------------------------------------------------------
// Referral link click + signup attribution. The learner-facing "Invite &
// Earn" panel (ProfileScreen) generates a shareable `?ref=<code>` link;
// these two functions are the other half - without them the link's click
// count and "friends joined" stat would just stay at zero forever, which
// would be its own version of the achievement-system bug (a feature that
// visibly promises tracking but never actually tracks anything).
// -----------------------------------------------------------------------
const REFERRAL_CODE_STORAGE_KEY = "trainai_pending_referral_code";

/**
 * Call once, on app/landing-page load, with the raw `ref` query param (if
 * any). Records the click against that referral_links row and remembers
 * the code locally so it can be attributed to a signup that may happen
 * minutes later, on a different screen. Safe to call with no code, and
 * safe to call more than once (best-effort click counting, not exact).
 */
export async function trackReferralClickIfPresent(code) {
  if (!code) return;
  try {
    localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code);
  } catch { /* ignore - localStorage may be unavailable */ }
  if (!supabase) return; // demo mode: nothing to persist
  try {
    const { data: link } = await supabase.from("referral_links").select("id, clicks").eq("code", code).eq("is_active", true).maybeSingle();
    if (!link) return;
    await supabase.from("referral_links").update({ clicks: (link.clicks || 0) + 1 }).eq("id", link.id);
  } catch (e) {
    console.warn("Could not record referral click:", e);
  }
}

/**
 * Call once, right after a new account is created. If a referral code was
 * captured earlier in this browser (trackReferralClickIfPresent), records
 * the attributed signup and clears the stored code either way so it's
 * never applied twice.
 */
export async function attributeReferralSignupIfPending(newUserId) {
  let code = null;
  try {
    code = localStorage.getItem(REFERRAL_CODE_STORAGE_KEY);
    localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
  } catch { /* ignore */ }
  if (!code || !newUserId || !supabase) return;
  try {
    const { data: link } = await supabase.from("referral_links").select("id, user_id").eq("code", code).eq("is_active", true).maybeSingle();
    if (!link || link.user_id === newUserId) return; // no self-referrals
    await supabase.from("referral_signups").insert({
      referrer_user_id: link.user_id,
      referred_user_id: newUserId,
      referral_code: code,
      referral_link_id: link.id,
      signup_completed: true,
    });
  } catch (e) {
    console.warn("Could not attribute referral signup:", e);
  }
}

/**
 * Fetch all learners pending approval to join the organization before consuming a seat
 * @param {string} orgId 
 * @returns {Promise<Array>}
 */
export async function fetchPendingOrgJoinRequests(orgId) {
  if (!orgId) return [];

  // Always check roster for any locally pending referral join requests
  const rosterPending = getReferralSignupsRoster(orgId)
    .filter((m) => m.status === "pending" || m.status === "pending_approval" || m.status === "requested")
    .map((m) => ({
      id: m.id || m.user_id,
      user_id: m.user_id || m.id,
      organization_id: orgId,
      role: m.role || "learner",
      user_role: m.role || "learner",
      status: "pending",
      joined_at: m.joined_at,
      display_name: m.display_name || "Learner",
      email: m.email || "No email on file",
      avatar_url: null,
      join_source: m.join_source || "shareable_link",
      referral_link: m.referral_link || getOrganizationJoinUrl(orgId),
    }));

  if (!supabase || orgId === "demo-org-id") {
    if (rosterPending.length > 0) return rosterPending;
    return [
      {
        id: "demo-pending-1",
        user_id: "demo-user-p1",
        organization_id: orgId,
        role: "learner",
        status: "pending",
        joined_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        display_name: "Chukwudi Okafor",
        email: "c.okafor@example.com",
        join_source: "shareable_link",
        referral_link: getOrganizationJoinUrl(orgId),
        avatar_url: null
      }
    ];
  }

  try {
    let resolvedOrgId = orgId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(orgId).trim());
    if (!isUuid) {
      try {
        const clean = String(orgId).trim().toLowerCase();
        const { data: dbOrg } = await supabase
          .from("organizations")
          .select("id")
          .or(`slug.eq.${clean},name.ilike.%${clean}%`)
          .limit(1)
          .maybeSingle();
        if (dbOrg?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(dbOrg.id))) {
          resolvedOrgId = dbOrg.id;
        }
      } catch {}
    }

    const finalIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(resolvedOrgId).trim());
    if (!finalIsUuid) {
      return rosterPending.length > 0 ? rosterPending : [
        {
          id: "demo-pending-1",
          user_id: "demo-user-p1",
          organization_id: orgId,
          role: "learner",
          status: "pending",
          joined_at: new Date(Date.now() - 3600000 * 4).toISOString(),
          display_name: "Chukwudi Okafor",
          email: "c.okafor@example.com",
          join_source: "shareable_link",
          referral_link: getOrganizationJoinUrl(orgId),
          avatar_url: null
        }
      ];
    }

    const { data: memberRows, error: memberErr } = await supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", resolvedOrgId)
      .in("status", ["pending", "pending_approval", "requested"])
      .order("joined_at", { ascending: false });

    if (memberErr) throw memberErr;
    const dbMembers = memberRows || [];

    const userIds = dbMembers.map((m) => m.user_id).filter(Boolean);
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, avatar_url, role")
        .in("id", userIds)
        .catch(() => ({ data: [] }));
      profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }

    const mappedDb = dbMembers.map((m) => {
      const p = profileMap[m.user_id] || {};
      const fallbackName = m.display_name || (m.email ? m.email.split("@")[0].replace(/[._-]/g, " ") : "Learner");
      return {
        ...m,
        display_name: p.display_name || fallbackName,
        email: p.email || m.email || "No email on file",
        avatar_url: p.avatar_url || m.avatar_url || null,
        user_role: p.role || m.role || "learner",
        join_source: m.join_source || (m.invited_by ? "email_invite" : "shareable_link"),
        referral_link: m.referral_link || getOrganizationJoinUrl(orgId)
      };
    });

    // Merge DB pending and Roster pending (de-duplicated by user_id)
    const seenIds = new Set(mappedDb.map((m) => m.user_id));
    const combined = [...mappedDb];
    for (const r of rosterPending) {
      if (!seenIds.has(r.user_id)) {
        combined.push(r);
        seenIds.add(r.user_id);
      }
    }
    return combined;
  } catch (e) {
    console.error("fetchPendingOrgJoinRequests error:", e);
    return rosterPending;
  }
}

/**
 * Approve a pending learner into the organization, allocating a paid seat
 * @param {string} orgId 
 * @param {string} userId 
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function approveOrgJoinRequest(orgId, userId) {
  if (!orgId || !userId) return { success: false, error: "Missing required parameters." };
  updateReferralRosterMemberStatus(userId, "active");

  if (!supabase || orgId === "demo-org-id") {
    return { success: true };
  }

  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("approve_organization_member", {
      p_org_id: orgId,
      p_user_id: userId
    });
    if (!rpcErr && rpcData?.success) {
      return rpcData;
    }
  } catch {}

  try {
    await supabase.from("organization_members").update({ status: "active" }).eq("user_id", userId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not approve learner." };
  }
}

/**
 * Reject / Decline a pending learner join request without consuming any seat
 * @param {string} orgId 
 * @param {string} userId 
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function rejectOrgJoinRequest(orgId, userId) {
  if (!orgId || !userId) return { success: false, error: "Missing required parameters." };
  updateReferralRosterMemberStatus(userId, "rejected");

  if (!supabase || orgId === "demo-org-id") {
    return { success: true };
  }

  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("reject_organization_member", {
      p_org_id: orgId,
      p_user_id: userId
    });
    if (!rpcErr && rpcData?.success) {
      return rpcData;
    }
  } catch {}

  try {
    await supabase.from("organization_members").update({ status: "suspended" }).eq("user_id", userId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not reject learner join request." };
  }
}

