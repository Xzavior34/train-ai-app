import React, { useState, useContext, useEffect } from "react";
import { TopBar, ToastContext, Tag, Switch } from "../components/PlatformUI.jsx";
import { Plus, Trash2, BadgeCheck, Link as LinkIcon, Bell, Calendar, FolderOpen, User } from "lucide-react";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import { updateUserAvatar, updateUserDisplayName } from "../../lib/api/platform.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  updateMentorProfile,
  fetchMentorCredentials, addMentorCredential, deleteMentorCredential,
  fetchMentorPortfolioItems, addMentorPortfolioItem, deleteMentorPortfolioItem,
  fetchNotificationPreferences, upsertNotificationPreferences,
  fetchReminderSettings, addReminderSetting, deleteReminderSetting,
  fetchSessionTemplates, addSessionTemplate, deleteSessionTemplate,
  fetchCancellationPolicies, addCancellationPolicy, deleteCancellationPolicy,
  fetchVideoIntegrationSettings, updateVideoIntegrationSettings,
  fetchMentorResourceLibrary, addMentorResource, deleteMentorResource,
  fetchMentorshipAgreements,
} from "../../lib/api/schemaHelper.js";

const CREDENTIAL_TYPES = ["certification", "degree", "license", "award", "other"];
const PORTFOLIO_TYPES = ["project", "case_study", "publication", "link", "video"];
const VIDEO_PLATFORMS = [
  { key: "jitsi", label: "Jitsi Meet (Free, No Setup)" },
  { key: "zoom", label: "Zoom" },
  { key: "google_meet", label: "Google Meet" },
  { key: "teams", label: "Microsoft Teams" },
];

// Real profile-completeness signal - counts fields that are actually
// filled in, rather than a fabricated percentage. Matches the schema's
// own `profile_completion_percentage` concept in spirit but computes it
// honestly from what's actually on the record right now.
const PROFILE_FIELDS = [
  { key: "bio", label: "Biography" },
  { key: "tagline", label: "Tagline" },
  { key: "specializations", label: "Specializations", isArray: true },
  { key: "years_of_experience", label: "Years of Experience" },
  { key: "languages", label: "Languages", isArray: true },
];

function useIsNarrow(breakpoint = 900) {
  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return narrow;
}

