import React, { useState, useMemo } from "react";
import { TopBar } from "../components/LearnerUI.jsx";
import {
  Bell, BookOpen, Video, Trophy, Sparkles, CheckCheck, Trash2,
  Search, ArrowRight, MessageSquare, ShieldAlert, Check, X, Filter
} from "lucide-react";

const DEFAULT_NOTIFICATIONS = [
  {
    id: "notif-1",
    title: "Live Critique Session in 15 Minutes",
    message: "UI Critique & System Architecture Review with Astrid Larsson is about to start. Click to join the live studio stream.",
    type: "live",
    time: "15 min ago",
    read: false,
    actionUrl: "cohort",
    actionLabel: "Join Live Stream"
  },
  {
    id: "notif-2",
    title: "New Assignment Assigned: Design Tokens",
    message: "Your instructor posted Module 4 deliverables in 'Master Design Systems in Figma'. Due in 3 days.",
    type: "assignment",
    time: "2 hours ago",
    read: false,
    actionUrl: "courses",
    actionLabel: "Open Assignment"
  },
  {
    id: "notif-3",
    title: "Quiz Completed: +50 XP Awarded",
    message: "You scored 100% on the Prompt Engineering quiz! You're now ranked in the Top 3 of your weekly cohort.",
    type: "achievement",
    time: "Yesterday",
    read: true,
    actionUrl: "achievements",
    actionLabel: "View Leaderboard"
  },
  {
    id: "notif-4",
    title: "Mentor Feedback Received",
    message: "David Kim left detailed comments on your Capstone Project wireframes.",
    type: "mentor",
    time: "Yesterday",
    read: true,
    actionUrl: "mentors",
    actionLabel: "Read Feedback"
  },
  {
    id: "notif-5",
    title: "Weekly Learning Summary Ready",
    message: "Your weekly study streak report and personalized skill recommendations are ready in your AI tab.",
    type: "ai",
    time: "2 days ago",
    read: true,
    actionUrl: "ai-quiz",
    actionLabel: "Explore Recommendations"
  }
];

export function NotificationsScreen({
  notifications = [],
  markAllNotificationsRead,
  markOneNotificationRead,
  back,
  push
}) {
  const [filterTab, setFilterTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [localNotifs, setLocalNotifs] = useState(DEFAULT_NOTIFICATIONS);

  const baseNotifs = (notifications && notifications.length > 0) ? notifications : localNotifs;

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
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860, margin: "0 auto", width: "100%" }}>
      <TopBar
        title="Notifications & Updates"
        sub={`${unreadCount} unread alert${unreadCount === 1 ? "" : "s"} across all courses and cohorts`}
        onBack={back}
        hideBell
        right={
          <div className="tai-row tai-gap8">
            {unreadCount > 0 && (
              <button
                type="button"
                className="tai-btn tai-btn-ghost tai-btn-sm"
                onClick={handleMarkAll}
                style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <CheckCheck size={15} /> Mark All Read
              </button>
            )}
            {baseNotifs.length > 0 && (
              <button
                type="button"
                className="tai-btn tai-btn-ghost tai-btn-sm"
                onClick={handleClearAll}
                style={{ color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 6 }}
                title="Clear all notifications"
              >
                <Trash2 size={14} /> Clear
              </button>
            )}
          </div>
        }
      />

      {/* Search & Category Filter Toolbar */}
      <div className="tai-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ position: "relative", width: "100%" }}>
          <Search
            size={16}
            color="var(--text-3)"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            className="tai-input"
            placeholder="Search notification title or message content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 40, height: 42, width: "100%", borderRadius: 12 }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "var(--text-3)", cursor: "pointer"
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="tai-scrollx" style={{ gap: 8, paddingBottom: 2 }}>
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
              style={{ whiteSpace: "nowrap", cursor: "pointer", border: "none" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="tai-col tai-gap12 anim-stagger">
        {filteredNotifs.length === 0 ? (
          <div className="tai-card tai-empty" style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Bell size={24} color="var(--text-3)" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>No Notifications Found</div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4, maxWidth: 360, margin: "4px auto 0" }}>
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
                borderColor: n.read ? "var(--border)" : "var(--primary-light)",
                boxShadow: n.read ? "none" : "0 4px 14px rgba(79, 70, 229, 0.08)",
                padding: "16px 20px",
                transition: "all .18s ease",
                position: "relative"
              }}
            >
              <div className="tai-row tai-between" style={{ alignItems: "flex-start", gap: 14 }}>
                {/* Left icon + content */}
                <div className="tai-row tai-gap14" style={{ alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: n.read ? "var(--surface-3)" : "var(--primary-tint)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0
                  }}>
                    {iconForType(n.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <div className="tai-row tai-gap8" style={{ alignItems: "center", flexWrap: "wrap" }}>
                        <span className="tai-tag" style={{ fontSize: 11, padding: "2px 8px", background: "var(--surface-3)", color: "var(--text-2)" }}>
                          {typeLabel(n.type)}
                        </span>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", letterSpacing: "-0.01em" }}>
                          {n.title}
                        </div>
                      </div>

                      <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                        <span style={{ fontSize: 11.5, color: "var(--text-3)", whiteSpace: "nowrap" }}>{n.time}</span>
                        {!n.read && (
                          <span
                            className="anim-pulse"
                            style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }}
                            title="Unread"
                          />
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.55, marginTop: 8 }}>
                      {n.message}
                    </div>

                    {/* Action Bar */}
                    <div className="tai-row tai-between" style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        {n.actionLabel && (
                          <button
                            type="button"
                            className="tai-btn tai-btn-primary tai-btn-sm"
                            style={{ borderRadius: 8, padding: "6px 14px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
                            onClick={() => {
                              if (push && n.actionUrl) push(n.actionUrl);
                            }}
                          >
                            <span>{n.actionLabel}</span>
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>

                      <div className="tai-row tai-gap6">
                        <button
                          type="button"
                          className="tai-btn tai-btn-ghost tai-btn-sm"
                          style={{ padding: "4px 8px", fontSize: 12 }}
                          onClick={(e) => handleToggleRead(n.id, e)}
                        >
                          {n.read ? "Mark unread" : "Mark read"}
                        </button>
                        <button
                          type="button"
                          className="tai-btn tai-btn-ghost tai-btn-sm"
                          style={{ padding: "4px 8px", color: "var(--danger)" }}
                          onClick={(e) => handleDeleteNotification(n.id, e)}
                          title="Dismiss notification"
                        >
                          <Trash2 size={13} />
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
