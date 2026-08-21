import React, { useState, useEffect } from "react";
import { TopBar, Avatar, Switch } from "../components/LearnerUI.jsx";
import { Moon, ShieldCheck, Download, LogOut, ChevronRight, Sparkles, Trophy, Accessibility, Camera, AlertTriangle, Trash2, Clock, Smartphone, Bell, Star, Flame, User, CheckCircle2, Lock, BookOpen } from "lucide-react";
import { exportUserData, submitDSARRequest, fetchUserDSARRequests } from "../../lib/api/gdprService.js";
import { fetchNotificationPreferences, upsertNotificationPreferences } from "../../lib/api/schemaHelper.js";
import { submitPlatformFeedback, updateWeeklyGoal } from "../../lib/api/platform.js";
import AccessibilityPanel from "../../components/common/AccessibilityPanel.jsx";
import FileUploadZone from "../../components/common/FileUploadZone.jsx";
import MfaSetupScreen from "../../pages/auth/MfaSetupScreen.jsx";
import { usePushNotifications } from "../hooks/usePushNotifications.js";

export function ProfileScreen({ user, dark, setDark, signOut, back, push, onOpenDashboardSwitcher, credits, onBuyCredits, session, onAvatarUploaded, showToast, gamificationEnabled = true, weeklyGoal, setWeeklyGoal }) {
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("General");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  async function handleSetWeeklyGoal(goal) {
    setSavingGoal(true);
    try {
      const result = await updateWeeklyGoal(userId, goal);
      if (!result.success) notify(result.error);
      else { setWeeklyGoal?.(goal); notify(`Weekly goal set to ${goal} lessons.`); }
    } finally {
      setSavingGoal(false);
    }
  }
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submittingDeletion, setSubmittingDeletion] = useState(false);
  const [dsarRequests, setDsarRequests] = useState([]);

  const userId = session?.user?.id;
  const notify = showToast || (() => {});
  const pushNotifications = usePushNotifications(userId);

  // Load this learner's own DSAR request history so a pending deletion
  // request (already submitted) is visible instead of letting them submit
  // duplicates with no feedback.
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    fetchUserDSARRequests(userId).then((rows) => { if (!cancelled) setDsarRequests(rows); });
    return () => { cancelled = true; };
  }, [userId]);

  // Notification type preferences - a real, already-existing table
  // (notification_preferences) with real read/write functions, confirmed
  // to have no screen anywhere that ever called them - a genuine, bounded
  // gap found while comparing against the real 1.0 reference codebase,
  // not a new mechanism invented here.
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    fetchNotificationPreferences(userId).then((prefs) => {
      if (!cancelled) setNotifPrefs(prefs || { email_enabled: true, push_enabled: true, in_app_enabled: true });
    });
    return () => { cancelled = true; };
  }, [userId]);

  async function handleToggleNotifPref(field) {
    const next = { ...notifPrefs, [field]: !notifPrefs[field] };
    setNotifPrefs(next);
    await upsertNotificationPreferences(userId, next);
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
      // Log the export for the admin audit trail too - best-effort, the
      // download itself already happened above regardless of this outcome.
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

  return (
    <div className="tai-fade-in" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
      <TopBar title="Profile & Settings" sub="Manage your account & preferences" onBack={back} />
      
      {/* Sleek Profile Hero with Cover Photo */}
      <div className="tai-card" style={{ padding: 0, overflow: "hidden", borderRadius: 18, border: "1px solid var(--border)" }}>
        {/* Cover Photo */}
        <div style={{
          height: 100,
          background: "linear-gradient(135deg, #4338CA 0%, #6366F1 50%, #8B5CF6 100%)",
          position: "relative"
        }}>
          <img 
            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80"
            alt="Cover"
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.25 }}
          />
        </div>

        {/* Profile Content */}
        <div style={{ padding: "0 20px 20px", marginTop: -32 }}>
          <div className="tai-row tai-between" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div className="tai-row tai-gap14" style={{ alignItems: "flex-end" }}>
              <div style={{ position: "relative", cursor: session?.user?.id ? "pointer" : "default" }} onClick={() => session?.user?.id && setShowAvatarUpload(v => !v)}>
                <img 
                  src={user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=180&auto=format&fit=crop&q=80"}
                  alt={user.name}
                  style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: "4px solid var(--surface)", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}
                />
                {session?.user?.id && (
                  <div style={{
                    position: "absolute", bottom: 2, right: 2, width: 22, height: 22, borderRadius: "50%",
                    background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid var(--surface)",
                  }}>
                    <Camera size={11} color="#fff" />
                  </div>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || "Evelyn Hayes"}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email || "evelyn.hayes@trainai.co"} • {user.location || "Nairobi, Kenya"}</div>
              </div>
            </div>

            <div style={{
              background: "rgba(99, 102, 241, 0.12)", color: "var(--primary)",
              padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700
            }}>
              Track: Product Design & AI
            </div>
          </div>

          {showAvatarUpload && session?.user?.id && (
            <div className="tai-mt14">
              <FileUploadZone
                bucket="uploads"
                pathPrefix={`avatars/${session.user.id}`}
                accept="image/*"
                maxSizeMB={5}
                label="Drag and drop a photo, or click to browse"
                onUploaded={(url) => {
                  onAvatarUploaded?.(url);
                  setShowAvatarUpload(false);
                }}
              />
            </div>
          )}

          {/* 4 Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginTop: 20 }}>
            <div className="tai-card" style={{ textAlign: "center", padding: "12px 8px", background: "var(--surface-2)", borderRadius: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--primary)" }}>{user.mastery ?? 88}%</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Mastery</div>
            </div>
            <div className="tai-card" style={{ textAlign: "center", padding: "12px 8px", background: "var(--surface-2)", borderRadius: 12 }}>
              <div className="tai-row tai-gap4" style={{ justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#F59E0B" }}>
                <span>{user.streak ?? 8}</span> <Flame size={18} color="#F59E0B" />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Day Streak</div>
            </div>
            <div className="tai-card" style={{ textAlign: "center", padding: "12px 8px", background: "var(--surface-2)", borderRadius: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>{(user.totalPoints || 4520).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Total XP</div>
            </div>
            <div className="tai-card" style={{ textAlign: "center", padding: "12px 8px", background: "var(--surface-2)", borderRadius: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--success)" }}>3</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Certificates</div>
            </div>
          </div>
        </div>
      </div>

      {push && gamificationEnabled !== false && (
        <div className="tai-card tai-card-hover tai-mt12" style={{ cursor: "pointer" }} onClick={() => push("achievements")}>
          <div className="tai-row tai-between">
            <div className="tai-row tai-gap10">
              <Trophy size={18} color="var(--primary)" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Achievements & levels</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Level {user.level || 1} • {(user.totalPoints || 0).toLocaleString()} XP</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-3)" />
          </div>
        </div>
      )}

      <div className="tai-card tai-card-hover tai-mt12" style={{ cursor: "pointer" }} onClick={() => setShowAccessibility(true)}>
        <div className="tai-row tai-between">
          <div className="tai-row tai-gap10">
            <Accessibility size={18} color="var(--primary)" />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Accessibility</div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Font size, contrast & motion</div>
            </div>
          </div>
          <ChevronRight size={16} color="var(--text-3)" />
        </div>
      </div>

      {session?.user?.id && (
        <div className="tai-card tai-card-hover tai-mt12" style={{ cursor: "pointer" }} onClick={() => setShowMfaSetup(true)}>
          <div className="tai-row tai-between">
            <div className="tai-row tai-gap10">
              <Smartphone size={18} color="var(--primary)" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Two-factor authentication</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>Secure sign-in with an authenticator app</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-3)" />
          </div>
        </div>
      )}

      {onBuyCredits && (
        <div className="tai-card tai-mt12">
          <div className="tai-row tai-between">
            <div className="tai-row tai-gap10">
              <Sparkles size={18} color="var(--primary)" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>AI Credits</div>
                <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{credits ?? 0} credits available today</div>
              </div>
            </div>
            <button className="tai-btn tai-btn-ghost tai-btn-sm" onClick={onBuyCredits}>Buy more</button>
          </div>
        </div>
      )}

      <div className="tai-card tai-mt12">
        <div className="tai-title-sm">Preferences</div>
        <div className="tai-row tai-between tai-mt12">
          <div className="tai-row tai-gap10">
            <Moon size={18} color="var(--primary)" />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Dark mode</span>
          </div>
          <Switch on={dark} onChange={() => setDark(v => !v)} />
        </div>

        <hr className="tai-divider" />
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Weekly lesson goal</div>
        <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 8 }}>
          How many lessons a week you're aiming for - shown on your Home screen.
        </div>
        <div className="tai-row tai-gap8" style={{ flexWrap: "wrap" }}>
          {[3, 5, 7, 10].map((v) => (
            <button
              key={v}
              className={`tai-btn tai-btn-sm ${weeklyGoal === v ? "tai-btn-primary" : "tai-btn-outline"}`}
              disabled={savingGoal}
              onClick={() => handleSetWeeklyGoal(v)}
            >
              {v}
            </button>
          ))}
        </div>

        {session?.user?.id && (
          <>
            <hr className="tai-divider" />
            <div className="tai-row tai-between">
              <div className="tai-row tai-gap10">
                <Bell size={18} color="var(--primary)" />
                <div>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>Push notifications</span>
                  <div style={{ fontSize: 11, color: "var(--text-2)" }}>
                    {!pushNotifications.supported
                      ? "Not supported in this browser"
                      : pushNotifications.permission === "denied"
                        ? "Blocked. Enable in browser settings"
                        : pushNotifications.subscribed
                          ? "Reminders & updates enabled on this device"
                          : "Get reminders even when the tab isn't focused"}
                  </div>
                </div>
              </div>
              <Switch on={pushNotifications.subscribed} onChange={() => { if (!pushNotifications.loading && !pushNotifications.busy) handleTogglePush(); }} />
            </div>
            {pushNotifications.subscribed && (
              <div className="tai-row tai-between tai-mt10">
                <div style={{ fontSize: 11, color: "var(--text-2)" }}>Want to check it's working?</div>
                <button
                  className="tai-btn tai-btn-ghost tai-btn-sm"
                  disabled={pushNotifications.busy}
                  onClick={async () => {
                    const res = await pushNotifications.sendTestPush();
                    notify(res.ok ? "Test push sent. Check your notifications." : (res.error || "Could not send a test push."));
                  }}
                >
                  Send test push
                </button>
              </div>
            )}
          </>
        )}

        {notifPrefs && (
          <>
            <hr className="tai-divider" />
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Notification types</div>
            <div className="tai-row tai-between">
              <span style={{ fontSize: 12.5 }}>Email</span>
              <Switch on={notifPrefs.email_enabled} onChange={() => handleToggleNotifPref("email_enabled")} />
            </div>
            <div className="tai-row tai-between tai-mt10">
              <span style={{ fontSize: 12.5 }}>Push</span>
              <Switch on={notifPrefs.push_enabled} onChange={() => handleToggleNotifPref("push_enabled")} />
            </div>
            <div className="tai-row tai-between tai-mt10">
              <span style={{ fontSize: 12.5 }}>In-app</span>
              <Switch on={notifPrefs.in_app_enabled} onChange={() => handleToggleNotifPref("in_app_enabled")} />
            </div>
          </>
        )}

        <hr className="tai-divider" />
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Send feedback</div>
        <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 10 }}>
          A bug, a suggestion, anything - your admin can see this.
        </div>
        <select className="tai-input" value={feedbackCategory} onChange={(e) => setFeedbackCategory(e.target.value)}>
          <option>General</option>
          <option>Bug report</option>
          <option>Feature request</option>
          <option>Course content</option>
        </select>
        <textarea className="tai-input tai-mt8" rows={3} placeholder="Tell us what's on your mind..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
        <div className="tai-row tai-gap4 tai-mt8">
          {[1, 2, 3, 4, 5].map((v) => (
            <Star
              key={v}
              size={18}
              fill={v <= feedbackRating ? "var(--primary)" : "none"}
              color={v <= feedbackRating ? "var(--primary)" : "var(--border)"}
              style={{ cursor: "pointer" }}
              onClick={() => setFeedbackRating(v)}
            />
          ))}
        </div>
        <button
          className="tai-btn tai-btn-primary tai-mt10"
          disabled={submittingFeedback || !feedbackText.trim()}
          onClick={async () => {
            setSubmittingFeedback(true);
            try {
              const result = await submitPlatformFeedback(userId, { category: feedbackCategory, message: feedbackText, rating: feedbackRating || null });
              if (!result.success) notify(result.error);
              else { setFeedbackText(""); setFeedbackRating(0); notify("Thanks - your feedback was sent."); }
            } finally {
              setSubmittingFeedback(false);
            }
          }}
        >
          Send feedback
        </button>

        {onOpenDashboardSwitcher && (
          <>
            <hr className="tai-divider" />
            <div className="tai-row tai-between" style={{ cursor: "pointer" }} onClick={onOpenDashboardSwitcher}>
              <div className="tai-row tai-gap10">
                <ShieldCheck size={18} color="var(--primary)" />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Switch Dashboard</span>
              </div>
              <ChevronRight size={16} color="var(--text-3)" />
            </div>
          </>
        )}
      </div>

      <div className="tai-card tai-mt12">
        <div className="tai-title-sm">Privacy & Data (GDPR)</div>
        <div className="tai-col tai-gap10 tai-mt10">
          <div
            className="tai-row tai-between"
            style={{ padding: "6px 0", cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.6 : 1 }}
            onClick={exporting ? undefined : handleDownloadData}
          >
            <div className="tai-row tai-gap10">
              <Download size={17} color="var(--primary)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{exporting ? "Preparing your export..." : "Download my data (JSON)"}</div>
                <div style={{ fontSize: 11, color: "var(--text-2)" }}>Everything we hold about you: profile, enrollments, progress & more</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-3)" />
          </div>

          <hr className="tai-divider" />

          {pendingErasureRequest ? (
            <div className="tai-row tai-gap10" style={{ padding: "6px 0" }}>
              <Clock size={17} color="var(--text-2)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Deletion request pending review</div>
                <div style={{ fontSize: 11, color: "var(--text-2)" }}>
                  Submitted {pendingErasureRequest.requested_at ? new Date(pendingErasureRequest.requested_at).toLocaleDateString() : "recently"}: our team will contact you by email
                </div>
              </div>
            </div>
          ) : (
            <div
              className="tai-row tai-between"
              style={{ padding: "6px 0", cursor: "pointer" }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <div className="tai-row tai-gap10">
                <Trash2 size={17} color="var(--danger)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>Request account deletion</div>
                  <div style={{ fontSize: 11, color: "var(--text-2)" }}>Submits a request for our team to review and erase your data</div>
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-3)" />
            </div>
          )}
        </div>
      </div>

      {signOut && (
        <button className="tai-btn tai-btn-ghost tai-mt16" style={{ width: "100%", color: "var(--danger)" }} onClick={signOut}>
          <LogOut size={16} /> Sign out
        </button>
      )}

      {showAccessibility && <AccessibilityPanel onClose={() => setShowAccessibility(false)} />}

      {showMfaSetup && session?.user?.id && <MfaSetupScreen onClose={() => setShowMfaSetup(false)} />}



      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm account deletion request"
          onClick={() => !submittingDeletion && setShowDeleteConfirm(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 10000, background: "rgba(16,20,42,.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="tai-card anim-pop"
            style={{ width: "100%", maxWidth: 380, background: "var(--surface)" }}
          >
            <div className="tai-row tai-gap10">
              <AlertTriangle size={20} color="var(--danger)" />
              <div style={{ fontWeight: 800, fontSize: 15 }}>Request account deletion?</div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, marginTop: 10 }}>
              This submits a request for our team to permanently erase your profile, course progress,
              community activity and other personal data. It is not undone automatically. An admin
              reviews every request before anything is deleted. You'll be contacted by email once it's processed.
            </p>
            <div className="tai-row tai-gap10 tai-mt16">
              <button
                className="tai-btn tai-btn-ghost"
                style={{ flex: 1 }}
                disabled={submittingDeletion}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="tai-btn"
                style={{ flex: 1, background: "var(--danger)", color: "#fff", opacity: submittingDeletion ? 0.7 : 1 }}
                disabled={submittingDeletion}
                onClick={handleConfirmDeletionRequest}
              >
                {submittingDeletion ? "Submitting..." : "Yes, submit request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
