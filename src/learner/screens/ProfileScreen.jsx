import React, { useState, useEffect } from "react";
import { TopBar, Avatar, Switch } from "../components/LearnerUI.jsx";
import { Moon, ShieldCheck, Download, LogOut, ChevronRight, Trophy, Accessibility, Camera, AlertTriangle, Trash2, Clock, Smartphone, Bell, Star, Flame, User, CheckCircle2, Lock, BookOpen, Zap, Mail, Sliders, Shield, MessageSquare, Send, Check, Gift, Copy, Users } from "lucide-react";
import { exportUserData, submitDSARRequest, fetchUserDSARRequests } from "../../lib/api/gdprService.js";
import { fetchNotificationPreferences, upsertNotificationPreferences } from "../../lib/api/schemaHelper.js";
import { submitPlatformFeedback, updateWeeklyGoal } from "../../lib/api/platform.js";
import AccessibilityPanel from "../../components/common/AccessibilityPanel.jsx";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import MfaSetupScreen from "../../pages/auth/MfaSetupScreen.jsx";
import { usePushNotifications } from "../hooks/usePushNotifications.js";

export function ProfileScreen({
  user,
  dark,
  setDark,
  signOut,
  back,
  push,
  onOpenDashboardSwitcher,
  credits,
  onBuyCredits,
  session,
  onAvatarUploaded,
  showToast,
  gamificationEnabled = true,
  weeklyGoal = 5,
  setWeeklyGoal,
  referralLink = null,
  referralStats = null
}) {
  const [activeTab, setActiveTab] = useState("profile");
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("General");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submittingDeletion, setSubmittingDeletion] = useState(false);
  const [dsarRequests, setDsarRequests] = useState([]);

  const userId = session?.user?.id;
  const notify = showToast || (() => {});
  const pushNotifications = usePushNotifications(userId);

  async function handleSetWeeklyGoal(goal) {
    setSavingGoal(true);
    try {
      const result = await updateWeeklyGoal(userId, goal);
      if (!result.success) notify(result.error);
      else {
        setWeeklyGoal?.(goal);
        notify(`Weekly goal set to ${goal} lessons.`);
      }
    } finally {
      setSavingGoal(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    fetchUserDSARRequests(userId).then((rows) => {
      if (!cancelled) setDsarRequests(rows);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    fetchNotificationPreferences(userId).then((prefs) => {
      if (!cancelled) setNotifPrefs(prefs || { email_enabled: true, push_enabled: true, in_app_enabled: true });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  async function handleToggleNotifPref(field) {
    const prev = notifPrefs;
    const next = { ...notifPrefs, [field]: !notifPrefs[field] };
    setNotifPrefs(next);
    try {
      const result = await upsertNotificationPreferences(userId, next);
      if (result && result.success === false) {
        setNotifPrefs(prev);
        notify(result.error || "Could not update notification preferences.");
      } else {
        notify("Notification preferences updated.");
      }
    } catch (e) {
      setNotifPrefs(prev);
      notify(e?.message || "Could not update notification preferences.");
    }
  }

  const pendingErasureRequest = dsarRequests.find((r) => r.request_type === "erasure" && r.status === "pending");

  async function handleDownloadData() {
    if (!userId) { notify("Sign in again to export your data."); return; }
    setExporting(true);
    try {
      const data = await exportUserData(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `train-ai-data-export-${userId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      submitDSARRequest({ userId, email: session?.user?.email || "", requestType: "export" }).catch(() => {});
      notify("Your data export has downloaded.");
    } catch (e) {
      notify(e?.message || "Could not export your data. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleTogglePush() {
    if (!userId) { notify("Sign in again to manage push notifications."); return; }
    if (!pushNotifications.supported) { notify("Push notifications aren't supported in this browser."); return; }
    if (pushNotifications.subscribed) {
      const ok = await pushNotifications.unsubscribe();
      notify(ok ? "Push notifications turned off." : "Could not turn off push notifications. Please try again.");
      return;
    }
    const ok = await pushNotifications.requestAndSubscribe();
    if (ok) {
      notify("Push notifications enabled.");
    } else if (pushNotifications.permission === "denied") {
      notify("Notifications are blocked for this site. Enable them in your browser settings.");
    } else {
      notify("Could not enable push notifications. Please try again.");
    }
  }

  async function handleConfirmDeletionRequest() {
    if (!userId) { notify("Sign in again to request account deletion."); return; }
    setSubmittingDeletion(true);
    try {
      const res = await submitDSARRequest({
        userId,
        email: session?.user?.email || "",
        requestType: "erasure",
        notes: "Submitted by learner from Profile & Settings",
      });
      if (res.success) {
        notify("Deletion request submitted. Our team will review it and follow up by email.");
        setShowDeleteConfirm(false);
        setDsarRequests((prev) => [res.request, ...prev]);
      } else {
        notify(res.error || "Could not submit your deletion request. Please try again.");
      }
    } catch (e) {
      notify(e?.message || "Could not submit your deletion request. Please try again.");
    } finally {
      setSubmittingDeletion(false);
    }
  }

  const TABS = [
    { key: "profile", label: "Profile & Overview", icon: User },
    { key: "preferences", label: "Preferences & Habits", icon: Sliders },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "security", label: "Security & Access", icon: Shield },
    { key: "privacy", label: "Privacy & Data", icon: Download },
    { key: "referrals", label: "Invite & Earn", icon: Gift },
    { key: "feedback", label: "Support & Feedback", icon: MessageSquare },
  ];

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: 1040, margin: "0 auto", padding: "0 0 32px" }}>
      <TopBar title="Profile & Settings" sub="Manage your personal identity, learning pace, security, and app preferences" onBack={back} />

      {/* =========================================================================
          REVAMPED LIQUID GLASS PROFILE IDENTITY HERO
          ========================================================================= */}
      <div
        className="tai-card anim-fluid-entrance"
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 14,
          padding: "clamp(20px, 3.5vw, 32px)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "inset 0 1px 0 var(--glass-specular), 0 10px 30px -10px rgba(0,0,0,0.12)"
        }}
      >
        {/* Subtle decorative glow in top corner */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(79, 70, 229, 0.18) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        {/* Profile Identity Details (Stacked cleanly on Mobile, Flex Row on Desktop) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(12px, 3vw, 20px)", flex: "1 1 260px", minWidth: 0, flexWrap: "wrap" }}>
            {/* Avatar with Camera Overlay */}
            <div
              style={{ position: "relative", cursor: session?.user?.id ? "pointer" : "default", flexShrink: 0 }}
              onClick={() => session?.user?.id && setShowAvatarUpload(v => !v)}
              title="Change profile photo"
            >
              <img
                src={user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=220&auto=format&fit=crop&q=80"}
                alt={user.name}
                style={{
                  width: "clamp(68px, 14vw, 88px)",
                  height: "clamp(68px, 14vw, 88px)",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid var(--surface-2)",
                  boxShadow: "0 8px 24px -4px rgba(0,0,0,0.22)"
                }}
              />
              {session?.user?.id && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#4F46E5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid var(--surface)",
                    color: "#FFFFFF",
                    boxShadow: "0 2px 8px rgba(79, 70, 229, 0.45)"
                  }}
                >
                  <Camera size={12} />
                </div>
              )}
            </div>

            {/* Name, Verified Badge & Metadata */}
            <div style={{ minWidth: 0, flex: "1 1 200px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontWeight: 900, fontSize: "clamp(19px, 3.5vw, 25px)", color: "var(--text)", letterSpacing: "-0.025em", margin: 0, lineHeight: 1.2, wordBreak: "break-word" }}>
                  {user.name || "Evelyn Hayes"}
                </h1>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 99,
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#10B981",
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  <CheckCircle2 size={11} /> Verified Learner
                </span>
              </div>

              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 5, display: "flex", alignItems: "center", gap: "clamp(6px, 1.5vw, 10px)", flexWrap: "wrap", lineHeight: 1.4 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, wordBreak: "break-all" }}>
                  <Mail size={12} color="var(--text-3)" />
                  {user.email || "evelyn.hayes@trainai.co"}
                </span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span>{user.location || "San Francisco, CA"}</span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span>{user.organization || "Train AI Academy"}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span className="tai-tag" style={{ fontWeight: 700, padding: "3px 8px", fontSize: 11 }}>
                  <Zap size={11} style={{ marginRight: 4 }} />
                  {user.track || "Full-Stack AI & Design"}
                </span>
                {user.role && (
                  <span className="tai-tag" style={{ background: "var(--surface-3)", color: "var(--text-2)", padding: "3px 8px", fontSize: 11 }}>
                    {user.role.toUpperCase()}
                  </span>
                )}
                <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>
                  Cohort 04 • Sprint 5
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
            {onBuyCredits && (
              <button
                className="tai-btn tai-btn-outline tai-btn-sm"
                onClick={onBuyCredits}
                style={{ padding: "7px 12px", fontWeight: 700, fontSize: 12 }}
              >
                <Zap size={13} color="var(--primary)" />
                <span>{typeof credits === "number" ? credits : 10} Credits</span>
              </button>
            )}
            {session?.user?.id && (
              <button
                className="tai-btn tai-btn-outline tai-btn-sm"
                onClick={() => setShowAvatarUpload(v => !v)}
                style={{ padding: "7px 12px", fontWeight: 700, fontSize: 12 }}
              >
                <Camera size={13} />
                <span>Change Photo</span>
              </button>
            )}
          </div>
        </div>

        {/* Upload Zone Drawer */}
        {showAvatarUpload && session?.user?.id && (
          <div className="tai-mt20 anim-fluid-entrance" style={{ background: "var(--surface-2)", padding: 18, borderRadius: 10, border: "1px solid var(--border)" }}>
            <FileUploadZone
              bucket="uploads"
              pathPrefix={`avatars/${session.user.id}`}
              accept="image/*"
              maxSizeMB={5}
              label="Drag and drop a new profile photo, or click to browse"
              onUploaded={(url) => {
                onAvatarUploaded?.(url);
                setShowAvatarUpload(false);
              }}
            />
          </div>
        )}

        {/* 4 Stat Cards with Responsive Grid & Liquid Glass Styling */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
          <div className="tai-card" style={{ textAlign: "center", padding: "12px 8px", borderRadius: 10, background: "var(--surface-2)" }}>
            <div style={{ fontWeight: 900, fontSize: "clamp(17px, 2.2vw, 21px)", color: "var(--primary)", letterSpacing: "-0.02em" }}>{user.mastery ?? 88}%</div>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2, fontWeight: 600 }}>Curriculum Mastery</div>
          </div>
          <div className="tai-card" style={{ textAlign: "center", padding: "12px 8px", borderRadius: 10, background: "var(--surface-2)" }}>
            <div className="tai-row tai-gap4" style={{ justifyContent: "center", fontWeight: 900, fontSize: "clamp(17px, 2.2vw, 21px)", color: "#F59E0B" }}>
              <span>{user.streak ?? 8}</span> <Flame size={16} color="#F59E0B" fill="#F59E0B" />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2, fontWeight: 600 }}>Active Day Streak</div>
          </div>
          <div className="tai-card" style={{ textAlign: "center", padding: "12px 8px", borderRadius: 10, background: "var(--surface-2)" }}>
            <div style={{ fontWeight: 900, fontSize: "clamp(17px, 2.2vw, 21px)", color: "var(--text)", letterSpacing: "-0.02em" }}>{(user.totalPoints || 4520).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2, fontWeight: 600 }}>Credential XP</div>
          </div>
          <div className="tai-card" style={{ textAlign: "center", padding: "12px 8px", borderRadius: 10, background: "var(--surface-2)" }}>
            <div style={{ fontWeight: 900, fontSize: "clamp(17px, 2.2vw, 21px)", color: "var(--success)", letterSpacing: "-0.02em" }}>3 Issued</div>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2, fontWeight: 600 }}>Certificates</div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB NAVIGATION (Responsive Scroll with Fluid Liquid Glass Pills)
          ========================================================================= */}
      <div className="tai-scrollx" style={{ gap: 8, paddingBottom: 6, width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              className={`tai-btn tai-btn-sm ${isActive ? "tai-btn-primary" : "tai-btn-outline"}`}
              style={{
                borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700,
                display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", flexShrink: 0
              }}
              onClick={() => setActiveTab(t.key)}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: PROFILE & OVERVIEW
          ========================================================================= */}
      {activeTab === "profile" && (
        <div className="tai-col tai-gap16 anim-stagger">
          <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
            <h2 className="tai-title-sm" style={{ margin: "0 0 14px" }}>Learner Information & Identity</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div style={{ background: "var(--surface-2)", padding: 14, borderRadius: 8 }}>
                <label className="tai-label">Full Name</label>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>{user.name || "Evelyn Hayes"}</div>
              </div>
              <div style={{ background: "var(--surface-2)", padding: 14, borderRadius: 8 }}>
                <label className="tai-label">Email Address</label>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>{user.email || "evelyn.hayes@trainai.co"}</div>
              </div>
              <div style={{ background: "var(--surface-2)", padding: 14, borderRadius: 8 }}>
                <label className="tai-label">Current Organization</label>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>{user.organization || "Train AI Academy"}</div>
              </div>
              <div style={{ background: "var(--surface-2)", padding: 14, borderRadius: 8 }}>
                <label className="tai-label">Enrolled Batch</label>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>Cohort 04 • Sprint 5</div>
              </div>
            </div>
          </div>

          {push && gamificationEnabled !== false && (
            <div
              className="tai-card tai-card-hover"
              style={{ cursor: "pointer", background: "var(--surface)", borderRadius: 12, padding: "clamp(16px, 3vw, 20px)" }}
              onClick={() => push("achievements")}
            >
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div className="tai-row tai-gap14">
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trophy size={20} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>View Achievements, XP & Rank</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>Level {user.level || 2} • {(user.totalPoints || 4520).toLocaleString()} XP earned across 8 badges</div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-3)" />
              </div>
            </div>
          )}

          {onOpenDashboardSwitcher && (
            <div
              className="tai-card tai-card-hover"
              style={{ cursor: "pointer", background: "var(--surface)", borderRadius: 12, padding: "clamp(16px, 3vw, 20px)" }}
              onClick={onOpenDashboardSwitcher}
            >
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div className="tai-row tai-gap14">
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShieldCheck size={20} color="#10B981" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Switch Workspace Dashboard</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>Switch to Admin, Instructor, or Manager workspaces</div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-3)" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: PREFERENCES & HABITS
          ========================================================================= */}
      {activeTab === "preferences" && (
        <div className="tai-col tai-gap16 anim-stagger">
          <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
            <h2 className="tai-title-sm" style={{ margin: "0 0 14px" }}>Display & Theme</h2>
            <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
              <div className="tai-row tai-gap12">
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Moon size={18} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Dark Mode Theme</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>High-contrast deep slate palette for comfortable night studying</div>
                </div>
              </div>
              <Switch on={dark} onChange={() => setDark(v => !v)} />
            </div>
          </div>

          <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
            <h2 className="tai-title-sm" style={{ margin: "0 0 4px" }}>Weekly Lesson Target</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 14px" }}>
              Choose your target number of lessons to complete each week. Tracked automatically on your home dashboard.
            </p>
            <div className="tai-row tai-gap10" style={{ flexWrap: "wrap" }}>
              {[3, 5, 7, 10, 14].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`tai-btn tai-btn-sm ${weeklyGoal === v ? "tai-btn-primary" : "tai-btn-outline"}`}
                  style={{ minWidth: 70, fontWeight: 800 }}
                  disabled={savingGoal}
                  onClick={() => handleSetWeeklyGoal(v)}
                >
                  {v} Lessons
                </button>
              ))}
            </div>
          </div>

          {onBuyCredits && (
            <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div className="tai-row tai-gap12">
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(99, 102, 241, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Zap size={18} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>AI Neural Credits</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{typeof credits === "number" ? credits : 10} credits available for code debugging & quiz generator</div>
                  </div>
                </div>
                <button className="tai-btn tai-btn-primary tai-btn-sm" onClick={onBuyCredits}>
                  + Get More Credits
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: NOTIFICATIONS
          ========================================================================= */}
      {activeTab === "notifications" && (
        <div className="tai-col tai-gap16 anim-stagger">
          {session?.user?.id && (
            <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
              <h2 className="tai-title-sm" style={{ margin: "0 0 14px" }}>Push Notifications</h2>
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div className="tai-row tai-gap12">
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(245, 158, 11, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bell size={18} color="#F59E0B" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Browser Push Notifications</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                      {!pushNotifications.supported
                        ? "Not supported in this browser"
                        : pushNotifications.permission === "denied"
                          ? "Blocked in browser settings. Enable in URL bar."
                          : pushNotifications.subscribed
                            ? "Active • Reminders and live session alerts enabled"
                            : "Receive alerts for live workshops even when the tab is closed"}
                    </div>
                  </div>
                </div>
                <Switch on={pushNotifications.subscribed} onChange={() => { if (!pushNotifications.loading && !pushNotifications.busy) handleTogglePush(); }} />
              </div>

              {pushNotifications.subscribed && (
                <div className="tai-row tai-between tai-mt14" style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Verify push delivery to your device</span>
                  <button
                    type="button"
                    className="tai-btn tai-btn-ghost tai-btn-sm"
                    disabled={pushNotifications.busy}
                    onClick={async () => {
                      const res = await pushNotifications.sendTestPush();
                      notify(res.ok ? "Test push notification sent!" : (res.error || "Could not send test push."));
                    }}
                  >
                    Send Test Push
                  </button>
                </div>
              )}
            </div>
          )}

          {notifPrefs && (
            <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
              <h2 className="tai-title-sm" style={{ margin: "0 0 4px" }}>Notification Channels</h2>
              <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 16px" }}>
                Select where you would like to receive course assignments, critique notices, and peer messages.
              </p>
              <div className="tai-col tai-gap14">
                <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                  <div className="tai-row tai-gap10">
                    <Mail size={16} color="var(--text-2)" />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>Email Summaries</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Weekly progress digests &amp; major syllabus announcements</div>
                    </div>
                  </div>
                  <Switch on={notifPrefs.email_enabled} onChange={() => handleToggleNotifPref("email_enabled")} />
                </div>

                <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                  <div className="tai-row tai-gap10">
                    <Smartphone size={16} color="var(--text-2)" />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>Device Push Alerts</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Live critique room reminders 15 minutes before start</div>
                    </div>
                  </div>
                  <Switch on={notifPrefs.push_enabled} onChange={() => handleToggleNotifPref("push_enabled")} />
                </div>

                <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                  <div className="tai-row tai-gap10">
                    <Bell size={16} color="var(--text-2)" />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>In-App Toast &amp; Activity Bell</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Real-time reactions, mentions, and assignment grading notices</div>
                    </div>
                  </div>
                  <Switch on={notifPrefs.in_app_enabled} onChange={() => handleToggleNotifPref("in_app_enabled")} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: SECURITY & ACCESS
          ========================================================================= */}
      {activeTab === "security" && (
        <div className="tai-col tai-gap16 anim-stagger">
          <div
            className="tai-card tai-card-hover"
            style={{ cursor: "pointer", borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}
            onClick={() => setShowAccessibility(true)}
          >
            <div className="tai-row tai-between">
              <div className="tai-row tai-gap14">
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(99, 102, 241, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Accessibility size={20} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Accessibility &amp; Motion Controls</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>High-contrast mode, dyslexia font, font scaling, and reduced motion</div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-3)" />
            </div>
          </div>

          {session?.user?.id && (
            <div
              className="tai-card tai-card-hover"
              style={{ cursor: "pointer", borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}
              onClick={() => setShowMfaSetup(true)}
            >
              <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
                <div className="tai-row tai-gap14">
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(16, 185, 129, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Smartphone size={20} color="#10B981" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Two-Factor Authentication (MFA)</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>Protect your account with Google Authenticator or 1Password TOTP</div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-3)" />
              </div>
            </div>
          )}

          <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
            <h2 className="tai-title-sm" style={{ margin: "0 0 12px" }}>Active Session Information</h2>
            <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
              Signed in as <strong>{session?.user?.email || user.email || "Learner"}</strong>. Your session is securely encrypted via Supabase Auth with JWT token refresh.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: PRIVACY & DATA (GDPR)
          ========================================================================= */}
      {activeTab === "privacy" && (
        <div className="tai-col tai-gap16 anim-stagger">
          <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
            <h2 className="tai-title-sm" style={{ margin: "0 0 6px" }}>GDPR Data Portability &amp; Export</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 16px" }}>
              Download a complete machine-readable JSON copy of all personal records, course enrollments, quiz results, and community discussions.
            </p>

            <button
              type="button"
              className="tai-btn tai-btn-outline"
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px", fontWeight: 700 }}
              disabled={exporting}
              onClick={handleDownloadData}
            >
              <Download size={16} /> {exporting ? "Generating Export..." : "Download Full Data Export (JSON)"}
            </button>
          </div>

          <div className="tai-card" style={{ borderColor: "rgba(239, 68, 68, 0.3)", borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
            <h2 className="tai-title-sm" style={{ margin: "0 0 6px", color: "var(--danger)" }}>Account Deletion &amp; Erasure</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 16px" }}>
              Permanently delete your profile, earned certificates, study records, and personal identifier tokens under GDPR Right to be Forgotten.
            </p>

            {pendingErasureRequest ? (
              <div className="tai-row tai-gap10" style={{ background: "var(--surface-2)", padding: 14, borderRadius: 8 }}>
                <Clock size={18} color="var(--warning)" />
                <div style={{ fontSize: 13, color: "var(--text)" }}>
                  <strong>Deletion request pending review:</strong> Submitted {pendingErasureRequest.requested_at ? new Date(pendingErasureRequest.requested_at).toLocaleDateString() : "recently"}.
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="tai-btn"
                style={{ background: "rgba(239, 68, 68, 0.12)", color: "var(--danger)", border: "1px solid rgba(239, 68, 68, 0.3)", width: "100%", fontWeight: 700 }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={16} /> Request Permanent Account Deletion
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: SUPPORT & FEEDBACK
          ========================================================================= */}
      {activeTab === "referrals" && (
        <div className="tai-col tai-gap16 anim-stagger">
          <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
            <h2 className="tai-title-sm" style={{ margin: "0 0 4px" }}>Invite Friends &amp; Earn</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 16px" }}>
              Share your personal link. When someone signs up through it, it's tracked here.
            </p>

            {referralLink?.code ? (
              <>
                <div className="tai-row tai-gap8" style={{ flexWrap: "wrap" }}>
                  <input
                    className="tai-input"
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${referralLink.code}`}
                    style={{ flex: 1, minWidth: 220, fontSize: 12.5 }}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className="tai-btn tai-btn-primary"
                    onClick={async () => {
                      const url = `${window.location.origin}/?ref=${referralLink.code}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        setCopiedReferral(true);
                        notify("Referral link copied!");
                        setTimeout(() => setCopiedReferral(false), 2000);
                      } catch {
                        notify("Couldn't copy automatically - select and copy the link above.");
                      }
                    }}
                  >
                    {copiedReferral ? <Check size={15} /> : <Copy size={15} />}
                    {copiedReferral ? "Copied" : "Copy Link"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 18 }}>
                  <div className="tai-card" style={{ textAlign: "center", padding: "14px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                    <Users size={18} color="var(--primary)" style={{ marginBottom: 6 }} />
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{referralStats?.signups ?? 0}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2, fontWeight: 600 }}>Friends Joined</div>
                  </div>
                  <div className="tai-card" style={{ textAlign: "center", padding: "14px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                    <Gift size={18} color="var(--primary)" style={{ marginBottom: 6 }} />
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{referralStats?.clicks ?? 0}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2, fontWeight: 600 }}>Link Clicks</div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-3)" }}>Loading your referral link...</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "feedback" && (
        <div className="tai-col tai-gap16 anim-stagger">
          <div className="tai-card" style={{ borderRadius: 12, padding: "clamp(16px, 3vw, 24px)" }}>
            <h2 className="tai-title-sm" style={{ margin: "0 0 4px" }}>Send Product Feedback &amp; Suggestions</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "0 0 16px" }}>
              Have an idea for a new course track, or found a UI bug? Your feedback goes directly to our curriculum and engineering teams.
            </p>

            <div className="tai-col tai-gap12">
              <div>
                <label className="tai-label">Category</label>
                <select
                  className="tai-input tai-mt6"
                  value={feedbackCategory}
                  onChange={(e) => setFeedbackCategory(e.target.value)}
                >
                  <option>General Suggestion</option>
                  <option>Bug Report</option>
                  <option>Course Syllabus Request</option>
                  <option>UI &amp; Accessibility</option>
                  <option>Instructor Feedback</option>
                </select>
              </div>

              <div>
                <label className="tai-label">Experience Rating</label>
                <div className="tai-row tai-gap6 tai-mt6">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-label={`Rate ${v} star`}
                      onClick={() => setFeedbackRating(v)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    >
                      <Star
                        size={22}
                        fill={v <= feedbackRating ? "#F59E0B" : "none"}
                        color={v <= feedbackRating ? "#F59E0B" : "var(--border)"}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="tai-label">Message</label>
                <textarea
                  className="tai-input tai-mt6"
                  rows={4}
                  placeholder="Share details, steps to reproduce a bug, or features you'd like to see..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="tai-btn tai-btn-primary tai-mt8"
                disabled={submittingFeedback || !feedbackText.trim()}
                onClick={async () => {
                  setSubmittingFeedback(true);
                  try {
                    const result = await submitPlatformFeedback(userId, { category: feedbackCategory, message: feedbackText, rating: feedbackRating || null });
                    if (!result.success) notify(result.error);
                    else {
                      setFeedbackText("");
                      setFeedbackRating(5);
                      notify("Thank you! Your feedback has been delivered.");
                    }
                  } finally {
                    setSubmittingFeedback(false);
                  }
                }}
              >
                <Send size={15} /> {submittingFeedback ? "Delivering..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out CTA */}
      {signOut && (
        <div style={{ paddingTop: 8 }}>
          <button
            type="button"
            className="tai-btn"
            style={{
              width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
              color: "var(--danger)", fontWeight: 700, padding: "12px 20px", borderRadius: 10
            }}
            onClick={signOut}
          >
            <LogOut size={16} /> Sign Out of Train AI
          </button>
        </div>
      )}

      {/* Sub-modals */}
      {showAccessibility && <AccessibilityPanel onClose={() => setShowAccessibility(false)} />}
      {showMfaSetup && session?.user?.id && <MfaSetupScreen onClose={() => setShowMfaSetup(false)} />}

      {/* Account Deletion Modal */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm account deletion request"
          onClick={() => !submittingDeletion && setShowDeleteConfirm(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 10000, background: "rgba(16,20,42,.65)",
            backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="tai-card anim-pop"
            style={{ width: "100%", maxWidth: 440, background: "var(--surface)", borderRadius: 12 }}
          >
            <div className="tai-row tai-gap10">
              <AlertTriangle size={22} color="var(--danger)" />
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>Request Account Deletion?</div>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginTop: 12 }}>
              This submits a formal GDPR erasure request to permanently delete your student records, course progress,
              and community activity. An administrator reviews every request before permanent purging.
            </p>
            <div className="tai-row tai-gap10 tai-mt20">
              <button
                type="button"
                className="tai-btn tai-btn-ghost"
                style={{ flex: 1 }}
                disabled={submittingDeletion}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tai-btn"
                style={{ flex: 1, background: "var(--danger)", color: "#fff", opacity: submittingDeletion ? 0.7 : 1, fontWeight: 800 }}
                disabled={submittingDeletion}
                onClick={handleConfirmDeletionRequest}
              >
                {submittingDeletion ? "Submitting..." : "Yes, Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
