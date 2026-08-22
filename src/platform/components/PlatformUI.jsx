import React, { useContext, useState, useEffect, useRef } from "react";
import {
  Building2, GraduationCap, ShieldCheck, LayoutDashboard, Users, BookOpen, BarChart3,
  Layers, Plug, Briefcase, Settings, Calendar, MessageSquare, MessagesSquare, Map, Mail,
  Repeat, LogOut, Search, Bell, Menu, X, ArrowUpRight, ArrowDownRight, Sparkles, ChevronRight, Flag, Palette, Rocket, Brain, LifeBuoy,
  PanelLeftClose, PanelLeftOpen, Check, CheckCircle2, Sun, Moon, MoreVertical
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient.js";
import { DASHBOARD_META } from "../../lib/roleRouting.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCurrentUserProfile, fetchOrgMembers, fetchUsersInOrg, fetchCourses, fetchCohorts } from "../../lib/api/platform.js";
import { PortalModal } from "../../components/common/PortalModal.jsx";

export const MobileMenuContext = React.createContext(() => {});
export const ToastContext = React.createContext(() => {});
export const NavigationContext = React.createContext(null);

export function getStoredThemeDark() {
  try {
    return localStorage.getItem("trainai_theme_dark") === "true" ||
      (typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  } catch {
    return false;
  }
}

export function setGlobalThemeDark(isDark) {
  try {
    localStorage.setItem("trainai_theme_dark", isDark ? "true" : "false");
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    window.dispatchEvent(new CustomEvent("trainai-theme-change", { detail: { isDark } }));
  } catch {}
}

export const TOKENS = `
  .ta * { box-sizing: border-box; }
  .ta {
    --bg: #F8FAFC;
    --surface: #FFFFFF;
    --surface-2: #F1F5F9;
    --surface-3: #F8FAFC;
    --primary: #4F46E5;
    --primary-dark: #4338CA;
    --primary-light: #6366F1;
    --primary-tint: #EEF2FF;
    --grad: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
    --grad-subtle: linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%);
    --text: #0F172A;
    --text-2: #475569;
    --text-3: #94A3B8;
    --border: #E2E8F0;
    --border-subtle: #F1F5F9;
    --success: #10B981;
    --success-bg: #ECFDF5;
    --success-border: #A7F3D0;
    --warning: #F59E0B;
    --warning-bg: #FFFBEB;
    --warning-border: #FDE68A;
    --danger: #EF4444;
    --danger-bg: #FEF2F2;
    --danger-border: #FECACA;
    --sidebar-w: 260px;
    --radius: 18px;
    --radius-sm: 12px;
    --shadow-card: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 4px 14px -2px rgba(15, 23, 42, 0.03);
    --shadow-hover: 0 8px 24px -4px rgba(79, 70, 229, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
    --shadow-btn: 0 4px 14px -2px rgba(79, 70, 229, 0.32);
    --font: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-family: var(--font);
    color: var(--text);
    background: var(--bg);
    min-height: 100vh; min-height: 100dvh;
    transition: background .25s ease, color .25s ease;
  }
  .ta.dark, html.dark .ta, html.dark body, html.dark {
    --bg: #090D1A;
    --surface: #121829;
    --surface-2: #1B243B;
    --surface-3: #161D31;
    --text: #F8FAFC;
    --text-2: #94A3B8;
    --text-3: #64748B;
    --border: rgba(255, 255, 255, 0.1);
    --border-subtle: rgba(255, 255, 255, 0.06);
    --success-bg: rgba(16, 185, 129, 0.18);
    --success-border: rgba(16, 185, 129, 0.35);
    --warning-bg: rgba(245, 158, 11, 0.18);
    --warning-border: rgba(245, 158, 11, 0.35);
    --danger-bg: rgba(239, 68, 68, 0.18);
    --danger-border: rgba(239, 68, 68, 0.35);
    --primary-tint: rgba(99, 102, 241, 0.2);
  }
  .ta.dark .ta-sidebar, html.dark .ta-sidebar {
    background: #0D1222;
    border-right-color: rgba(255, 255, 255, 0.08);
  }
  .ta.dark .ta-topbar, html.dark .ta-topbar {
    background: #0D1222;
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
  .ta.dark .ta-table-wrap, html.dark .ta-table-wrap {
    background: #121829;
    border-color: rgba(255, 255, 255, 0.08);
  }
  .ta.dark .ta-search, html.dark .ta-search {
    background: #161D31;
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--text);
  }
  .ta.dark .ta-search:focus-within, html.dark .ta-search:focus-within {
    background: #121829;
  }
  .ta-shell { display: flex; min-height: 100vh; min-height: 100dvh; }
  .ta-sidebar {
    width: var(--sidebar-w); flex-shrink: 0;
    background: #FFFFFF;
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; height: 100dvh;
    color: var(--text); box-shadow: 2px 0 16px -8px rgba(15,23,42,0.04);
    transition: width .2s ease, padding .2s ease;
  }
  .ta-sidebar.ta-sidebar-minimized {
    width: 76px; padding: 20px 8px;
  }
  .ta-sidebar.ta-sidebar-minimized .ta-brand-name,
  .ta-sidebar.ta-sidebar-minimized .ta-brand-tag,
  .ta-sidebar.ta-sidebar-minimized .ta-nav-section-title,
  .ta-sidebar.ta-sidebar-minimized .ta-nav-item span,
  .ta-sidebar.ta-sidebar-minimized .ta-ws-item span,
  .ta-sidebar.ta-sidebar-minimized .ta-nav-item svg:last-child {
    display: none;
  }
  .ta-sidebar.ta-sidebar-minimized .ta-nav-item,
  .ta-sidebar.ta-sidebar-minimized .ta-ws-item {
    justify-content: center; padding: 10px 0; gap: 0;
  }
  .ta-sidebar.ta-sidebar-minimized .ta-brand {
    justify-content: center; padding: 0 0 16px;
  }
  .ta-brand { display: flex; align-items: center; gap: 12px; padding: 4px 8px 16px; }
  .ta-brand-mark {
    width: 36px; height: 36px; border-radius: 10px; background: var(--grad);
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
    box-shadow: 0 4px 12px rgba(79,70,229,0.3);
  }
  .ta-brand-name { font-weight: 800; font-size: 17px; letter-spacing: -0.02em; color: var(--text); }
  .ta-brand-tag { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; background: var(--primary-tint); color: var(--primary); padding: 3px 8px; border-radius: 6px; }
  .ta-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; overflow-y:auto; padding-right: 2px; }
  .ta-nav::-webkit-scrollbar { width: 4px; }
  .ta-nav::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
  .ta-nav-section-title {
    font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3);
    padding: 14px 10px 6px; margin-top: 4px;
  }
  .ta-nav-item {
    display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 12px; cursor: pointer;
    font-size: 13.5px; font-weight: 600; color: var(--text-2); transition: all .16s ease;
  }
  .ta-nav-item:hover { background: var(--surface-2); color: var(--text); transform: translateX(2px); }
  .ta-nav-item.active {
    background: var(--surface-2);
    color: var(--primary); font-weight: 700; border-left: 3px solid var(--primary); padding-left: 9px;
  }
  .ta-nav-divider { height: 1px; background: var(--border); margin: 10px 4px; }
  .ta-workspace-card {
    background: var(--surface-3); border: 1px solid var(--border); border-radius: 14px; padding: 6px;
    margin-bottom: 12px; display: flex; flex-direction: column; gap: 3px;
  }
  .ta-ws-item {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; cursor: pointer;
    font-size: 13px; font-weight: 600; color: var(--text-2); transition: all .14s ease;
  }
  .ta-ws-item:hover { background: var(--surface-2); color: var(--text); }
  .ta-ws-item.active { background: var(--grad); color: #FFFFFF; font-weight: 700; box-shadow: 0 4px 12px rgba(79,70,229,0.25); }
  .ta-nav-footer { display:flex; flex-direction:column; gap:4px; margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); }
  .ta-toggle-btn {
    display: flex; align-items: center; justify-content: center; width: 100%; height: 36px; border-radius: 10px;
    border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); cursor: pointer;
    transition: all .15s ease; margin-bottom: 10px;
  }
  .ta-toggle-btn:hover { background: var(--surface-3); color: var(--primary); border-color: var(--primary-light); }
  .ta-main { flex: 1; min-width: 0; }
  .ta-topbar {
    height: 72px; border-bottom: 1px solid var(--border); background: var(--surface);
    display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(20px, 2.5vw, 32px); position: sticky; top:0; z-index: 20;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }
  .ta-topbar-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; padding-right: 16px; }
  .ta-topbar-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .ta-search { display:flex; align-items:center; gap:8px; background: var(--surface-3); border: 1px solid var(--border); border-radius: 12px; padding: 9px 14px; width: clamp(220px, 24vw, 380px); color: var(--text-3); font-size: 13px; transition: all .15s ease; }
  .ta-search:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12); background: #fff; }
  .ta-content { padding: 28px clamp(20px, 2.5vw, 40px) 72px; max-width: 1560px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  .ta-h1 { font-size: 23px; font-weight: 800; letter-spacing: -0.025em; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; color: var(--text); }
  .ta-sub { font-size: 13.5px; color: var(--text-2); margin: 4px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; font-weight: 500; }
  @media (min-width: 900px) {
    .ta-menu-btn, .ta-sidebar-close { display: none !important; }
    .ta-header-mobile-only { display: none !important; }
  }
  .ta-hero-banner {
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.88) 100%);
    color: #FFFFFF;
    padding: clamp(22px, 2.2vw, 30px) clamp(24px, 2.5vw, 34px);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.35);
    border: 1px solid rgba(99, 102, 241, 0.4);
    position: relative;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
  }
  .ta-hero-inner {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    width: 100%;
    box-sizing: border-box;
  }
  .ta-hero-text {
    min-width: 0;
    flex: 1;
  }
  .ta-hero-title {
    font-size: clamp(22px, 2vw, 28px);
    font-weight: 900;
    letter-spacing: -0.025em;
    margin: 0 0 6px;
    color: #FFFFFF;
    line-height: 1.25;
  }
  .ta-hero-desc {
    font-size: clamp(13px, 1vw, 14.5px);
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
    max-width: 680px;
    line-height: 1.5;
  }
  .ta-hero-actions {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
    align-items: center;
  }

  @media (max-width: 899px) {
    .ta-menu-btn { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); cursor: pointer; flex-shrink: 0; }
    .ta-search { display: none; }
    /* The theme toggle, notifications bell, per-screen quick-action, and
       Sign Out button all get hidden here rather than shrunk - crammed
       together as icons they still read as "crowded" no matter how small.
       Each one (except the purely-decorative bell) is replicated inside the
       single "more" menu (.ta-header-mobile-only) instead, so nothing is
       actually lost - it's consolidated into one tap target. */
    .ta-header-full-only { display: none !important; }
    .ta-header-mobile-only { display: block; }
    .ta-topbar {
      padding: 0 16px; height: 58px; min-height: 58px;
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: nowrap; box-sizing: border-box; width: 100%;
    }
    .ta-topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
    .ta-topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .ta-profile-pill { padding: 3px !important; }
    .ta-content { padding: 16px 16px calc(88px + env(safe-area-inset-bottom)); width: 100%; box-sizing: border-box; }
    .ta-sidebar {
      position: fixed; top: 0; left: 0; z-index: 100;
      transform: translateX(-100%); transition: transform .22s ease;
      box-shadow: 6px 0 24px rgba(15,23,42,.18);
    }
    .ta-sidebar.mobile-open { transform: translateX(0); }
    .ta-sidebar-close {
      display: flex !important; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 8px; border: none; background: var(--surface-2); cursor: pointer; color: var(--text-2);
    }
    .ta-scrim { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 90; animation: fadeInScale .15s ease; }
    .ta-profile-pill-name { max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ta-org-selector { display: none !important; }
    .ta-h1 { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ta-sub { display: none; }
    .ta-table-wrap .ta-table { min-width: 460px; }
    .ta-grid-5, .ta-grid-4, .ta-grid-3 { grid-template-columns: repeat(2, 1fr); gap: 12px; }

    /* Clean mobile scrolling for tabs and filter pills */
    .ta-tabs, .ta-pills-row {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
      flex-wrap: nowrap !important;
      scrollbar-width: none;
      padding-bottom: 2px;
    }
    .ta-tabs::-webkit-scrollbar, .ta-pills-row::-webkit-scrollbar { display: none; }
    .ta-tab, .ta-pill { flex-shrink: 0 !important; white-space: nowrap !important; }

    /* Responsive hero layout for all dashboards */
    .ta-hero-banner {
      padding: 16px 14px !important;
      border-radius: 16px !important;
    }
    .ta-hero-inner {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 12px !important;
    }
    .ta-hero-text {
      width: 100% !important;
      flex: none !important;
    }
    .ta-hero-title {
      font-size: 18px !important;
      line-height: 1.3 !important;
      margin-bottom: 5px !important;
    }
    .ta-hero-desc {
      font-size: 12.5px !important;
      line-height: 1.45 !important;
      max-width: 100% !important;
    }
    .ta-hero-actions {
      width: 100% !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
    }
    .ta-hero-actions .ta-btn, .ta-hero-actions button {
      padding: 8px 16px !important;
      font-size: 12.5px !important;
      border-radius: 10px !important;
    }
  }
  @media (max-width: 640px) {
    .ta-topbar { padding: 0 14px; height: 56px; min-height: 56px; }
    .ta-content { padding: 14px 14px calc(86px + env(safe-area-inset-bottom)); width: 100%; box-sizing: border-box; }
    .ta-card { padding: 18px 16px; border-radius: 16px; width: 100%; box-sizing: border-box; }
    .ta-h1 { font-size: 14.5px; }
    .ta-btn { padding: 8px 14px; font-size: 12.5px; border-radius: 10px; }
    .ta-grid, .ta-grid-5, .ta-grid-4, .ta-grid-3, .ta-grid-2 { grid-template-columns: 1fr !important; gap: 14px !important; width: 100% !important; }
  }
  .ta-btn { border: none; cursor: pointer; border-radius: 12px; font-weight: 700; font-size: 13.5px; padding: 10px 18px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all .18s cubic-bezier(0.16, 1, 0.3, 1); font-family: var(--font); }
  .ta-btn:active { transform: scale(.96); }
  .ta-btn-primary { background: var(--grad); color: #fff; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.32); }
  .ta-btn-primary:hover { box-shadow: 0 8px 22px -2px rgba(79,70,229,0.48); transform: translateY(-2px); }
  .ta-btn-outline { background: var(--surface); border: 1.5px solid var(--border); color: var(--text); }
  .ta-btn-outline:hover { background: var(--surface-2); border-color: rgba(99, 102, 241, 0.3); transform: translateY(-1px); }
  .ta-btn-ghost { background: var(--surface-2); color: var(--primary); font-weight: 700; }
  .ta-btn-ghost:hover { background: #E0E7FF; transform: translateY(-1px); }
  .ta-btn-sm { padding: 7px 14px; font-size: 12px; border-radius: 10px; }
  .ta-btn-danger { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); }
  
  /* Card surface for Platform - no backdrop-filter: this app is dense with
     stacked/nested cards and tables, and a blur costs real scroll/render
     performance for near-zero visible benefit on flat backgrounds. */
  /* Card surface for Platform */
  .ta-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 22px;
    box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.8);
    transition: transform .24s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow .24s cubic-bezier(0.16, 1, 0.3, 1),
                border-color .24s ease,
                background .2s ease;
  }
  .ta.dark .ta-card, html.dark .ta-card, html.dark .ta .ta-card {
    background: var(--surface) !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
    box-shadow: 0 8px 28px -4px rgba(0, 0, 0, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.06) !important;
  }
  .ta-card-hover {
    cursor: pointer;
  }
  .ta-card-hover:hover {
    box-shadow: 0 16px 36px -6px rgba(79, 70, 229, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
    border-color: rgba(99, 102, 241, 0.35);
    transform: translateY(-3px) scale(1.006);
  }
  .ta.dark .ta-card-hover:hover, html.dark .ta .ta-card-hover:hover {
    box-shadow: 0 18px 40px -6px rgba(0, 0, 0, 0.65), 0 0 20px -2px rgba(99, 102, 241, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.12) !important;
    border-color: rgba(129, 140, 248, 0.35) !important;
    transform: translateY(-3px) scale(1.006);
  }
  .ta-grid { display: grid; gap: 20px; }
  .ta-grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .ta-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .ta-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ta-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (min-width: 641px) and (max-width: 1080px) {
    .ta-grid-5, .ta-grid-4, .ta-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 16px !important; }
  }
  /* Main content + sidebar layout: keeps the main column dominant instead of
     splitting 50/50 once both tracks clear an auto-fit minmax threshold */
  .ta-sidebar-layout { display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start; }
  @media (min-width: 900px) {
    .ta-sidebar-layout { grid-template-columns: minmax(0, 2fr) minmax(320px, 380px); gap: 24px; }
  }
  .ta-row { display: flex; align-items: center; }
  .ta-between { justify-content: space-between; }
  .ta-col { display: flex; flex-direction: column; }
  .ta-gap4 { gap: 4px; } .ta-gap6 { gap: 6px; } .ta-gap8 { gap: 8px; } .ta-gap10 { gap: 10px; } .ta-gap12 { gap: 12px; } .ta-gap14 { gap: 14px; } .ta-gap16 { gap: 16px; } .ta-gap20 { gap: 20px; } .ta-gap24 { gap: 24px; }
  .ta-mt4 { margin-top: 4px; } .ta-mt6 { margin-top: 6px; } .ta-mt8 { margin-top: 8px; } .ta-mt10 { margin-top: 10px; } .ta-mt12 { margin-top: 12px; } .ta-mt14 { margin-top: 14px; } .ta-mt16 { margin-top: 16px; } .ta-mt18 { margin-top: 18px; } .ta-mt20 { margin-top: 20px; } .ta-mt24 { margin-top: 24px; } .ta-mt28 { margin-top: 28px; }
  .ta-label { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .06em; }
  .ta-title { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; color: var(--text); }
  .ta-body { font-size: 13.5px; color: var(--text-2); line-height: 1.5; }
  .ta-avatar { border-radius: 50%; background: var(--grad); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; box-shadow: 0 2px 6px rgba(79,70,229,0.25); }
  .ta-tag { padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 700; background: var(--surface-2); color: var(--primary); display:inline-flex; align-items:center; gap:4px; }
  .ta-divider { height: 1px; background: var(--border); border: none; margin: 16px 0; }
  .ta-table { width: 100%; border-collapse: collapse; }
  .ta-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); }
  .ta-table-wrap .ta-table { min-width: 560px; }
  .ta-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-3); font-weight: 700; padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--surface-3); }
  .ta-table td { padding: 14px 16px; font-size: 13.5px; border-bottom: 1px solid var(--border); color: var(--text); }
  .ta-table tr:last-child td { border-bottom: none; }
  .ta-table tr:hover td { background: var(--surface-2); }
  .ta-progress-track { width: 100%; height: 7px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
  .ta-progress-fill { height: 100%; border-radius: 99px; background: var(--grad); transition: width .3s ease; }
  .ta-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--border); overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin; margin-bottom: 20px; }
  .ta-tab { padding: 11px 8px; margin-right: 14px; font-size: 14px; font-weight: 700; color: var(--text-2); cursor: pointer; border-bottom: 2.5px solid transparent; white-space: nowrap; flex-shrink: 0; transition: all .15s ease; }
  .ta-tab:hover { color: var(--text); }
  .ta-tab.active { color: var(--primary); border-color: var(--primary); }
  .ta-pill { padding: 6px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 700; cursor: pointer; border: 1px solid var(--border); color: var(--text-2); background: var(--surface); transition: all .14s ease; }
  .ta-pill:hover { background: var(--surface-2); color: var(--text); }
  .ta-pill.active { background: var(--primary); color: #fff; border-color: var(--primary); box-shadow: 0 2px 8px rgba(79,70,229,0.3); }
  .ta-switch { width: 42px; height: 24px; border-radius: 99px; background: var(--surface-2); position: relative; cursor: pointer; flex-shrink: 0; transition: background .15s ease; border: 1px solid var(--border); }
  .ta-switch.on { background: var(--primary); border-color: var(--primary); }
  .ta-switch-knob { width: 18px; height: 18px; border-radius: 50%; background: #fff; position: absolute; top: 2px; left: 2px; transition: left .15s ease; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  .ta-switch.on .ta-switch-knob { left: 20px; }
  .ta-input { width: 100%; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); padding: 11px 14px; font-size: 13.5px; color: var(--text); font-family: var(--font); transition: all .15s ease; }
  .ta-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
  .ta-empty { text-align: center; padding: 36px 18px; color: var(--text-2); font-size: 13.5px; }
  .ta-fade { animation: fadeIn .18s ease-out both; }
  @keyframes taDropdownIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  .anim-slide-down { animation: taDropdownIn .16s ease both; transform-origin: top; }
  .ta-dropdown-item { padding: 9px 12px; border-radius: 9px; font-size: 13px; font-weight: 600; color: var(--text-2); cursor: pointer; transition: all .14s ease; }
  .ta-dropdown-item:hover { background: var(--surface-2); color: var(--text); }
  @keyframes taStaggerIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .anim-stagger > * { opacity: 0; animation: taStaggerIn .3s ease both; }
  .anim-stagger > *:nth-child(1) { animation-delay: .02s; }
  .anim-stagger > *:nth-child(2) { animation-delay: .06s; }
  .anim-stagger > *:nth-child(3) { animation-delay: .10s; }
  .anim-stagger > *:nth-child(4) { animation-delay: .14s; }
  .anim-stagger > *:nth-child(5) { animation-delay: .18s; }
  .anim-stagger > *:nth-child(6) { animation-delay: .22s; }
  .anim-stagger > *:nth-child(n+7) { animation-delay: .26s; }
`;

export function Avatar({ initials, size = 36, style = {} }) {
  return <div className="ta-avatar" style={{ width: size, height: size, fontSize: size * 0.36, ...style }}>{initials}</div>;
}

export function ProgressBar({ value, height = 7 }) {
  return <div className="ta-progress-track" style={{ height }}><div className="ta-progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%`, height }} /></div>;
}

export function Tag({ children, tone, icon: Icon }) {
  const bg = tone === "success" ? "var(--success-bg)" : tone === "warning" ? "var(--warning-bg)" : tone === "danger" ? "var(--danger-bg)" : "var(--primary-tint)";
  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : "var(--primary)";
  const border = tone === "success" ? "var(--success-border)" : tone === "warning" ? "var(--warning-border)" : tone === "danger" ? "var(--danger-border)" : "transparent";
  return (
    <span className="ta-tag" style={{ background: bg, color, border: `1px solid ${border}` }}>
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
    <div className="ta-card ta-card-hover" style={{ width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <div className="ta-row ta-between" style={{ gap: 8, alignItems: "center" }}>
          <span className="ta-label" style={{ minWidth: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1.3, wordBreak: "break-word" }}>{stat.label}</span>
          {Icon && (
            <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={18} color="var(--primary)" />
            </div>
          )}
        </div>
        <div className="ta-row ta-between ta-mt12" style={{ alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: "clamp(22px, 3.5vw, 26px)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1 }}>{stat.value}</div>
          {stat.delta && (
            <div className="ta-row ta-gap4" style={{ fontSize: 11.5, fontWeight: 700, color: stat.up ? "var(--success)" : "var(--danger)", background: stat.up ? "var(--success-bg)" : "var(--danger-bg)", border: `1px solid ${stat.up ? "var(--success-border)" : "var(--danger-border)"}`, padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>
              {stat.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {stat.delta}
            </div>
          )}
        </div>
      </div>
      {stat.sub && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8, fontWeight: 500, lineHeight: 1.4 }}>{stat.sub}</div>}
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
export function BrandLogo({ height = 22, isMinimized = false, style = {} }) {
  const isDark = typeof document !== "undefined" && (document.documentElement.classList.contains("dark") || localStorage.getItem("trainai_theme_dark") === "true");
  const src = isDark ? "/logo-dark.png" : "/train-ai-logo.png";
  return (
    <img
      src={src}
      alt="Train AI"
      style={{
        height: isMinimized ? Math.round(height * 0.72) : height,
        width: "auto",
        objectFit: "contain",
        display: "block",
        ...style
      }}
    />
  );
}

export function OwnerSidebar({ screen, setScreen, mobileOpen, onClose, onOpenDashboardSwitcher }) {
  const [isMinimized, setIsMinimized] = useState(() => localStorage.getItem("ta_owner_sidebar_minimized") === "true");

  const toggleMinimized = () => {
    setIsMinimized(prev => {
      const next = !prev;
      localStorage.setItem("ta_owner_sidebar_minimized", String(next));
      return next;
    });
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="ta-scrim ta-scrim-sidebar"
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,23,42,.45)" }}
        />
      )}
      <div className={`ta-sidebar ${mobileOpen ? "mobile-open" : ""} ${isMinimized ? "ta-sidebar-minimized" : ""}`}>
        <div className="ta-row ta-between" style={{ padding: isMinimized ? "0 0 14px" : "0 4px 16px" }}>
          <div className="ta-brand" style={{ padding: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <BrandLogo height={22} isMinimized={isMinimized} />
            {!isMinimized && (
              <span className="ta-brand-tag" style={{ marginLeft: "auto", background: "linear-gradient(135deg, #F59E0B, #EF4444)", color: "#FFFFFF" }}>OWNER</span>
            )}
          </div>
          <button className="ta-sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>

        {/* Minimize / Expand Toggle */}
        <button
          className="ta-toggle-btn"
          onClick={toggleMinimized}
          title={isMinimized ? "Expand sidebar" : "Minimize to icons"}
          aria-label={isMinimized ? "Expand sidebar" : "Minimize to icons"}
        >
          {isMinimized ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        {!isMinimized && <div className="ta-nav-section-title">Platform Owner</div>}
        <div className="ta-nav">
          {SUPERADMIN_NAV.map(s => {
            const Icon = s.icon;
            const isActive = screen === s.key;
            return (
              <div
                key={s.key}
                className={`ta-nav-item ${isActive ? "active" : ""}`}
                onClick={() => { setScreen(s.key); onClose(); }}
                title={s.label}
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
              style={{ background: "var(--primary-tint)", color: "var(--primary)", border: "1px solid #E0E7FF", fontWeight: 700 }}
              onClick={() => { onOpenDashboardSwitcher(); onClose(); }}
              title="Switch Dashboard"
            >
              <Repeat size={16} />
              <span>Switch Dashboard</span>
              {!isMinimized && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function Sidebar({ workspace, setWorkspace, screen, setScreen, mobileOpen, onClose, onOpenDashboardSwitcher, userRoles = ["admin", "mentor", "super_admin"] }) {
  const [isMinimized, setIsMinimized] = useState(() => localStorage.getItem("ta_sidebar_minimized") === "true");
  const allowedWorkspaces = WORKSPACES.filter(w => w.roles.some(r => userRoles.includes(r)));
  const navItems = NAV_BY_WORKSPACE[workspace] || MENTOR_NAV;

  const toggleMinimized = () => {
    setIsMinimized(prev => {
      const next = !prev;
      localStorage.setItem("ta_sidebar_minimized", String(next));
      return next;
    });
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="ta-scrim ta-scrim-sidebar"
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,23,42,.45)" }}
        />
      )}
      <div className={`ta-sidebar ${mobileOpen ? "mobile-open" : ""} ${isMinimized ? "ta-sidebar-minimized" : ""}`}>
        <div className="ta-row ta-between" style={{ padding: isMinimized ? "0 0 14px" : "0 4px 16px" }}>
          <div className="ta-brand" style={{ padding: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <BrandLogo height={22} isMinimized={isMinimized} />
            {!isMinimized && <span className="ta-brand-tag" style={{ marginLeft: "auto" }}>PRO</span>}
          </div>
          <button className="ta-sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>

        {/* Minimize / Expand Toggle */}
        <button
          className="ta-toggle-btn"
          onClick={toggleMinimized}
          title={isMinimized ? "Expand sidebar" : "Minimize to icons"}
          aria-label={isMinimized ? "Expand sidebar" : "Minimize to icons"}
        >
          {isMinimized ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        {!isMinimized && <div className="ta-nav-section-title">Workspaces</div>}
        <div className="ta-workspace-card">
          {allowedWorkspaces.map(w => {
            const Icon = w.icon;
            const isActive = workspace === w.key;
            return (
              <div
                key={w.key}
                className={`ta-ws-item ${isActive ? "active" : ""}`}
                onClick={() => { setWorkspace(w.key); onClose(); }}
                title={w.label}
              >
                <Icon size={16} />
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, flex: 1, minWidth: 0 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {!isMinimized && <div className="ta-nav-section-title">Navigation</div>}
        <div className="ta-nav">
          {navItems.map(s => {
            const Icon = s.icon;
            const isActive = screen === s.key;
            return (
              <div
                key={s.key}
                className={`ta-nav-item ${isActive ? "active" : ""}`}
                onClick={() => { setScreen(s.key); onClose(); }}
                title={s.label}
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
              style={{ background: "var(--primary-tint)", color: "var(--primary)", border: "1px solid #E0E7FF", fontWeight: 700 }}
              onClick={() => { onOpenDashboardSwitcher(); onClose(); }}
              title="Switch Dashboard"
            >
              <Repeat size={16} />
              <span>Switch Dashboard</span>
              {!isMinimized && <ChevronRight size={14} style={{ marginLeft: "auto" }} />}
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
    <PortalModal
      isOpen={true}
      onClose={onClose}
      maxWidth={480}
      zIndex={9999}
    >
      <div className="ta-row ta-between">
        <div className="ta-row ta-gap8">
          <Repeat size={18} color="var(--primary)" />
          <div className="ta-title" style={{ fontSize: 18 }}>Dashboard Switcher</div>
        </div>
        <div className="ta-row ta-gap8">
          {roleLabel && <Tag tone="warning">{roleLabel}</Tag>}
          <button className="ta-btn ta-btn-ghost ta-btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6, marginBottom: 18 }}>
        Switch between your authorized dashboard workspaces without changing your saved account role.
      </div>
      <div className="ta-col ta-gap10">
        {availableDashboards.map((key) => {
          const Icon = DASHBOARD_ICONS[key];
          const meta = DASHBOARD_META[key];
          const isActive = key === currentDashboard;
          return (
            <div
              key={key}
              className={`ta-ws-item ${isActive ? "active" : ""}`}
              style={{ padding: "14px 16px", borderRadius: 14, cursor: isActive ? "default" : "pointer" }}
              onClick={() => { if (!isActive) onSwitch(key); }}
            >
              <Icon size={20} />
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{meta.label}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{meta.subtitle}</span>
              </div>
              {isActive && <Check size={18} />}
            </div>
          );
        })}
      </div>
    </PortalModal>
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

export function TopBar({ title, sub, right, orgSelector, profileQuery, onNavigate, onSignOut }) {
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
  const [isDarkTheme, setIsDarkTheme] = useState(() => getStoredThemeDark());
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    const syncTheme = () => {
      setIsDarkTheme(getStoredThemeDark());
    };
    window.addEventListener("storage", syncTheme);
    window.addEventListener("trainai-theme-change", syncTheme);
    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("trainai-theme-change", syncTheme);
    };
  }, []);

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
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
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
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 190 }}
                onClick={() => setIsSearchOpen(false)}
              />
              <div
                className="ta-card anim-slide-down"
                style={{
                  position: "absolute",
                  top: 48,
                  left: 0,
                  width: 380,
                  maxHeight: "65vh",
                  overflowY: "auto",
                  padding: "8px 0",
                  zIndex: 200,
                  boxShadow: "0 14px 36px -8px rgba(15,23,42,0.22)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)"
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
          </>
          )}
        </div>

        {/* Theme Toggle (Dark / Light) - full button on desktop, folded into
            the mobile "more" menu below instead of shown here, so it isn't
            a 6th thing competing for room in an already-tight mobile header. */}
        <button
          className="ta-btn ta-btn-outline ta-header-full-only"
          style={{ width: 42, height: 42, padding: 0, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          onClick={() => {
            const next = !isDarkTheme;
            setIsDarkTheme(next);
            setGlobalThemeDark(next);
          }}
          title={isDarkTheme ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDarkTheme ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkTheme ? <Sun size={17} color="#FBBF24" /> : <Moon size={17} color="var(--text-2)" />}
        </button>

        {/* Notifications icon - desktop only; purely decorative (no real
            feed to back it yet), so it isn't worth a slot in the mobile
            menu either. */}
        <div className="ta-header-full-only" style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <Bell size={17} color="var(--text-2)" />
        </div>

        {/* Primary Header Quick Action - full-size on desktop, replicated
            (not dropped) inside the mobile "more" menu below. */}
        <div className="ta-header-full-only">
          {right}
        </div>

        {/* User Profile Pill - opens the real Settings Hub. Always visible -
            this is the one action worth a permanent, dedicated slot. */}
        <div
          className="ta-row ta-gap8 ta-profile-pill"
          style={{ background: "var(--surface)", padding: "4px 10px 4px 4px", borderRadius: 12, border: "1px solid var(--border)", cursor: canOpenOwnSettings ? "pointer" : "default", flexShrink: 0 }}
          onClick={() => canOpenOwnSettings && onNavigate("settings")}
        >
          <Avatar initials={userInitials} size={32} />
          <div className="ta-col ta-profile-pill-text" style={{ lineHeight: 1.2, paddingRight: 4 }}>
            <span className="ta-profile-pill-name" style={{ fontSize: 12, fontWeight: 700 }}>{userDisplayName.split(" ")[0]}</span>
            <span className="ta-profile-pill-name" style={{ fontSize: 10, color: "var(--text-3)", textTransform: "capitalize" }}>{profileQuery?.data?.role || "Admin"}</span>
          </div>
        </div>

        {/* Sign Out Action - full button on desktop, replicated inside the
            mobile "more" menu below. */}
        <button
          className="ta-btn ta-btn-ghost ta-btn-sm ta-header-full-only"
          onClick={onSignOut || (() => { localStorage.removeItem("trainai_active_session_v1"); window.location.reload(); })}
          title="Sign Out"
          aria-label="Sign out"
          style={{ color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>

        {/* Mobile-only "more" menu - replaces the theme toggle, quick action
            and sign out above (hidden on mobile via .ta-header-full-only)
            with one tap target instead of 3-4 separate icons crowding the
            header. Every action is still fully reachable, just consolidated. */}
        <div ref={moreMenuRef} className="ta-header-mobile-only" style={{ position: "relative" }}>
          <button
            style={{ width: 38, height: 38, padding: 0, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            onClick={() => setIsMoreMenuOpen(v => !v)}
            aria-label="More options"
          >
            <MoreVertical size={18} color="var(--text-2)" />
          </button>
          {isMoreMenuOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 240 }}
                onClick={() => setIsMoreMenuOpen(false)}
              />
              <div className="ta-card anim-slide-down" style={{ position: "absolute", top: 46, right: 0, width: 230, padding: "8px 6px", zIndex: 250, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "0 14px 36px -8px rgba(15,23,42,0.3)" }}>
                <div
                  className="ta-dropdown-item ta-row ta-gap8"
                  style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                  onClick={() => { const next = !isDarkTheme; setIsDarkTheme(next); setGlobalThemeDark(next); setIsMoreMenuOpen(false); }}
                >
                  {isDarkTheme ? <Sun size={16} color="#FBBF24" /> : <Moon size={16} color="var(--text-2)" />}
                  <span>{isDarkTheme ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
                </div>
                {canOpenOwnSettings && (
                  <div
                    className="ta-dropdown-item ta-row ta-gap8"
                    style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                    onClick={() => { setIsMoreMenuOpen(false); onNavigate("settings"); }}
                  >
                    <Settings size={16} color="var(--text-2)" />
                    <span>Settings &amp; Preferences</span>
                  </div>
                )}
                <div className="ta-divider" style={{ margin: "6px 0" }} />
                <div
                  className="ta-dropdown-item ta-row ta-gap8"
                  style={{ color: "var(--danger)", padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    (onSignOut || (() => { localStorage.removeItem("trainai_active_session_v1"); window.location.reload(); }))();
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </div>
              </div>
            </>
          )}
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
