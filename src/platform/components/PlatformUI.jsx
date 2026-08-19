import React, { useContext, useState, useEffect, useRef } from "react";
import {
  Building2, GraduationCap, ShieldCheck, LayoutDashboard, Users, BookOpen, BarChart3,
  Layers, Plug, Briefcase, Settings, Calendar, MessageSquare, MessagesSquare, Map, Mail,
  Repeat, LogOut, Search, Bell, Menu, X, ArrowUpRight, ArrowDownRight, Sparkles, ChevronRight, Flag, Palette, Rocket, Brain, LifeBuoy
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient.js";
import { DASHBOARD_META } from "../../lib/roleRouting.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCurrentUserProfile, fetchOrgMembers, fetchUsersInOrg, fetchCourses, fetchCohorts } from "../../lib/api/platform.js";

export const MobileMenuContext = React.createContext(() => {});
export const ToastContext = React.createContext(() => {});
export const NavigationContext = React.createContext(null);

export const TOKENS = `
  .ta * { box-sizing: border-box; }
  .ta {
    --bg: #F8FAFC;
    --surface: #FFFFFF;
    --surface-2: #F1F5F9;
    --surface-3: #F8FAFC;
    --primary: #2563EB;
    --primary-dark: #1D4ED8;
    --primary-light: #60A5FA;
    --grad: linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #60A5FA 100%);
    --text: #0F172A;
    --text-2: #475569;
    --text-3: #94A3B8;
    --border: #E2E8F0;
    --success: #10B981;
    --success-bg: #ECFDF5;
    --warning: #F59E0B;
    --warning-bg: #FFFBEB;
    --danger: #EF4444;
    --danger-bg: #FEF2F2;
    --sidebar-w: 256px;
    --radius: 16px;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-family: var(--font);
    color: var(--text);
    background: var(--bg);
    min-height: 100vh; min-height: 100dvh;
  }
  .ta-shell { display: flex; min-height: 100vh; min-height: 100dvh; }
  .ta-sidebar {
    width: var(--sidebar-w); flex-shrink: 0;
    background: #FFFFFF;
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; height: 100dvh;
    color: var(--text); box-shadow: 2px 0 16px -8px rgba(15,23,42,0.06);
  }
  .ta-brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 18px; }
  .ta-brand-mark {
    width: 34px; height: 34px; border-radius: 10px; background: var(--grad);
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
    box-shadow: 0 4px 12px rgba(37,99,235,0.3);
  }
  .ta-brand-name { font-weight: 800; font-size: 17px; letter-spacing: -0.02em; color: var(--text); }
  .ta-brand-tag { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; background: var(--surface-2); color: var(--primary); padding: 2px 7px; border-radius: 6px; }
  .ta-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; overflow-y:auto; padding-right: 2px; }
  .ta-nav::-webkit-scrollbar { width: 4px; }
  .ta-nav::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
  .ta-nav-section-title {
    font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3);
    padding: 12px 10px 4px; margin-top: 4px;
  }
  .ta-nav-item {
    display: flex; align-items: center; gap: 11px; padding: 9.5px 12px; border-radius: 11px; cursor: pointer;
    font-size: 13.5px; font-weight: 600; color: var(--text-2); transition: all .16s cubic-bezier(.34,1.56,.64,1);
  }
  .ta-nav-item:hover { background: var(--surface-2); color: var(--text); transform: translateX(3px); }
  .ta-nav-item.active {
    background: var(--surface-2);
    color: var(--primary); font-weight: 700; border-left: 3px solid var(--primary); padding-left: 9px;
  }
  .ta-nav-divider { height: 1px; background: var(--border); margin: 10px 4px; }
  .ta-workspace-card {
    background: var(--surface-3); border: 1px solid var(--border); border-radius: 12px; padding: 6px;
    margin-bottom: 12px; display: flex; flex-direction: column; gap: 3px;
  }
  .ta-ws-item {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 9px; cursor: pointer;
    font-size: 12.5px; font-weight: 600; color: var(--text-2); transition: all .14s ease;
  }
  .ta-ws-item:hover { background: var(--surface-2); color: var(--text); }
  .ta-ws-item.active { background: var(--grad); color: #FFFFFF; font-weight: 700; box-shadow: 0 4px 12px rgba(37,99,235,0.25); }
  .ta-nav-footer { display:flex; flex-direction:column; gap:4px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border); }
  .ta-main { flex: 1; min-width: 0; }
  .ta-topbar {
    height: 72px; border-bottom: 1px solid var(--border); background: var(--surface);
    display: flex; align-items: center; justify-content: space-between; padding: 0 28px; position: sticky; top:0; z-index: 20;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .ta-topbar-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; padding-right: 16px; }
  .ta-topbar-right { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
  .ta-search { display:flex; align-items:center; gap:8px; background: var(--surface-3); border: 1px solid var(--border); border-radius: 11px; padding: 9px 14px; width: clamp(180px, 20vw, 320px); color: var(--text-3); font-size: 13px; }
  .ta-content { padding: 28px; max-width: 1320px; }
  .ta-h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .ta-sub { font-size: 13.5px; color: var(--text-2); margin: 4px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  @media (min-width: 900px) {
    .ta-menu-btn, .ta-sidebar-close { display: none !important; }
  }
  @media (max-width: 899px) {
    .ta-menu-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 11px; background: var(--surface); border: 1px solid var(--border); cursor: pointer; flex-shrink: 0; }
    .ta-search { display: none; }
    .ta-topbar { padding: 0 16px; }
    .ta-content { padding: 16px; }
    .ta-sidebar {
      position: fixed; top: 0; left: 0; z-index: 100;
      transform: translateX(-100%); transition: transform .22s ease;
      box-shadow: 6px 0 24px rgba(15,23,42,.18);
    }
    .ta-sidebar.mobile-open { transform: translateX(0); }
    .ta-sidebar-close {
      display: flex !important; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px; border: none; background: var(--surface-2); cursor: pointer; color: var(--text-2);
    }
    .ta-scrim { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 90; animation: taFade .15s ease; }
    .ta-topbar { height: auto; min-height: 68px; flex-wrap: wrap; row-gap: 8px; padding: 10px 16px; }
    .ta-topbar-left { flex: 1 1 100%; }
    .ta-topbar-right { gap: 8px; flex-wrap: wrap; justify-content: flex-end; flex: 1 1 100%; }
    .ta-org-selector { max-width: 130px; }
    .ta-org-selector select { max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ta-h1 { font-size: 18px; }
    .ta-table-wrap .ta-table { min-width: 460px; }
  }
  .ta-btn { border: none; cursor: pointer; border-radius: 11px; font-weight: 700; font-size: 13.5px; padding: 10px 16px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; transition: transform .12s ease, box-shadow .12s ease, background-color .12s ease; }
  .ta-btn:active { transform: scale(.97); }
  .ta-btn-primary { background: var(--grad); color: #fff; box-shadow: 0 10px 18px -8px rgba(37,99,235,.45); }
  .ta-btn-primary:hover { box-shadow: 0 12px 22px -6px rgba(37,99,235,.55); transform: translateY(-1px); }
  .ta-btn-outline { background: transparent; border: 1.5px solid var(--border); color: var(--text); }
  .ta-btn-outline:hover { background: var(--surface-3); border-color: var(--primary-light); }
  .ta-btn-ghost { background: var(--surface-2); color: var(--primary); }
  .ta-btn-ghost:hover { background: #E2E8F0; }
  .ta-btn-sm { padding: 7px 12px; font-size: 12px; border-radius: 9px; }
  .ta-btn-danger { background: var(--danger-bg); color: var(--danger); }
  .ta-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px;
    box-shadow: 0 1px 2px rgba(15,23,42,.03), 0 6px 18px -10px rgba(15,23,42,.08); }
  .ta-grid { display: grid; gap: 16px; }
  .ta-grid-5 { grid-template-columns: repeat(5, 1fr); }
  .ta-grid-4 { grid-template-columns: repeat(4, 1fr); }
  .ta-grid-3 { grid-template-columns: repeat(3, 1fr); }
  .ta-grid-2 { grid-template-columns: 1fr 1fr; }
  @media (max-width: 899px) {
    .ta-grid-5, .ta-grid-4, .ta-grid-3 { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 599px) {
    .ta-grid-5, .ta-grid-4, .ta-grid-3, .ta-grid-2 { grid-template-columns: 1fr; }
  }
  .ta-row { display: flex; align-items: center; }
  .ta-between { justify-content: space-between; }
  .ta-col { display: flex; flex-direction: column; }
  .ta-gap6 { gap: 6px; } .ta-gap8 { gap: 8px; } .ta-gap10 { gap: 10px; } .ta-gap12 { gap: 12px; } .ta-gap14 { gap: 14px; } .ta-gap16 { gap: 16px; }
  .ta-mt8 { margin-top: 8px; } .ta-mt12 { margin-top: 12px; } .ta-mt16 { margin-top: 16px; } .ta-mt20 { margin-top: 20px; } .ta-mt24 { margin-top: 24px; } .ta-mt28 { margin-top: 28px; }
  .ta-label { font-size: 11px; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: .06em; }
  .ta-title { font-size: 15.5px; font-weight: 800; }
  .ta-body { font-size: 13.5px; color: var(--text-2); line-height: 1.5; }
  .ta-avatar { border-radius: 50%; background: var(--grad); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
  .ta-tag { padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: var(--surface-2); color: var(--primary); display:inline-flex; align-items:center; gap:4px; }
  .ta-divider { height: 1px; background: var(--border); border: none; margin: 14px 0; }
  .ta-table { width: 100%; border-collapse: collapse; }
  .ta-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .ta-table-wrap .ta-table { min-width: 560px; }
  .ta-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); font-weight: 700; padding: 0 12px 10px; border-bottom: 1px solid var(--border); }
  .ta-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid var(--border); }
  .ta-table tr:last-child td { border-bottom: none; }
  .ta-progress-track { width: 100%; height: 7px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
  .ta-progress-fill { height: 100%; border-radius: 99px; background: var(--grad); }
  .ta-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--border); overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
  .ta-tab { padding: 10px 4px; margin-right: 18px; font-size: 13.5px; font-weight: 700; color: var(--text-2); cursor: pointer; border-bottom: 2.5px solid transparent; white-space: nowrap; flex-shrink: 0; }
  .ta-tab.active { color: var(--primary); border-color: var(--primary); }
  .ta-pill { padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid var(--border); color: var(--text-2); }
  .ta-pill.active { background: var(--primary); color: #fff; border-color: var(--primary); }
  .ta-switch { width: 38px; height: 22px; border-radius: 99px; background: var(--surface-2); position: relative; cursor: pointer; flex-shrink: 0; transition: background .15s; }
  .ta-switch.on { background: var(--primary); }
  .ta-switch-knob { width: 16px; height: 16px; border-radius: 50%; background: #fff; position: absolute; top: 3px; left: 3px; transition: left .15s; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
  .ta-switch.on .ta-switch-knob { left: 19px; }
  .ta-input { border-radius: 11px; border: 1px solid var(--border); background: var(--surface); padding: 10px 13px; font-size: 13.5px; color: var(--text); font-family: var(--font); }
  .ta-empty { text-align: center; padding: 30px 16px; color: var(--text-2); font-size: 13.5px; }
  .ta-fade { animation: taFade .2s ease; }
  @keyframes taFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
`;

export function Avatar({ initials, size = 36, style = {} }) {
  return <div className="ta-avatar" style={{ width: size, height: size, fontSize: size * 0.36, ...style }}>{initials}</div>;
}

export function ProgressBar({ value, height = 7 }) {
  return <div className="ta-progress-track" style={{ height }}><div className="ta-progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%`, height }} /></div>;
}

export function Tag({ children, tone, icon: Icon }) {
  const bg = tone === "success" ? "var(--success-bg)" : tone === "warning" ? "var(--warning-bg)" : tone === "danger" ? "var(--danger-bg)" : "var(--surface-2)";
  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : "var(--primary)";
  return (
    <span className="ta-tag" style={{ background: bg, color }}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

export function Switch({ on, onChange }) {
  return (
    <div className={`ta-switch ${on ? "on" : ""}`} onClick={onChange} role="switch" aria-checked={on}>
      <div className="ta-switch-knob" />
    </div>
  );
}

export function StatCard({ stat }) {
  const Icon = stat.icon;
  return (
    <div className="ta-card">
      <div className="ta-row ta-between">
        <span className="ta-label">{stat.label}</span>
        {Icon && <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} color="var(--primary)" /></div>}
      </div>
      <div className="ta-row ta-between ta-mt12">
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>{stat.value}</div>
        {stat.delta && (
          <div className="ta-row ta-gap4" style={{ fontSize: 12, fontWeight: 700, color: stat.up ? "var(--success)" : "var(--danger)" }}>
            {stat.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {stat.delta}
          </div>
        )}
      </div>
      {stat.sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{stat.sub}</div>}
    </div>
  );
}

const WORKSPACES = [
  { key: "admin", label: "Admin", subtitle: "Northwind Academy", icon: Building2, roles: ["admin", "super_admin"] },
  { key: "mentor", label: "Instructor View", subtitle: "Instructor Portal", icon: GraduationCap, roles: ["mentor", "admin", "super_admin"] },
  { key: "manager", label: "Manager View", subtitle: "Team Manager", icon: Users, roles: ["manager", "admin", "super_admin"] },
  // "superadmin" removed from here on purpose - Platform Owner is no longer
  // a workspace tab sharing this dashboard's sidebar. It is its own
  // top-level dashboard now (src/platform/PlatformOwnerApp.jsx), reached
  // through the Dashboard Switcher below, not through this list.
];

const ADMIN_NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "workforce", label: "Workforce Intelligence", icon: Brain },
  { key: "people", label: "People & Access", icon: Users },
  { key: "content", label: "Content & Courses", icon: BookOpen },
  { key: "paths", label: "Learning Paths", icon: Map },
  { key: "moderation", label: "Content Moderation", icon: Flag },
  { key: "studygroups", label: "Study Groups", icon: Users },
  { key: "analytics", label: "Analytics Hub", icon: BarChart3 },
  { key: "cohorts", label: "Cohorts & Batches", icon: Layers },
  { key: "compliance", label: "Learner Progress", icon: ShieldCheck },
  { key: "roleaccess", label: "Role & Access Control", icon: ShieldCheck },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "settings", label: "Settings Hub", icon: Settings },
];

