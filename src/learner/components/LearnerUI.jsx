import React, { useState } from "react";
import {
  Home, BookOpen, Zap, Users, Settings, ArrowLeft, GraduationCap, Star, Clock, CheckCircle2, Repeat, ChevronRight
} from "lucide-react";

export const TOKENS = `
  .tai * { box-sizing: border-box; }
  .tai {
    --bg: #F4F6FC;
    --surface: #FFFFFF;
    --surface-2: #EEF2FF;
    --surface-3: #F8F9FE;
    --primary: #2563EB;
    --primary-dark: #1D4ED8;
    --primary-light: #60A5FA;
    --grad: linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #60A5FA 100%);
    --text: #10142A;
    --text-2: #656C86;
    --text-3: #9AA1B9;
    --border: #E6E9F5;
    --success: #17A673;
    --success-bg: #E7F8F1;
    --warning: #F5A524;
    --warning-bg: #FEF3E0;
    --danger: #EF4444;
    --danger-bg: #FDECEC;
    --radius: 20px;
    --radius-sm: 12px;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-family: var(--font);
    color: var(--text);
    transition: background .25s ease, color .25s ease;
  }
  .tai.dark {
    --bg: #0B0E1A;
    --surface: #151A2E;
    --surface-2: #1B2440;
    --surface-3: #12162A;
    --text: #F1F3FC;
    --text-2: #9AA1C2;
    --text-3: #6A7192;
    --border: #262C48;
    --success-bg: #0F2E24;
    --warning-bg: #332507;
    --danger-bg: #331414;
  }
  .tai-app-outer { min-height: 100vh; min-height: 100dvh; background: var(--bg); display:flex; justify-content:center; overscroll-behavior: none; }
  .tai-desktop-shell { display: flex; width: 100%; max-width: 960px; margin: 0 auto; align-items: flex-start; }
  @media (max-width: 899px) {
    .tai-app { margin: 0 auto; }
  }
  .tai-app {
    width:100%; max-width: clamp(480px, 75vw, 640px); min-height:100vh; min-height:100dvh;
    background: var(--bg); position:relative; display:flex; flex-direction:column;
  }
  .tai-body { flex:1; padding: max(16px, env(safe-area-inset-top)) 20px calc(100px + env(safe-area-inset-bottom)); }
  .tai-desktop-sidebar { display: none; }
  .tai-demo-banner {
    position: fixed; top: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: clamp(480px, 75vw, 640px);
    background: var(--warning-bg); color: #9A6B12; font-size: 11px; font-weight: 700; text-align: center;
    padding: 5px 8px; z-index: 100;
  }
  .tai, .tai * { -webkit-tap-highlight-color: transparent; }
  .tai button, .tai [role="switch"], .tai-navitem, .tai-pill, .tai-iconbtn { touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  .tai-toast {
    position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); z-index: 200;
    background: var(--text); color: #fff; padding: 11px 18px; border-radius: 12px; font-size: 13px; font-weight: 600;
    box-shadow: 0 10px 30px -8px rgba(16,20,42,.4); display: flex; align-items: center; gap: 8px; max-width: 90%;
    animation: staggerItem .25s ease both;
  }
  @media (min-width: 900px) {
    .tai-toast { bottom: 28px; }
  }
  @media (min-width: 1080px) {
    .tai-app { max-width: 720px; }
    .tai-body { max-width: 720px; }
  }
  .tai-topbar { display:flex; justify-content:space-between; align-items:flex-start; padding: 10px 0 18px; }
  .tai-h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin:0; }
  .tai-sub { font-size: 13px; color: var(--text-2); margin: 3px 0 0; }
  .tai-iconbtn { width:40px; height:40px; border-radius:13px; background: var(--surface); border:1px solid var(--border);
    box-shadow: 0 1px 2px rgba(16,20,42,.04);
    display:flex; align-items:center; justify-content:center; color: var(--text); flex-shrink:0; cursor:pointer; }
  .tai-iconbtn:active { transform: scale(0.94); }
  .tai-card { background: var(--surface); border-radius: var(--radius); padding: 16px; border: 1px solid var(--border);
    box-shadow: 0 1px 2px rgba(16,20,42,.03), 0 6px 18px -10px rgba(16,20,42,.10); }
  .tai-row { display:flex; align-items:center; }
  .tai-between { justify-content:space-between; }
  .tai-gap6 { gap:6px; } .tai-gap8 { gap:8px; } .tai-gap10 { gap:10px; } .tai-gap12 { gap:12px; } .tai-gap16 { gap:16px; }
  .tai-col { display:flex; flex-direction:column; }
  .tai-mt8 { margin-top:8px; } .tai-mt10 { margin-top:10px; } .tai-mt12 { margin-top:12px; } .tai-mt14 { margin-top:14px; } .tai-mt16 { margin-top:16px; } .tai-mt20 { margin-top:20px; } .tai-mt24 { margin-top:24px; }
  .tai-label { font-size:11.5px; font-weight:700; color: var(--text-2); text-transform:uppercase; letter-spacing:.06em; }
  .tai-title-sm { font-size:15.5px; font-weight:700; }
  .tai-body-text { font-size: 13.5px; color: var(--text-2); line-height:1.45; }
  .tai-btn { border:none; cursor:pointer; border-radius: 14px; font-weight:700; font-size:14px; padding: 13px 18px;
    display:flex; align-items:center; justify-content:center; gap:8px; transition: transform .12s ease, box-shadow .12s ease, background-color .12s ease; }
  .tai-btn-primary { background: var(--grad); color:#fff; box-shadow: 0 10px 20px -8px rgba(37,99,235,.55); }
  .tai-btn-primary:active { transform: scale(.98); }
  .tai-btn-ghost { background: var(--surface-2); color: var(--primary); }
  .tai-btn-outline { background:transparent; border: 1.5px solid var(--border); color: var(--text); }
  .tai-btn-sm { padding: 8px 14px; font-size:12.5px; border-radius:10px; }
  .tai-pill { padding:7px 14px; border-radius:999px; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; border: 1px solid transparent; transition: background-color .12s ease, color .12s ease; }
  .tai-pill-active { background: var(--primary); color:#fff; }
  .tai-pill-inactive { background: var(--surface); color: var(--text-2); border-color: var(--border); }
  .tai-tag { padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight:700; background: var(--surface-2); color: var(--primary); }
  .tai-scrollx { display:flex; gap:10px; overflow-x:auto; padding-bottom:2px; -ms-overflow-style:none; scrollbar-width:none; }
  .tai-scrollx::-webkit-scrollbar { display:none; }
  .tai-progress-track { width:100%; height:8px; border-radius:99px; background: var(--surface-2); overflow:hidden; }
  .tai-progress-fill { height:100%; border-radius:99px; background: var(--grad); }
  .tai-avatar { border-radius:50%; background: var(--grad); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; flex-shrink:0; }
  .tai-divider { height:1px; background: var(--border); border:none; margin: 12px 0; }
  .tai-navbar { position: fixed; left:50%; transform: translateX(-50%); bottom:0; width:100%; max-width: clamp(480px, 75vw, 640px); background: var(--surface); border-top: 1px solid var(--border);
    display:flex; justify-content:space-around; align-items:center; padding: 10px 8px max(22px, calc(env(safe-area-inset-bottom) + 10px)); z-index: 30;
    box-shadow: 0 -4px 20px -6px rgba(16,20,42,.08); }
  @media (min-width: 900px) {
    .tai-demo-banner { max-width: 960px; }
    .tai-navbar { display: none; }
    .tai-desktop-sidebar {
      display: flex; flex-direction: column; width: 232px; flex-shrink: 0; position: sticky; top: 0;
      height: 100vh; height: 100dvh; background: var(--surface); border-right: 1px solid var(--border); padding: 22px 14px;
    }
    .tai-app { max-width: 640px; min-height: auto; }
    .tai-body { padding: 20px 32px 40px; max-width: 640px; margin: 0 auto; }
    .tai-desktop-brand { display: flex; align-items: center; gap: 10px; padding: 4px 10px 22px; }
    .tai-desktop-brand-mark { width: 30px; height: 30px; border-radius: 9px; background: var(--grad); flex-shrink: 0; }
    .tai-desktop-brand-name { font-weight: 800; font-size: 15.5px; letter-spacing: -0.01em; }
    .tai-desktop-nav-item {
      display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 12px; cursor: pointer;
      font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 2px;
    }
    .tai-desktop-nav-item:hover { background: var(--surface-3); }
    .tai-desktop-nav-item.active { background: var(--surface-2); color: var(--primary); }
    .tai-desktop-nav-footer { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); }
  }
  .tai-navitem { display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; color: var(--text-3); flex:1; }
  .tai-navitem.active { color: var(--primary); }
  .tai-navitem span { font-size:10.5px; font-weight:700; }
  .tai-input { width:100%; border-radius:14px; border:1px solid var(--border); background: var(--surface); padding: 12px 14px;
    font-size:13.5px; color: var(--text); font-family: var(--font); }
  .tai-input:focus { outline:2px solid var(--primary-light); }
  .tai-fade-in { animation: taiFade .25s ease; }
  @keyframes taiFade { from { opacity:0; transform: translateY(6px);} to { opacity:1; transform:none; } }
  .tai-switch { width:42px; height:24px; border-radius:99px; background: var(--surface-2); position:relative; cursor:pointer; flex-shrink:0; transition: background .15s; }
  .tai-switch.on { background: var(--primary); }
  .tai-switch-knob { width:18px; height:18px; border-radius:50%; background:#fff; position:absolute; top:3px; left:3px; transition: left .15s; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
  .tai-switch.on .tai-switch-knob { left:21px; }
  .tai-empty { text-align:center; padding: 36px 16px; color: var(--text-2); }
  .tai-grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
  .tai-link { color: var(--primary); font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:2px; }
`;

