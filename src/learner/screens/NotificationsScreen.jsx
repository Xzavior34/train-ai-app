import React, { useState, useMemo, useEffect } from "react";
import { TopBar } from "../components/LearnerUI.jsx";
import {
  Bell, BookOpen, Video, Trophy, CheckCheck, Trash2,
  Search, ArrowRight, MessageSquare, ShieldAlert, Check, X, Filter
} from "lucide-react";

export function NotificationsScreen({
  notifications = [],
  markAllNotificationsRead,
  markOneNotificationRead,
  back,
  push
}) {
  const [filterTab, setFilterTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [localNotifs, setLocalNotifs] = useState(notifications);

  // Keep the local read/delete overlay in sync with the real notifications
  // feed as it loads/updates, instead of ever falling back to fabricated
  // placeholder data.
  useEffect(() => {
    setLocalNotifs(notifications);
  }, [notifications]);

  const baseNotifs = localNotifs;

  const unreadCount = useMemo(() => baseNotifs.filter(n => !n.read).length, [baseNotifs]);

  const filteredNotifs = useMemo(() => {
    return baseNotifs.filter(n => {
      // Tab filter
      if (filterTab === "unread" && n.read) return false;
      if (filterTab === "assignment" && n.type !== "assignment") return false;
      if (filterTab === "live" && n.type !== "live") return false;
      if (filterTab === "achievement" && n.type !== "achievement") return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title?.toLowerCase().includes(q);
        const matchesMsg = n.message?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg) return false;
      }

      return true;
    });
  }, [baseNotifs, filterTab, searchQuery]);

  function handleMarkAll() {
    if (markAllNotificationsRead) markAllNotificationsRead();
    setLocalNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  function handleToggleRead(id, e) {
    if (e) e.stopPropagation();
    if (markOneNotificationRead) markOneNotificationRead(id);
    setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  }

  function handleDeleteNotification(id, e) {
    if (e) e.stopPropagation();
    setLocalNotifs(prev => prev.filter(n => n.id !== id));
  }

  function handleClearAll() {
    setLocalNotifs([]);
  }

  function iconForType(type) {
    switch (type) {
      case "live":
        return <Video size={18} color="#EF4444" />;
      case "assignment":
        return <BookOpen size={18} color="var(--primary)" />;
      case "achievement":
        return <Trophy size={18} color="#F59E0B" />;
      case "mentor":
        return <MessageSquare size={18} color="#10B981" />;
      default:
        return <Bell size={18} color="var(--primary)" />;
    }
  }

  function typeLabel(type) {
    switch (type) {
      case "live": return "Live Workshop";
      case "assignment": return "Assignment";
      case "achievement": return "Milestone";
      case "mentor": return "Mentor Note";
      default: return "Update";
    }
  }

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <TopBar
        title="Notifications & Updates"
        sub={`${unreadCount} unread alert${unreadCount === 1 ? "" : "s"} across all courses and cohorts`}
        onBack={back}
        hideBell
      />

      {/* =========================================================================
          HERO BANNER: Unified Command Center
          ========================================================================= */}
      {/* =========================================================================
          HERO BANNER: Unified Activity Center (Adaptive Liquid Glass)
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 70%)",
            pointerEvents: "none"
          }}
        />

        <div className="tai-row tai-between" style={{ position: "relative", zIndex: 1, flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="tai-row tai-gap10" style={{ flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{
                background: "rgba(99, 102, 241, 0.25)", color: "#A5B4FC",
                border: "1px solid rgba(165, 180, 252, 0.4)",
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                display: "inline-flex", alignItems: "center", gap: 6, letterSpacing: "0.03em"
              }}>
                <Bell size={13} color="#A5B4FC" /> REAL-TIME ALERTS
              </span>
              <span style={{
                background: unreadCount > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                color: unreadCount > 0 ? "#FCA5A5" : "#34D399",
                border: unreadCount > 0 ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(16, 185, 129, 0.4)",
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99
              }}>
                {unreadCount > 0 ? `${unreadCount} UNREAD ALERT${unreadCount === 1 ? "" : "S"}` : "ALL CAUGHT UP"}
              </span>
            </div>
            <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", lineHeight: 1.2 }}>
              Notifications &amp; Activity Center
            </h1>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 640, lineHeight: 1.45 }}>
              Stay on top of live instructor sessions, cohort assignments, milestone achievements, and platform announcements.
            </p>
          </div>

          <div className="tai-row tai-gap8" style={{ flexWrap: "wrap", flexShrink: 0 }}>
            {unreadCount > 0 && (
              <button
                type="button"
                className="tai-btn tai-btn-primary tai-btn-sm"
                onClick={handleMarkAll}
                style={{
                  fontWeight: 700,
                  display: "inline-flex", alignItems: "center", gap: 6,
                  borderRadius: 8, height: 34, padding: "0 14px"
                }}
              >
                <CheckCheck size={14} /> Mark All Read
              </button>
            )}
            {baseNotifs.length > 0 && (
              <button
                type="button"
                className="tai-btn tai-btn-outline tai-btn-sm"
                onClick={handleClearAll}
                style={{
                  color: "var(--danger)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
                  borderRadius: 8, height: 34, padding: "0 12px"
                }}
                title="Clear all notifications"
              >
                <Trash2 size={13} /> Clear History
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          TOOLBAR: Search & Segmented Filter Pills
          ========================================================================= */}
      <div className="tai-card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, borderRadius: 10 }}>
        <div style={{ position: "relative", width: "100%" }}>
          <Search
            size={15}
            color="var(--text-3)"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            className="tai-input"
            placeholder="Search notification title or message content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 36, height: 38, width: "100%", borderRadius: 8, fontSize: 13 }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center"
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="tai-scrollx" style={{ gap: 6, paddingBottom: 2 }}>
          {[
            { k: "all", label: `All Updates (${baseNotifs.length})` },
            { k: "unread", label: `Unread (${unreadCount})` },
            { k: "assignment", label: "Assignments" },
            { k: "live", label: "Live Sessions" },
            { k: "achievement", label: "Achievements & XP" },
          ].map(t => (
            <button
              key={t.k}
              type="button"
              className={`tai-pill ${filterTab === t.k ? "tai-pill-active" : "tai-pill-inactive"}`}
              onClick={() => setFilterTab(t.k)}
              style={{ whiteSpace: "nowrap", cursor: "pointer", border: "none", fontSize: 12, padding: "5px 12px" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          NOTIFICATIONS LIST
          ========================================================================= */}
      <div className="tai-col tai-gap10 anim-stagger">
        {filteredNotifs.length === 0 ? (
          <div className="tai-card tai-empty" style={{ padding: "48px 20px", textAlign: "center", borderRadius: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Bell size={22} color="var(--text-3)" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text)" }}>No Notifications Found</div>
            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 4, maxWidth: 360, margin: "4px auto 0" }}>
              {searchQuery ? "No notifications matched your search keywords." : "You're all caught up! There are no new notifications in this category."}
            </div>
          </div>
        ) : (
          filteredNotifs.map(n => (
            <div
              key={n.id}
              className="tai-card tai-card-hover"
              style={{
                background: n.read ? "var(--surface)" : "var(--surface-2)",
                borderColor: n.read ? "var(--border)" : "var(--border)",
                borderLeft: n.read ? "1px solid var(--border)" : "3px solid #4F46E5",
                borderRadius: 10,
                padding: "14px 16px",
                transition: "all .16s ease",
                position: "relative"
              }}
            >
              <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 12 }}>
                {/* Left icon + content */}
                <div className="tai-row tai-gap12" style={{ alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 8,
                    background: n.read ? "var(--surface-3)" : "var(--primary-tint)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0
                  }}>
                    {iconForType(n.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <div className="tai-row tai-gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
                        <span className="tai-tag" style={{ fontSize: 10.5, padding: "2px 7px", background: "var(--surface-3)", color: "var(--text-2)", borderRadius: 4 }}>
                          {typeLabel(n.type)}
                        </span>
                        <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)", letterSpacing: "-0.01em" }}>
                          {n.title}
                        </div>
                      </div>

                      <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                        <span style={{ fontSize: 11.5, color: "var(--text-3)", whiteSpace: "nowrap" }}>{n.time}</span>
                        {!n.read && (
                          <span
                            className="anim-pulse"
                            style={{ width: 7, height: 7, borderRadius: "50%", background: "#4F46E5", flexShrink: 0 }}
                            title="Unread"
                          />
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, marginTop: 6 }}>
                      {n.message}
                    </div>

                    {/* Action Bar */}
                    <div className="tai-row tai-between" style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        {n.actionLabel && (
                          <button
                            type="button"
                            className="tai-btn tai-btn-primary tai-btn-sm"
                            style={{ borderRadius: 6, height: 28, padding: "0 10px", fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5, background: "#4F46E5" }}
                            onClick={() => {
                              if (push && n.actionUrl) push(n.actionUrl);
                            }}
                          >
                            <span>{n.actionLabel}</span>
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>

                      <div className="tai-row tai-gap6">
                        <button
                          type="button"
                          className="tai-btn tai-btn-ghost tai-btn-sm"
                          style={{ padding: "3px 8px", fontSize: 11.5, height: 28, borderRadius: 6 }}
                          onClick={(e) => handleToggleRead(n.id, e)}
                        >
                          {n.read ? "Mark unread" : "Mark read"}
                        </button>
                        <button
                          type="button"
                          className="tai-btn tai-btn-ghost tai-btn-sm"
                          style={{ padding: "3px 8px", fontSize: 11.5, height: 28, borderRadius: 6, color: "var(--danger)" }}
                          onClick={(e) => handleDeleteNotification(n.id, e)}
                          title="Dismiss notification"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