const MENTOR_NAV = [
  { key: "dashboard", label: "Instructor Overview", icon: LayoutDashboard },
  { key: "schedule", label: "Availability & Sessions", icon: Calendar },
  { key: "cohorts", label: "My Cohorts", icon: Layers },
  { key: "content", label: "My Courses", icon: BookOpen },
  { key: "studygroups", label: "My Study Groups", icon: Users },
  { key: "mentees", label: "My Learners", icon: Users },
  { key: "messages", label: "Direct Messages", icon: MessageSquare },
  { key: "discussions", label: "Learner Q&A", icon: MessagesSquare },
  { key: "analytics", label: "My Performance", icon: BarChart3 },
  { key: "admin", label: "Earnings & Payouts", icon: Briefcase },
  { key: "settings", label: "Instructor Settings", icon: Settings },
];

export const SUPERADMIN_NAV = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "orgs", label: "Organizations", icon: Building2 },
  { key: "onboarding", label: "Org Onboarding", icon: Rocket },
  { key: "branding", label: "Branding", icon: Palette },
  { key: "settings", label: "Platform Settings", icon: Settings },
  { key: "tracks", label: "Learning Tracks", icon: Map },
  { key: "emails", label: "Platform Emails", icon: Mail },
  { key: "support", label: "Support Queue", icon: LifeBuoy },
  { key: "access", label: "Access Control", icon: ShieldCheck },
];

