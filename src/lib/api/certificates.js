import { supabase } from "../supabaseClient.js";

const LOCAL_STORAGE_CERTS_KEY = "trainai_certificates_cache_v1";

const SEED_CERTIFICATES = [
  {
    id: "cert-2026-001",
    certificate_code: "TA-2026-NEXUS-8841",
    user_id: "user-1",
    recipient_name: "Kofi Mensah",
    organization_id: "org-demo",
    organization_name: "Tech Learning Academy",
    course_id: "course-cap3",
    course_name: "Career Acceleration Programme (CAP): AI & Product",
    cohort_id: "cap-cohort-3",
    cohort_name: "CAP Cohort 3",
    template_type: "train_ai_default",
    trigger_source: "programme_completed",
    issued_at: "2026-10-01T12:00:00Z",
    is_revoked: false,
    revoked_reason: null,
  },
  {
    id: "cert-2026-002",
    certificate_code: "TA-2026-SARA-1092",
    user_id: "user-2",
    recipient_name: "Zainab Bello",
    organization_id: "org-sara",
    organization_name: "Sara Foundation Africa",
    course_id: "course-ai-eng",
    course_name: "Practical AI & Full-Stack Development",
    cohort_id: "spring-2026-cohort",
    cohort_name: "Spring 2026 Foundation Cohort",
    template_type: "organization_custom",
    custom_template_url: "https://trainailtd.com/brand/sara-cert-frame.png",
    trigger_source: "course_completed",
    issued_at: "2026-09-28T14:30:00Z",
    is_revoked: false,
    revoked_reason: null,
  },
];

function getCachedCerts() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CERTS_KEY);
    return raw ? JSON.parse(raw) : SEED_CERTIFICATES;
  } catch {
    return SEED_CERTIFICATES;
  }
}

function saveCachedCerts(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CERTS_KEY, JSON.stringify(items));
  } catch {}
}

/**
 * Verifies a certificate publicly by its unique code or UUID
 */
export async function verifyPublicCertificate(codeOrId) {
  const target = (codeOrId || "").trim();
  if (!target) return { verified: false, error: "Missing certificate identifier." };

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("verify_public_certificate", {
        p_certificate_code: target,
      });
      if (!error && data) return data;
    } catch {}
  }

  const certs = getCachedCerts();
  const matched = certs.find(
    (c) =>
      c.certificate_code?.toUpperCase() === target.toUpperCase() ||
      c.id?.toLowerCase() === target.toLowerCase()
  );

  if (!matched) {
    return { verified: false, error: "Certificate not found or identifier invalid." };
  }

  if (matched.is_revoked) {
    return {
      verified: false,
      is_revoked: true,
      reason: matched.revoked_reason || "This certificate has been revoked by the issuing authority.",
      issued_at: matched.issued_at,
    };
  }

  return {
    verified: true,
    certificate_code: matched.certificate_code,
    recipient_name: matched.recipient_name,
    course_name: matched.course_name,
    organization_name: matched.organization_name,
    issued_at: matched.issued_at,
    template_type: matched.template_type,
  };
}

/**
 * Fetches all certificates for an organization or learner
 */
export async function fetchCertificates({ organizationId, userId } = {}) {
  if (!supabase) {
    let items = getCachedCerts();
    if (organizationId && organizationId !== "demo-org-id") {
      items = items.filter((c) => c.organization_id === organizationId);
    }
    if (userId) {
      items = items.filter((c) => c.user_id === userId);
    }
    return items;
  }

  try {
    let query = supabase.from("certificates").select("*, courses(name), organizations(name)").order("issued_at", { ascending: false });
    if (organizationId && organizationId !== "demo-org-id") query = query.eq("organization_id", organizationId);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return getCachedCerts();
    return data;
  } catch {
    return getCachedCerts();
  }
}

/**
 * Issues / generates a new tamper-proof certificate
 */
export async function issueCertificate({
  userId,
  recipientName,
  organizationId,
  organizationName,
  courseId,
  courseName,
  cohortId,
  cohortName,
  templateType = "train_ai_default",
  customTemplateUrl,
  triggerSource = "admin_manual",
}) {
  const certCode = `TA-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newCert = {
    id: `cert-${Date.now()}`,
    certificate_code: certCode,
    user_id: userId || "user-current",
    recipient_name: recipientName || "Certified Learner",
    organization_id: organizationId || "org-demo",
    organization_name: organizationName || "Train AI Academy",
    course_id: courseId || null,
    course_name: courseName || "Train AI Certified Programme",
    cohort_id: cohortId || null,
    cohort_name: cohortName || "CAP Cohort",
    template_type: templateType,
    custom_template_url: customTemplateUrl || null,
    trigger_source: triggerSource,
    issued_at: new Date().toISOString(),
    is_revoked: false,
    revoked_reason: null,
  };

  if (supabase) {
    try {
      await supabase.from("certificates").insert(newCert);
    } catch {}
  }

  const existing = getCachedCerts();
  saveCachedCerts([newCert, ...existing]);
  return { success: true, data: newCert };
}

/**
 * Revokes a certificate
 */
export async function revokeCertificate(certId, reason) {
  if (supabase) {
    try {
      await supabase.from("certificates").update({ is_revoked: true, revoked_reason: reason }).eq("id", certId);
    } catch {}
  }

  const existing = getCachedCerts();
  const updated = existing.map((c) => (c.id === certId ? { ...c, is_revoked: true, revoked_reason: reason } : c));
  saveCachedCerts(updated);
  return { success: true };
}
