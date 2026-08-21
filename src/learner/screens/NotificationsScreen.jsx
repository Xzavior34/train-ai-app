import React, { useState } from "react";
import { TopBar, Tag } from "../components/LearnerUI.jsx";
import { Bell, BookOpen, Video, Trophy, Sparkles, Check, CheckCheck } from "lucide-react";

const DEFAULT_NOTIFICATIONS = [
  {
    id: "notif-1",
    title: "Live Critique Session in 15 Minutes",
    message: "UI Critique & System Architecture Review with Astrid Larsson is about to start. Click to join the stream.",
    type: "live",
    time: "15 min ago",
    read: false
  },
  {
    id: "notif-2",
    title: "New Assignment Assigned: Design Tokens",
    message: "Your instructor posted Module 4 deliverables in 'Master Design Systems in Figma'. Due in 3 days.",
    type: "assignment",
    time: "2 hours ago",
    read: false
  },
  {
    id: "notif-3",
    title: "Quiz Completed: +50 XP Awarded",
    message: "You scored 100% on the Prompt Engineering quiz! You're now ranked in the Top 3 of your weekly cohort.",
    type: "achievement",
    time: "Yesterday",
    read: true
  },
  {
    id: "notif-4",
    title: "AI Insights Report Ready",
    message: "Your weekly study streak report and personalized skill recommendations are ready in your AI tab.",
    type: "ai",
    time: "2 days ago",
    read: true
  }
];

export function NotificationsScreen({ notifications = [], markAllNotificationsRead, markOneNotificationRead, back }) {
  const [filterTab, setFilterTab] = useState("all");
  const [localNotifs, setLocalNotifs] = useState(DEFAULT_NOTIFICATIONS);

  const baseNotifs = (notifications && notifications.length > 0) ? notifications : localNotifs;

  const unreadCount = baseNotifs.filter(n => !n.read).length;

  const filteredNotifs = baseNotifs.filter(n => {
    if (filterTab === "unread") return !n.read;
    if (filterTab === "assignment") return n.type === "assignment";
    if (filterTab === "live") return n.type === "live";
    return true;
  });

  function handleMarkAll() {
    if (markAllNotificationsRead) markAllNotificationsRead();
    setLocalNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  function handleToggleRead(id) {
    if (markOneNotificationRead) markOneNotificationRead(id);
    setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  }

  function iconForType(type) {
    if (type === "live") return <Video size={16} color="var(--danger)" />;
    if (type === "assignment") return <BookOpen size={16} color="var(--primary)" />;
    if (type === "achievement") return <Trophy size={16} color="var(--warning)" />;
    return <Sparkles size={16} color="var(--primary)" />;
  }

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <TopBar
        title="Notifications" sub={`${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`} onBack={back} hideBell
        right={
          unreadCount > 0 && (
            <button className="tai-btn tai-btn-ghost tai-btn-sm" onClick={handleMarkAll}>
              <CheckCheck size={14} /> Mark all read
            </button>
          )
        }
      />

      {/* Filter Tabs */}
      <div className="tai-row tai-gap8" style={{ flexWrap: "wrap" }}>
        {[
          { k: "all", label: `All (${baseNotifs.length})` },
          { k: "unread", label: `Unread (${unreadCount})` },
          { k: "assignment", label: "Assignments" },
          { k: "live", label: "Live Sessions" }
        ].map(t => (
          <div
            key={t.k}
            className={`tai-pill ${filterTab === t.k ? "tai-pill-active" : "tai-pill-inactive"}`}
            onClick={() => setFilterTab(t.k)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="tai-col tai-gap10 anim-stagger">
        {filteredNotifs.length === 0 && (
          <div className="tai-card tai-empty">No notifications in this filter.</div>
        )}
        {filteredNotifs.map(n => (
          <div
            key={n.id}
            className="tai-card tai-card-hover"
            style={{
              background: n.read ? "var(--surface)" : "var(--surface-3)",
              borderColor: n.read ? "var(--border)" : "var(--primary-light)",
              cursor: "pointer",
              padding: 16,
              transition: "all .16s ease"
            }}
            onClick={() => handleToggleRead(n.id)}
          >
            <div className="tai-row tai-between">
              <div className="tai-row tai-gap12">
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: n.read ? "var(--surface-2)" : "var(--primary-tint)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {iconForType(n.type)}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{n.time}</div>
                </div>
              </div>

              {!n.read && (
                <span className="anim-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }} />
              )}
            </div>
            <div className="tai-body-text tai-mt10" style={{ fontSize: 13, color: "var(--text-2)", paddingLeft: 48 }}>
              {n.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
