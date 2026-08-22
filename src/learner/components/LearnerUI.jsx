import React, { useState, useContext } from "react";
import {
  Home, BookOpen, Zap, Users, Settings, ArrowLeft, GraduationCap, Bookmark, Clock, CheckCircle2,
  Repeat, ChevronRight, ChevronDown, ChevronUp, Bell, Sparkles, Flame, MessageSquare, Calendar,
  Compass, ShieldCheck, LogOut, Search, Award, BarChart3, HelpCircle, Layers, Mail, Trophy, UserCheck, Radio, Star,
  PanelLeftClose, PanelLeftOpen, Video
} from "lucide-react";
import { LearningPathsScreen } from "../screens/LearningPathsScreen.jsx";

// Lets any screen's shared TopBar show a real unread-notifications bell
// without threading unreadNotifs/push down through every screen's props.
// TrainAILearnerApp provides the real value once, near the root.
export const NotificationBellContext = React.createContext({ unread: 0, onOpen: null });

export const TOKENS = `
  .tai * { box-sizing: border-box; }
  .tai {
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
    --radius: 10px;
    --radius-sm: 6px;
    --shadow-card: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 2px 8px -1px rgba(15, 23, 42, 0.02);
    --shadow-hover: 0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.02);
    --shadow-btn: none;
    --font: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-family: var(--font);
    color: var(--text);
    transition: background .25s ease, color .25s ease;
  }
  .tai.dark {
    --bg: #090D1A;
    --surface: #121829;
    --surface-2: #1B243B;
    --surface-3: #161D31;
    --text: #F8FAFC;
    --text-2: #94A3B8;
    --text-3: #64748B;
    --border: #1E293B;
    --border-subtle: #161F33;
    --success-bg: #064E3B;
    --warning-bg: #451A03;
    --danger-bg: #450A0A;
  }
  .tai-app-outer { min-height: 100vh; min-height: 100dvh; background: var(--bg); display:flex; flex-direction:column; width: 100%; box-sizing: border-box; }
  
  /* Top Full-Width Learner Global Header */
  .tai-global-header {
    height: 54px; min-height: 54px; width: 100%; max-width: 100%; background: var(--surface); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(14px, 2vw, 24px);
    position: sticky; top: 0; z-index: 60; box-shadow: 0 1px 3px rgba(15,23,42,0.03); box-sizing: border-box;
  }
  .tai-header-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .tai-header-brand { display: flex; align-items: center; gap: 8px; cursor: pointer; text-decoration: none; flex-shrink: 0; }
  .tai-header-brand-mark { width: 28px; height: 28px; border-radius: 6px; background: #4F46E5; display: flex; align-items: center; justify-content: center; color: #fff; }
  .tai-header-brand-name { font-size: 15px; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
  .tai-header-search { display: flex; align-items: center; gap: 6px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 11px; width: clamp(140px, 15vw, 210px); font-size: 12px; color: var(--text-2); }
  .tai-header-search input { border: none; background: transparent; outline: none; width: 100%; font-size: 12px; font-family: inherit; color: var(--text); }
  
  .tai-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .tai-streak-pill { display: flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 6px; background: #FFF7ED; border: 1px solid #FFEDD5; color: #EA580C; font-size: 11.5px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
  .tai-credits-pill { display: flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 6px; background: #EEF2FF; border: 1px solid #E0E7FF; color: #4F46E5; font-size: 11.5px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
  .tai-workspace-pill { display: flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: 6px; background: var(--surface); border: 1px solid var(--border); color: var(--text); font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all .14s ease; flex-shrink: 0; }
  .tai-workspace-pill:hover { background: var(--surface-2); border-color: #CBD5E1; }
  
  .tai-desktop-shell { display: flex; width: 100%; max-width: 1440px; margin: 0 auto; align-items: stretch; min-height: calc(100vh - 54px); box-sizing: border-box; }
  .tai-app {
    width: 100%; max-width: 100%; flex: 1; min-height: calc(100vh - 54px);
    background: var(--bg); position: relative; display: flex; flex-direction: column; min-width: 0; box-sizing: border-box;
  }
  .tai-body {
    flex: 1; padding: 20px 24px calc(80px + env(safe-area-inset-bottom));
    width: 100%; max-width: 1240px; margin: 0 auto; box-sizing: border-box;
  }

  /* Collapsible Accordion Sidebar */
  .tai-desktop-sidebar { display: none; }
  @media (min-width: 900px) {
    .tai-desktop-sidebar {
      display: flex; flex-direction: column; width: 240px; flex-shrink: 0;
      position: fixed; top: 54px; left: max(0px, calc((100vw - 1440px) / 2));
      height: calc(100vh - 54px); height: calc(100dvh - 54px); background: var(--surface); border-right: 1px solid var(--border);
      padding: 16px 10px; box-shadow: 1px 0 6px rgba(15, 23, 42, 0.02); z-index: 40; overflow-y: auto;
      transition: width .2s ease, padding .2s ease;
    }
    .tai-app { margin-left: 240px; transition: margin-left .2s ease; }
    .tai-desktop-sidebar.tai-sidebar-minimized + .tai-app { margin-left: 68px; }
    .tai-desktop-sidebar.tai-sidebar-minimized {
      width: 68px; padding: 16px 6px;
    }
    .tai-desktop-sidebar.tai-sidebar-minimized .tai-group-header span,
    .tai-desktop-sidebar.tai-sidebar-minimized .tai-single-nav span,
    .tai-desktop-sidebar.tai-sidebar-minimized .tai-sub-item span,
    .tai-desktop-sidebar.tai-sidebar-minimized .tai-group-header > svg:last-child {
      display: none;
    }
    .tai-desktop-sidebar.tai-sidebar-minimized .tai-group-header,
    .tai-desktop-sidebar.tai-sidebar-minimized .tai-single-nav,
    .tai-desktop-sidebar.tai-sidebar-minimized .tai-sub-item {
      justify-content: center; padding: 10px 0; gap: 0;
    }
    .tai-desktop-sidebar.tai-sidebar-minimized .tai-sub-items {
      padding: 2px 0 4px 0;
    }
    .tai-sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .tai-nav-group { margin-bottom: 3px; }
    .tai-group-header {
      display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 8px;
      cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-2); transition: all .14s ease;
    }
    .tai-group-header:hover { background: var(--surface-2); color: var(--text); }
    .tai-group-header.active { color: var(--primary); font-weight: 700; }
    .tai-sub-items { display: flex; flex-direction: column; gap: 2px; padding: 2px 0 4px 10px; }
    .tai-sub-item {
      display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; cursor: pointer;
      font-size: 12.5px; font-weight: 500; color: var(--text-2); transition: all .14s ease;
    }
    .tai-sub-item:hover { background: var(--surface-2); color: var(--text); }
    .tai-sub-item.active { background: #EEF2FF; color: #4F46E5; font-weight: 700; border-left: 2.5px solid #4F46E5; padding-left: 7.5px; }
    .tai-single-nav {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 600; color: var(--text-2); transition: all .14s ease;
    }
    .tai-single-nav:hover { background: var(--surface-2); color: var(--text); }
    .tai-single-nav.active { background: #EEF2FF; color: #4F46E5; font-weight: 700; border-left: 2.5px solid #4F46E5; padding-left: 7.5px; }
    .tai-sidebar-footer { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 3px; }
    .tai-toggle-sidebar-btn {
      display: flex; align-items: center; justify-content: center; width: 100%; height: 32px; border-radius: 6px;
      border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); cursor: pointer;
      transition: all .15s ease; margin-bottom: 8px;
    }
    .tai-toggle-sidebar-btn:hover { background: var(--surface-3); color: var(--primary); border-color: var(--primary-light); }
  }

  .tai-demo-banner {
    position: fixed; top: 0; left: 0; right: 0; width: 100%;
    background: var(--warning-bg); border-bottom: 1px solid var(--warning-border); color: #B45309; font-size: 11.5px; font-weight: 700; text-align: center;
    padding: 6px 12px; z-index: 100;
  }
  .tai, .tai * { -webkit-tap-highlight-color: transparent; }
  .tai-toast {
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 200;
    background: #0F172A; color: #FFFFFF; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.2); display: flex; align-items: center; gap: 8px; max-width: 90%;
    animation: slideUp .18s cubic-bezier(.16,1,.3,1) both; border: 1px solid rgba(255,255,255,0.1);
  }
  .tai-topbar { display:flex; justify-content:space-between; align-items:center; flex-wrap: nowrap; gap: 10px; padding: 6px 0 14px; width: 100%; box-sizing: border-box; }
  .tai-topbar > .tai-row.tai-gap12 { min-width: 0; flex: 1; }
  .tai-topbar-actions { flex-wrap: nowrap; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
  .tai-h1 { font-size: clamp(17px, 2.5vw, 20px); font-weight: 800; letter-spacing: -0.02em; margin:0; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
  .tai-sub { font-size: 12px; color: var(--text-2); margin: 2px 0 0; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
  .tai-iconbtn { width:32px; height:32px; border-radius:8px; background: #FFFFFF; border:1px solid var(--border);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    display:flex; align-items:center; justify-content:center; color: var(--text); flex-shrink:0; cursor:pointer;
    transition: background-color .15s ease, border-color .15s ease; }
  .tai-iconbtn:hover { background: var(--surface-2); border-color: #CBD5E1; }
  .tai-iconbtn:active { transform: scale(0.96); }
  
  .tai-card {
    background: var(--surface);
    border-radius: var(--radius);
    padding: 20px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-card);
    transition: border-color .15s ease, box-shadow .15s ease;
    position: relative;
    overflow: hidden;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
  .tai.dark .tai-card {
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.4);
  }
  .tai-card-hover {
    cursor: pointer;
  }
  .tai-card-hover:hover {
    border-color: #CBD5E1;
    box-shadow: var(--shadow-hover);
  }

  .tai-row { display:flex; align-items:center; }
  .tai-between { justify-content:space-between; }
  .tai-gap4 { gap:4px; } .tai-gap6 { gap:6px; } .tai-gap8 { gap:8px; } .tai-gap10 { gap:10px; } .tai-gap12 { gap:12px; } .tai-gap14 { gap:14px; } .tai-gap16 { gap:16px; } .tai-gap18 { gap:18px; } .tai-gap20 { gap:20px; }
  .tai-col { display:flex; flex-direction:column; }
  .tai-mt4 { margin-top:4px; } .tai-mt6 { margin-top:6px; } .tai-mt8 { margin-top:8px; } .tai-mt10 { margin-top:10px; } .tai-mt12 { margin-top:12px; } .tai-mt14 { margin-top:14px; } .tai-mt16 { margin-top:16px; } .tai-mt20 { margin-top:20px; } .tai-mt24 { margin-top:24px; }
  .tai-label { font-size:11px; font-weight:700; color: var(--text-3); text-transform:uppercase; letter-spacing:.06em; }
  .tai-title-sm { font-size:15px; font-weight:800; letter-spacing: -0.01em; color: var(--text); }
  .tai-body-text { font-size: 13px; color: var(--text-2); line-height:1.5; }
  
  .tai-btn { border:none; cursor:pointer; border-radius: 8px; font-weight:600; font-size:13.5px; padding: 10px 16px;
    display:flex; align-items:center; justify-content:center; gap:6px; transition: background-color .15s ease, border-color .15s ease; font-family: var(--font); }
  .tai-btn-primary { background: #4F46E5; color:#fff; }
  .tai-btn-primary:hover { background: #4338CA; }
  .tai-btn-primary:active { transform: scale(.98); }
  .tai-btn-ghost { background: var(--surface-2); color: var(--primary); font-weight: 700; }
  .tai-btn-ghost:hover { background: #E0E7FF; color: var(--primary-dark); }
  .tai-btn-ghost:active { transform: scale(.98); }
  .tai-btn-outline { background: var(--surface); border: 1.5px solid var(--border); color: var(--text); font-weight: 600; }
  .tai-btn-outline:hover { background: var(--surface-2); border-color: #CBD5E1; }
  .tai-btn-outline:active { transform: scale(.98); }
  .tai-btn-sm { padding: 6px 12px; font-size:12px; border-radius:6px; }
  
  .tai-pill { padding:6px 12px; border-radius:6px; font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; border: 1px solid transparent; transition: background-color .15s ease; }
  .tai-pill-active { background: var(--primary); color:#fff; }
  .tai-pill-inactive { background: var(--surface); color: var(--text-2); border-color: var(--border); }
  .tai-pill-inactive:hover { background: var(--surface-2); color: var(--text); border-color: #CBD5E1; }
  
  .tai-tag { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight:700; background: var(--surface-2); color: var(--primary); letter-spacing: 0.02em; }
  
  .tai-scrollx { display:flex; gap:10px; overflow-x:auto; padding-bottom:4px; -ms-overflow-style:none; scrollbar-width:none; }
  .tai-scrollx::-webkit-scrollbar { display:none; }
  .tai-progress-track { width:100%; height:6px; border-radius:4px; background: var(--surface-2); overflow:hidden; }
  .tai-progress-fill { height:100%; border-radius:4px; background: var(--primary); transition: width .25s ease; }
  .tai-avatar { border-radius:50%; background: #4F46E5; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; flex-shrink:0; }
  .tai-divider { height:1px; background: var(--border); border:none; margin: 12px 0; }
  
  /* Full-width attached bottom navigation on mobile - clean, solid, accessible */
  .tai-navbar {
    position: fixed; left: 0; right: 0; bottom: 0; width: 100vw; max-width: 100%;
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex; justify-content: space-around; align-items: center;
    padding: 6px 12px max(8px, env(safe-area-inset-bottom)); z-index: 100;
    box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.04);
  }
  .tai.dark .tai-navbar {
    background: #0D1222;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .tai-navitem {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-3); padding: 4px 8px; border-radius: 6px;
    background: transparent; border: none; outline: none; gap: 3px;
    transition: color .15s ease;
  }
  .tai-navitem:hover {
    color: var(--text);
  }
  .tai-navitem-icon-wrap {
    display: flex; align-items: center; justify-content: center;
  }
  .tai-navitem-label {
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.01em; color: var(--text-3);
  }
  .tai-navitem.active {
    color: #4F46E5;
  }
  .tai-navitem.active .tai-navitem-label {
    color: #4F46E5; font-weight: 800;
  }
  .tai-input { width:100%; border-radius:8px; border:1px solid var(--border); background: var(--surface); padding: 10px 14px;
    font-size:13px; color: var(--text); font-family: var(--font); transition: border-color .15s ease; }
  .tai-input:focus { outline:none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15); }
  .tai-fade-in { animation: fadeIn .15s ease-out both; }
  .tai-switch { width:40px; height:22px; border-radius:99px; background: var(--surface-2); position:relative; cursor:pointer; flex-shrink:0; transition: background .15s ease; border: 1px solid var(--border); }
  .tai-switch.on { background: var(--primary); border-color: var(--primary); }
  .tai-switch-knob { width:16px; height:16px; border-radius:50%; background:#fff; position:absolute; top:2px; left:2px; transition: left .15s ease; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
  .tai-switch.on .tai-switch-knob { left:20px; }
  .tai-empty { text-align:center; padding: 36px 16px; color: var(--text-2); }
  .tai-grid2 { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:16px; width:100%; box-sizing:border-box; }
  .tai-grid3 { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:16px; width:100%; box-sizing:border-box; }
  .tai-grid4 { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:16px; width:100%; box-sizing:border-box; }
  .tai-link { color: var(--primary); font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:3px; }
  .tai-dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.62fr) minmax(0, 1fr); gap: 20px; align-items: start; width: 100%; max-width: 100%; box-sizing: border-box; }

  /* Learner Hero & Career Roadmap responsive classes */
  .tai-hero-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
  .tai-hero-btn { flex-shrink: 0; }
  .tai-roadmap-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: 100%; box-sizing: border-box; }
  .tai-roadmap-item {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 8px 6px; border-radius: 10px; border: 1px solid var(--border);
    text-align: center; box-sizing: border-box; min-width: 0;
  }
  .tai-roadmap-item-title { font-size: 11px; font-weight: 700; margin-top: 4px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
  .tai-roadmap-item-status { font-size: 9.5px; color: var(--text-3); margin-top: 2px; white-space: nowrap; }

  /* =========================================================================
     RESPONSIVE MEDIA QUERIES (AT END OF STYLESHEET TO GUARANTEE CASCADE)
     ========================================================================= */
  @media (min-width: 900px) {
    .tai-toast { bottom: 32px; }
    .tai-navbar { display: none !important; }
    .tai-body { padding: 28px clamp(24px, 2.5vw, 40px) 72px; max-width: 1560px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  }
  @media (max-width: 899px) {
    .tai-header-search { display: none; }
    .tai-desktop-only { display: none !important; }
    .tai-global-header { padding: 0 16px; height: 56px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .tai-header-brand img, .tai-header-logo { height: 20px !important; }
    .tai-body { padding: 16px 16px calc(88px + env(safe-area-inset-bottom)); width: 100%; max-width: 100%; box-sizing: border-box; }
    .tai-streak-pill, .tai-credits-pill { padding: 6px 10px; font-size: 12px; gap: 5px; }
    .tai-header-right { gap: 8px; }
    .tai-dashboard-grid { display: flex !important; flex-direction: column !important; gap: 16px !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
    .tai-card { padding: 16px 14px !important; border-radius: 16px !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
    .tai-grid2, .tai-grid3, .tai-grid4 { grid-template-columns: 1fr !important; gap: 14px !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
    .tai-hero-row { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
    .tai-hero-btn { width: 100% !important; justify-content: center !important; padding: 10px 16px !important; font-size: 13px !important; }
    .tai-roadmap-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 6px !important; }
    .tai-roadmap-item { padding: 7px 4px !important; }
    .tai-roadmap-item-title { font-size: 10px !important; }
    .tai-roadmap-item-status { font-size: 8.5px !important; }
  }
  @media (max-width: 480px) {
    .tai-global-header { padding: 0 14px; height: 54px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .tai-header-brand img, .tai-header-logo { height: 19px !important; }
    .tai-body { padding: 14px 14px calc(86px + env(safe-area-inset-bottom)); width: 100%; max-width: 100%; box-sizing: border-box; }
    .tai-card { padding: 14px 14px !important; border-radius: 16px !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
    .tai-iconbtn { width: 34px; height: 34px; border-radius: 10px; }
    .tai-topbar { padding: 4px 0 12px; }
    .tai-h1 { font-size: 19px; }
    .tai-grid2, .tai-grid3, .tai-grid4 { grid-template-columns: 1fr !important; gap: 12px !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
    .tai-roadmap-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 4px !important; }
    .tai-roadmap-item { padding: 6px 2px !important; border-radius: 8px !important; }
    .tai-roadmap-item-title { font-size: 9.5px !important; }
    .tai-roadmap-item-status { font-size: 8px !important; }
  }

  /* Universal Cinema Video & Lesson Responsive Rules */
  .tai-lesson-cinema-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 18px;
    align-items: start;
    transition: all 0.25s ease;
    width: 100%;
    box-sizing: border-box;
  }
  .tai-lesson-cinema-layout.tai-cinema-full {
    grid-template-columns: 1fr !important;
  }
  .tai-lesson-nav-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
  }
  .tai-lesson-nav-complete { flex: 2 1 240px; order: 2; }
  .tai-lesson-nav-subrow { display: flex; gap: 12px; flex: 2 1 300px; }
  .tai-lesson-nav-subrow > button:first-child { order: 1; }
  .tai-lesson-nav-subrow > button:last-child { order: 3; }

  @media (max-width: 899px) {
    .tai-lesson-cinema-layout {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }
  }
  @media (max-width: 768px) {
    .tai-lesson-nav-container {
      flex-direction: column !important;
      gap: 10px !important;
    }
    .tai-lesson-nav-complete {
      width: 100% !important;
      flex: none !important;
      order: 1 !important;
    }
    .tai-lesson-nav-subrow {
      width: 100% !important;
      display: flex !important;
      gap: 8px !important;
      flex: none !important;
      order: 2 !important;
    }
    .tai-header-full-text { display: none !important; }
  }
`;

