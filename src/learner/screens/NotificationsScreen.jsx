import React from "react";
import { TopBar, Tag } from "../components/LearnerUI.jsx";
import { Bell } from "lucide-react";

export function NotificationsScreen({ notifications, markAllNotificationsRead, markOneNotificationRead, back }) {
  return (
    <div className="tai-fade-in">
      <TopBar
        title="Notifications" sub="Updates & reminders" onBack={back}
        right={
          notifications.some(n => !n.read) && (
            <button className="tai-btn tai-btn-ghost tai-btn-sm" onClick={markAllNotificationsRead}>
              Mark all read
            </button>
          )
        }
      />
      <div className="tai-col tai-gap10">
        {notifications.length === 0 && <div className="tai-empty">No notifications yet.</div>}
        {notifications.map(n => (
          <div key={n.id} className="tai-card" style={{ background: n.read ? "var(--surface)" : "var(--surface-2)", cursor: "pointer" }} onClick={() => markOneNotificationRead(n.id)}>
            <div className="tai-row tai-between">
              <div className="tai-row tai-gap10">
                <Bell size={16} color="var(--primary)" />
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{n.title}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>{n.time}</div>
            </div>
            <div className="tai-body-text tai-mt6">{n.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
