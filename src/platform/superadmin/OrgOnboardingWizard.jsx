import React, { useContext, useEffect, useState } from "react";
import { TopBar, ToastContext } from "../components/PlatformUI.jsx";
import {
  Building2, Palette, Mail, Layers, CheckCircle2, Circle, ArrowRight, ArrowLeft, ExternalLink,
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchAllOrganizationsWithUserCounts,
  createOrganization,
  updateOrganization,
  fetchOrgBranding,
  upsertOrgBranding,
  createInvitation,
  fetchPendingInvitations,
  createCohort,
  fetchCohorts,
} from "../../lib/api/platform.js";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";

// Real, working multi-step "set up a new organization" flow for a super
// admin. Every step below calls the same live functions the individual
// superadmin/admin screens already use (createOrganization, upsertOrgBranding,
// createInvitation, createCohort - all confirmed by reading
// src/lib/api/platform.js) - nothing here is a static progress bar with no
// backing action, and nothing marks a skipped step as "done" in the final
// summary.

const STEPS = [
  { key: "details", label: "Organization" },
  { key: "branding", label: "Branding" },
  { key: "invite", label: "Invite people" },
  { key: "cohort", label: "First cohort" },
  { key: "finish", label: "Finish" },
];

// organizations.slug is `text unique not null` with no default (see
// 0001_init_schema.sql) - the existing OrganizationsScreen "Create
// organization" button never supplies one, which would fail a NOT NULL
// insert. This wizard derives a real, usable slug from the name instead so
// step 1 actually succeeds.
function slugify(name) {
  const base = (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `org-${Date.now().toString(36)}`;
}

function StepIndicator({ stepIndex }) {
  return (
    <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="ta-row ta-gap8">
            <div
              style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                background: i < stepIndex ? "var(--success)" : i === stepIndex ? "var(--grad)" : "var(--surface-2)",
                color: i <= stepIndex ? "#fff" : "var(--text-3)",
              }}
            >
              {i < stepIndex ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: i === stepIndex ? "var(--text)" : "var(--text-3)" }}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <div style={{ width: 20, height: 1, background: "var(--border)" }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function SummaryRow({ icon: Icon, label, done, value }) {
  return (
    <div className="ta-row ta-between" style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 12 }}>
      <div className="ta-row ta-gap10">
        <Icon size={16} color="var(--primary)" />
        <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
      </div>
      <div className="ta-row ta-gap8">
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{value}</span>
        {done ? <CheckCircle2 size={16} color="var(--success)" /> : <Circle size={16} color="var(--text-3)" />}
      </div>
    </div>
  );
}

/* ---------------------------- Step 1: details --------------------------- */