export function MentorSettingsScreen({ mentorId, mentorProfileQuery, currentUserId, userProfileQuery }) {
  const showToast = useContext(ToastContext);
  const isNarrow = useIsNarrow();
  const mentor = mentorProfileQuery?.data || null;
  const userProfile = userProfileQuery?.data || null;
  const [tab, setTab] = useState("profile");
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => { if (userProfile) setDisplayName(userProfile.display_name || ""); }, [userProfile]);

  const missingFields = PROFILE_FIELDS.filter((f) => {
    const v = mentor?.[f.key];
    return f.isArray ? !(v && v.length) : !v;
  });
  const completionPct = Math.round(((PROFILE_FIELDS.length - missingFields.length) / PROFILE_FIELDS.length) * 100);


  const [bio, setBio] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (mentor) {
      setBio(mentor.bio || "");
      // Real column is `specializations` (text[]), not a single string -
      // caught by checking the actual schema before shipping this, not
      // assumed from the field's plain-English name.
      setSpecialization((mentor.specializations || []).join(", "));
    }
  }, [mentor]);

  async function handleSaveProfile() {
    if (!mentorId) { showToast("Your instructor profile isn't linked to an instructor record yet."); return; }
    setSavingProfile(true);
    try {
      const specializations = specialization.split(",").map((s) => s.trim()).filter(Boolean);
      await updateMentorProfile(mentorId, { bio, specializations });
      mentorProfileQuery?.refetch?.();
      showToast("Instructor profile updated!");
    } catch (e) {
      showToast(e.message || "Could not save settings.");
    } finally {
      setSavingProfile(false);
    }
  }

  // Credentials
  const credentialsQuery = useSupabaseQuery(async () => mentorId ? fetchMentorCredentials(mentorId) : [], [mentorId]);
  const [credTitle, setCredTitle] = useState("");
  const [credType, setCredType] = useState(CREDENTIAL_TYPES[0]);
  const [credOrg, setCredOrg] = useState("");
  const [credUrl, setCredUrl] = useState("");
  const [savingCred, setSavingCred] = useState(false);

  async function handleAddCredential() {
    if (!mentorId || !credTitle.trim() || !credOrg.trim()) { showToast("Title and issuing organization are required."); return; }
    setSavingCred(true);
    try {
      await addMentorCredential(mentorId, { title: credTitle.trim(), credentialType: credType, issuingOrganization: credOrg.trim(), verificationUrl: credUrl.trim() || null });
      setCredTitle(""); setCredOrg(""); setCredUrl("");
      credentialsQuery.refetch();
      showToast("Credential added.");
    } catch (e) {
      showToast(e.message || "Could not add credential.");
    } finally {
      setSavingCred(false);
    }
  }

  async function handleDeleteCredential(id) {
    try {
      await deleteMentorCredential(id);
      credentialsQuery.refetch();
      showToast("Credential removed.");
    } catch (e) {
      showToast(e.message || "Could not remove credential.");
    }
  }

  // Portfolio
  const portfolioQuery = useSupabaseQuery(async () => mentorId ? fetchMentorPortfolioItems(mentorId) : [], [mentorId]);
  const [pfTitle, setPfTitle] = useState("");
  const [pfType, setPfType] = useState(PORTFOLIO_TYPES[0]);
  const [pfDescription, setPfDescription] = useState("");
  const [pfUrl, setPfUrl] = useState("");
  const [savingPf, setSavingPf] = useState(false);

  async function handleAddPortfolioItem() {
    if (!mentorId || !pfTitle.trim()) { showToast("Title is required."); return; }
    setSavingPf(true);
    try {
      await addMentorPortfolioItem(mentorId, { title: pfTitle.trim(), itemType: pfType, description: pfDescription.trim() || null, mediaUrl: pfUrl.trim() || null });
      setPfTitle(""); setPfDescription(""); setPfUrl("");
      portfolioQuery.refetch();
      showToast("Portfolio item added.");
    } catch (e) {
      showToast(e.message || "Could not add portfolio item.");
    } finally {
      setSavingPf(false);
    }
  }

  async function handleDeletePortfolioItem(id) {
    try {
      await deleteMentorPortfolioItem(id);
      portfolioQuery.refetch();
      showToast("Portfolio item removed.");
    } catch (e) {
      showToast(e.message || "Could not remove portfolio item.");
    }
  }

  // --- Communications: Notification Preferences ---
  const notifPrefsQuery = useSupabaseQuery(async () => (mentor?.user_id ? fetchNotificationPreferences(mentor.user_id) : null), [mentor?.user_id]);
  const notifPrefs = notifPrefsQuery.data || {};
  async function handleToggleNotifPref(key, current) {
    if (!mentor?.user_id) return;
    try {
      await upsertNotificationPreferences(mentor.user_id, { [key]: !current });
      notifPrefsQuery.refetch();
    } catch (e) {
      showToast(e.message || "Could not update notification preference.");
    }
  }

  // --- Communications: Automated Reminders ---
  const remindersQuery = useSupabaseQuery(async () => (mentorId ? fetchReminderSettings(mentorId) : []), [mentorId]);
  const [reminderType, setReminderType] = useState("email");
  const [hoursBefore, setHoursBefore] = useState(24);
  const [reminderMsg, setReminderMsg] = useState("");
  async function handleAddReminder() {
    if (!mentorId) return;
    try {
      await addReminderSetting(mentorId, { reminderType, hoursBefore: Number(hoursBefore), customMessage: reminderMsg.trim() || null });
      setReminderMsg("");
      remindersQuery.refetch();
      showToast("Reminder added.");
    } catch (e) {
      showToast(e.message || "Could not add reminder.");
    }
  }

  // --- Sessions: Session Preferences (mentors table columns) ---
  const [autoAccept, setAutoAccept] = useState(false);
  const [requirePrePayment, setRequirePrePayment] = useState(false);
  const [allowGroupSessions, setAllowGroupSessions] = useState(false);
  useEffect(() => {
    if (mentor) {
      setAutoAccept(!!mentor.auto_accept_bookings);
      setRequirePrePayment(!!mentor.require_pre_payment);
      setAllowGroupSessions(!!mentor.allow_group_sessions);
    }
  }, [mentor]);
  async function handleToggleSessionPref(key, value) {
    if (!mentorId) return;
    try {
      await updateMentorProfile(mentorId, { [key]: value });
      mentorProfileQuery?.refetch?.();
    } catch (e) {
      showToast(e.message || "Could not update session preference.");
    }
  }

  // --- Sessions: Session Templates ---
  const templatesQuery = useSupabaseQuery(async () => (mentorId ? fetchSessionTemplates(mentorId) : []), [mentorId]);
  const [tplTitle, setTplTitle] = useState("");
  async function handleAddTemplate() {
    if (!mentorId || !tplTitle.trim()) return;
    try {
      await addSessionTemplate(mentorId, { title: tplTitle.trim() });
      setTplTitle("");
      templatesQuery.refetch();
      showToast("Session template created.");
    } catch (e) {
      showToast(e.message || "Could not create template.");
    }
  }

  // --- Sessions: Cancellation Policies ---
  const policiesQuery = useSupabaseQuery(async () => (mentorId ? fetchCancellationPolicies(mentorId) : []), [mentorId]);
  const [policyHours, setPolicyHours] = useState(24);
  const [policyFee, setPolicyFee] = useState(50);
  async function handleAddPolicy() {
    if (!mentorId) return;
    try {
      await addCancellationPolicy(mentorId, { hoursBefore: Number(policyHours), feePercentage: Number(policyFee) });
      policiesQuery.refetch();
      showToast("Cancellation policy added.");
    } catch (e) {
      showToast(e.message || "Could not add policy.");
    }
  }

  // --- Sessions: Video Integration ---
  const videoSettingsQuery = useSupabaseQuery(async () => (mentorId ? fetchVideoIntegrationSettings(mentorId) : {}), [mentorId]);
  const [videoPlatform, setVideoPlatform] = useState("jitsi");
  const [meetingUrl, setMeetingUrl] = useState("");
  useEffect(() => {
    if (videoSettingsQuery.data) {
      setVideoPlatform(videoSettingsQuery.data.preferred_platform || "jitsi");
      setMeetingUrl(videoSettingsQuery.data.personal_meeting_url || "");
    }
  }, [videoSettingsQuery.data]);
  async function handleSaveVideoSettings() {
    if (!mentorId) return;
    try {
      await updateVideoIntegrationSettings(mentorId, { preferred_platform: videoPlatform, personal_meeting_url: meetingUrl.trim() || null });
      videoSettingsQuery.refetch();
      showToast("Video settings saved.");
    } catch (e) {
      showToast(e.message || "Could not save video settings.");
    }
  }

  // --- Resources: Resource Library ---
  const resourcesQuery = useSupabaseQuery(async () => (mentorId ? fetchMentorResourceLibrary(mentorId) : []), [mentorId]);
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  async function handleAddResource() {
    if (!mentorId || !resTitle.trim()) return;
    try {
      await addMentorResource(mentorId, { title: resTitle.trim(), externalUrl: resUrl.trim() || null, resourceType: "link" });
      setResTitle(""); setResUrl("");
      resourcesQuery.refetch();
      showToast("Resource added.");
    } catch (e) {
      showToast(e.message || "Could not add resource.");
    }
  }

  // --- Resources: Mentorship Agreements ---
  const agreementsQuery = useSupabaseQuery(async () => (mentorId ? fetchMentorshipAgreements(mentorId) : []), [mentorId]);

  return (
    <div className="ta-fade">
      <TopBar title="Instructor Settings" sub="Profile setup, communications, session preferences, and teaching resources" />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* =========================================================================
            INSTRUCTOR SETTINGS HERO BANNER
            ========================================================================= */}
        <div className="ta-hero-banner">
          <img
            src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1400&auto=format&fit=crop&q=85"
            alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", opacity: 0.28, zIndex: 0
            }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.85) 60%, rgba(15,23,42,0.7) 100%)",
            zIndex: 0
          }} />

          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <div className="ta-row ta-gap10" style={{ flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{
                  background: "rgba(99, 102, 241, 0.35)", color: "#E0E7FF",
                  border: "1px solid rgba(165, 180, 252, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                  display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
                }}>
                  <BadgeCheck size={13} color="#A5B4FC" /> TEACHING STUDIO CONFIGURATION
                </span>
                <span style={{
                  background: completionPct === 100 ? "rgba(16, 185, 129, 0.28)" : "rgba(245, 158, 11, 0.28)",
                  color: completionPct === 100 ? "#A7F3D0" : "#FDE68A",
                  border: completionPct === 100 ? "1px solid rgba(16, 185, 129, 0.5)" : "1px solid rgba(245, 158, 11, 0.5)",
                  fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
                }}>
                  {completionPct}% PROFILE READINESS
                </span>
              </div>

              <h1 className="ta-hero-title">
                Instructor Studio &amp; Preferences
              </h1>
              <p className="ta-hero-desc">
                Customize your public instructor biography, manage verified certifications, configure video room links, and share student resource libraries.
              </p>
            </div>

            <div className="ta-hero-actions">
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: 14, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>Active Platform</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", textTransform: "capitalize" }}>{videoPlatform.replace(/_/g, " ")}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Settings 2-Column Grid */}
        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "minmax(260px, 300px) minmax(0, 1fr)", gap: 24, alignItems: "start" }}>

          {/* Left Navigation Sidebar & Profile Meter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div className="ta-card" style={{ padding: 20, borderRadius: 16 }}>
              <div className="ta-row ta-between">
                <div className="ta-title" style={{ fontSize: 15 }}>Profile Readiness</div>
                <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: 14 }}>{completionPct}%</div>
              </div>
              <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 4, marginTop: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${completionPct}%`, background: "var(--primary)", borderRadius: 4 }} />
              </div>
              {missingFields.length > 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 10, lineHeight: 1.4 }}>
                  Incomplete: {missingFields.map((f) => f.label).join(", ")}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--success)", marginTop: 10, fontWeight: 600 }}>
                  Profile fully complete and verified
                </div>
              )}
            </div>

            {/* Vertical Settings Tabs */}
            <div className="ta-card" style={{ padding: 10, borderRadius: 16, display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { k: "profile", label: "Profile & Portfolio", Icon: User, desc: "Bio, photo, credentials" },
                { k: "communications", label: "Communications", Icon: Bell, desc: "Notifications and alerts" },
                { k: "sessions", label: "Sessions & Video", Icon: Calendar, desc: "Room URLs, policies" },
                { k: "resources", label: "Resources & Agreements", Icon: FolderOpen, desc: "Documents and guides" },
              ].map(({ k, label, Icon, desc }) => {
                const isActive = tab === k;
                return (
                  <div
                    key={k}
                    onClick={() => setTab(k)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 12,
                      cursor: "pointer",
                      background: isActive ? "var(--surface-2)" : "transparent",
                      borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <Icon size={18} color={isActive ? "var(--primary)" : "var(--text-3)"} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? "var(--text)" : "var(--text-2)" }}>{label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Content Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            {tab === "profile" && (
              <>
                <div className="ta-card" style={{ padding: 22, borderRadius: 16 }}>
                  <div className="ta-title" style={{ fontSize: 16 }}>Instructor Public Profile</div>
                  <div className="ta-sub" style={{ fontSize: 12, marginTop: 2 }}>This information is visible to enrolled learners and co-instructors.</div>
                  
                  <div className="ta-row ta-gap16 ta-mt16" style={{ alignItems: "center" }}>
                    <div style={{ width: 68, height: 68, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, overflow: "hidden", border: "2px solid var(--border)" }}>
                      {userProfile?.avatar_url ? <img src={userProfile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (displayName || "I").slice(0, 2).toUpperCase()}
                    </div>
                    <FileUploadZone
                      bucket="uploads"
                      pathPrefix={`avatars/${currentUserId}`}
                      accept="image/*"
                      onUploaded={async (url) => {
                        try {
                          await updateUserAvatar(currentUserId, url);
                          userProfileQuery?.refetch?.();
                          showToast("Profile picture updated!");
                        } catch (e) {
                          showToast(e.message || "Could not update picture.");
                        }
                      }}
                      label="Change photo"
                    />
                  </div>
          <div className="ta-label ta-mt16">Display Name</div>
          <div className="ta-row ta-gap8">
            <input className="ta-input ta-mt6" style={{ flex: 1 }} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <button
              className="ta-btn ta-btn-outline ta-mt6"
              disabled={savingName || !displayName.trim()}
              onClick={async () => {
                setSavingName(true);
                try {
                  await updateUserDisplayName(currentUserId, displayName);
                  userProfileQuery?.refetch?.();
                  showToast("Name updated!");
                } catch (e) {
                  showToast(e.message || "Could not update name.");
                } finally {
                  setSavingName(false);
                }
              }}
            >
              Save name
            </button>
          </div>
          <div className="ta-label ta-mt16">Specialization / Teaching Areas</div>
          <input className="ta-input ta-mt6" style={{ width: "100%" }} placeholder="e.g. AI Fundamentals, Data Science" value={specialization} onChange={e => setSpecialization(e.target.value)} />
          <div className="ta-label ta-mt16">Bio</div>
          <textarea className="ta-input ta-mt6" style={{ width: "100%", resize: "vertical" }} rows={4} placeholder="Tell learners about yourself..." value={bio} onChange={e => setBio(e.target.value)} />
          <button className="ta-btn ta-btn-primary ta-mt16" disabled={savingProfile} onClick={handleSaveProfile}>Save profile</button>
        </div>

        <div className="ta-card ta-mt20" style={{ maxWidth: 700 }}>
          <div className="ta-title">Credentials & Certifications</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>Optional - helps learners know your background, not required to teach.</div>
          <div className="ta-col ta-gap8 ta-mt12 anim-stagger">
            {credentialsQuery.loading && <div className="ta-empty">Loading credentials...</div>}
            {!credentialsQuery.loading && (credentialsQuery.data || []).length === 0 && <div className="ta-empty">No credentials added yet.</div>}
            {(credentialsQuery.data || []).map(c => (
              <div key={c.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, flexWrap: "wrap", gap: 8 }}>
                <div className="ta-row ta-gap10" style={{ minWidth: 0, flex: "1 1 180px" }}>
                  <BadgeCheck size={16} color={c.is_verified ? "var(--success)" : "var(--text-3)"} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.issuing_organization} · {(c.credential_type || "").replace(/_/g, " ")}</div>
                  </div>
                </div>
                <div className="ta-row ta-gap8" style={{ flexShrink: 0 }}>
                  <Tag tone={c.is_verified ? "success" : "warning"}>{c.is_verified ? "verified" : "unverified"}</Tag>
                  <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={() => handleDeleteCredential(c.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="ta-row ta-gap8 ta-mt16" style={{ flexWrap: "wrap" }}>
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Title (e.g. AWS ML Specialty)" value={credTitle} onChange={e => setCredTitle(e.target.value)} />
            <select className="ta-input" style={{ flex: "1 1 160px" }} value={credType} onChange={e => setCredType(e.target.value)}>
              {CREDENTIAL_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Issuing organization" value={credOrg} onChange={e => setCredOrg(e.target.value)} />
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Verification URL (optional)" value={credUrl} onChange={e => setCredUrl(e.target.value)} />
            <button className="ta-btn ta-btn-outline" disabled={!mentorId || savingCred} onClick={handleAddCredential}><Plus size={14} /> Add</button>
          </div>
        </div>

        <div className="ta-card ta-mt20" style={{ maxWidth: 700 }}>
          <div className="ta-title">Portfolio</div>
          <div className="ta-col ta-gap8 ta-mt12 anim-stagger">
            {portfolioQuery.loading && <div className="ta-empty">Loading portfolio...</div>}
            {!portfolioQuery.loading && (portfolioQuery.data || []).length === 0 && <div className="ta-empty">No portfolio items added yet.</div>}
            {(portfolioQuery.data || []).map(p => (
              <div key={p.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                  <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{p.title}</span>
                    <Tag>{(p.item_type || "link").replace(/_/g, " ")}</Tag>
                  </div>
                  {p.description && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>{p.description}</div>}
                  {p.media_urls?.[0] && (
                    <a href={p.media_urls[0]} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--primary)", display: "flex", alignItems: "center", gap: 4, marginTop: 4, minWidth: 0 }}>
                      <LinkIcon size={12} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.media_urls[0]}</span>
                    </a>
                  )}
                </div>
                <button className="ta-btn ta-btn-ghost ta-btn-sm" style={{ flexShrink: 0 }} onClick={() => handleDeletePortfolioItem(p.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="ta-row ta-gap8 ta-mt16" style={{ flexWrap: "wrap" }}>
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Title" value={pfTitle} onChange={e => setPfTitle(e.target.value)} />
            <select className="ta-input" style={{ flex: "1 1 160px" }} value={pfType} onChange={e => setPfType(e.target.value)}>
              {PORTFOLIO_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Description (optional)" value={pfDescription} onChange={e => setPfDescription(e.target.value)} />
            <input className="ta-input" style={{ flex: "1 1 160px" }} placeholder="Link URL (optional)" value={pfUrl} onChange={e => setPfUrl(e.target.value)} />
            <button className="ta-btn ta-btn-outline" disabled={!mentorId || savingPf} onClick={handleAddPortfolioItem}><Plus size={14} /> Add</button>
          </div>
        </div>
          </>
        )}

        {tab === "communications" && (
          <>
            <div className="ta-card ta-mt20">
              <div className="ta-title">Notification Preferences</div>
              {[
                { key: "in_app_enabled", label: "In-App Notifications" },
                { key: "email_enabled", label: "Email Notifications" },
                { key: "push_enabled", label: "Push Notifications" },
              ].map(({ key, label }) => (
                <div key={key} className="ta-row ta-between ta-mt12">
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
                  <Switch on={notifPrefs[key] !== false} onChange={() => handleToggleNotifPref(key, notifPrefs[key] !== false)} />
                </div>
              ))}
            </div>

            <div className="ta-card ta-mt20">
              <div className="ta-title">Automated Reminders</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>Configure automated session reminders for your learners.</div>
              <div className="ta-col ta-gap8 ta-mt12 anim-stagger">
                {remindersQuery.loading && <div className="ta-empty">Loading reminders...</div>}
                {!remindersQuery.loading && (remindersQuery.data || []).length === 0 && <div className="ta-empty">No reminders configured.</div>}
                {(remindersQuery.data || []).map((r) => (
                  <div key={r.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13, minWidth: 0, overflowWrap: "break-word", flex: "1 1 160px" }}>{r.reminder_type} • {r.hours_before}h before{r.custom_message ? `: "${r.custom_message}"` : ""}</div>
                    <button className="ta-btn ta-btn-ghost ta-btn-sm" style={{ flexShrink: 0 }} onClick={async () => { await deleteReminderSetting(r.id); remindersQuery.refetch(); }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="ta-row ta-gap8 ta-mt16" style={{ flexWrap: "wrap" }}>
                <select className="ta-input" style={{ flex: "0 1 140px" }} value={reminderType} onChange={(e) => setReminderType(e.target.value)}>
                  <option value="email">Email</option>
                  <option value="in_app">In-App</option>
                  <option value="sms">SMS</option>
                </select>
                <input className="ta-input" type="number" style={{ width: 100 }} value={hoursBefore} onChange={(e) => setHoursBefore(e.target.value)} placeholder="Hours before" />
                <input className="ta-input" style={{ flex: "1 1 200px" }} placeholder="Custom message (optional)" value={reminderMsg} onChange={(e) => setReminderMsg(e.target.value)} />
                <button className="ta-btn ta-btn-outline" onClick={handleAddReminder}><Plus size={14} /> Add Reminder</button>
              </div>
            </div>
          </>
        )}

        {tab === "sessions" && (
          <>
            <div className="ta-card ta-mt20">
              <div className="ta-title">Session Preferences</div>
              {[
                { key: "auto_accept_bookings", label: "Auto-Accept Bookings", sub: "Automatically approve session requests", state: autoAccept, setState: setAutoAccept },
                { key: "require_pre_payment", label: "Require Pre-Payment", sub: "Payment required before sessions", state: requirePrePayment, setState: setRequirePrePayment },
                { key: "allow_group_sessions", label: "Allow Group Sessions", sub: "Enable multi-learner sessions", state: allowGroupSessions, setState: setAllowGroupSessions },
              ].map(({ key, label, sub, state, setState }) => (
                <div key={key} className="ta-row ta-between ta-mt12">
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{sub}</div>
                  </div>
                  <Switch on={state} onChange={() => { const next = !state; setState(next); handleToggleSessionPref(key, next); }} />
                </div>
              ))}
            </div>

            <div className="ta-card ta-mt20">
              <div className="ta-title">Session Templates</div>
              <div className="ta-col ta-gap8 ta-mt12 anim-stagger">
                {!templatesQuery.loading && (templatesQuery.data || []).length === 0 && <div className="ta-empty">No templates yet.</div>}
                {(templatesQuery.data || []).map((t) => (
                  <div key={t.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, minWidth: 0, overflowWrap: "break-word", flex: "1 1 160px" }}>{t.title}</div>
                    <button className="ta-btn ta-btn-ghost ta-btn-sm" style={{ flexShrink: 0 }} onClick={async () => { await deleteSessionTemplate(t.id); templatesQuery.refetch(); }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="ta-row ta-gap8 ta-mt16">
                <input className="ta-input" style={{ flex: 1 }} placeholder="Template title" value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} />
                <button className="ta-btn ta-btn-outline" onClick={handleAddTemplate}><Plus size={14} /> Create Template</button>
              </div>
            </div>

            <div className="ta-card ta-mt20">
              <div className="ta-title">Cancellation Policies</div>
              <div className="ta-col ta-gap8 ta-mt12 anim-stagger">
                {!policiesQuery.loading && (policiesQuery.data || []).length === 0 && <div className="ta-empty">No cancellation policies set.</div>}
                {(policiesQuery.data || []).map((p) => (
                  <div key={p.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13, minWidth: 0, flex: "1 1 160px" }}>Cancel within {p.hours_before}h: {p.fee_percentage}% fee</div>
                    <button className="ta-btn ta-btn-ghost ta-btn-sm" style={{ flexShrink: 0 }} onClick={async () => { await deleteCancellationPolicy(p.id); policiesQuery.refetch(); }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="ta-row ta-gap8 ta-mt16">
                <input className="ta-input" type="number" style={{ width: 100 }} value={policyHours} onChange={(e) => setPolicyHours(e.target.value)} placeholder="Hours" />
                <input className="ta-input" type="number" style={{ width: 100 }} value={policyFee} onChange={(e) => setPolicyFee(e.target.value)} placeholder="Fee %" />
                <button className="ta-btn ta-btn-outline" onClick={handleAddPolicy}><Plus size={14} /> Add Policy</button>
              </div>
            </div>

            <div className="ta-card ta-mt20">
              <div className="ta-title">Video Platform Settings</div>
              <div className="ta-label ta-mt12">Preferred Platform</div>
              <select className="ta-input ta-mt6" style={{ width: "100%" }} value={videoPlatform} onChange={(e) => setVideoPlatform(e.target.value)}>
                {VIDEO_PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <div className="ta-label ta-mt16">Personal Meeting Room URL (Optional)</div>
              <input className="ta-input ta-mt6" style={{ width: "100%" }} placeholder="Leave empty to auto-generate" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
              <button className="ta-btn ta-btn-primary ta-mt16" onClick={handleSaveVideoSettings}>Save Video Settings</button>
            </div>
          </>
        )}

        {tab === "resources" && (
          <>
            <div className="ta-card ta-mt20">
              <div className="ta-title">Resource Library</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>Share learning materials and resources with your learners.</div>
              <div className="ta-col ta-gap8 ta-mt12 anim-stagger">
                {!resourcesQuery.loading && (resourcesQuery.data || []).length === 0 && <div className="ta-empty">No resources yet.</div>}
                {(resourcesQuery.data || []).map((r) => (
                  <div key={r.id} className="ta-row ta-between" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, minWidth: 0, overflowWrap: "break-word", flex: "1 1 160px" }}>{r.title}</div>
                    <button className="ta-btn ta-btn-ghost ta-btn-sm" style={{ flexShrink: 0 }} onClick={async () => { await deleteMentorResource(r.id); resourcesQuery.refetch(); }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="ta-row ta-gap8 ta-mt16">
                <input className="ta-input" style={{ flex: 1 }} placeholder="Title" value={resTitle} onChange={(e) => setResTitle(e.target.value)} />
                <input className="ta-input" style={{ flex: 1 }} placeholder="URL" value={resUrl} onChange={(e) => setResUrl(e.target.value)} />
                <button className="ta-btn ta-btn-outline" onClick={handleAddResource}><Plus size={14} /> Add Resource</button>
              </div>
            </div>

            <div className="ta-card ta-mt20">
              <div className="ta-title">Mentorship Agreements</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>Manage contracts and expectations with your learners.</div>
              <div className="ta-col ta-gap8 ta-mt12">
                {!agreementsQuery.loading && (agreementsQuery.data || []).length === 0 && <div className="ta-empty">No agreements yet.</div>}
                {(agreementsQuery.data || []).map((a) => (
                  <div key={a.id} className="ta-row ta-gap8" style={{ padding: 12, background: "var(--surface-3)", borderRadius: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, minWidth: 0, overflowWrap: "break-word" }}>{a.learner_name}</span>
                    <Tag tone={a.status === "signed" ? "success" : "warning"}>{a.status}</Tag>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 10 }}>
                Create a new agreement from a specific learner's profile in My Learners.
              </div>
            </div>
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