export const COURSE_GRAD_PALETTE = [
  ["#4F46E5", "#818CF8"], ["#4338CA", "#6366F1"], ["#0284C7", "#38BDF8"],
  ["#7C3AED", "#A78BFA"], ["#059669", "#34D399"], ["#D97706", "#FBBF24"],
  ["#DB2777", "#F472B6"], ["#4F46E5", "#93C5FD"],
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

export function ProgressBar({ value, height = 7 }) {
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
      {right && <div className="tai-row tai-gap8 tai-topbar-actions">{right}</div>}
    </div>
  );
}

export function Tag({ children, tone }) {
  const bg = tone === "success" ? "var(--success-bg)" : tone === "warning" ? "var(--warning-bg)" : tone === "danger" ? "var(--danger-bg)" : "var(--primary-tint)";
  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : "var(--primary)";
  const border = tone === "success" ? "var(--success-border)" : tone === "warning" ? "var(--warning-border)" : tone === "danger" ? "var(--danger-border)" : "transparent";
  return <span className="tai-tag" style={{ background: bg, color, border: `1px solid ${border}` }}>{children}</span>;
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
  { key: "ai", label: "AI Coach", icon: Zap },
  { key: "community", label: "Community", icon: Users },
];

export function BottomNav({ active, go }) {
  return (
    <nav className="tai-navbar" aria-label="Bottom Navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={`tai-navitem ${isActive ? "active" : ""}`}
            onClick={() => go(item.key)}
            aria-label={item.label}
          >
            <div className="tai-navitem-icon-wrap">
              <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
            </div>
            <span className="tai-navitem-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function LearnerHeader({
  user,
  credits,
  onBuyCredits,
  onOpenNotifications,
  unreadNotifs = 0,
  onOpenDashboardSwitcher,
  hasPlatformRole,
  onProfile,
  onSignOut,
  brandLogoUrl,
  go,
  active,
  searchComponent,
  dark,
}) {
  const isDarkActive = typeof dark === "boolean" ? dark : (typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  const defaultLogo = isDarkActive ? "/logo-dark.png" : "/train-ai-logo.png";

  return (
    <header className="tai-global-header">
      <div className="tai-header-left" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div className="tai-header-brand" onClick={() => go?.("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img
            src={brandLogoUrl || defaultLogo}
            alt="Train AI"
            className="tai-header-logo"
            style={{ height: 24, width: "auto", minWidth: 70, objectFit: "contain", display: "block", flexShrink: 0 }}
          />
        </div>
        <div className="tai-desktop-only">
          {searchComponent}
        </div>
      </div>

      <div className="tai-header-right" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Streak Pill */}
        <div className="tai-streak-pill" onClick={() => go?.("achievements")} title="Active Streak">
          <Flame size={14} color="#EA580C" />
          <span>{user?.streak || 8} <span className="tai-pill-unit tai-desktop-only">days</span></span>
        </div>

        {/* AI Credits Pill (Desktop only to prevent mobile crowding) */}
        <div className="tai-credits-pill tai-desktop-only" onClick={onBuyCredits || (() => go?.("creditsCheckout"))} title="AI Neural Credits">
          <Sparkles size={13} color="#4F46E5" />
          <span>{typeof credits === "number" ? credits : 10} <span className="tai-pill-unit">credits</span></span>
        </div>

        {/* Workspace Switcher Button (Desktop only) */}
        {onOpenDashboardSwitcher && (
          <button className="tai-workspace-pill tai-desktop-only" onClick={onOpenDashboardSwitcher} title="Switch workspace">
            <ShieldCheck size={15} color="var(--primary)" />
            <span>Admin workspace</span>
          </button>
        )}

        {/* Notifications Icon with Badge */}
        {onOpenNotifications && (
          <button
            className="tai-iconbtn"
            onClick={onOpenNotifications}
            aria-label="Notifications"
            style={{ position: "relative" }}
          >
            <Bell size={16} />
            {unreadNotifs > 0 && (
              <span style={{
                position: "absolute", top: 4, right: 4, minWidth: 14, height: 14,
                borderRadius: 99, background: "var(--danger)", color: "#fff",
                fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 2px", border: "1.5px solid #fff"
              }}>
                {unreadNotifs}
              </span>
            )}
          </button>
        )}

        {/* User Avatar with Profile link */}
        <div
          onClick={onProfile}
          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
          title={user?.name || "My Account"}
        >
          <Avatar
            initials={initialsOf(user?.name || user?.email || "Learner")}
            size={32}
            src={user?.avatarUrl}
          />
        </div>

        {/* Sign Out Button (Desktop only) */}
        {onSignOut && (
          <button
            className="tai-iconbtn tai-desktop-only"
            onClick={onSignOut}
            title="Sign out"
            style={{ color: "var(--danger)" }}
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}

export function DesktopSidebar({
  activeScreen,
  currentTab,
  go,
  onProfile,
  onOpenDashboardSwitcher,
  onSignOut,
  brandLogoUrl,
  user,
  unreadNotifs = 0,
}) {
  const [isMinimized, setIsMinimized] = useState(() => localStorage.getItem("tai_sidebar_minimized") === "true");
  const [learningOpen, setLearningOpen] = useState(true);
  const [communityOpen, setCommunityOpen] = useState(true);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const toggleMinimized = () => {
    setIsMinimized(prev => {
      const next = !prev;
      localStorage.setItem("tai_sidebar_minimized", String(next));
      return next;
    });
  };

  return (
    <aside className={`tai-desktop-sidebar ${isMinimized ? "tai-sidebar-minimized" : ""}`}>
      {/* Sidebar Collapse / Expand Toggle */}
      <button
        className="tai-toggle-sidebar-btn"
        onClick={toggleMinimized}
        title={isMinimized ? "Expand sidebar" : "Minimize to icons"}
        aria-label={isMinimized ? "Expand sidebar" : "Minimize to icons"}
      >
        {isMinimized ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      <div className="tai-sidebar-nav">
        {/* HOME (Single link) */}
        <div
          className={`tai-single-nav ${activeScreen === "home" ? "active" : ""}`}
          onClick={() => go("home")}
          title="Home"
        >
          <Home size={18} />
          <span>Home</span>
        </div>

        {/* LEARNING (Collapsible Accordion) */}
        <div className="tai-nav-group">
          <div
            className={`tai-group-header ${["courses", "courseDetail", "lesson", "learningPaths", "bookmarks", "myProgress"].includes(activeScreen) ? "active" : ""}`}
            onClick={() => isMinimized ? go("courses") : setLearningOpen(!learningOpen)}
            title="Learning & Courses"
          >
            <div className="tai-row tai-gap10">
              <BookOpen size={18} />
              <span>Learning</span>
            </div>
            {!isMinimized && (learningOpen ? <ChevronDown size={15} color="var(--text-3)" /> : <ChevronRight size={15} color="var(--text-3)" />)}
          </div>
          {(!isMinimized ? learningOpen : true) && (
            <div className="tai-sub-items">
              <div
                className={`tai-sub-item ${activeScreen === "courses" && currentTab !== "myCourses" && currentTab !== "bookmarks" ? "active" : ""}`}
                onClick={() => go("courses")}
                title="Explore Courses"
              >
                <BookOpen size={15} />
                <span>Courses</span>
              </div>
              <div
                className={`tai-sub-item ${currentTab === "learningPaths" ? "active" : ""}`}
                onClick={() => go("learningPaths")}
                title="Learning Paths & Tracks"
              >
                <Layers size={15} />
                <span>Learning Paths</span>
              </div>
              <div
                className={`tai-sub-item ${activeScreen === "bookmarks" ? "active" : ""}`}
                onClick={() => go("bookmarks")}
                title="Saved Library & Bookmarks"
              >
                <Bookmark size={15} />
                <span>Bookmarks</span>
              </div>
              <div
                className={`tai-sub-item ${activeScreen === "myProgress" ? "active" : ""}`}
                onClick={() => go("myProgress")}
                title="My Progress & Syllabus"
              >
                <BarChart3 size={15} />
                <span>My Progress</span>
              </div>
            </div>
          )}
        </div>

        {/* AI COACH (Single link) */}
        <div
          className={`tai-single-nav ${activeScreen === "ai" ? "active" : ""}`}
          onClick={() => go("ai")}
          title="AI Neural Coach"
        >
          <Zap size={18} />
          <span>AI Coach</span>
        </div>

        {/* COMMUNITY (Collapsible Accordion) */}
        <div className="tai-nav-group">
          <div
            className={`tai-group-header ${["community", "cohort"].includes(activeScreen) ? "active" : ""}`}
            onClick={() => isMinimized ? go("communityFeed") : setCommunityOpen(!communityOpen)}
            title="Community Hub"
          >
            <div className="tai-row tai-gap10">
              <Users size={18} />
              <span>Community</span>
            </div>
            {!isMinimized && (communityOpen ? <ChevronDown size={15} color="var(--text-3)" /> : <ChevronRight size={15} color="var(--text-3)" />)}
          </div>
          {(!isMinimized ? communityOpen : true) && (
            <div className="tai-sub-items">
              <div
                className={`tai-sub-item ${activeScreen === "community" && currentTab === "posts" ? "active" : ""}`}
                onClick={() => go("communityFeed")}
                title="Community Feed"
              >
                <MessageSquare size={15} />
                <span>Feed</span>
              </div>
              <div
                className={`tai-sub-item ${activeScreen === "cohort" || (activeScreen === "community" && currentTab === "groups") ? "active" : ""}`}
                onClick={() => go("cohort")}
                title="Active Cohorts"
              >
                <Users size={15} />
                <span>Cohorts</span>
              </div>
            </div>
          )}
        </div>

        {/* INBOX & SESSIONS (Collapsible Accordion) */}
        <div className="tai-nav-group">
          <div
            className={`tai-group-header ${["messages", "mentors", "notifications"].includes(activeScreen) ? "active" : ""}`}
            onClick={() => isMinimized ? go("messages") : setInboxOpen(!inboxOpen)}
            title="Inbox & Sessions"
          >
            <div className="tai-row tai-gap10">
              <Mail size={18} />
              <span>Inbox &amp; Sessions</span>
            </div>
            {!isMinimized && (inboxOpen ? <ChevronDown size={15} color="var(--text-3)" /> : <ChevronRight size={15} color="var(--text-3)" />)}
          </div>
          {(!isMinimized ? inboxOpen : true) && (
            <div className="tai-sub-items">
              <div
                className={`tai-sub-item ${activeScreen === "messages" ? "active" : ""}`}
                onClick={() => go("messages")}
                title="Direct Messages"
              >
                <MessageSquare size={15} />
                <span>Messages</span>
              </div>
              <div
                className={`tai-sub-item ${activeScreen === "mentors" ? "active" : ""}`}
                onClick={() => go("mentors")}
                title="Instructors & 1-on-1 Sessions"
              >
                <Calendar size={15} />
                <span>Schedule</span>
              </div>
              <div
                className={`tai-sub-item ${activeScreen === "notifications" ? "active" : ""}`}
                onClick={() => go("notifications")}
                title="Notifications"
              >
                <Bell size={15} />
                <span>Notifications</span>
              </div>
            </div>
          )}
        </div>

        {/* ACCOUNT (Collapsible Accordion) */}
        <div className="tai-nav-group">
          <div
            className={`tai-group-header ${activeScreen === "settings" ? "active" : ""}`}
            onClick={() => isMinimized ? onProfile?.() : setAccountOpen(!accountOpen)}
            title="Account & Settings"
          >
            <div className="tai-row tai-gap10">
              <Settings size={18} />
              <span>Account</span>
            </div>
            {!isMinimized && (accountOpen ? <ChevronDown size={15} color="var(--text-3)" /> : <ChevronRight size={15} color="var(--text-3)" />)}
          </div>
          {(!isMinimized ? accountOpen : false) && (
            <div className="tai-sub-items">
              <div
                className={`tai-sub-item ${activeScreen === "achievements" ? "active" : ""}`}
                onClick={() => go("achievements")}
                title="Achievements & Badges"
              >
                <Award size={15} />
                <span>Achievements</span>
              </div>
              <div
                className={`tai-sub-item ${activeScreen === "settings" ? "active" : ""}`}
                onClick={() => onProfile ? onProfile() : go("settings")}
                title="Settings"
              >
                <Settings size={15} />
                <span>Settings</span>
              </div>
              {onSignOut && (
                <div
                  className="tai-sub-item"
                  style={{ color: "var(--danger)" }}
                  onClick={onSignOut}
                  title="Sign Out"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="tai-sidebar-footer">
        {onOpenDashboardSwitcher && (
          <div className="tai-single-nav" onClick={onOpenDashboardSwitcher} title="Switch Dashboard Workspace">
            <Repeat size={16} />
            <span>Switch Dashboard</span>
          </div>
        )}
        <div
          className={`tai-single-nav ${activeScreen === "settings" ? "active" : ""}`}
          onClick={onProfile}
          title="My Profile & Settings"
        >
          <Settings size={16} />
          <span>Settings</span>
        </div>
        {onSignOut && (
          <div
            className="tai-single-nav"
            onClick={onSignOut}
            title="Sign Out to Landing Page"
            style={{ color: "var(--danger)" }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </div>
        )}
      </div>
    </aside>
  );
}

export function CourseThumb({ course, size = 56, rounded = 14 }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div style={{
        width: size, height: size, borderRadius: rounded, flexShrink: 0,
        background: `linear-gradient(135deg, ${course.grad?.[0] || "#4F46E5"}, ${course.grad?.[1] || "#818CF8"})`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <GraduationCap size={size * 0.42} color="#fff" strokeWidth={1.6} />
      </div>
    );
  }
  const imgSrc = course.coverImageUrl || `https://picsum.photos/seed/${course.id}/160/160`;
  return (
    <div style={{
      width: size, height: size, borderRadius: rounded, flexShrink: 0, overflow: "hidden", position: "relative",
      background: `linear-gradient(135deg, ${course.grad?.[0] || "#4F46E5"}, ${course.grad?.[1] || "#818CF8"})`,
      boxShadow: "0 2px 6px rgba(15,23,42,0.06)"
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
    <div className="tai-card" style={{ flex: 1, padding: "16px", background: "var(--surface)" }}>
      <div className="tai-row tai-between">
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: tone ? `var(--${tone}-bg)` : "var(--primary-tint)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {Icon && <Icon size={18} color={tone ? `var(--${tone})` : "var(--primary)"} />}
        </div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 10, color: "var(--text)" }}>{value}</div>
      <div className="tai-label" style={{ fontSize: 11, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function CourseCard({ course, onClick, onEnroll, onToggleBookmark }) {
  return (
    <div className="tai-card tai-card-hover" style={{ cursor: "pointer", position: "relative" }} onClick={onClick}>
      {onToggleBookmark && (
        <button
          aria-label={course.isBookmarked ? "Remove bookmark" : "Bookmark this course"}
          onClick={(e) => { e.stopPropagation(); onToggleBookmark(course.id, !!course.isBookmarked); }}
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", padding: 4, zIndex: 1 }}
        >
          <Bookmark size={18} color={course.isBookmarked ? "var(--primary)" : "var(--text-3)"} fill={course.isBookmarked ? "var(--primary)" : "none"} />
        </button>
      )}
      <div className="tai-row tai-gap14">
        <CourseThumb course={course} size={58} rounded={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tai-row tai-between" style={{ paddingRight: onToggleBookmark ? 24 : 0 }}>
            <Tag>{course.category}</Tag>
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4, lineHeight: 1.35, wordBreak: "break-word", color: "var(--text)" }}>
            {course.title}
          </div>
          <div className="tai-row tai-gap12 tai-mt8" style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 500 }}>
            <span className="tai-row tai-gap4"><Clock size={13} />{course.hours}h</span>
            <span>•</span>
            <span>{course.lessons} lessons</span>
          </div>
        </div>
      </div>
      {course.enrolled ? (
        <div className="tai-mt14">
          <div className="tai-row tai-between" style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600, marginBottom: 5 }}>
            <span>Progress</span>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>{course.progress}%</span>
          </div>
          <ProgressBar value={course.progress} height={7} />
        </div>
      ) : onEnroll ? (
        <div className="tai-row tai-between tai-mt14">
          <div />
          {course.requiresApproval && course.applicationStatus === "pending" ? (
            <span style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", fontWeight: 600 }}>Pending review</span>
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
    <div className="tai-card tai-card-hover" style={{ cursor: "pointer", background: "var(--grad-subtle)", borderColor: "#E0E7FF" }} onClick={onClick}>
      <div className="tai-row tai-between">
        <div>
          <span className="tai-tag" style={{ background: "#FFFFFF", color: "var(--primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>Quick win</span>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 6, color: "var(--text)" }}>{title}</div>
          <div className="tai-row tai-gap10 tai-mt8" style={{ fontSize: 12.5, color: "var(--text-2)" }}>
            <span>{duration}</span>
            <span>•</span>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>+{points} XP</span>
          </div>
        </div>
        <div className="tai-iconbtn" style={{ background: "var(--primary)", color: "#fff", border: "none", boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}>
          <ChevronRight size={18} />
        </div>
      </div>
    </div>
  );
}

// LearningPathsView used to live here: a hardcoded three-entry TRACKS array
// with invented progress percentages, invented step lists and a button that
// sent every learner to the same stock course id. It is replaced by
// learner/screens/LearningPathsScreen.jsx, which reads the real
// learning_paths / learning_path_courses / learning_path_enrollments tables
// the admin path builder writes to, evaluates each step's real unlock rule
// against the learner's own course completions, and lets a learner add and
// drop their own tracks (user_personalization.learning_tracks).

export function ScheduleView({ push, back }) {
  const SESSIONS = [
    {
      id: "live-now",
      title: "UI Critique & System Architecture Review",
      track: "Design & UX",
      time: "Live Now (10:00 AM - 11:30 AM)",
      instructor: "Astrid Larsson",
      isLive: true,
      attendees: 18,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
    },
    {
      id: "live-2",
      title: "Full-Stack GenAI: Vector Embeddings & Supabase",
      track: "AI & Engineering",
      time: "Tomorrow at 02:00 PM UTC",
      instructor: "Alex Rivera",
      isLive: false,
      attendees: 24,
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80"
    },
    {
      id: "live-3",
      title: "Axon AI Prompting & Autonomous Workflows",
      track: "AI Tools",
      time: "Thursday at 04:30 PM UTC",
      instructor: "Marcus Vance",
      isLive: false,
      attendees: 31,
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80"
    }
  ];

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBar title="Schedule & Live Sessions" sub="Join live mentor workshops, critiques, and cohort sessions" onBack={back} />

      <div className="tai-col tai-gap14">
        {SESSIONS.map((sess) => (
          <div
            key={sess.id}
            className="tai-card tai-card-hover"
            style={{
              padding: 22,
              background: sess.isLive ? "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" : "var(--surface)",
              color: sess.isLive ? "#fff" : "var(--text)",
              border: sess.isLive ? "none" : "1px solid var(--border)",
              boxShadow: sess.isLive ? "0 10px 30px rgba(15,23,42,0.25)" : "var(--shadow-card)"
            }}
          >
            <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10 }}>
              <div className="tai-row tai-gap10">
                <span className="tai-tag" style={{
                  background: sess.isLive ? "rgba(239,68,68,0.25)" : "var(--primary-tint)",
                  color: sess.isLive ? "#F87171" : "var(--primary)",
                  border: sess.isLive ? "1px solid rgba(239,68,68,0.4)" : "1px solid #E0E7FF",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5
                }}>
                  {sess.isLive ? <><Radio size={12} color="#F87171" /> LIVE NOW</> : "UPCOMING"}
                </span>
                <span style={{ fontSize: 12, opacity: 0.8, fontWeight: 600 }}>{sess.track}</span>
              </div>

              <span style={{ fontSize: 12.5, fontWeight: 700, color: sess.isLive ? "#F87171" : "var(--primary)" }}>
                {sess.time}
              </span>
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 800, margin: "12px 0 4px", color: sess.isLive ? "#fff" : "var(--text)" }}>
              {sess.title}
            </h3>

            <div className="tai-row tai-between tai-mt16" style={{ flexWrap: "wrap", gap: 12 }}>
              <div className="tai-row tai-gap10">
                <Avatar initials={sess.instructor.slice(0, 2)} size={38} src={sess.avatar} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{sess.instructor}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.75 }}>Instructor • {sess.attendees} learners registered</div>
                </div>
              </div>

              <button
                className="tai-btn tai-btn-primary tai-btn-sm"
                style={{ padding: "10px 20px" }}
                onClick={() => {
                  window.open("https://meet.google.com", "_blank");
                }}
              >
                <Video size={14} /> {sess.isLive ? "Join Live Stream Room" : "Add to Calendar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
