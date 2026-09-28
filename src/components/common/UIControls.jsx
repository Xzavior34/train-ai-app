import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Avatar({ initials = "U", size = 36, style = {} }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "#2563EB",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.36, flexShrink: 0, ...style
      }}
    >
      {initials}
    </div>
  );
}

export function ProgressBar({ value = 0, height = 7 }) {
  const safeVal = Math.min(100, Math.max(0, value));
  return (
    <div style={{ width: "100%", height, borderRadius: 99, background: "var(--border, #E2E8F0)", overflow: "hidden" }}>
      <div
        style={{
          width: `${safeVal}%`, height, borderRadius: 99,
          background: "var(--primary, #2563EB)",
          transition: "width .3s ease"
        }}
      />
    </div>
  );
}

export function Tag({ children, tone, icon: Icon }) {
  const bg = tone === "success" ? "rgba(16, 185, 129, 0.12)" : tone === "warning" ? "rgba(245, 158, 11, 0.12)" : tone === "danger" ? "rgba(239, 68, 68, 0.12)" : "rgba(37, 99, 235, 0.10)";
  const color = tone === "success" ? "#10B981" : tone === "warning" ? "#F59E0B" : tone === "danger" ? "#EF4444" : "#2563EB";
  const border = tone === "success" ? "rgba(16, 185, 129, 0.25)" : tone === "warning" ? "rgba(245, 158, 11, 0.25)" : tone === "danger" ? "rgba(239, 68, 68, 0.25)" : "rgba(37, 99, 235, 0.25)";
  return (
    <span style={{
      padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: bg, color, border: `1px solid ${border}`,
      display: "inline-flex", alignItems: "center", gap: 4
    }}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}

export function Switch({ on, onChange }) {
  return (
    <div
      onClick={onChange}
      role="switch"
      aria-checked={on}
      style={{
        width: 38, height: 22, borderRadius: 99,
        background: on ? "#2563EB" : "var(--surface-2, #E2E8F0)",
        border: `1px solid ${on ? "#1D4ED8" : "var(--border, #CBD5E1)"}`,
        position: "relative", cursor: "pointer", flexShrink: 0, transition: "all .16s ease"
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute",
          top: 2, left: on ? 18 : 2, transition: "left .16s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,.2)"
        }}
      />
    </div>
  );
}

export function StatCard({ stat }) {
  const Icon = stat.icon;
  return (
    <div
      className="tai-card tai-card-hover"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10, padding: 18,
        boxShadow: "var(--shadow-card)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: "var(--primary-tint, #EFF6FF)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {Icon && <Icon size={16} color="var(--primary, #2563EB)" />}
        </div>
        {stat.delta && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: stat.up ? "#10B981" : "#EF4444" }}>
            {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{stat.delta}
          </div>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 14, color: "var(--text)", letterSpacing: "-0.02em" }}>{stat.value}</div>
      <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{stat.label}</div>
    </div>
  );
}