export const COURSE_GRAD_PALETTE = [
  ["#1D4ED8", "#8AA6FF"], ["#1D4ED8", "#2563EB"], ["#0EA5B7", "#63D3E0"],
  ["#7C3AED", "#B794F4"], ["#0F766E", "#4FD1C5"], ["#B45309", "#F6AD55"],
  ["#BE185D", "#F472B6"], ["#1D4ED8", "#93C5FD"],
];
export function gradForIndex(i) { return COURSE_GRAD_PALETTE[i % COURSE_GRAD_PALETTE.length]; }

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function initialsOf(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function optionLabel(opt) {
  if (typeof opt === "string") return opt;
  return opt?.text ?? opt?.label ?? JSON.stringify(opt);
}
export function optionValue(opt) {
  if (typeof opt === "string") return opt;
  return opt?.value ?? opt?.text ?? JSON.stringify(opt);
}

export function Avatar({ initials, size = 40, style = {}, src }) {
  const [errored, setErrored] = useState(false);
  if (src && !errored) {
    return (
      <div className="tai-avatar" style={{ width: size, height: size, overflow: "hidden", ...style }}>
        <img
          src={src}
          alt=""
          onError={() => setErrored(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }
  return (
    <div className="tai-avatar" style={{ width: size, height: size, fontSize: size * 0.36, ...style }}>
      {initials}
    </div>
  );
}

export function ProgressBar({ value, height = 8 }) {
  return (
    <div className="tai-progress-track" style={{ height }}>
      <div className="tai-progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%`, height }} />
    </div>
  );
}

export function TopBar({ title, sub, onBack, right }) {
  return (
    <div className="tai-topbar">
      <div className="tai-row tai-gap12">
        {onBack && (
          <button className="tai-iconbtn" onClick={onBack} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="tai-h1">{title}</h1>
          {sub && <p className="tai-sub">{sub}</p>}
        </div>
      </div>
      <div className="tai-row tai-gap8">{right}</div>
    </div>
  );
}

export function Tag({ children, tone }) {
  const bg = tone === "success" ? "var(--success-bg)" : tone === "warning" ? "var(--warning-bg)" : tone === "danger" ? "var(--danger-bg)" : "var(--surface-2)";
  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : "var(--primary)";
  return <span className="tai-tag" style={{ background: bg, color }}>{children}</span>;
}

export function Switch({ on, onChange }) {
  return (
    <div className={`tai-switch ${on ? "on" : ""}`} onClick={onChange} role="switch" aria-checked={on}>
      <div className="tai-switch-knob" />
    </div>
  );
}

export const NAV_ITEMS = [
  { key: "home", label: "Home", icon: Home },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "ai", label: "AI", icon: Zap },
  { key: "community", label: "Community", icon: Users },
];

export function BottomNav({ active, go }) {
  return (
    <div className="tai-navbar">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <div key={item.key} className={`tai-navitem ${isActive ? "active" : ""}`} onClick={() => go(item.key)}>
            <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DesktopSidebar({ active, go, onProfile, profileActive, onSwitchToPlatform, brandLogoUrl }) {
  return (
    <div className="tai-desktop-sidebar">
      <div className="tai-desktop-brand">
        <img
          src={brandLogoUrl || "/brand/train-ai-logo.png"}
          alt={brandLogoUrl ? "Organization logo" : "Train AI"}
          style={{ width: 32, height: 32, borderRadius: brandLogoUrl ? 8 : 0, objectFit: "contain", flexShrink: 0 }}
        />
        <div className="tai-desktop-brand-name">Train AI</div>
      </div>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <div key={item.key} className={`tai-desktop-nav-item ${isActive ? "active" : ""}`} onClick={() => go(item.key)}>
            <Icon size={18} /><span>{item.label}</span>
          </div>
        );
      })}
      <div className="tai-desktop-nav-footer">
        {onSwitchToPlatform && (
          <div className="tai-desktop-nav-item" onClick={onSwitchToPlatform}>
            <Repeat size={18} /><span>Admin workspace</span>
          </div>
        )}
        <div className={`tai-desktop-nav-item ${profileActive ? "active" : ""}`} onClick={onProfile}>
          <Settings size={18} /><span>Profile</span>
        </div>
      </div>
    </div>
  );
}

export function CourseThumb({ course, size = 56, rounded = 16 }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div style={{
        width: size, height: size, borderRadius: rounded, flexShrink: 0,
        background: `linear-gradient(135deg, ${course.grad[0]}, ${course.grad[1]})`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <GraduationCap size={size * 0.42} color="#fff" strokeWidth={1.6} />
      </div>
    );
  }
  // Real cover image uploaded by an admin (courses.cover_image_url) takes
  // priority over the picsum placeholder when present.
  const imgSrc = course.coverImageUrl || `https://picsum.photos/seed/${course.id}/160/160`;
  return (
    <div style={{
      width: size, height: size, borderRadius: rounded, flexShrink: 0, overflow: "hidden", position: "relative",
      background: `linear-gradient(135deg, ${course.grad[0]}, ${course.grad[1]})`,
    }}>
      <img
        src={imgSrc}
        alt=""
        onError={() => setErrored(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

export function StatTile({ icon: Icon, value, label, tone }) {
  return (
    <div className="tai-card" style={{ flex: 1, padding: "14px 12px", background: tone ? `var(--${tone}-bg)` : "var(--surface)" }}>
      <div className="tai-row tai-between">
        <span className="tai-label" style={{ fontSize: 10.5 }}>{label}</span>
        {Icon && <Icon size={16} color={tone ? `var(--${tone})` : "var(--primary)"} />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function CourseCard({ course, onClick, onEnroll }) {
  return (
    <div className="tai-card" style={{ cursor: "pointer" }} onClick={onClick}>
      <div className="tai-row tai-gap12">
        <CourseThumb course={course} size={54} rounded={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tai-row tai-between">
            <Tag>{course.category}</Tag>
            <div className="tai-row tai-gap4" style={{ fontSize: 12, color: "var(--text-2)" }}>
              <Star size={12} color="var(--warning)" fill="var(--warning)" />
              <span>{course.rating}</span>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {course.title}
          </div>
          <div className="tai-row tai-gap10 tai-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
            <span className="tai-row tai-gap4"><Clock size={12} />{course.hours}h</span>
            <span>•</span>
            <span>{course.lessons} lessons</span>
          </div>
        </div>
      </div>
      {course.enrolled ? (
        <div className="tai-mt12">
          <div className="tai-row tai-between" style={{ fontSize: 11.5, color: "var(--text-2)", marginBottom: 4 }}>
            <span>Progress</span>
            <span>{course.progress}%</span>
          </div>
          <ProgressBar value={course.progress} />
        </div>
      ) : onEnroll ? (
        <div className="tai-row tai-between tai-mt12">
          <div style={{ fontSize: 12, color: "var(--text-2)", textTransform: "capitalize" }}>{course.level}</div>
          {course.requiresApproval && course.applicationStatus === "pending" ? (
            <span style={{ fontSize: 11.5, color: "var(--text-3)", fontStyle: "italic" }}>Pending review</span>
          ) : (
            <button
              className="tai-btn tai-btn-ghost tai-btn-sm"
              onClick={(e) => { e.stopPropagation(); onEnroll(course.id); }}
            >
              {course.requiresApproval ? (course.applicationStatus === "rejected" ? "Reapply" : "Request to Join") : "Enroll"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function QuickWinCard({ title, duration, points, onClick }) {
  return (
    <div className="tai-card" style={{ cursor: "pointer", background: "var(--surface-2)" }} onClick={onClick}>
      <div className="tai-row tai-between">
        <div>
          <span className="tai-tag" style={{ background: "var(--surface)", color: "var(--primary)" }}>Quick win</span>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6 }}>{title}</div>
          <div className="tai-row tai-gap10 tai-mt8" style={{ fontSize: 12, color: "var(--text-2)" }}>
            <span>{duration}</span>
            <span>•</span>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>+{points} XP</span>
          </div>
        </div>
        <div className="tai-iconbtn" style={{ background: "var(--primary)", color: "#fff", border: "none" }}>
          <ChevronRight size={18} />
        </div>
      </div>
    </div>
  );
}
