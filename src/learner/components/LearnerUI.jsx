import React, { useState, useContext } from "react";
import {
  Home, BookOpen, Zap, Users, Settings, ArrowLeft, GraduationCap, Bookmark, Clock, CheckCircle2,
  Repeat, ChevronRight, ChevronDown, ChevronUp, Bell, Sparkles, Flame, MessageSquare, Calendar,
  Compass, ShieldCheck, LogOut, Search, Award, BarChart3, HelpCircle, Layers, Mail, Trophy, UserCheck, Radio, Star,
  PanelLeftClose, PanelLeftOpen
} from "lucide-react";

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
    --radius: 20px;
    --radius-sm: 12px;
    --shadow-card: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 4px 14px -2px rgba(15, 23, 42, 0.03);
    --shadow-hover: 0 8px 24px -4px rgba(79, 70, 229, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
    --shadow-btn: 0 4px 14px -2px rgba(79, 70, 229, 0.32);
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
    height: 72px; width: 100%; max-width: 100%; background: var(--surface); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; padding: 0 24px;
    position: sticky; top: 0; z-index: 60; box-shadow: 0 1px 3px rgba(15,23,42,0.03); box-sizing: border-box;
  }
  .tai-header-left { display: flex; align-items: center; gap: 20px; min-width: 0; }
  .tai-header-brand { display: flex; align-items: center; gap: 10px; cursor: pointer; text-decoration: none; flex-shrink: 0; }
  .tai-header-brand-mark { width: 34px; height: 34px; border-radius: 9px; background: var(--grad); display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(79,70,229,0.3); }
  .tai-header-brand-name { font-size: 17px; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
  .tai-header-search { display: flex; align-items: center; gap: 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 7px 14px; width: clamp(180px, 22vw, 320px); font-size: 13px; color: var(--text-2); }
  .tai-header-search input { border: none; background: transparent; outline: none; width: 100%; font-size: 13px; font-family: inherit; color: var(--text); }
  
  .tai-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .tai-streak-pill { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: #FFF7ED; border: 1px solid #FFEDD5; color: #EA580C; font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
  .tai-credits-pill { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: #EEF2FF; border: 1px solid #E0E7FF; color: #4F46E5; font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
  .tai-workspace-pill { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); color: var(--text); font-size: 12px; font-weight: 700; cursor: pointer; transition: all .14s ease; flex-shrink: 0; }
  .tai-workspace-pill:hover { background: var(--surface-2); border-color: #CBD5E1; }
  
  .tai-desktop-shell { display: flex; width: 100%; max-width: 1440px; margin: 0 auto; align-items: stretch; min-height: calc(100vh - 72px); box-sizing: border-box; }
  .tai-app {
    width: 100%; max-width: 100%; flex: 1; min-height: calc(100vh - 72px);
    background: var(--bg); position: relative; display: flex; flex-direction: column; min-width: 0; box-sizing: border-box;
  }
  .tai-body {
    flex: 1; padding: 24px 28px calc(90px + env(safe-area-inset-bottom));
    width: 100%; max-width: 1240px; margin: 0 auto; box-sizing: border-box;
  }
  
  /* Collapsible Accordion Sidebar */
  .tai-desktop-sidebar { display: none; }
  @media (min-width: 900px) {
    .tai-desktop-sidebar {
      display: flex; flex-direction: column; width: 250px; flex-shrink: 0; position: sticky; top: 72px;
      height: calc(100vh - 72px); height: calc(100dvh - 72px); background: var(--surface); border-right: 1px solid var(--border);
      padding: 18px 12px; box-shadow: 2px 0 12px -6px rgba(15, 23, 42, 0.03); z-index: 40; overflow-y: auto;
      transition: width .2s ease, padding .2s ease;
    }
    .tai-desktop-sidebar.tai-sidebar-minimized {
      width: 72px; padding: 18px 8px;
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
    .tai-sidebar-nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }
    .tai-nav-group { margin-bottom: 4px; }
    .tai-group-header {
      display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 10px;
      cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--text-2); transition: all .14s ease;
    }
    .tai-group-header:hover { background: var(--surface-2); color: var(--text); }
    .tai-group-header.active { color: var(--primary); font-weight: 700; }
    .tai-sub-items { display: flex; flex-direction: column; gap: 2px; padding: 2px 0 6px 12px; }
    .tai-sub-item {
      display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 500; color: var(--text-2); transition: all .14s ease;
    }
    .tai-sub-item:hover { background: var(--surface-2); color: var(--text); }
    .tai-sub-item.active { background: #EEF2FF; color: #4F46E5; font-weight: 700; border-left: 3px solid #4F46E5; padding-left: 9px; }
    .tai-single-nav {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; cursor: pointer;
      font-size: 13.5px; font-weight: 600; color: var(--text-2); transition: all .14s ease;
    }
    .tai-single-nav:hover { background: var(--surface-2); color: var(--text); }
    .tai-single-nav.active { background: #EEF2FF; color: #4F46E5; font-weight: 700; border-left: 3px solid #4F46E5; padding-left: 9px; }
    .tai-sidebar-footer { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px; }
    .tai-toggle-sidebar-btn {
      display: flex; align-items: center; justify-content: center; width: 100%; height: 36px; border-radius: 10px;
      border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); cursor: pointer;
      transition: all .15s ease; margin-bottom: 10px;
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
    position: fixed; bottom: 84px; left: 50%; transform: translateX(-50%); z-index: 200;
    background: #0F172A; color: #FFFFFF; padding: 12px 20px; border-radius: 14px; font-size: 13.5px; font-weight: 600;
    box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.35); display: flex; align-items: center; gap: 10px; max-width: 90%;
    animation: slideUp .22s cubic-bezier(.16,1,.3,1) both; border: 1px solid rgba(255,255,255,0.1);
  }
  @media (min-width: 900px) {
    .tai-toast { bottom: 32px; }
    .tai-navbar { display: none !important; }
    .tai-body { padding: 24px 32px 60px; }
  }
  @media (max-width: 899px) {
    .tai-header-search { display: none; }
    .tai-desktop-only { display: none !important; }
    .tai-global-header { padding: 0 16px; height: 60px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .tai-header-brand img { height: 44px !important; }
    .tai-body { padding: 16px 14px calc(88px + env(safe-area-inset-bottom)); width: 100%; max-width: 100%; box-sizing: border-box; }
    .tai-streak-pill, .tai-credits-pill { padding: 6px 10px; font-size: 12px; gap: 5px; }
    .tai-header-right { gap: 8px; }
    .tai-dashboard-grid { display: flex !important; flex-direction: column !important; gap: 16px !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
    .tai-card { padding: 18px 16px; border-radius: 16px; width: 100%; box-sizing: border-box; }
  }
  @media (max-width: 480px) {
    .tai-global-header { padding: 0 12px; height: 56px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .tai-header-brand img { height: 38px !important; }
    .tai-body { padding: 12px 12px calc(86px + env(safe-area-inset-bottom)); width: 100%; max-width: 100%; box-sizing: border-box; }
    .tai-card { padding: 14px 12px; border-radius: 14px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .tai-iconbtn { width: 34px; height: 34px; border-radius: 10px; }
    .tai-topbar { padding: 4px 0 12px; }
    .tai-h1 { font-size: 19px; }
    .tai-grid2, .tai-grid3, .tai-grid4 { grid-template-columns: 1fr !important; gap: 12px !important; width: 100% !important; max-width: 100% !important; }
  }
  .tai-topbar { display:flex; justify-content:space-between; align-items:center; padding: 8px 0 18px; }
  .tai-h1 { font-size: clamp(20px, 4vw, 24px); font-weight: 800; letter-spacing: -0.025em; margin:0; color: var(--text); }
  .tai-sub { font-size: 13px; color: var(--text-2); margin: 3px 0 0; font-weight: 500; }
  .tai-iconbtn { width:38px; height:38px; border-radius:12px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border:1px solid var(--border);
    box-shadow: 0 2px 8px -1px rgba(15, 23, 42, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.6);
    display:flex; align-items:center; justify-content:center; color: var(--text); flex-shrink:0; cursor:pointer;
    transition: all .18s cubic-bezier(0.16, 1, 0.3, 1); }
  .tai-iconbtn:hover { background: var(--surface-2); border-color: rgba(99, 102, 241, 0.3); transform: translateY(-2px) scale(1.04); box-shadow: 0 6px 16px -2px rgba(79, 70, 229, 0.18); }
  .tai-iconbtn:active { transform: scale(0.94); }
  
  /* Card surface with a subtle specular highlight - no backdrop-filter on
     cards: this screen stacks many of them per page, and blurring flat
     background colors costs real scroll/render performance for no visible
     benefit. (.tai-iconbtn and .tai-navbar keep their blur - those are single,
     small, fixed elements, not repeated per-card.) */
  .tai-card {
    background: rgba(255, 255, 255, 0.96);
    border-radius: 18px;
    padding: 22px;
    border: 1px solid rgba(226, 232, 240, 0.85);
    box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.8);
    transition: transform .24s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow .24s cubic-bezier(0.16, 1, 0.3, 1),
                border-color .24s ease,
                background .24s ease;
    position: relative;
    overflow: hidden;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
  .tai.dark .tai-card {
    background: rgba(18, 24, 43, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 28px -4px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
  }
  .tai-card-hover {
    cursor: pointer;
  }
  .tai-card-hover:hover {
    box-shadow: 0 16px 36px -6px rgba(79, 70, 229, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.9);
    border-color: rgba(99, 102, 241, 0.35);
    transform: translateY(-3px) scale(1.006);
  }
  .tai.dark .tai-card-hover:hover {
    box-shadow: 0 18px 40px -6px rgba(0, 0, 0, 0.65), 0 0 20px -2px rgba(99, 102, 241, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.12);
    border-color: rgba(129, 140, 248, 0.35);
    transform: translateY(-3px) scale(1.006);
  }
  .tai-card-hover:active {
    transform: translateY(-1px) scale(0.995);
  }
  
  /* Card image dynamic zoom */
  .tai-card-hover img.tai-zoomable,
  .tai-card:hover img.tai-zoomable {
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .tai-card-hover:hover img.tai-zoomable,
  .tai-card:hover img.tai-zoomable {
    transform: scale(1.04);
  }

  .tai-row { display:flex; align-items:center; }
  .tai-between { justify-content:space-between; }
  .tai-gap4 { gap:4px; } .tai-gap6 { gap:6px; } .tai-gap8 { gap:8px; } .tai-gap10 { gap:10px; } .tai-gap12 { gap:12px; } .tai-gap14 { gap:14px; } .tai-gap16 { gap:16px; } .tai-gap18 { gap:18px; } .tai-gap20 { gap:20px; }
  .tai-col { display:flex; flex-direction:column; }
  .tai-mt4 { margin-top:4px; } .tai-mt6 { margin-top:6px; } .tai-mt8 { margin-top:8px; } .tai-mt10 { margin-top:10px; } .tai-mt12 { margin-top:12px; } .tai-mt14 { margin-top:14px; } .tai-mt16 { margin-top:16px; } .tai-mt20 { margin-top:20px; } .tai-mt24 { margin-top:24px; }
  .tai-label { font-size:11.5px; font-weight:700; color: var(--text-3); text-transform:uppercase; letter-spacing:.06em; }
  .tai-title-sm { font-size:16px; font-weight:800; letter-spacing: -0.01em; color: var(--text); }
  .tai-body-text { font-size: 13.5px; color: var(--text-2); line-height:1.5; }
  
  /* Buttons with micro spring animations */
  .tai-btn { border:none; cursor:pointer; border-radius: 12px; font-weight:700; font-size:14px; padding: 12px 20px;
    display:flex; align-items:center; justify-content:center; gap:8px; transition: all .18s cubic-bezier(0.16, 1, 0.3, 1); font-family: var(--font); }
  .tai-btn-primary { background: var(--grad); color:#fff; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.32); }
  .tai-btn-primary:hover { opacity: 0.96; transform: translateY(-2px); box-shadow: 0 8px 22px -2px rgba(79, 70, 229, 0.48); }
  .tai-btn-primary:active { transform: scale(.96); }
  .tai-btn-ghost { background: var(--surface-2); color: var(--primary); font-weight: 700; }
  .tai-btn-ghost:hover { background: #E0E7FF; color: var(--primary-dark); transform: translateY(-1px); }
  .tai-btn-ghost:active { transform: scale(.96); }
  .tai-btn-outline { background: var(--surface); border: 1.5px solid var(--border); color: var(--text); font-weight: 600; }
  .tai-btn-outline:hover { background: var(--surface-2); border-color: rgba(99, 102, 241, 0.3); transform: translateY(-1px); }
  .tai-btn-outline:active { transform: scale(.96); }
  .tai-btn-sm { padding: 8px 14px; font-size:12.5px; border-radius:10px; }
  
  /* Interactive Pills with spring motion */
  .tai-pill { padding:7px 16px; border-radius:999px; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; border: 1px solid transparent; transition: all .18s cubic-bezier(0.16, 1, 0.3, 1); }
  .tai-pill:hover { transform: translateY(-1px); }
  .tai-pill:active { transform: scale(0.96); }
  .tai-pill-active { background: var(--primary); color:#fff; box-shadow: 0 4px 14px -2px rgba(79, 70, 229, 0.4); }
  .tai-pill-inactive { background: var(--surface); color: var(--text-2); border-color: var(--border); }
  .tai-pill-inactive:hover { background: var(--surface-2); color: var(--text); border-color: #CBD5E1; }
  
  /* Dynamic tags */
  .tai-tag { padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight:700; background: var(--surface-2); color: var(--primary); letter-spacing: 0.02em; transition: all .16s ease; }
  .tai-tag:hover { transform: scale(1.03); }
  
  .tai-scrollx { display:flex; gap:10px; overflow-x:auto; padding-bottom:4px; -ms-overflow-style:none; scrollbar-width:none; }
  .tai-scrollx::-webkit-scrollbar { display:none; }
  .tai-progress-track { width:100%; height:8px; border-radius:99px; background: var(--surface-2); overflow:hidden; }
  .tai-progress-fill { height:100%; border-radius:99px; background: var(--grad); transition: width .35s cubic-bezier(0.16, 1, 0.3, 1); }
  .tai-avatar { border-radius:50%; background: var(--grad); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; flex-shrink:0; box-shadow: 0 2px 8px rgba(79,70,229,0.25); }
  .tai-divider { height:1px; background: var(--border); border:none; margin: 14px 0; }
  
  /* Full-width attached bottom navigation on mobile with dynamic glowing pill motion */
  .tai-navbar {
    position: fixed; left: 0; right: 0; bottom: 0; width: 100vw; max-width: 100%;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(226, 232, 240, 0.85);
    display: flex; justify-content: space-around; align-items: center;
    padding: 8px 14px max(12px, env(safe-area-inset-bottom)); z-index: 100;
    box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.06), inset 0 1px 0 0 rgba(255, 255, 255, 0.8);
    transition: background .25s ease, border-color .25s ease, box-shadow .25s ease;
  }
  .tai.dark .tai-navbar {
    background: rgba(13, 18, 34, 0.94);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 -6px 30px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
  }
  .tai-navitem {
    display: flex; flex-direction: row; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-3); padding: 8px 14px; border-radius: 999px;
    background: transparent; border: none; outline: none;
    transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .tai-navitem:hover {
    color: var(--text);
  }
  .tai-navitem-icon-wrap {
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), filter 0.25s ease;
  }
  .tai-navitem-label {
    max-width: 0; opacity: 0; transform: scale(0.7);
    overflow: hidden; white-space: nowrap; margin-left: 0;
    font-size: 12.5px; font-weight: 800; letter-spacing: 0.02em;
    transition: max-width 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                margin-left 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }
  /* Active dynamic glowing pill state */
  .tai-navitem.active {
    background: var(--grad); color: #FFFFFF;
    padding: 8px 18px;
    box-shadow: 0 4px 18px rgba(79, 70, 229, 0.45);
    transform: translateY(-2px);
  }
  .tai-navitem.active .tai-navitem-icon-wrap {
    transform: scale(1.08);
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.7));
  }
  .tai-navitem.active .tai-navitem-label {
    max-width: 90px; opacity: 1; transform: scale(1);
    margin-left: 7px; color: #FFFFFF;
    text-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .tai-input { width:100%; border-radius:12px; border:1px solid var(--border); background: var(--surface); padding: 12px 16px;
    font-size:13.5px; color: var(--text); font-family: var(--font); transition: all .18s ease; }
  .tai-input:focus { outline:none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); transform: translateY(-1px); }
  .tai-fade-in { animation: fadeInScale .24s cubic-bezier(.16,1,.3,1) both; }
  .tai-switch { width:44px; height:26px; border-radius:99px; background: var(--surface-2); position:relative; cursor:pointer; flex-shrink:0; transition: background .18s ease; border: 1px solid var(--border); }
  .tai-switch.on { background: var(--primary); border-color: var(--primary); }
  .tai-switch-knob { width:20px; height:20px; border-radius:50%; background:#fff; position:absolute; top:2px; left:2px; transition: left .18s cubic-bezier(.16,1,.3,1); box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  .tai-switch.on .tai-switch-knob { left:20px; }
  .tai-empty { text-align:center; padding: 42px 18px; color: var(--text-2); }
  .tai-grid2 { display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px; }
  .tai-grid3 { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px; }
  .tai-grid4 { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:20px; }
  .tai-link { color: var(--primary); font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:3px; transition: all .16s ease; }
  .tai-link:hover { transform: translateX(2px); }
  .tai-dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.62fr) minmax(320px, 1fr); gap: 24px; align-items: start; }
  @media (max-width: 980px) {
    .tai-dashboard-grid { grid-template-columns: 1fr; }
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
      {right && <div className="tai-row tai-gap8">{right}</div>}
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
      <div className="tai-header-left">
        <div className="tai-header-brand" onClick={() => go?.("home")} style={{ cursor: "pointer" }}>
          <img
            src={brandLogoUrl || defaultLogo}
            alt="Train AI"
            className="tai-header-logo"
            style={{ height: 44, width: "auto", maxWidth: 140, objectFit: "contain", display: "block" }}
          />
        </div>
        {searchComponent}
      </div>

      <div className="tai-header-right">
        {/* Streak Pill */}
        <div className="tai-streak-pill" onClick={() => go?.("achievements")} title="Active Streak">
          <Flame size={14} color="#EA580C" />
          <span>{user?.streak || 8} <span className="tai-pill-unit">days</span></span>
        </div>

        {/* AI Credits Pill */}
        <div className="tai-credits-pill" onClick={onBuyCredits || (() => go?.("creditsCheckout"))} title="AI Neural Credits">
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
            <Bell size={17} />
            {unreadNotifs > 0 && (
              <span style={{
                position: "absolute", top: 5, right: 5, minWidth: 15, height: 15,
                borderRadius: 99, background: "var(--danger)", color: "#fff",
                fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px", border: "2px solid #fff"
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
            size={34}
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
              <div
                className={`tai-sub-item ${activeScreen === "community" && currentTab === "leaderboard" ? "active" : ""}`}
                onClick={() => go("leaderboard")}
                title="Leaderboard & Rank"
              >
                <Trophy size={15} />
                <span>Rank</span>
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
          title="My Profile"
        >
          <Settings size={16} />
          <span>Profile</span>
        </div>
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
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>
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

export function LearningPathsView({ push, back }) {
  const TRACKS = [
    {
      id: "track-1",
      title: "AI & Product Engineering Career Track",
      category: "Full-Stack AI",
      progress: 68,
      hours: "48 hours",
      coursesCount: 4,
      skills: ["React 19", "Figma AI", "Supabase", "Vector DBs", "LLM APIs"],
      steps: [
        { title: "Master Design Systems in Figma with AI", status: "completed", hours: "12h" },
        { title: "Full-Stack AI Application Engineering", status: "in_progress", hours: "16h" },
        { title: "Cloud Infrastructure & Microservices", status: "upcoming", hours: "10h" },
        { title: "Capstone: Production AI Agent Deployment", status: "upcoming", hours: "10h" }
      ]
    },
    {
      id: "track-2",
      title: "Generative AI & Autonomous Agent Architect",
      category: "AI & Agents",
      progress: 25,
      hours: "36 hours",
      coursesCount: 3,
      skills: ["LangChain", "Autonomous Agents", "Prompt Design", "RAG Pipelines"],
      steps: [
        { title: "Prompt Engineering & Multi-Modal Generation", status: "completed", hours: "8h" },
        { title: "Building Autonomous Agent Workflows", status: "in_progress", hours: "14h" },
        { title: "Enterprise RAG & Knowledge Graphs", status: "upcoming", hours: "14h" }
      ]
    },
    {
      id: "track-3",
      title: "Spatial UI & Modern Frontend Mastery",
      category: "Design & UX",
      progress: 0,
      hours: "40 hours",
      coursesCount: 4,
      skills: ["Spatial Design", "Figma Variables", "Motion UI", "Accessibility"],
      steps: [
        { title: "UI/UX Principles for Modern Web & Mobile", status: "upcoming", hours: "10h" },
        { title: "Micro-interactions & After Effects for UI", status: "upcoming", hours: "10h" },
        { title: "Spatial Computing Interfaces in Three.js", status: "upcoming", hours: "12h" },
        { title: "Design Systems Governance & Tokens", status: "upcoming", hours: "8h" }
      ]
    }
  ];

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBar title="Learning Paths & Career Tracks" sub="Structured milestone journeys designed for job-ready skill mastery" onBack={back} />

      <div className="tai-col tai-gap16">
        {TRACKS.map((track) => (
          <div
            key={track.id}
            className="tai-card tai-card-hover"
            style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 10 }}>
              <div>
                <Tag tone="primary">{track.category}</Tag>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "8px 0 4px" }}>
                  {track.title}
                </h3>
                <div style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 600 }}>
                  {track.coursesCount} courses • {track.hours} total duration
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)" }}>{track.progress}% Complete</div>
                <div style={{ width: 140, marginTop: 6 }}><ProgressBar value={track.progress} height={7} /></div>
              </div>
            </div>

            {/* Skills Pills */}
            <div className="tai-row tai-gap6 tai-mt12" style={{ flexWrap: "wrap" }}>
              {track.skills.map((s) => (
                <span key={s} style={{ fontSize: 11, fontWeight: 700, background: "var(--surface-2)", color: "var(--text-2)", padding: "3px 8px", borderRadius: 6 }}>
                  {s}
                </span>
              ))}
            </div>

            {/* Step-by-Step Curriculum Roadmap */}
            <div className="tai-col tai-gap8 tai-mt16" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
              {track.steps.map((step, idx) => (
                <div key={idx} className="tai-row tai-between" style={{ padding: "8px 12px", background: "var(--surface-3)", borderRadius: 10 }}>
                  <div className="tai-row tai-gap10">
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: step.status === "completed" ? "var(--success-bg)" : step.status === "in_progress" ? "var(--primary-tint)" : "var(--surface-2)",
                      color: step.status === "completed" ? "var(--success)" : step.status === "in_progress" ? "var(--primary)" : "var(--text-3)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800
                    }}>
                      {step.status === "completed" ? "✓" : idx + 1}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{step.title}</span>
                  </div>
                  <div className="tai-row tai-gap10">
                    <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{step.hours}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                      color: step.status === "completed" ? "var(--success)" : step.status === "in_progress" ? "var(--primary)" : "var(--text-3)"
                    }}>
                      {step.status === "completed" ? "Completed" : step.status === "in_progress" ? "In Progress" : "Locked"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="tai-row tai-between tai-mt16" style={{ paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Includes Verified Certificate upon completion</span>
              <button
                className="tai-btn tai-btn-primary tai-btn-sm"
                onClick={() => push("courseDetail", { id: "stock-1" })}
              >
                {track.progress > 0 ? "Continue Track →" : "Start Learning Path →"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
