import React, { useContext, useState, useEffect, useRef } from "react";
import {
  Building2, GraduationCap, ShieldCheck, LayoutDashboard, Users, BookOpen, BarChart3,
  Layers, Plug, Briefcase, Settings, Calendar, MessageSquare, MessagesSquare, Map, Mail,
  Repeat, LogOut, Search, Bell, Menu, X, ArrowUpRight, ArrowDownRight, Zap, ChevronRight, Flag, Palette, Rocket, Brain, LifeBuoy,
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
    --grad: #4F46E5;
    --grad-subtle: #EEF2FF;
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
    --radius: 10px;
    --radius-sm: 6px;
    --shadow-card: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 2px 8px -1px rgba(15, 23, 42, 0.02);
    --shadow-hover: 0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.02);
    --shadow-btn: none;
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
    --primary: #818CF8;
    --primary-dark: #6366F1;
    --primary-light: #A5B4FC;
    --primary-hover: #93C5FD;
    --primary-tint: rgba(99, 102, 241, 0.18);
    --text: #F8FAFC;
    --text-2: #94A3B8;
    --text-3: #64748B;
    --border: rgba(255, 255, 255, 0.08);
    --border-subtle: rgba(255, 255, 255, 0.05);
    --success-bg: rgba(16, 185, 129, 0.18);
    --success-border: rgba(16, 185, 129, 0.35);
    --warning-bg: rgba(245, 158, 11, 0.18);
    --warning-border: rgba(245, 158, 11, 0.35);
    --danger-bg: rgba(239, 68, 68, 0.18);
    --danger-border: rgba(239, 68, 68, 0.35);
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
    display: flex; flex-direction: column; padding: 18px 12px;
    position: fixed; top: 0; left: 0; height: 100vh; height: 100dvh;
    color: var(--text); box-shadow: 1px 0 6px rgba(15,23,42,0.02);
    transition: width .2s ease, padding .2s ease;
    z-index: 30;
  }
  .ta-sidebar.ta-sidebar-minimized {
    width: 68px; padding: 18px 6px;
  }
  .ta-sidebar.ta-sidebar-minimized .ta-brand-name,
  .ta-sidebar.ta-sidebar-minimized .ta-brand-tag,
  .ta-sidebar.ta-sidebar-minimized .ta-nav-section-title,
  .ta-sidebar.ta-sidebar-minimized .ta-nav-item span,
  .ta-sidebar.ta-sidebar-minimized .ta-ws-item span,
  .ta-sidebar.ta-sidebar-minimized .ta-ws-item div,
  .ta-sidebar.ta-sidebar-minimized .ta-ws-item > div,
  .ta-sidebar.ta-sidebar-minimized .ta-nav-item svg:last-child {
    display: none !important;
  }
  .ta-sidebar.ta-sidebar-minimized .ta-workspace-card {
    padding: 2px;
    margin-bottom: 8px;
    background: var(--surface-2);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    width: 100%;
    box-sizing: border-box;
  }
  .ta-sidebar.ta-sidebar-minimized .ta-ws-item,
  .ta-sidebar.ta-sidebar-minimized .ta-nav-item {
    width: 100%;
    min-height: 38px;
    height: 38px;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 0 !important;
    box-sizing: border-box;
  }
  .ta-sidebar.ta-sidebar-minimized .ta-ws-item svg,
  .ta-sidebar.ta-sidebar-minimized .ta-nav-item svg {
    margin: 0 auto !important;
    flex-shrink: 0 !important;
  }
  .ta-sidebar.ta-sidebar-minimized .ta-brand {
    justify-content: center; padding: 0 0 14px;
  }
  .ta-brand { display: flex; align-items: center; gap: 10px; padding: 4px 6px 14px; }
  .ta-brand-mark {
    width: 32px; height: 32px; border-radius: 8px; background: #4F46E5;
    display:flex; align-items:center; justify-content:center; flex-shrink:0; color: #fff;
  }
  .ta-brand-name { font-weight: 800; font-size: 16px; letter-spacing: -0.02em; color: var(--text); }
  .ta-brand-tag { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; background: var(--primary-tint); color: var(--primary); padding: 2px 6px; border-radius: 4px; }
  .ta-sidebar-scroll {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 2px;
  }
  .ta-sidebar-scroll::-webkit-scrollbar { width: 4px; }
  .ta-sidebar-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
  .ta-nav { display: flex; flex-direction: column; gap: 2px; }
  .ta-nav-section-title {
    font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3);
    padding: 10px 8px 3px; margin-top: 4px;
  }
  /* .ta-iconbtn was already used by admin screens (Learning Paths' reorder and
     delete controls) but was never defined anywhere in TOKENS, so those
     buttons fell back to the browser's default button chrome. The new
     People/Paths/Builder controls lean on it heavily, so it gets a real
     definition here. */
  .ta-iconbtn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; flex-shrink: 0;
    border-radius: 8px; border: 1px solid var(--glass-border); background: var(--glass-surface);
    backdrop-filter: var(--glass-blur-xs); -webkit-backdrop-filter: var(--glass-blur-xs);
    box-shadow: inset 0 1px 0 var(--glass-specular);
    color: var(--text-2); cursor: pointer; font-size: 13px; line-height: 1;
    transition: all .16s cubic-bezier(0.16, 1, 0.3, 1); padding: 0;
  }
  .ta-iconbtn:hover:not(:disabled) {
    background: var(--glass-elevated); color: var(--text); border-color: rgba(99, 102, 241, 0.35); box-shadow: var(--shadow-hover);
  }
  .ta-iconbtn:active:not(:disabled) { transform: scale(.95); }
  .ta-iconbtn:disabled { opacity: .4; cursor: not-allowed; }
  .ta-nav-item {
    display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; cursor: pointer;
    font-size: 13px; font-weight: 600; color: var(--text-2); transition: all .16s ease; line-height: 1.4;
    min-height: 34px; box-sizing: border-box;
  }
  .ta-nav-item:hover {
    background: var(--glass-surface); color: var(--text);
    transform: translateX(2px);
    box-shadow: inset 0 1px 0 var(--glass-specular);
  }
  .ta-nav-item.active {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(99, 102, 241, 0.18) 100%) !important;
    color: #4F46E5 !important; font-weight: 700;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(79, 70, 229, 0.12);
  }
  .ta.dark .ta-nav-item.active, html.dark .ta-nav-item.active {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.28) 0%, rgba(99, 102, 241, 0.38) 100%) !important;
    color: #A5B4FC !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(0, 0, 0, 0.4) !important;
    border: 1px solid rgba(165, 180, 252, 0.25) !important;
  }
  .ta-nav-divider { height: 1px; background: var(--glass-border); margin: 8px 4px; }
  .ta-workspace-card {
    background: var(--glass-surface); backdrop-filter: blur(8px);
    border: 1px solid var(--glass-border); border-radius: 8px; padding: 3px;
    margin-bottom: 6px; display: flex; flex-direction: column; gap: 2px;
    box-shadow: inset 0 1px 0 var(--glass-specular);
  }
  .ta-ws-item {
    display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer;
    font-size: 12.5px; font-weight: 600; color: var(--text-2); transition: all .14s ease; line-height: 1.35;
    background: transparent;
  }
  .ta-ws-item:hover { background: var(--glass-elevated); color: var(--text); }
  .ta-ws-item.active {
    background: var(--glass-surface-solid) !important;
    color: var(--primary) !important;
    font-weight: 700;
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
  }
  .ta.dark .ta-ws-item.active, html.dark .ta-ws-item.active {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.28) 0%, rgba(99, 102, 241, 0.38) 100%) !important;
    color: #A5B4FC !important;
    font-weight: 700;
    border: 1px solid rgba(165, 180, 252, 0.30) !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 8px rgba(0, 0, 0, 0.4) !important;
  }
  .ta-nav-footer { display:flex; flex-direction:column; gap:3px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--glass-border); }
  .ta-toggle-btn {
    display: flex; align-items: center; justify-content: center; width: 100%; height: 32px; border-radius: 6px;
    border: 1px solid var(--glass-border); background: var(--glass-surface); color: var(--text-2); cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all .15s ease; margin-bottom: 8px;
  }
  .ta-toggle-btn:hover { background: var(--glass-elevated); color: var(--primary); border-color: rgba(99, 102, 241, 0.35); }
  .ta-main { flex: 1; min-width: 0; margin-left: var(--sidebar-w); transition: margin-left .2s ease; }
  .ta-sidebar.ta-sidebar-minimized + .ta-main { margin-left: 68px; }
  .ta-topbar {
    min-height: 54px; height: auto;
    border-bottom: 1px solid var(--glass-border); background: var(--glass-elevated);
    backdrop-filter: var(--glass-blur-lg); -webkit-backdrop-filter: var(--glass-blur-lg);
    box-shadow: var(--glass-shadow);
    display: flex; align-items: center; justify-content: space-between; padding: 8px clamp(12px, 1.8vw, 20px); position: sticky; top: 0; z-index: 50;
    box-sizing: border-box; width: 100%; gap: 12px;
  }
  .ta-topbar-left { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; min-width: min-content; max-width: 45%; }
  .ta-topbar-right { display: flex; align-items: center; gap: 8px; flex: 1 1 auto; justify-content: flex-end; min-width: 0; flex-wrap: wrap; }
  .ta-search {
    display:flex; align-items:center; gap:6px;
    background: var(--glass-surface); backdrop-filter: var(--glass-blur-sm); -webkit-backdrop-filter: var(--glass-blur-sm);
    border: 1px solid var(--glass-border); border-radius: 8px; padding: 6px 10px; width: clamp(120px, 14vw, 190px);
    color: var(--text-2); font-size: 12px; transition: border-color .15s ease; flex-shrink: 1; min-width: 90px;
    box-shadow: inset 0 1px 0 var(--glass-specular);
  }
  .ta-search:focus-within { border-color: var(--primary); background: var(--glass-elevated); box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2), inset 0 1px 0 var(--glass-specular); }
  .ta-content { padding: 20px clamp(14px, 2vw, 28px) 64px; max-width: 1560px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  .ta-h1 { font-size: clamp(14px, 1.2vw, 16px); font-weight: 800; letter-spacing: -0.015em; margin: 0; color: var(--text); line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ta-sub { font-size: 11.5px; color: var(--text-3); margin: 2px 0 0; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media (min-width: 900px) {
    .ta-menu-btn, .ta-sidebar-close { display: none !important; }
    .ta-header-mobile-only { display: none !important; }
  }
  .ta-hero-banner {
    border-radius: 14px;
    background: #0F172A;
    color: #FFFFFF;
    padding: clamp(18px, 2vw, 24px) clamp(20px, 2.2vw, 28px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 8px 24px rgba(15, 23, 42, 0.35);
    border: 1px solid #1E293B;
    position: relative;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
  }
  .ta.dark .ta-hero-banner, html.dark .ta-hero-banner {
    background: var(--surface) !important;
    color: var(--text) !important;
    border: 1px solid var(--border) !important;
    box-shadow: inset 0 1px 0 var(--glass-specular), 0 12px 36px -4px rgba(0, 0, 0, 0.65) !important;
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
    font-size: clamp(20px, 1.8vw, 25px);
    font-weight: 900;
    letter-spacing: -0.025em;
    margin: 0 0 4px;
    color: #FFFFFF;
    line-height: 1.25;
  }
  .ta.dark .ta-hero-title, html.dark .ta-hero-title {
    color: var(--text) !important;
  }
  .ta-hero-desc {
    font-size: clamp(12.5px, 1vw, 13.5px);
    color: #94A3B8;
    margin: 0;
    max-width: 680px;
    line-height: 1.5;
  }
  .ta.dark .ta-hero-desc, html.dark .ta-hero-desc {
    color: var(--text-2) !important;
  }
  .ta-hero-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
    align-items: center;
  }

  @media (max-width: 899px) {
    .ta-menu-btn { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); cursor: pointer; flex-shrink: 0; }
    .ta-search { display: none; }
    .ta-main, .ta-sidebar.ta-sidebar-minimized + .ta-main { margin-left: 0; }
    .ta-header-full-only { display: none !important; }
    .ta-header-mobile-only { display: block; }
    .ta-topbar {
      padding: 6px 12px; min-height: 52px; height: auto; max-height: none;
      display: flex; align-items: center; justify-content: space-between;
      box-sizing: border-box; width: 100%; position: sticky; top: 0; z-index: 50; background: var(--surface);
      gap: 8px;
    }
    .ta-topbar-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1 1 auto; }
    .ta-topbar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex: 0 0 auto; }
    .ta-topbar-right .ta-btn {
      height: 32px !important;
      padding: 0 10px !important;
      font-size: 11.5px !important;
      border-radius: 6px !important;
      gap: 4px !important;
    }
    .ta-profile-pill { padding: 3px !important; }
    .ta-content { padding: 14px 14px calc(80px + env(safe-area-inset-bottom)); width: 100%; box-sizing: border-box; }
    .ta-sidebar {
      position: fixed; top: 0; left: 0; z-index: 100;
      transform: translateX(-100%); transition: transform .2s ease;
      box-shadow: 4px 0 18px rgba(15,23,42,.15);
    }
    .ta-sidebar.mobile-open { transform: translateX(0); }
    .ta-sidebar-close {
      display: flex !important; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 6px; border: none; background: var(--surface-2); cursor: pointer; color: var(--text-2);
    }
    .ta-scrim { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 90; }
    .ta-profile-pill-name { max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ta-org-selector { display: none !important; }
    .ta-h1 {
      font-size: clamp(13.5px, 4vw, 15px) !important;
      font-weight: 800 !important;
      line-height: 1.25 !important;
      color: var(--text) !important;
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: clip !important;
      word-break: normal !important;
      overflow-wrap: break-word !important;
    }
    .ta-sub { display: none !important; }
    .ta-table-wrap .ta-table { min-width: 460px; }
    .ta-grid-5, .ta-grid-4, .ta-grid-3 { grid-template-columns: repeat(2, 1fr); gap: 12px; }

    .ta-tabs, .ta-pills-row {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
      flex-wrap: nowrap !important;
      scrollbar-width: none;
      padding-bottom: 2px;
    }
    .ta-tabs::-webkit-scrollbar, .ta-pills-row::-webkit-scrollbar { display: none; }
    .ta-tab, .ta-pill { flex-shrink: 0 !important; white-space: nowrap !important; }

    .ta-hero-banner {
      padding: 14px 12px !important;
      border-radius: 12px !important;
    }
    .ta-hero-inner {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 10px !important;
    }
    .ta-hero-text {
      width: 100% !important;
      flex: none !important;
    }
    .ta-hero-title {
      font-size: clamp(18px, 4.5vw, 22px) !important;
      line-height: 1.25 !important;
      margin-bottom: 6px !important;
      color: var(--text) !important;
      word-break: normal !important;
      overflow-wrap: break-word !important;
    }
    .ta-hero-desc {
      font-size: 13px !important;
      line-height: 1.45 !important;
      color: var(--text-2) !important;
      max-width: 100% !important;
    }
    .ta-hero-actions {
      width: 100% !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
    }
    .ta-hero-actions .ta-btn, .ta-hero-actions button {
      padding: 7px 14px !important;
      font-size: 12px !important;
      border-radius: 8px !important;
    }
  }
  @media (max-width: 640px) {
    .ta-topbar { padding: 6px 10px; min-height: 50px; height: auto; }
    .ta-content { padding: 12px 12px calc(80px + env(safe-area-inset-bottom)); width: 100%; box-sizing: border-box; }
    .ta-card { padding: 16px 14px; border-radius: 10px; width: 100%; box-sizing: border-box; }
    .ta-h1 { font-size: 13.5px !important; font-weight: 800 !important; line-height: 1.25 !important; white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }
    .ta-btn { padding: 7px 12px; font-size: 12px; border-radius: 8px; }
    .ta-grid, .ta-grid-5, .ta-grid-4, .ta-grid-3, .ta-grid-2 { grid-template-columns: 1fr !important; gap: 12px !important; width: 100% !important; }
  }
  .ta-btn { border: none; cursor: pointer; border-radius: 8px; font-weight: 600; font-size: 13px; padding: 9px 16px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all .16s cubic-bezier(0.16, 1, 0.3, 1); font-family: var(--font); user-select: none; }
  .ta-btn-primary {
    background: #4F46E5 !important;
    color: #FFFFFF !important;
    border: 1px solid rgba(255, 255, 255, 0.20) !important;
    box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.32), 0 4px 14px -2px rgba(79, 70, 229, 0.40) !important;
  }
  .ta-btn-primary:hover {
    background: #4338CA !important;
    box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.45), 0 6px 20px -2px rgba(79, 70, 229, 0.50) !important;
    transform: translateY(-1.5px);
  }
  .ta-btn-primary:active {
    background: #3730A3 !important;
    transform: translateY(1px) scale(0.975);
    box-shadow: inset 0 1px 0 0 rgba(0, 0, 0, 0.15), 0 2px 6px rgba(79, 70, 229, 0.30) !important;
  }
  .ta-btn-outline {
    background: var(--glass-surface) !important;
    backdrop-filter: var(--glass-blur-sm) !important;
    -webkit-backdrop-filter: var(--glass-blur-sm) !important;
    border: 1px solid var(--glass-border) !important;
    color: var(--text) !important;
    box-shadow: inset 0 1px 0 var(--glass-specular), var(--shadow-card) !important;
  }
  .ta-btn-outline:hover {
    background: var(--glass-elevated) !important;
    border-color: rgba(99, 102, 241, 0.35) !important;
    transform: translateY(-1.5px);
    color: var(--primary) !important;
  }
  .ta-btn-outline:active { transform: translateY(1px) scale(0.975); }
  .ta-btn-ghost { background: var(--surface-2); color: var(--primary); font-weight: 700; }
  .ta-btn-ghost:hover { background: #E0E7FF; }
  .ta-btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 6px; }
  .ta-btn-danger { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); }
  
  .ta-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: clamp(16px, 2.5vw, 20px);
    box-shadow: var(--shadow-card);
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .ta.dark .ta-card, html.dark .ta-card, html.dark .ta .ta-card {
    background: var(--surface) !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
    box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.45) !important;
  }
  .ta-card-hover {
    cursor: pointer;
  }
  .ta-card-hover:hover {
    box-shadow: var(--shadow-hover);
    border-color: #CBD5E1;
  }
  .ta.dark .ta-card-hover:hover, html.dark .ta .ta-card-hover:hover {
    box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.6) !important;
    border-color: rgba(129, 140, 248, 0.35) !important;
  }
  .ta-grid { display: grid; gap: 16px; }
  .ta-grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .ta-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .ta-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ta-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (min-width: 641px) and (max-width: 1080px) {
    .ta-grid-5, .ta-grid-4, .ta-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
  }
  .ta-sidebar-layout { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; }
  @media (min-width: 900px) {
    .ta-sidebar-layout { grid-template-columns: minmax(0, 2fr) minmax(300px, 360px); gap: 20px; }
  }
  .ta-row { display: flex; align-items: center; }
  .ta-between { justify-content: space-between; }
  .ta-col { display: flex; flex-direction: column; }
  .ta-gap4 { gap: 4px; } .ta-gap6 { gap: 6px; } .ta-gap8 { gap: 8px; } .ta-gap10 { gap: 10px; } .ta-gap12 { gap: 12px; } .ta-gap14 { gap: 14px; } .ta-gap16 { gap: 16px; } .ta-gap20 { gap: 20px; } .ta-gap24 { gap: 24px; }
  .ta-mt4 { margin-top: 4px; } .ta-mt6 { margin-top: 6px; } .ta-mt8 { margin-top: 8px; } .ta-mt10 { margin-top: 10px; } .ta-mt12 { margin-top: 12px; } .ta-mt14 { margin-top: 14px; } .ta-mt16 { margin-top: 16px; } .ta-mt18 { margin-top: 18px; } .ta-mt20 { margin-top: 20px; } .ta-mt24 { margin-top: 24px; } .ta-mt28 { margin-top: 28px; }
  .ta-label { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .06em; }
  .ta-title { font-size: 15px; font-weight: 800; letter-spacing: -0.01em; color: var(--text); }
  .ta-body { font-size: 13px; color: var(--text-2); line-height: 1.5; }
  .ta-avatar { border-radius: 50%; background: #4F46E5; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
  .ta-tag { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: var(--surface-2); color: var(--primary); display:inline-flex; align-items:center; gap:4px; }
  .ta-divider { height: 1px; background: var(--border); border: none; margin: 14px 0; }
  .ta-table { width: 100%; border-collapse: collapse; }
  .ta-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); }
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

