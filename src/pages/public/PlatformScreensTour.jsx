import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, BookOpen, Brain, Users, BarChart3,
  Target, Sparkles, CheckCircle2, Play, Flame, Award, ArrowUpRight,
  TrendingUp, Shield, MessageSquare, Clock, Zap, Search, Bell, Lock
} from "lucide-react";
import "./PlatformScreensTour.css";

const SCREENS = [
  {
    id: "learner-dashboard",
    category: "learner",
    categoryLabel: "Learners Section",
    roleBadge: "Learner Portal",
    title: "Learner Dashboard & Active Tracks",
    subtitle: "A focused daily workspace keeping learners on pace across assignments, goals, and cohort milestones.",
    highlightPill: "Daily Progress",
    urlPath: "app.trainailtd.com/learner/home",
    stats: [
      { label: "Current Progress", value: "74%" },
      { label: "Weekly Commitment", value: "4 of 5 Done" },
      { label: "Active Learning Streak", value: "12 Days 🔥" },
    ],
    renderPreview: () => (
      <div className="pst-mock-body">
        {/* Learner Portal Top Bar */}
        <div className="pst-mock-nav">
          <div className="pst-mock-nav-brand">
            <span className="pst-mock-logo-mark">T</span>
            <span className="pst-mock-logo-text">Train AI</span>
            <span className="pst-mock-badge pst-badge-blue">Learner</span>
          </div>
          <div className="pst-mock-nav-search">
            <Search size={13} />
            <span>Search modules, topics, resources...</span>
          </div>
          <div className="pst-mock-nav-user">
            <div className="pst-mock-icon-btn"><Bell size={14} /><span className="pst-notif-dot" /></div>
            <div className="pst-avatar-sm">OF</div>
          </div>
        </div>

        {/* Welcome Greeting */}
        <div className="pst-welcome-banner">
          <div>
            <h3>Welcome back, Olamide 👋</h3>
            <p>You’re 74% through <strong>Foundations of Applied AI</strong>. Keep your momentum going!</p>
          </div>
          <div className="pst-streak-pill">
            <Flame size={16} color="#F97316" />
            <span>12-Day Streak</span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="pst-grid-2col">
          {/* Active Course Card */}
          <div className="pst-card pst-card-hero">
            <div className="pst-card-tag">
              <span className="pst-tag pst-tag-blue">ACTIVE COHORT</span>
              <span className="pst-tag-sub">FLIP Fellowship · Cohort 1</span>
            </div>
            <h4>Foundations of Applied AI & Prompt Systems</h4>
            <p className="pst-card-desc">Module 3: Structured Contexts, Output Schemas, and Fine-Tuning</p>
            <div className="pst-progress-bar-wrap">
              <div className="pst-progress-labels">
                <span>Progress: 14/19 Lessons</span>
                <span className="pst-fw-bold">74%</span>
              </div>
              <div className="pst-progress-track">
                <div className="pst-progress-fill" style={{ width: "74%" }} />
              </div>
            </div>
            <div className="pst-card-footer">
              <button type="button" className="pst-btn-primary">
                <Play size={13} fill="currentColor" />
                <span>Resume Lesson 15</span>
              </button>
              <span className="pst-hint-text">Est. 18 mins remaining</span>
            </div>
          </div>

          {/* Right Column Cards */}
          <div className="pst-col-stack">
            {/* Weekly Commitment */}
            <div className="pst-card pst-card-sm">
              <div className="pst-card-header-sm">
                <span className="pst-card-title-sm">This Week's Goal</span>
                <span className="pst-badge-green">On Track</span>
              </div>
              <div className="pst-goal-stat">
                <span className="pst-big-num">4 <span className="pst-num-sub">/ 5</span></span>
                <span className="pst-sub-text">lessons completed this week</span>
              </div>
              <div className="pst-dots-row">
                {[1, 2, 3, 4].map((i) => <span key={i} className="pst-dot-done"><CheckCircle2 size={12} /></span>)}
                <span className="pst-dot-pending" />
              </div>
            </div>

            {/* Upcoming Live Mentorship */}
            <div className="pst-card pst-card-sm">
              <div className="pst-card-header-sm">
                <span className="pst-card-title-sm">Next Live Session</span>
                <span className="pst-live-badge"><span className="pst-pulse-dot" /> Tomorrow</span>
              </div>
              <div className="pst-session-info">
                <strong>Cohort Workshop: Model Evaluation</strong>
                <span>4:00 PM GMT · With Instructor Jordan</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "learner-lesson-ai",
    category: "learner",
    categoryLabel: "Learners Section",
    roleBadge: "AI Learning Coach",
    title: "Interactive Lessons with AI Assistant",
    subtitle: "Structured course materials alongside an on-demand AI Coach providing real-time explanations and concept checks.",
    highlightPill: "Instant Tutoring",
    urlPath: "app.trainailtd.com/learner/courses/ai-systems/lesson-15",
    stats: [
      { label: "AI Coach Availability", value: "24/7 Realtime" },
      { label: "Checkpoint Quiz", value: "3/3 Answered" },
      { label: "Response Speed", value: "< 1.2s" },
    ],
    renderPreview: () => (
      <div className="pst-mock-body">
        {/* Lesson Breadcrumb */}
        <div className="pst-lesson-crumb">
          <span>Foundations of Applied AI</span>
          <span>&rsaquo;</span>
          <span>Module 3: Structured Contexts</span>
          <span>&rsaquo;</span>
          <strong className="pst-crumb-current">Lesson 15: Output Schema Control</strong>
        </div>

        {/* 2-Column Split: Lesson Content & AI Coach */}
        <div className="pst-lesson-split">
          {/* Main Lesson Content */}
          <div className="pst-lesson-main">
            <div className="pst-video-placeholder">
              <div className="pst-video-overlay">
                <div className="pst-play-circle"><Play size={22} fill="white" /></div>
                <span>Video Walkthrough: Defining Pydantic & JSON Schemas (12:40)</span>
              </div>
            </div>
            <div className="pst-lesson-notes">
              <h5>Key Learning Objectives</h5>
              <ul>
                <li>Understand how temperature and schema constraints mitigate hallucinations.</li>
                <li>Implement schema validation for high-reliability enterprise pipelines.</li>
              </ul>
              <div className="pst-code-box">
                <code>{`const response = await ai.generate({ schema: UserSchema, enforce: true });`}</code>
              </div>
            </div>
          </div>

          {/* AI Coach Sidebar */}
          <div className="pst-ai-coach-panel">
            <div className="pst-coach-header">
              <div className="pst-coach-title">
                <Brain size={16} color="#2563EB" />
                <strong>Train AI Coach</strong>
              </div>
              <span className="pst-badge-green-sm">Online</span>
            </div>

            <div className="pst-chat-scroll">
              <div className="pst-chat-msg pst-chat-user">
                <p>Can you explain why enforcing a JSON schema prevents model drift?</p>
              </div>
              <div className="pst-chat-msg pst-chat-bot">
                <div className="pst-bot-avatar"><Sparkles size={12} color="#2563EB" /></div>
                <p>
                  Enforcing schemas constrains output tokens during sampling, forcing the model to adhere strictly to your data contracts.
                </p>
              </div>
              <div className="pst-quiz-prompt">
                <span className="pst-quiz-tag"><Zap size={11} /> Quick Quiz</span>
                <p>Which parameter is best reduced when deterministic outputs are needed?</p>
                <div className="pst-quiz-opt pst-quiz-opt-correct">
                  <CheckCircle2 size={12} color="#16A34A" /> Temperature (set to 0.0)
                </div>
              </div>
            </div>

            <div className="pst-chat-input-fake">
              <span>Ask a question about this lesson...</span>
              <button type="button" className="pst-send-btn"><ArrowUpRight size={13} /></button>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "learner-community",
    category: "learner",
    categoryLabel: "Learners Section",
    roleBadge: "Community & Cohort",
    title: "Cohort Collaboration & Study Groups",
    subtitle: "Discussion threads, peer feedback, instructor announcements, and healthy gamified study leagues.",
    highlightPill: "Peer Learning",
    urlPath: "app.trainailtd.com/learner/community",
    stats: [
      { label: "Cohort Peers Online", value: "42 Learners" },
      { label: "Community Ranking", value: "Top 5%" },
      { label: "Weekly Discussion", value: "128 Posts" },
    ],
    renderPreview: () => (
      <div className="pst-mock-body">
        <div className="pst-community-layout">
          {/* Left Channels */}
          <div className="pst-community-sidebar">
            <span className="pst-sub-heading-xs">COHORT CHANNELS</span>
            <div className="pst-channel-item active"># general-flip-fellowship</div>
            <div className="pst-channel-item"># module-3-practicum</div>
            <div className="pst-channel-item"># capstone-ideas</div>
            <div className="pst-channel-item"># resources-and-tips</div>

            <span className="pst-sub-heading-xs" style={{ marginTop: 14 }}>STUDY GROUPS</span>
            <div className="pst-channel-item">👥 AI Explorers (Group 2)</div>
            <div className="pst-channel-item">👥 Neural Innovators</div>
          </div>

          {/* Middle Feed */}
          <div className="pst-community-feed">
            <div className="pst-feed-header">
              <strong># general-flip-fellowship</strong>
              <span className="pst-muted-sm">42 members active now</span>
            </div>

            {/* Post 1 */}
            <div className="pst-feed-card">
              <div className="pst-post-author">
                <div className="pst-avatar-sm pst-avatar-alt">OF</div>
                <div>
                  <strong>Olamide Fasoranti</strong>
                  <span>FLIP Fellow · 2 hours ago</span>
                </div>
              </div>
              <p className="pst-post-text">
                Just submitted my structured output pipeline assignment! Used Pydantic schema validation with 99.4% accuracy on synthetic edge tests.
              </p>
              <div className="pst-post-reactions">
                <span className="pst-reaction-pill">👏 14</span>
                <span className="pst-reaction-pill">🚀 8</span>
                <span className="pst-reply-count"><MessageSquare size={12} /> 4 replies</span>
              </div>
            </div>

            {/* Instructor Reply */}
            <div className="pst-feed-reply">
              <div className="pst-reply-author">
                <div className="pst-avatar-sm pst-avatar-instructor">WA</div>
                <div>
                  <strong>Wale Adebayo <span className="pst-badge-instructor">Instructor</span></strong>
                  <span>Superb work Olamide! The latency benchmarks were standout.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Leaderboard Card */}
          <div className="pst-community-aside">
            <div className="pst-card pst-card-clean">
              <div className="pst-aside-title">
                <Award size={15} color="#F59E0B" />
                <strong>Weekly League</strong>
              </div>
              <div className="pst-leader-row pst-rank-1">
                <span className="pst-rank-badge">1</span>
                <span className="pst-leader-name">Amara Chen</span>
                <span className="pst-leader-pts">1,840 XP</span>
              </div>
              <div className="pst-leader-row pst-rank-2">
                <span className="pst-rank-badge">2</span>
                <span className="pst-leader-name">David Osei</span>
                <span className="pst-leader-pts">1,620 XP</span>
              </div>
              <div className="pst-leader-row pst-rank-3 pst-current-user">
                <span className="pst-rank-badge">3</span>
                <span className="pst-leader-name">Olamide F. (You)</span>
                <span className="pst-leader-pts">1,490 XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "admin-summary",
    category: "admin",
    categoryLabel: "Admin Section",
    roleBadge: "Admin Console",
    title: "Organisation Workspace & Operations",
    subtitle: "Complete operational visibility: monitor cohort completion, active learners, seat allocations, and instructor delivery.",
    highlightPill: "Executive Visibility",
    urlPath: "app.trainailtd.com/admin/dashboard",
    stats: [
      { label: "Active Cohorts", value: "3 Active" },
      { label: "Avg Completion Rate", value: "89.2%" },
      { label: "Seat Utilization", value: "48 of 50 (96%)" },
    ],
    renderPreview: () => (
      <div className="pst-mock-body">
        {/* Admin Navigation Bar */}
        <div className="pst-mock-nav pst-mock-nav-admin">
          <div className="pst-mock-nav-brand">
            <span className="pst-mock-logo-mark pst-mark-admin">A</span>
            <div>
              <span className="pst-mock-logo-text">Sara Foundation Africa</span>
              <span className="pst-sub-org">Train AI Enterprise Tenant</span>
            </div>
          </div>
          <div className="pst-admin-links">
            <span className="active">Overview</span>
            <span>Cohorts</span>
            <span>Learners</span>
            <span>Intelligence</span>
            <span>Settings</span>
          </div>
          <div className="pst-mock-nav-user">
            <span className="pst-badge-admin-role">Super Admin</span>
          </div>
        </div>

        {/* KPI Metric Cards */}
        <div className="pst-kpi-grid">
          <div className="pst-kpi-card">
            <span className="pst-kpi-label">TOTAL ENROLLED</span>
            <div className="pst-kpi-val-row">
              <span className="pst-kpi-val">384</span>
              <span className="pst-trend-pill pst-trend-up">+14% MoM</span>
            </div>
            <span className="pst-kpi-sub">Across 3 active cohorts</span>
          </div>

          <div className="pst-kpi-card">
            <span className="pst-kpi-label">AVG COMPLETION RATE</span>
            <div className="pst-kpi-val-row">
              <span className="pst-kpi-val">89.2%</span>
              <span className="pst-trend-pill pst-trend-up">Target: 80%</span>
            </div>
            <span className="pst-kpi-sub">+6.4% above benchmark</span>
          </div>

          <div className="pst-kpi-card">
            <span className="pst-kpi-label">SEAT LICENSES</span>
            <div className="pst-kpi-val-row">
              <span className="pst-kpi-val">48 <span className="pst-kpi-denom">/ 50</span></span>
              <span className="pst-trend-pill pst-trend-neutral">96% Capacity</span>
            </div>
            <span className="pst-kpi-sub">2 invitations pending</span>
          </div>

          <div className="pst-kpi-card">
            <span className="pst-kpi-label">LEARNER ENGAGEMENT</span>
            <div className="pst-kpi-val-row">
              <span className="pst-kpi-val">94.8%</span>
              <span className="pst-trend-pill pst-trend-up">High</span>
            </div>
            <span className="pst-kpi-sub">Weekly active touchpoints</span>
          </div>
        </div>

        {/* Cohort Summary Table */}
        <div className="pst-card pst-table-card">
          <div className="pst-table-header">
            <strong>Active Cohort Performance</strong>
            <span className="pst-link-inline">Export Reports &rarr;</span>
          </div>
          <div className="pst-table-wrap">
            <table className="pst-table">
              <thead>
                <tr>
                  <th>COHORT</th>
                  <th>LEARNERS</th>
                  <th>PROGRESS</th>
                  <th>ON-TRACK RATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>FLIP Fellowship · Cohort 1</strong></td>
                  <td>42 learners</td>
                  <td>
                    <div className="pst-mini-progress">
                      <div className="pst-mini-bar" style={{ width: "92%" }} />
                      <span>92%</span>
                    </div>
                  </td>
                  <td><span className="pst-badge-green-sm">95.2%</span></td>
                  <td><span className="pst-status-pill pst-pill-active">Active</span></td>
                </tr>
                <tr>
                  <td><strong>Applied AI & Data Apprenticeship</strong></td>
                  <td>35 learners</td>
                  <td>
                    <div className="pst-mini-progress">
                      <div className="pst-mini-bar" style={{ width: "74%" }} />
                      <span>74%</span>
                    </div>
                  </td>
                  <td><span className="pst-badge-green-sm">88.5%</span></td>
                  <td><span className="pst-status-pill pst-pill-active">Active</span></td>
                </tr>
                <tr>
                  <td><strong>Digital Skills Enterprise Fast-Track</strong></td>
                  <td>28 learners</td>
                  <td>
                    <div className="pst-mini-progress">
                      <div className="pst-mini-bar" style={{ width: "98%" }} />
                      <span>98%</span>
                    </div>
                  </td>
                  <td><span className="pst-badge-green-sm">99.1%</span></td>
                  <td><span className="pst-status-pill pst-pill-grad">Graduating</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "admin-intelligence",
    category: "admin",
    categoryLabel: "Admin Section",
    roleBadge: "Workforce Intelligence",
    title: "Workforce Skill Diagnostics & Readiness",
    subtitle: "Identify capability gaps across teams, benchmark progress against industry frameworks, and view AI synthesis summaries.",
    highlightPill: "Skill Intelligence",
    urlPath: "app.trainailtd.com/admin/intelligence",
    stats: [
      { label: "Overall Readiness", value: "84 / 100" },
      { label: "Skill Velocity", value: "+18% QoQ" },
      { label: "Critical Gaps", value: "0 Identified" },
    ],
    renderPreview: () => (
      <div className="pst-mock-body">
        <div className="pst-intel-grid">
          {/* Left: Skill Benchmarks */}
          <div className="pst-card pst-card-intel">
            <div className="pst-card-header-sm">
              <div>
                <strong>Workforce Capability Matrix</strong>
                <p className="pst-sub-text">Assessed across 384 active learners in programme</p>
              </div>
              <span className="pst-badge-blue">Q3 Benchmark</span>
            </div>

            <div className="pst-skill-bars">
              <div className="pst-skill-row">
                <div className="pst-skill-meta">
                  <span>Prompt Engineering & Systems Design</span>
                  <strong>94% (Advanced)</strong>
                </div>
                <div className="pst-bar-bg"><div className="pst-bar-val" style={{ width: "94%" }} /></div>
              </div>

              <div className="pst-skill-row">
                <div className="pst-skill-meta">
                  <span>Data Pipelines & Feature Structuring</span>
                  <strong>86% (Proficient)</strong>
                </div>
                <div className="pst-bar-bg"><div className="pst-bar-val" style={{ width: "86%" }} /></div>
              </div>

              <div className="pst-skill-row">
                <div className="pst-skill-meta">
                  <span>Model Evaluation & Bias Auditing</span>
                  <strong>78% (Target Focus)</strong>
                </div>
                <div className="pst-bar-bg"><div className="pst-bar-val" style={{ width: "78%", background: "#F59E0B" }} /></div>
              </div>

              <div className="pst-skill-row">
                <div className="pst-skill-meta">
                  <span>Workforce Automation & Tool Integration</span>
                  <strong>91% (Advanced)</strong>
                </div>
                <div className="pst-bar-bg"><div className="pst-bar-val" style={{ width: "91%" }} /></div>
              </div>
            </div>
          </div>

          {/* Right: AI Executive Synthesis */}
          <div className="pst-col-stack">
            <div className="pst-card pst-card-ai-summary">
              <div className="pst-ai-badge-row">
                <div className="pst-sparkle-icon"><Sparkles size={14} color="#2563EB" /></div>
                <strong>AI Executive Synthesis</strong>
              </div>
              <p className="pst-ai-summary-text">
                "Cohort 1 demonstrates rapid mastery in LLM orchestration. 92% of learners cleared practical prompt evaluation without intervention. Recommended next step: deploy Module 4 hands-on evaluation sandbox to reinforce edge-case testing."
              </p>
              <div className="pst-summary-meta">
                <span>Generated for Programme Directors</span>
                <span>Updated 1 hour ago</span>
              </div>
            </div>

            <div className="pst-card pst-card-action">
              <strong>Need a formal review for leadership?</strong>
              <p>Export consolidated PDF readiness cards with breakdown per department or cohort.</p>
              <button type="button" className="pst-btn-outline">
                <span>Download Executive Briefing</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export default function PlatformScreensTour() {
  const [filter, setFilter] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const filteredScreens = SCREENS.filter((s) => filter === "all" || s.category === filter);

  // Keep index within bounds if filter changes
  useEffect(() => {
    if (currentIndex >= filteredScreens.length) {
      setCurrentIndex(0);
    }
  }, [filter, filteredScreens.length, currentIndex]);

  const activeScreen = filteredScreens[currentIndex] || filteredScreens[0];

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? filteredScreens.length - 1 : prev - 1));
  }, [filteredScreens.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === filteredScreens.length - 1 ? 0 : prev + 1));
  }, [filteredScreens.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (touchStartX.current && touchEndX.current && Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <section id="screens" className="lp-section lp-screens-section">
      <div className="lp-shell">
        {/* Section Header */}
        <div className="lp-section-heading pst-header-center">
          <p className="lp-kicker">HAVE A LOOK INSIDE</p>
          <h2>Experience the platform from both perspectives.</h2>
          <p>
            Explore the screens where learners study, practise and collaborate, and the summary workspace where administrators manage cohorts and track readiness.
          </p>

          {/* Section Filter Pills */}
          <div className="pst-filter-bar">
            <button
              type="button"
              className={`pst-filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => { setFilter("all"); setCurrentIndex(0); }}
            >
              All Screens ({SCREENS.length})
            </button>
            <button
              type="button"
              className={`pst-filter-btn ${filter === "learner" ? "active" : ""}`}
              onClick={() => { setFilter("learner"); setCurrentIndex(0); }}
            >
              <BookOpen size={14} />
              Learners Section (3)
            </button>
            <button
              type="button"
              className={`pst-filter-btn ${filter === "admin" ? "active" : ""}`}
              onClick={() => { setFilter("admin"); setCurrentIndex(0); }}
            >
              <BarChart3 size={14} />
              Admin Section (2)
            </button>
          </div>
        </div>

        {/* Carousel Showcase Card */}
        <div
          className="pst-carousel-container"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Control & Title Bar */}
          <div className="pst-tour-header">
            <div className="pst-tour-title-block">
              <div className="pst-title-badge-row">
                <span className={`pst-category-badge ${activeScreen.category === "admin" ? "pst-cat-admin" : "pst-cat-learner"}`}>
                  {activeScreen.categoryLabel}
                </span>
                <span className="pst-role-pill">{activeScreen.roleBadge}</span>
              </div>
              <h3 className="pst-screen-heading">{activeScreen.title}</h3>
              <p className="pst-screen-desc">{activeScreen.subtitle}</p>
            </div>

            {/* Nav Arrows in header for desktop */}
            <div className="pst-nav-controls">
              <button
                type="button"
                className="pst-arrow-btn"
                onClick={handlePrev}
                aria-label="Previous screen"
                title="Previous screen"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="pst-counter-text">
                <span className="pst-counter-current">0{currentIndex + 1}</span>
                <span className="pst-counter-sep">/</span>
                <span className="pst-counter-total">0{filteredScreens.length}</span>
              </div>
              <button
                type="button"
                className="pst-arrow-btn"
                onClick={handleNext}
                aria-label="Next screen"
                title="Next screen"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Browser Window Frame Preview */}
          <div className="pst-browser-frame">
            {/* Window Chrome Header */}
            <div className="pst-browser-chrome">
              <div className="pst-traffic-lights">
                <span className="pst-light pst-light-red" />
                <span className="pst-light pst-light-yellow" />
                <span className="pst-light pst-light-green" />
              </div>
              <div className="pst-url-bar">
                <Lock size={12} color="#64748B" />
                <span className="pst-url-text">{activeScreen.urlPath}</span>
              </div>
              <span className="pst-live-chip">Live Preview</span>
            </div>

            {/* Screen Content Render */}
            <div className="pst-screen-viewport" key={activeScreen.id}>
              {activeScreen.renderPreview()}
            </div>
          </div>

          {/* Footer Metadata & Navigation Arrows */}
          <div className="pst-tour-footer">
            {/* Quick Metrics Bar */}
            <div className="pst-meta-stats">
              {activeScreen.stats.map((st) => (
                <div key={st.label} className="pst-stat-item">
                  <span className="pst-stat-label">{st.label}</span>
                  <span className="pst-stat-value">{st.value}</span>
                </div>
              ))}
            </div>

            {/* Navigation Arrows inside card (Matches user screenshot: media_1790953925886.jpg) */}
            <div className="pst-arrows-inline">
              <button
                type="button"
                className="pst-arrow-btn-prev"
                onClick={handlePrev}
                aria-label="Previous screen"
                title="Previous screen"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="pst-arrow-btn-next"
                onClick={handleNext}
                aria-label="Next screen"
                title="Next screen"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Pagination Dots below card (Elongated active pill matching user screenshot) */}
        <div className="pst-pagination-dots" role="tablist" aria-label="Screens navigation">
          {filteredScreens.map((sc, idx) => (
            <button
              key={sc.id}
              type="button"
              className={`pst-dot ${idx === currentIndex ? "pst-dot-active" : ""}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to ${sc.title}`}
              aria-selected={idx === currentIndex}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
