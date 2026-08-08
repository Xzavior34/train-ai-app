import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Avatar({ initials = "U", size = 36, style = {} }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #60A5FA 100%)",
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
    <div style={{ width: "100%", height, borderRadius: 99, background: "#EEF2FF", overflow: "hidden" }}>
      <div
        style={{
          width: `${safeVal}%`, height, borderRadius: 99,
          background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #60A5FA 100%)",
          transition: "width .4s ease"
        }}
      />
    </div>
  );
}

export function Tag({ children, tone, icon: Icon }) {
  const bg = tone === "success" ? "#E7F8F1" : tone === "warning" ? "#FEF3E0" : tone === "danger" ? "#FDECEC" : "#EEF2FF";
  const color = tone === "success" ? "#17A673" : tone === "warning" ? "#F5A524" : tone === "danger" ? "#EF4444" : "#2563EB";
  return (
    <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: bg, color, display: "inline-flex", alignItems: "center", gap: 4 }}>
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
        width: 38, height: 22, borderRadius: 99, background: on ? "#2563EB" : "#EEF2FF",
        position: "relative", cursor: "pointer", flexShrink: 0, transition: "background .15s"
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute",
          top: 3, left: on ? 19 : 3, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.25)"
        }}
      />
    </div>
  );
}

export function StatCard({ stat }) {
  const Icon = stat.icon;
  return (
    <div style={{ background: "#fff", border: "1px solid #E6E9F5", borderRadius: 16, padding: 18, boxShadow: "0 1px 2px rgba(16,20,42,.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Icon && <Icon size={16} color="#2563EB" />}
        </div>
        {stat.delta && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: stat.up ? "#17A673" : "#EF4444" }}>
            {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{stat.delta}
          </div>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 14, color: "#10142A" }}>{stat.value}</div>
      <div style={{ fontSize: 12, color: "#656C86", marginTop: 2 }}>{stat.label}</div>
    </div>
  );
}
