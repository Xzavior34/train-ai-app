import React from "react";

export function Skeleton({
  width = "100%",
  height = "16px",
  borderRadius = "6px",
  style = {},
  className = "",
}) {
  return (
    <div
      className={`tai-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, gap = 8, style = {} }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, width: "100%", ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="13px"
          width={i === lines - 1 && lines > 1 ? "65%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = 120, padding = 16, style = {} }) {
  return (
    <div
      className="tai-card"
      style={{
        padding,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton width="36px" height="36px" borderRadius="8px" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton width="45%" height="14px" />
          <Skeleton width="30%" height="11px" />
        </div>
      </div>
      <Skeleton width="100%" height={`${Math.max(20, height - 80)}px`} borderRadius="8px" />
    </div>
  );
}

export function SkeletonDiscussionItem() {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        <Skeleton width="32px" height="32px" borderRadius="50%" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Skeleton width="90px" height="12px" />
            <Skeleton width="40px" height="10px" />
          </div>
          <Skeleton width="85%" height="11px" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Skeleton width="45px" height="14px" borderRadius="4px" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div
      className="tai-card"
      style={{
        padding: "16px",
        borderRadius: 10,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Skeleton width="60%" height="11px" />
        <Skeleton width="18px" height="18px" borderRadius="4px" />
      </div>
      <Skeleton width="40%" height="24px" borderRadius="4px" />
      <Skeleton width="50%" height="10px" />
    </div>
  );
}

export function SkeletonCourseCard() {
  return (
    <div
      className="tai-card"
      style={{
        padding: 0,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Skeleton width="100%" height="130px" borderRadius="0" />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton width="35%" height="12px" borderRadius="4px" />
        <Skeleton width="80%" height="16px" borderRadius="4px" />
        <Skeleton width="95%" height="12px" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <Skeleton width="60px" height="12px" />
          <Skeleton width="80px" height="28px" borderRadius="6px" />
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