// `src` support added so the directory can show a member's real avatar_url
// where one is set and fall back to initials otherwise. Without it the
// People screen had no way to render a real avatar at all, which is why it
// was previously generating throwaway stock-photo URLs per table row.
export function Avatar({ initials, size = 36, style = {}, src }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        className="ta-avatar"
        src={src}
        alt={initials || "Member"}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: "cover", flexShrink: 0, ...style }}
      />
    );
  }
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
    <div
      className={`ta-switch ${on ? "on" : ""}`}
      onClick={onChange}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange?.(e);
        }
      }}
    >
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

// The admin sidebar is grouped into labelled sections rather than one flat
// list of thirteen items. Sections and their contents mirror the reference
// app's AdminShell (Workspace / Analytics / Learning / People / Operations /
// Platform) - notably Operations, which had no equivalent here at all, and
// which is where Email Center and Payouts now live.
const ADMIN_NAV = [
  {
    section: "Workspace",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "workforce", label: "Workforce Intelligence", icon: Brain },
    ],
  },
  {
    section: "Learning",
    items: [
      { key: "content", label: "Courses", icon: BookOpen },
      { key: "coursebuilder", label: "Course Builder", icon: Zap },
      { key: "paths", label: "Learning Paths", icon: Map },
      { key: "cohorts", label: "Cohorts & Batches", icon: Layers },
      { key: "compliance", label: "Learner Progress", icon: ShieldCheck },
      { key: "studygroups", label: "Study Groups", icon: Users },
    ],
  },
  {
    section: "People",
    items: [
      { key: "people", label: "Users & Access", icon: Users },
      { key: "roleaccess", label: "Role & Access Control", icon: ShieldCheck },
    ],
  },
  {
    section: "Operations",
    items: [
      { key: "emails", label: "Email Center", icon: Mail },
      { key: "payouts", label: "Payouts", icon: Briefcase },
      { key: "integrations", label: "Integrations", icon: Plug },
      { key: "moderation", label: "Content Moderation", icon: Flag },
    ],
  },
  {
    section: "Insights",
    items: [
      { key: "analytics", label: "Analytics Hub", icon: BarChart3 },
    ],
  },
  {
    section: "Platform",
    items: [
      { key: "settings", label: "Settings Hub", icon: Settings },
    ],
  },
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
              <span className="ta-brand-tag" style={{ marginLeft: "auto", background: "#F59E0B", color: "#FFFFFF" }}>OWNER</span>
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

        <div className="ta-sidebar-scroll">
          {!isMinimized && <div className="ta-nav-section-title" style={{ marginTop: 0 }}>Platform Owner</div>}
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
        </div>

        <div className="ta-nav-footer">
          {onOpenDashboardSwitcher && (
            <div
              className="ta-nav-item"
              style={{ background: "var(--primary-tint)", color: "var(--primary)", border: "1px solid var(--glass-border)", fontWeight: 700 }}
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
  // MENTOR_NAV / MANAGER_NAV / SUPERADMIN_NAV are still flat arrays - wrap
  // them in a single "Navigation" section so one render path handles both
  // shapes instead of duplicating the nav markup per workspace.
  const rawNav = NAV_BY_WORKSPACE[workspace] || MENTOR_NAV;
  const navSections = Array.isArray(rawNav) && rawNav.length && rawNav[0].items
    ? rawNav
    : [{ section: "Navigation", items: rawNav }];

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
        <div className="ta-row ta-between" style={{ padding: isMinimized ? "0 0 14px" : "0 4px 14px" }}>
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

        <div className="ta-sidebar-scroll">
          {!isMinimized && <div className="ta-nav-section-title" style={{ marginTop: 0 }}>Workspaces</div>}
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
                  <Icon size={17} style={{ flexShrink: 0 }} />
                  {!isMinimized && (
                    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, flex: 1, minWidth: 0 }}>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.label}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {navSections.map(group => (
            <div key={group.section} className="ta-nav-group">
              {!isMinimized && <div className="ta-nav-section-title">{group.section}</div>}
              <div className="ta-nav">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = screen === item.key;
                  return (
                    <div
                      key={item.key}
                      className={`ta-nav-item ${isActive ? "active" : ""}`}
                      onClick={() => { setScreen(item.key); onClose(); }}
                      title={item.label}
                    >
                      <Icon size={17} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="ta-nav-footer">
          {onOpenDashboardSwitcher && (
            <div
              className="ta-nav-item"
              style={{ background: "var(--primary-tint)", color: "var(--primary)", border: "1px solid var(--glass-border)", fontWeight: 700 }}
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
              style={{ padding: "14px 16px", borderRadius: 10, cursor: isActive ? "default" : "pointer" }}
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
          <div className="ta-row ta-gap6 ta-org-selector" style={{
            background: "var(--surface)",
            height: 34,
            padding: "2px 8px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            maxWidth: 190,
            flexShrink: 1,
            alignItems: "center"
          }}>
            <Building2 size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
            <div className="ta-col" style={{ lineHeight: 1.1, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Tenant</span>
              <select
                value={orgSelector.selectedOrgId || ""}
                onChange={(e) => orgSelector.onSelectOrg(e.target.value)}
                style={{
                  padding: 0,
                  fontSize: 11.5,
                  fontWeight: 700,
                  border: "none",
                  background: "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  outline: "none",
                  maxWidth: 135,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                <option value="">All Organizations (Global)</option>
                {(orgSelector.orgs || []).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <ChevronRight size={12} color="var(--text-3)" style={{ transform: "rotate(90deg)", flexShrink: 0 }} />
          </div>
        )}

        {/* Universal Search Bar with Live Results Popover */}
        <div className="ta-search" ref={searchRef} style={{ position: "relative", zIndex: 100 }}>
          <Search size={14} color="var(--text-3)" />
          <input
            type="text"
            placeholder="Search platform..."
            value={searchValue}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setIsSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsSearchOpen(false);
            }}
            style={{ border: "none", background: "transparent", width: "100%", fontSize: 12.5, color: "var(--text)", outline: "none", fontFamily: "var(--font)" }}
          />
          {searchValue ? (
            <X size={13} color="var(--text-3)" style={{ cursor: "pointer" }} onClick={() => { setSearchValue(""); setIsSearchOpen(false); }} />
          ) : (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-3)", background: "var(--surface)", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--border)" }}>⌘K</span>
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
                  top: 42,
                  left: 0,
                  width: 320,
                  maxHeight: "65vh",
                  overflowY: "auto",
                  padding: "6px 0",
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
        {/* Theme Toggle (Dark / Light) */}
        <button
          className="ta-btn ta-btn-outline ta-header-full-only"
          style={{ width: 34, height: 34, padding: 0, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          onClick={() => {
            const next = !isDarkTheme;
            setIsDarkTheme(next);
            setGlobalThemeDark(next);
          }}
          title={isDarkTheme ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDarkTheme ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkTheme ? <Sun size={15} color="#FBBF24" /> : <Moon size={15} color="var(--text-2)" />}
        </button>

        {/* Notifications icon */}
        <div className="ta-header-full-only" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bell size={15} color="var(--text-2)" />
        </div>

        {/* Primary Header Quick Action */}
        <div className="ta-header-full-only">
          {right}
        </div>

        {/* User Profile Pill */}
        <div
          className="ta-row ta-gap8 ta-profile-pill"
          style={{ background: "var(--surface)", height: 34, padding: "2px 8px 2px 4px", borderRadius: 8, border: "1px solid var(--border)", cursor: canOpenOwnSettings ? "pointer" : "default", flexShrink: 0, alignItems: "center" }}
          onClick={() => canOpenOwnSettings && onNavigate("settings")}
        >
          <Avatar initials={userInitials} size={26} />
          <div className="ta-col ta-profile-pill-text" style={{ lineHeight: 1.15, paddingRight: 2 }}>
            <span className="ta-profile-pill-name" style={{ fontSize: 11.5, fontWeight: 700 }}>{userDisplayName.split(" ")[0]}</span>
            <span className="ta-profile-pill-name" style={{ fontSize: 9.5, color: "var(--text-3)", textTransform: "capitalize" }}>{profileQuery?.data?.role || "Admin"}</span>
          </div>
        </div>

        {/* Sign Out Action */}
        <button
          className="ta-btn ta-btn-ghost ta-btn-sm ta-header-full-only"
          onClick={onSignOut || (() => { localStorage.removeItem("trainai_active_session_v1"); window.location.reload(); })}
          title="Sign Out"
          aria-label="Sign out"
          style={{ height: 34, padding: "0 8px", borderRadius: 8, color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}
        >
          <LogOut size={14} />
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
