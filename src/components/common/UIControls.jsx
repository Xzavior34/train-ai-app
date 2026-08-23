import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Avatar({ initials = "U", size = 36, style = {} }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 4px 14px rgba(79, 70, 229, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
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
    <div style={{ width: "100%", height, borderRadius: 99, background: "var(--glass-border-subtle, #EEF2FF)", overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)" }}>
      <div
        style={{
          width: `${safeVal}%`, height, borderRadius: 99,
          background: "linear-gradient(90deg, #4F46E5 0%, #6366F1 100%)",
          boxShadow: "0 0 8px rgba(79, 70, 229, 0.4)",
          transition: "width .4s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      />
    </div>
  );
}

export function Tag({ children, tone, icon: Icon }) {
  const bg = tone === "success" ? "rgba(16, 185, 129, 0.12)" : tone === "warning" ? "rgba(245, 158, 11, 0.12)" : tone === "danger" ? "rgba(239, 68, 68, 0.12)" : "rgba(79, 70, 229, 0.12)";
  const color = tone === "success" ? "#10B981" : tone === "warning" ? "#F59E0B" : tone === "danger" ? "#EF4444" : "#4F46E5";
  const border = tone === "success" ? "rgba(16, 185, 129, 0.25)" : tone === "warning" ? "rgba(245, 158, 11, 0.25)" : tone === "danger" ? "rgba(239, 68, 68, 0.25)" : "rgba(79, 70, 229, 0.25)";
  return (
    <span style={{
      padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: bg, color, border: `1px solid ${border}`,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
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
        background: on ? "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)" : "var(--glass-surface, #EEF2FF)",
        boxShadow: on ? "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(79, 70, 229, 0.3)" : "inset 0 1px 2px rgba(0,0,0,0.06)",
        border: "1px solid var(--glass-border, #E2E8F0)",
        position: "relative", cursor: "pointer", flexShrink: 0, transition: "all .18s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute",
          top: 2, left: on ? 18 : 2, transition: "left .18s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)"
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
        background: "var(--glass-surface, rgba(255, 255, 255, 0.88))",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid var(--glass-border, #E6E9F5)",
        borderRadius: 10, padding: 18,
        boxShadow: "var(--glass-shadow)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {Icon && <Icon size={16} color="#4F46E5" />}
        </div>
        {stat.delta && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: stat.up ? "#10B981" : "#EF4444" }}>
            {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{stat.delta}
          </div>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 14, color: "var(--text, #10142A)", letterSpacing: "-0.02em" }}>{stat.value}</div>
      <div style={{ fontSize: 12, color: "var(--text-2, #656C86)", marginTop: 2 }}>{stat.label}</div>
    </div>
  );
}