const MANAGER_NAV = [
  { key: "dashboard", label: "Manager View", icon: Users },
  { key: "workforce", label: "Workforce Intelligence", icon: Brain },
];

const NAV_BY_WORKSPACE = { admin: ADMIN_NAV, mentor: MENTOR_NAV, manager: MANAGER_NAV, superadmin: SUPERADMIN_NAV };

// Owner's own sidebar - deliberately NOT the same Sidebar component the
// Organisation dashboard uses. That one always renders a "Workspaces"
// section (Admin/Instructor/HR/Manager to switch between); Owner has no
// such sub-workspaces to switch between - it is one dashboard, which is
// the entire point of pulling it out of that shared component in the first
// place rather than passing it an empty workspace list.
export function OwnerSidebar({ screen, setScreen, mobileOpen, onClose, onOpenDashboardSwitcher }) {
  return (
    <>
      {mobileOpen && <div className="ta-scrim ta-scrim-sidebar" onClick={onClose} />}
      <div className={`ta-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="ta-row ta-between">
          <div className="ta-brand">
            <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }} />
            <div>
              <div className="ta-brand-name">Train AI</div>
            </div>
            <span className="ta-brand-tag" style={{ background: "linear-gradient(90deg,#F59E0B,#EF4444)" }}>OWNER</span>
          </div>
          <button className="ta-sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>

        <div className="ta-nav-section-title">Platform Owner</div>
        <div className="ta-nav">
          {SUPERADMIN_NAV.map(s => {
            const Icon = s.icon;
            const isActive = screen === s.key;
            return (
              <div
                key={s.key}
                className={`ta-nav-item ${isActive ? "active" : ""}`}
                onClick={() => { setScreen(s.key); onClose(); }}
              >
                <Icon size={17} />
                <span style={{ flex: 1 }}>{s.label}</span>
              </div>
            );
          })}
        </div>

        <div className="ta-nav-footer">
          {onOpenDashboardSwitcher && (
            <div
              className="ta-nav-item"
              style={{ background: "rgba(59,130,246,0.12)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.25)" }}
              onClick={() => { onOpenDashboardSwitcher(); onClose(); }}
            >
              <Repeat size={16} />
              <span>Switch Dashboard</span>
              <ChevronRight size={14} style={{ marginLeft: "auto" }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function Sidebar({ workspace, setWorkspace, screen, setScreen, mobileOpen, onClose, onOpenDashboardSwitcher, userRoles = ["admin", "mentor", "super_admin"] }) {
  const allowedWorkspaces = WORKSPACES.filter(w => w.roles.some(r => userRoles.includes(r)));
  const navItems = NAV_BY_WORKSPACE[workspace] || MENTOR_NAV;

  return (
    <>
      {mobileOpen && <div className="ta-scrim ta-scrim-sidebar" onClick={onClose} />}
      <div className={`ta-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="ta-row ta-between">
          <div className="ta-brand">
            <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }} />
            <div>
              <div className="ta-brand-name">Train AI</div>
            </div>
            <span className="ta-brand-tag">PRO</span>
          </div>
          <button className="ta-sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>

        <div className="ta-nav-section-title">Workspaces</div>
        <div className="ta-workspace-card">
          {allowedWorkspaces.map(w => {
            const Icon = w.icon;
            const isActive = workspace === w.key;
            return (
              <div
                key={w.key}
                className={`ta-ws-item ${isActive ? "active" : ""}`}
                onClick={() => { setWorkspace(w.key); onClose(); }}
              >
                <Icon size={16} />
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, flex: 1, minWidth: 0 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.label}</span>
                </div>
                {isActive && <Sparkles size={13} />}
              </div>
            );
          })}
        </div>

        <div className="ta-nav-section-title">Navigation</div>
        <div className="ta-nav">
          {navItems.map(s => {
            const Icon = s.icon;
            const isActive = screen === s.key;
            return (
              <div
                key={s.key}
                className={`ta-nav-item ${isActive ? "active" : ""}`}
                onClick={() => { setScreen(s.key); onClose(); }}
              >
                <Icon size={17} />
                <span style={{ flex: 1 }}>{s.label}</span>
              </div>
            );
          })}
        </div>

        <div className="ta-nav-footer">
          {onOpenDashboardSwitcher && (
            <div
              className="ta-nav-item"
              style={{ background: "rgba(59,130,246,0.12)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.25)" }}
              onClick={() => { onOpenDashboardSwitcher(); onClose(); }}
            >
              <Repeat size={16} />
              <span>Switch Dashboard</span>
              <ChevronRight size={14} style={{ marginLeft: "auto" }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// The Dashboard Switcher - matching the reference design directly (title,
// role badge, "open another dashboard without changing your saved role"
// framing, one row per option). This is the actual mechanism for "three
// separate dashboards, not one with a tab hidden inside it" - clicking an
// option here re-mounts an entirely different top-level app component in
// App.jsx (TrainAILearnerApp / TrainAIPlatformApp / PlatformOwnerApp), not
// a screen change inside the current one.
// ============================================================================
const DASHBOARD_ICONS = {
  learner: GraduationCap,
  organisation: Building2,
  owner: ShieldCheck,
};

export function DashboardSwitcher({ currentDashboard, availableDashboards, roleLabel, onSwitch, onClose }) {
  return (
    <div className="ta-scrim" onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 200, position: "fixed", inset: 0 }}>
      {/* position/inset/zIndex all set inline, not just via the .ta-scrim
          class - a real bug found by testing: with three separate <style>
          tags injected simultaneously (one per mounted dashboard, all
          rendering the same TOKENS constant), this element's computed
          position was resolving to "static" despite the class rule saying
          "fixed", pushing the whole modal below the visible viewport
          instead of overlaying it. Inline styles have unambiguous highest
          specificity, so this can't be re-broken by stylesheet ordering
          the same way. */}
      <div className="ta-card" style={{ maxWidth: 460, width: "100%", background: "#fff" }} onClick={(e) => e.stopPropagation()}>
        <div className="ta-row ta-between">
          <div className="ta-row ta-gap8">
            <Repeat size={18} color="var(--primary)" />
            <div className="ta-title" style={{ fontSize: 16 }}>Dashboard Switcher</div>
          </div>
          {roleLabel && <Tag tone="warning">{roleLabel}</Tag>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6, marginBottom: 16 }}>
          Open another dashboard without changing your saved role
        </div>
        <div className="ta-col ta-gap8">
          {availableDashboards.map((key) => {
            const Icon = DASHBOARD_ICONS[key];
            const meta = DASHBOARD_META[key];
            const isActive = key === currentDashboard;
            return (
              <div
                key={key}
                className={`ta-ws-item ${isActive ? "active" : ""}`}
                style={{ padding: "14px 16px", borderRadius: 12, cursor: isActive ? "default" : "pointer" }}
                onClick={() => { if (!isActive) onSwitch(key); }}
              >
                <Icon size={18} />
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</span>
                  <span style={{ fontSize: 11.5, opacity: 0.8 }}>{meta.subtitle}</span>
                </div>
                {isActive && <Sparkles size={15} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Static jump-to-section shortcuts, clearly labeled "Navigation" in the
// results popover below and combined with real live-data matches (students,
// courses, cohorts - see the *Query hooks inside TopBar). Every entry below
// just deep links to a real screen in this app; it never lists fabricated
// learner names, course titles or cohort names.
const SEARCH_DATABASE = [
  { type: "Navigation", name: "People & Access Control", detail: "Manage users, roles & invitations", targetScreen: "people", icon: Users },
  { type: "Navigation", name: "Content & Courses", detail: "Manage published courses & lessons", targetScreen: "content", icon: BookOpen },
  { type: "Navigation", name: "Cohorts & Batches", detail: "Manage cohorts & enrolled students", targetScreen: "cohorts", icon: Layers },
  { type: "Navigation", name: "My Mentees", detail: "Search & message your actual mentees", targetScreen: "mentees", icon: Users },
  { type: "Navigation", name: "Compliance & Auditing", detail: "Participation metrics & CSV exports", targetScreen: "compliance", icon: ShieldCheck },
  { type: "Navigation", name: "Integrations & Webhooks", detail: "Configure API keys & integrations", targetScreen: "integrations", icon: Plug },
  { type: "Navigation", name: "Analytics Hub", detail: "Platform KPIs & adoption reports", targetScreen: "analytics", icon: BarChart3 },
  { type: "Navigation", name: "Settings Hub", detail: "Organization settings & security", targetScreen: "settings", icon: Settings },
];

const searchGroupLabelStyle = { padding: "8px 14px 4px", fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" };
const searchRowStyle = { padding: "9px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "background 0.12s ease" };

function SearchResultRow({ icon: Icon, name, detail, type, onClick }) {
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        if (onClick) onClick();
      }}
      onClick={onClick}
      style={searchRowStyle}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color="var(--primary)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {detail}
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "var(--surface-3)", color: "var(--text-2)", border: "1px solid var(--border)", flexShrink: 0 }}>
        {type}
      </span>
    </div>
  );
}

export function TopBar({ title, sub, right, orgSelector, profileQuery, onNavigate }) {
  const openMenu = useContext(MobileMenuContext);
  const navFromContext = useContext(NavigationContext);
  const handleNavigate = onNavigate || navFromContext;
  // Screens that pass their own `onNavigate` (almost always their workspace's
  // own `setScreen`) are known to stay inside a workspace that actually has a
  // "settings" screen. The bare NavigationContext fallback instead resolves
  // "settings" by a hardcoded target-screen allowlist that doesn't recognize
  // plain "settings" for hr/manager/mentor workspaces and would silently drop
  // the caller into the unrelated Admin workspace - so the profile pill below
  // only becomes clickable where the destination is actually known-good.
  const canOpenOwnSettings = !!onNavigate;
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const userDisplayName = profileQuery?.data?.display_name || "Admin User";
  const userInitials = userDisplayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "AU";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchValue.trim()), 300);
    return () => clearTimeout(t);
  }, [searchValue]);

  const searchActive = debouncedSearch.length >= 2;
  const q = debouncedSearch.toLowerCase();

  const needOwnProfile = searchActive && !profileQuery?.data?.organization_id;
  const ownProfileQuery = useSupabaseQuery(async () => {
    if (!needOwnProfile || !supabase) return null;
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (!uid) return null;
    return fetchCurrentUserProfile(uid);
  }, [needOwnProfile]);

  const scopedOrgId = orgSelector?.selectedOrgId || profileQuery?.data?.organization_id || ownProfileQuery.data?.organization_id || null;

  const studentsQuery = useSupabaseQuery(async () => {
    if (!searchActive) return [];
    return scopedOrgId ? fetchUsersInOrg(scopedOrgId) : fetchOrgMembers();
  }, [searchActive, scopedOrgId]);

  const coursesQuery = useSupabaseQuery(async () => {
    if (!searchActive) return [];
    return fetchCourses();
  }, [searchActive]);

  const cohortsQuery = useSupabaseQuery(async () => {
    if (!searchActive || !scopedOrgId) return [];
    return fetchCohorts(scopedOrgId);
  }, [searchActive, scopedOrgId]);

  const studentResults = !searchActive ? [] : (studentsQuery.data || [])
    .map(m => ({ id: m.id || m.user_id, name: m.name || m.display_name || "Unnamed user", sub: m.role || m.title || "Member" }))
    .filter(m => m.name.toLowerCase().includes(q) || (m.sub || "").toLowerCase().includes(q))
    .slice(0, 5);

  const courseResults = !searchActive ? [] : (coursesQuery.data || [])
    .filter(c => (c.title || "").toLowerCase().includes(q) || (c.category || "").toLowerCase().includes(q))
    .slice(0, 5);

  const cohortResults = !searchActive ? [] : (cohortsQuery.data || [])
    .filter(c => (c.name || "").toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q))
    .slice(0, 5);

  const realResultsLoading = searchActive && (studentsQuery.loading || coursesQuery.loading || (!!scopedOrgId && cohortsQuery.loading));
  const totalRealResults = studentResults.length + courseResults.length + cohortResults.length;

  const navResults = searchValue.trim() === "" ? [] : SEARCH_DATABASE.filter(item =>
    item.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    item.detail.toLowerCase().includes(searchValue.toLowerCase()) ||
    item.type.toLowerCase().includes(searchValue.toLowerCase())
  );

  function handleSelectResult(item) {
    setIsSearchOpen(false);
    setSearchValue("");
    if (handleNavigate) {
      handleNavigate(item.targetScreen, null, { courseId: item.courseId });
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="ta-topbar">
      <div className="ta-topbar-left">
        <button className="ta-menu-btn" onClick={openMenu} aria-label="Open menu"><Menu size={20} /></button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ta-h1">{title}</div>
          {sub && <div className="ta-sub">{sub}</div>}
        </div>
      </div>

      <div className="ta-topbar-right">
        {/* Tenant Organization Context Selector */}
        {orgSelector && (
          <div className="ta-row ta-gap8 ta-org-selector" style={{
            background: "var(--surface)",
            padding: "6px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
          }}>
            <Building2 size={16} color="var(--primary)" />
            <div className="ta-col" style={{ lineHeight: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Tenant</span>
              <select
                value={orgSelector.selectedOrgId || ""}
                onChange={(e) => orgSelector.onSelectOrg(e.target.value)}
                style={{
                  padding: "2px 0 0",
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: "none",
                  background: "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                <option value="">All Organizations (Global)</option>
                {(orgSelector.orgs || []).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <ChevronRight size={14} color="var(--text-3)" style={{ transform: "rotate(90deg)" }} />
          </div>
        )}

        {/* Universal Search Bar with Live Results Popover */}
        <div className="ta-search" ref={searchRef} style={{ position: "relative", zIndex: 100 }}>
          <Search size={15} color="var(--text-3)" />
          <input
            type="text"
            placeholder="Search students, courses, cohorts, or jump to a section..."
            value={searchValue}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setIsSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsSearchOpen(false);
            }}
            style={{ border: "none", background: "transparent", width: "100%", fontSize: 13, color: "var(--text)", outline: "none", fontFamily: "var(--font)" }}
          />
          {searchValue ? (
            <X size={14} color="var(--text-3)" style={{ cursor: "pointer" }} onClick={() => { setSearchValue(""); setIsSearchOpen(false); }} />
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", background: "var(--surface)", padding: "2px 6px", borderRadius: 6, border: "1px solid var(--border)" }}>⌘K</span>
          )}

          {/* Universal Search Results Popover */}
          {isSearchOpen && searchValue.trim() !== "" && (
            <div
              className="ta-card anim-slide-down"
              style={{
                position: "absolute",
                top: 48,
                left: 0,
                width: 380,
                maxHeight: 380,
                overflowY: "auto",
                padding: "8px 0",
                zIndex: 200,
                boxShadow: "0 14px 36px -8px rgba(15,23,42,0.22)",
                border: "1px solid var(--border)",
              }}
            >
              {debouncedSearch.length === 1 && (
                <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-3)" }}>
                  Keep typing: 2+ characters searches real students, courses & cohorts too.
                </div>
              )}

              {realResultsLoading && (
                <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-3)" }}>
                  Searching students, courses & cohorts…
                </div>
              )}

              {!realResultsLoading && totalRealResults === 0 && navResults.length === 0 && (
                <div className="ta-empty" style={{ padding: 18, fontSize: 13 }}>
                  No matches found for "{searchValue}"
                </div>
              )}

              {studentResults.length > 0 && (
                <>
                  <div style={searchGroupLabelStyle}>Students ({studentResults.length})</div>
                  {studentResults.map(s => (
                    <SearchResultRow
                      key={`student-${s.id}`}
                      icon={Users}
                      name={s.name}
                      detail={s.sub}
                      type="Student"
                      onClick={() => handleSelectResult({ targetScreen: "people" })}
                    />
                  ))}
                </>
              )}

              {courseResults.length > 0 && (
                <>
                  <div style={searchGroupLabelStyle}>Courses ({courseResults.length})</div>
                  {courseResults.map(c => (
                    <SearchResultRow
                      key={`course-${c.id}`}
                      icon={BookOpen}
                      name={c.title}
                      detail={`${c.category || "Course"}${c.is_published ? "" : " · Draft"}`}
                      type="Course"
                      onClick={() => handleSelectResult({ targetScreen: "content", courseId: c.id })}
                    />
                  ))}
                </>
              )}

              {cohortResults.length > 0 && (
                <>
                  <div style={searchGroupLabelStyle}>Cohorts ({cohortResults.length})</div>
                  {cohortResults.map(c => (
                    <SearchResultRow
                      key={`cohort-${c.id}`}
                      icon={Layers}
                      name={c.name}
                      detail={c.description || "Cohort"}
                      type="Cohort"
                      onClick={() => handleSelectResult({ targetScreen: "cohorts" })}
                    />
                  ))}
                </>
              )}

              {navResults.length > 0 && (
                <>
                  <div style={searchGroupLabelStyle}>Navigation ({navResults.length})</div>
                  {navResults.map((item, idx) => (
                    <SearchResultRow
                      key={`nav-${idx}`}
                      icon={item.icon}
                      name={item.name}
                      detail={item.detail}
                      type={item.type}
                      onClick={() => handleSelectResult(item)}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Notifications icon - decorative for now: there is no platform-side
            (admin/mentor/superadmin) notifications feed in the schema to back
            a real unread count (that only exists on the learner app side), so
            this deliberately has no fake unread dot or click affordance
            rather than pretending there's something behind it. */}
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <Bell size={17} color="var(--text-2)" />
        </div>

        {/* Primary Header Quick Action */}
        {right}

        {/* User Profile Pill - opens the real Settings Hub (org name/domain,
            same screen reachable from the sidebar) so this isn't just a
            static display; role label pulled from the real user_profiles.role
            column instead of the hardcoded "Admin" it used to always show. */}
        <div
          className="ta-row ta-gap8"
          style={{ background: "var(--surface)", padding: "4px 10px 4px 4px", borderRadius: 12, border: "1px solid var(--border)", cursor: canOpenOwnSettings ? "pointer" : "default" }}
          onClick={() => canOpenOwnSettings && onNavigate("settings")}
        >
          <Avatar initials={userInitials} size={34} />
          <div className="ta-col" style={{ lineHeight: 1.2, paddingRight: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{userDisplayName.split(" ")[0]}</span>
            <span style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "capitalize" }}>{profileQuery?.data?.role || "Admin"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function exportRowsAsCsv(filename, rows) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