function DetailsStep({ currentUserProfileId, onComplete }) {
  const [mode, setMode] = useState("new"); // "new" | "resume"
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resumeOrgId, setResumeOrgId] = useState("");

  const orgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), []);
  // "Hasn't been set up yet" is approximated by "no members yet" - the same
  // real user_count already computed by fetchAllOrganizationsWithUserCounts
  // (used elsewhere on the Organizations list).
  const resumableOrgs = (orgsQuery.data || []).filter((o) => (o.user_count || 0) === 0);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function handleCreateNew() {
    if (!name.trim()) { setError("Organization name is required."); return; }
    if (!slug.trim()) { setError("A URL slug is required."); return; }
    setSaving(true); setError("");
    try {
      const created = await createOrganization({ name: name.trim(), slug: slug.trim(), createdBy: currentUserProfileId || undefined });
      if (!created) throw new Error("Organization creation didn't return a row.");
      if (domain.trim()) {
        // organizations.domain is a real column but createOrganization's
        // signature (name/slug/createdBy only) doesn't set it - persist it
        // with the same generic updateOrganization patch helper the rest of
        // the app already uses.
        await updateOrganization(created.id, { domain: domain.trim() });
      }
      onComplete({ id: created.id, name: created.name, slug: created.slug, resumed: false });
    } catch (e) {
      setError(e?.message || "Couldn't create the organization. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleResume() {
    const picked = resumableOrgs.find((o) => o.id === resumeOrgId);
    if (!picked) { setError("Choose an organization to resume."); return; }
    onComplete({ id: picked.id, name: picked.name, slug: picked.slug, resumed: true });
  }

  return (
    <div>
      <div className="ta-title">Step 1: Organization details</div>
      <div className="ta-body ta-mt8">Create a brand-new organization, or resume onboarding one that already exists in the database but has no members yet.</div>

      <div className="ta-row ta-gap8 ta-mt16">
        <button className={`ta-pill ${mode === "new" ? "active" : ""}`} onClick={() => { setMode("new"); setError(""); }}>Create new organization</button>
        <button className={`ta-pill ${mode === "resume" ? "active" : ""}`} onClick={() => { setMode("resume"); setError(""); }}>Resume an existing organization</button>
      </div>

      {mode === "new" && (
        <div className="ta-mt16">
          <div className="ta-label">Organization name</div>
          <input className="ta-input ta-mt8" style={{ width: "100%" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northwind Academy" />

          <div className="ta-label ta-mt16">URL slug</div>
          <input className="ta-input ta-mt8" style={{ width: "100%" }} value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} placeholder="northwind-academy" />

          <div className="ta-label ta-mt16">Custom domain (optional)</div>
          <input className="ta-input ta-mt8" style={{ width: "100%" }} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="learn.northwind.com" />

          {error && <div className="ta-mt12" style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}

          <button className="ta-btn ta-btn-primary ta-mt20" onClick={handleCreateNew} disabled={saving}>
            {saving ? "Creating..." : <>Create & continue <ArrowRight size={14} /></>}
          </button>
        </div>
      )}

      {mode === "resume" && (
        <div className="ta-mt16">
          {orgsQuery.loading && <div className="ta-empty">Loading organizations...</div>}
          {!orgsQuery.loading && resumableOrgs.length === 0 && (
            <div className="ta-empty">Every existing organization already has members. There's nothing to resume. Create a new one instead.</div>
          )}
          {resumableOrgs.length > 0 && (
            <>
              <div className="ta-label">Organization (0 members so far)</div>
              <select className="ta-input ta-mt8" style={{ width: "100%" }} value={resumeOrgId} onChange={(e) => setResumeOrgId(e.target.value)}>
                <option value="">Select an organization...</option>
                {resumableOrgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              {error && <div className="ta-mt12" style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}
              <button className="ta-btn ta-btn-primary ta-mt20" onClick={handleResume} disabled={!resumeOrgId}>
                Continue with this organization <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Step 2: branding --------------------------- */

function BrandingStep({ org, onSaved, onSkip, onBack }) {
  const showToast = useContext(ToastContext);
  const existingQuery = useSupabaseQuery(async () => (org?.id ? fetchOrgBranding(org.id) : null), [org?.id]);
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existingQuery.data) {
      setLogoUrl(existingQuery.data.logo_url || "");
      setPrimaryColor(existingQuery.data.primary_color || "#2563EB");
    }
  }, [existingQuery.data]);

  async function handleSave() {
    if (!org?.id) return;
    setSaving(true); setError("");
    try {
      const data = await upsertOrgBranding(org.id, { logoUrl: logoUrl || null, primaryColor: primaryColor || null });
      showToast("Branding saved!");
      onSaved(data);
    } catch (e) {
      setError(e?.message || "Couldn't save branding. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const hasInput = !!(logoUrl || (primaryColor && primaryColor !== "#2563EB"));
  const alreadyBranded = !!(existingQuery.data?.logo_url || existingQuery.data?.primary_color);

  return (
    <div>
      <div className="ta-title">Step 2: Branding <span style={{ fontWeight: 500, color: "var(--text-3)", fontSize: 12 }}>(optional)</span></div>
      <div className="ta-body ta-mt8">
        Set a logo and brand color for {org?.name}. You can skip this and set it up later from the Branding screen.
        {alreadyBranded && " This organization already has branding saved. Shown below."}
      </div>

      <div className="ta-title ta-mt20" style={{ fontSize: 13.5 }}>Logo</div>
      {logoUrl && (
        <img src={logoUrl} alt="Logo preview" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", marginTop: 10, border: "1px solid var(--border)" }} />
      )}
      <div className="ta-mt10">
        <FileUploadZone
          bucket="uploads"
          pathPrefix={`branding/${org?.id || "pending"}`}
          accept="image/*"
          maxSizeMB={5}
          label="Drag and drop a logo image, or click to browse"
          onUploaded={(url) => setLogoUrl(url)}
        />
      </div>

      <div className="ta-title ta-mt20" style={{ fontSize: 13.5 }}>Primary brand color</div>
      <div className="ta-row ta-gap10 ta-mt10">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#2563EB"}
          onChange={(e) => setPrimaryColor(e.target.value)}
          style={{ width: 48, height: 36, padding: 0, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
        />
        <input className="ta-input" style={{ flex: 1 }} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#2563EB" />
        <Palette size={18} color="var(--primary)" />
      </div>

      {error && <div className="ta-mt12" style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}

      <div className="ta-row ta-gap8 ta-mt20">
        <button className="ta-btn ta-btn-outline" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <button className="ta-btn ta-btn-ghost" onClick={onSkip}>Skip branding for now</button>
        <button className="ta-btn ta-btn-primary" onClick={handleSave} disabled={saving || !hasInput}>
          {saving ? "Saving..." : <>Save branding & continue <ArrowRight size={14} /></>}
        </button>
      </div>
    </div>
  );
}

/* ----------------------- Step 3: invite people ---------------------------- */

const INVITE_ROLES = ["learner", "mentor", "admin", "manager"];
// Display label only - see the same note in AccessControlScreen.jsx.
const INVITE_ROLE_LABEL = { mentor: "Instructor" };
const ORG_ROLES = ["member", "admin", "owner"];

function InviteStep({ org, invites, onInviteSent, onDone, onBack }) {
  const showToast = useContext(ToastContext);
  const pendingQuery = useSupabaseQuery(async () => (org?.id ? fetchPendingInvitations(org.id) : []), [org?.id]);
  const alreadyPendingCount = (pendingQuery.data || []).filter((p) => !invites.some((i) => i.id === p.id)).length;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [organizationRole, setOrganizationRole] = useState("admin");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed) { setError("Enter an email address."); return; }
    if (!org?.id) { setError("No organization selected."); return; }
    setSending(true); setError("");
    try {
      const row = await createInvitation({ email: trimmed, role, organizationId: org.id, organizationRole });
      if (!row) throw new Error("Invitation didn't return a row.");
      onInviteSent(row);
      setEmail("");
      showToast(`Invitation sent to ${trimmed}`);
    } catch (e) {
      setError(e?.message || "Couldn't send the invitation. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="ta-title">Step 3: Invite the first admin/members <span style={{ fontWeight: 500, color: "var(--text-3)", fontSize: 12 }}>(optional)</span></div>
      <div className="ta-body ta-mt8">
        Send real invitations for {org?.name}. Each send creates a pending invitation row and, if email sending is configured, emails the real invite link.
        {alreadyPendingCount > 0 && ` This organization already has ${alreadyPendingCount} pending invitation${alreadyPendingCount === 1 ? "" : "s"} from before this session.`}
      </div>

      <div className="ta-grid ta-grid-2 ta-mt16">
        <input className="ta-input" placeholder="person@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="ta-input" value={role} onChange={(e) => setRole(e.target.value)}>
          {INVITE_ROLES.map((r) => <option key={r} value={r}>{INVITE_ROLE_LABEL[r] || (r[0].toUpperCase() + r.slice(1))}</option>)}
        </select>
      </div>
      <div className="ta-mt12">
        <div className="ta-label">Organization access level</div>
        <select className="ta-input ta-mt8" value={organizationRole} onChange={(e) => setOrganizationRole(e.target.value)}>
          {ORG_ROLES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>

      {error && <div className="ta-mt12" style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}

      <div className="ta-row ta-gap8 ta-mt16">
        <button className="ta-btn ta-btn-primary" onClick={handleSend} disabled={sending}>
          {sending ? "Sending..." : <><Mail size={14} /> Send invitation</>}
        </button>
      </div>

      {invites.length > 0 && (
        <div className="ta-mt20">
          <div className="ta-label">Sent this session ({invites.length})</div>
          <div className="ta-col ta-gap8 ta-mt10">
            {invites.map((inv) => (
              <div key={inv.id} className="ta-row ta-between" style={{ padding: "8px 12px", background: "var(--surface-2)", borderRadius: 10, fontSize: 13 }}>
                <span>{inv.email}</span>
                <span style={{ color: "var(--text-3)", fontSize: 12 }}>{inv.role} · {inv.organization_role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ta-row ta-gap8 ta-mt20">
        <button className="ta-btn ta-btn-outline" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <button className="ta-btn ta-btn-ghost" onClick={onDone}>
          {invites.length > 0 ? "Done inviting. Continue" : "Skip this step"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------- Step 4: first cohort --------------------------- */

function CohortStep({ org, currentUserProfileId, onCreated, onSkip, onBack }) {
  const showToast = useContext(ToastContext);
  const existingCohortsQuery = useSupabaseQuery(async () => (org?.id ? fetchCohorts(org.id) : []), [org?.id]);
  const existingCount = (existingCohortsQuery.data || []).length;

  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) { setError("Cohort name is required."); return; }
    if (!org?.id) { setError("No organization selected."); return; }
    setSaving(true); setError("");
    try {
      const created = await createCohort({
        organizationId: org.id,
        name: name.trim(),
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        createdBy: currentUserProfileId || undefined,
      });
      if (!created) throw new Error("Cohort creation didn't return a row.");
      showToast(`Cohort "${created.name}" created!`);
      onCreated({ id: created.id, name: created.name });
    } catch (e) {
      setError(e?.message || "Couldn't create the cohort. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="ta-title">Step 4: Create the first cohort <span style={{ fontWeight: 500, color: "var(--text-3)", fontSize: 12 }}>(optional)</span></div>
      <div className="ta-body ta-mt8">
        Give {org?.name} a first learning batch to organize members and courses around.
        {existingCount > 0 && ` This organization already has ${existingCount} cohort${existingCount === 1 ? "" : "s"}.`}
      </div>

      <div className="ta-label ta-mt16">Cohort name</div>
      <input className="ta-input ta-mt8" style={{ width: "100%" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 2026 AI Batch" />

      <div className="ta-grid ta-grid-2 ta-mt16">
        <div>
          <div className="ta-label">Starts</div>
          <input type="date" className="ta-input ta-mt8" style={{ width: "100%" }} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div>
          <div className="ta-label">Ends</div>
          <input type="date" className="ta-input ta-mt8" style={{ width: "100%" }} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>

      {error && <div className="ta-mt12" style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</div>}

      <div className="ta-row ta-gap8 ta-mt20">
        <button className="ta-btn ta-btn-outline" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <button className="ta-btn ta-btn-ghost" onClick={onSkip}>Skip this for now</button>
        <button className="ta-btn ta-btn-primary" onClick={handleCreate} disabled={saving}>
          {saving ? "Creating..." : <>Create cohort & continue <ArrowRight size={14} /></>}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Step 5: finish ----------------------------- */

function FinishStep({ org, brandingResult, invites, cohortResult, orgSelector, onSwitchToOrgWorkspace, onGoToOrgsList }) {
  const brandingDone = !!(brandingResult && brandingResult !== "skipped");
  const cohortDone = !!(cohortResult && cohortResult !== "skipped");

  return (
    <div>
      <div className="ta-title">Step 5: Finish</div>
      <div className="ta-body ta-mt8">Here's exactly what was set up for {org?.name || "this organization"} in this session.</div>

      <div className="ta-col ta-gap10 ta-mt20">
        <SummaryRow icon={Building2} label="Organization" done value={`${org?.name || "N/A"}: ${org?.resumed ? "resumed existing org" : "created"}`} />
        <SummaryRow icon={Palette} label="Branding" done={brandingDone} value={brandingDone ? "Logo/color saved" : "Skipped. Not set"} />
        <SummaryRow icon={Mail} label="Invitations" done={invites.length > 0} value={invites.length > 0 ? `${invites.length} invitation${invites.length === 1 ? "" : "s"} sent` : "None sent this session"} />
        <SummaryRow icon={Layers} label="First cohort" done={cohortDone} value={cohortDone ? `"${cohortResult.name}" created` : "Skipped. Not created"} />
      </div>

      <div className="ta-row ta-gap8 ta-mt24">
        <button
          className="ta-btn ta-btn-primary"
          onClick={() => {
            if (org?.id) orgSelector?.onSelectOrg?.(org.id);
            onSwitchToOrgWorkspace?.();
          }}
        >
          <ExternalLink size={14} /> Go to organization admin workspace
        </button>
        <button className="ta-btn ta-btn-outline" onClick={onGoToOrgsList}>Back to organizations list</button>
      </div>
    </div>
  );
}

/* --------------------------------- Root ----------------------------------- */

export function OrgOnboardingWizard({ currentUserProfileId, orgSelector, onSwitchToOrgWorkspace, onGoToOrgsList }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex].key;

  // Accumulator of what's actually been created/set so far this session
  // every field here is only ever populated from a real function's return
  // value (or explicitly marked "skipped"), never assumed true.
  const [org, setOrg] = useState(null); // { id, name, slug, resumed }
  const [brandingResult, setBrandingResult] = useState(null); // null | "skipped" | real branding_settings row
  const [invites, setInvites] = useState([]); // real user_invitations rows returned by createInvitation
  const [cohortResult, setCohortResult] = useState(null); // null | "skipped" | { id, name }

  function goNext() { setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)); }
  function goBack() { setStepIndex((i) => Math.max(i - 1, 0)); }

  return (
    <div className="ta-fade">
      <TopBar title="Set up new organization" sub="Guided onboarding. Every step performs a real, saved action" />
      <div className="ta-content" style={{ maxWidth: 720 }}>
        <StepIndicator stepIndex={stepIndex} />

        <div className="ta-card ta-mt20">
          {step === "details" && (
            <DetailsStep
              currentUserProfileId={currentUserProfileId}
              onComplete={(o) => { setOrg(o); goNext(); }}
            />
          )}

          {step === "branding" && (
            <BrandingStep
              org={org}
              onSaved={(data) => { setBrandingResult(data || "skipped"); goNext(); }}
              onSkip={() => { setBrandingResult("skipped"); goNext(); }}
              onBack={goBack}
            />
          )}

          {step === "invite" && (
            <InviteStep
              org={org}
              invites={invites}
              onInviteSent={(row) => setInvites((prev) => [row, ...prev])}
              onDone={goNext}
              onBack={goBack}
            />
          )}

          {step === "cohort" && (
            <CohortStep
              org={org}
              currentUserProfileId={currentUserProfileId}
              onCreated={(c) => { setCohortResult(c); goNext(); }}
              onSkip={() => { setCohortResult("skipped"); goNext(); }}
              onBack={goBack}
            />
          )}

          {step === "finish" && (
            <FinishStep
              org={org}
              brandingResult={brandingResult}
              invites={invites}
              cohortResult={cohortResult}
              orgSelector={orgSelector}
              onSwitchToOrgWorkspace={onSwitchToOrgWorkspace}
              onGoToOrgsList={onGoToOrgsList}
            />
          )}
        </div>
      </div>
    </div>
  );
}
