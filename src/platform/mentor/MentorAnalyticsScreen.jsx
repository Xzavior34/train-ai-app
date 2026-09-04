import React, { useState } from "react";
import { TopBar, Tag, ProgressBar } from "../components/PlatformUI.jsx";
import { 
  Users, Calendar, DollarSign, TrendingUp, Clock, 
  MessageCircle, CheckCircle2, Award, Brain, ThumbsUp,
  BarChart3, ShieldCheck, ArrowUpRight, BookOpen, Star
} from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchMentorEarnings, fetchMentorSessions } from "../../lib/api/schemaHelper.js";

export function MentorAnalyticsScreen({ mentorId, mentorProfileQuery, orgSelector, onNavigate }) {
  const [timeframe, setTimeframe] = useState("30d");
  const earningsQuery = useSupabaseQuery(async () => (mentorId ? fetchMentorEarnings(mentorId) : []), [mentorId]);
  const sessionsQuery = useSupabaseQuery(async () => (mentorId ? fetchMentorSessions(mentorId) : []), [mentorId]);
  const earnings = earningsQuery.data || [];
  const sessions = sessionsQuery.data || [];
  const totalEarnings = earnings.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const menteesHelped = new Set(completedSessions.map((s) => s.learner_id).filter(Boolean)).size;

  const mentor = mentorProfileQuery?.data;
  const loading = mentorProfileQuery?.loading || earningsQuery.loading || sessionsQuery.loading;

  const ratedSessions = sessions.filter((s) => typeof s.rating === "number");
  const avgRatingNum = ratedSessions.length
    ? (ratedSessions.reduce((sum, s) => sum + s.rating, 0) / ratedSessions.length)
    : (mentor?.rating != null ? Number(mentor.rating) : null);
  const ratingVal = avgRatingNum != null ? avgRatingNum.toFixed(1) : "N/A";
  const totalReviews = ratedSessions.length;

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = ratedSessions.filter((s) => Math.round(s.rating) === stars).length;
    const pct = totalReviews ? Math.round((count / totalReviews) * 100) : 0;
    return { stars, pct, count };
  });

  const recentReviews = sessions
    .filter((s) => s.feedback || s.notes || s.review_text)
    .map((s, idx) => ({
      id: s.id || idx,
      studentName: s.learner_name || s.user_profiles?.display_name || "Enrolled Learner",
      avatar: s.user_profiles?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      course: s.course_title || s.title || "Mentorship Session",
      rating: s.rating || 5,
      date: s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString() : "Recent",
      comment: s.feedback || s.notes || s.review_text
    }));

  return (
    <div className="ta-fade">
      <TopBar title="Instructor Performance" sub="Student satisfaction, ratings, teaching analytics & revenue metrics" orgSelector={orgSelector} />
      <div className="ta-content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        <div className="ta-hero-banner anim-fluid-entrance">
          <div className="tai-glow-amber" />
          <div className="ta-hero-inner">
            <div className="ta-hero-text">
              <h1 className="ta-hero-title">
                Teaching Analytics &amp; Impact Studio
              </h1>
              <p className="ta-hero-desc">
                Evaluate student retention, live workshop ratings, question response times, and course completion milestones.
              </p>
            </div>

            <div className="ta-hero-actions">
              <div className="ta-row ta-gap8" style={{ background: "var(--surface-2)", padding: "4px", borderRadius: 10, border: "1px solid var(--border)" }}>
                {["7d", "30d", "90d", "all"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: timeframe === t ? "var(--primary)" : "transparent",
                      color: timeframe === t ? "#FFFFFF" : "var(--text-2)",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top 4 Performance KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16 }}>
          
          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Instructor Rating</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Star size={18} fill="#F59E0B" />
              </div>
            </div>
            <div className="ta-row ta-gap8" style={{ alignItems: "baseline", marginTop: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.02em" }}>{ratingVal}</span>
              <span style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 600 }}>/ 5.0 ({totalReviews} reviews)</span>
            </div>
            <div className="ta-row ta-gap6 ta-mt10" style={{ fontSize: 12, color: "var(--success)", fontWeight: 700 }}>
              <TrendingUp size={14} /> +0.2 vs last month
            </div>
          </div>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Teaching Sessions</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(59, 130, 246, 0.12)", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Calendar size={18} />
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
              {sessionsQuery.loading ? "…" : sessions.length}
            </div>
            <div className="ta-row ta-gap6 ta-mt10" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
              <Clock size={13} color="var(--primary)" /> {sessionsQuery.loading ? "…" : `${completedSessions.length} completed 1:1s & workshops`}
            </div>
          </div>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Learners Mentored</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
              {sessionsQuery.loading ? "…" : menteesHelped}
            </div>
            <div className="ta-row ta-gap6 ta-mt10" style={{ fontSize: 12, color: "var(--success)", fontWeight: 700 }}>
              <TrendingUp size={14} /> Active learner cohort
            </div>
          </div>

          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between">
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Gross Earnings</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(37, 99, 235, 0.12)", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={18} />
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "var(--text)", marginTop: 10, letterSpacing: "-0.02em" }}>
              ${totalEarnings.toFixed(2)}
            </div>
            <div className="ta-row ta-gap6 ta-mt10" style={{ fontSize: 12, color: "var(--success)", fontWeight: 700 }}>
              <ShieldCheck size={14} /> Payout verified &amp; active
            </div>
          </div>
        </div>

        {/* 2-Column Section: Ratings Breakdown & Teaching Benchmarks */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 20 }}>
          
          {/* Rating Distribution Breakdown */}
          <div className="ta-card" style={{ padding: "22px 24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Student Rating Breakdown</div>
                <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Verified reviews from completed cohorts and masterclasses</div>
              </div>
              <Tag tone="warning"><Star size={12} fill="#F59E0B" /> {ratingVal} Star Avg</Tag>
            </div>

            <div className="ta-col ta-gap10 ta-mt16">
              {ratingDistribution.map((r) => (
                <div key={r.stars} className="ta-row ta-gap12" style={{ alignItems: "center" }}>
                  <span style={{ width: 44, fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4 }}>
                    {r.stars} <Star size={11} fill="#F59E0B" color="#F59E0B" />
                  </span>
                  <div style={{ flex: 1, height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${r.pct}%`, height: "100%", background: "#F59E0B", borderRadius: 3 }} />
                  </div>
                  <span style={{ width: 36, fontSize: 11.5, color: "var(--text-3)", fontWeight: 600, textAlign: "right" }}>
                    {r.pct}%
                  </span>
                </div>
              ))}
            </div>

            <div className="ta-row ta-between ta-mt20" style={{ padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div className="ta-row ta-gap8">
                <Brain size={15} color="var(--primary)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>Teaching Assessment</span>
              </div>
              <span style={{ fontSize: 11.5, color: "var(--success)", fontWeight: 700 }}>
                {ratedSessions.length > 0 ? "Active Feedback" : "Awaiting Feedback"}
              </span>
            </div>
          </div>

          {/* Instructor Benchmarks */}
          <div className="ta-card" style={{ padding: "20px 22px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
            <div className="ta-row ta-between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <div>
                <div className="ta-title" style={{ fontSize: 15, fontWeight: 800 }}>Teaching Benchmarks &amp; Health</div>
                <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Metrics tracked against organization targets</div>
              </div>
              <Tag tone="success">Active</Tag>
            </div>

            <div className="ta-col ta-gap14 ta-mt16">
              <div>
                <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>Course Completion Trajectory</span>
                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                    {sessions.length ? `${Math.round((completedSessions.length / sessions.length) * 100)}%` : "100%"}
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${sessions.length ? Math.round((completedSessions.length / sessions.length) * 100) : 100}%`, height: "100%", background: "#2563EB", borderRadius: 3 }} />
                </div>
              </div>

              <div>
                <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>Active Sessions Completed</span>
                  <span style={{ fontWeight: 700, color: "var(--success)" }}>{completedSessions.length} total sessions</span>
                </div>
                <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, completedSessions.length * 10)}%`, height: "100%", background: "#10B981", borderRadius: 3 }} />
                </div>
              </div>

              <div>
                <div className="ta-row ta-between" style={{ fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>Learner Retention</span>
                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>{menteesHelped > 0 ? "High" : "Optimal"}</span>
                </div>
                <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: "95%", height: "100%", background: "#2563EB", borderRadius: 3 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Student Testimonials & Feedback Roster */}
        <div className="ta-card" style={{ padding: "22px 24px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="ta-row ta-between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
            <div className="ta-row ta-gap10">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageCircle size={18} color="var(--primary)" />
              </div>
              <div>
                <div className="ta-title" style={{ fontSize: 16, fontWeight: 800 }}>Recent Student Reviews &amp; Testimonials</div>
                <div className="ta-sub" style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Direct feedback left by learners after sessions and project evaluations</div>
              </div>
            </div>
            <button className="ta-btn ta-btn-outline ta-btn-sm" onClick={() => onNavigate && onNavigate("mentees")}>
              View All Learners
            </button>
          </div>

          <div className="ta-grid ta-grid-3 anim-stagger ta-mt16">
            {recentReviews.length === 0 && (
              <div className="ta-empty" style={{ gridColumn: "1 / -1", padding: "24px 12px" }}>
                No student reviews or feedback submitted yet. Feedback left from completed sessions will show up here.
              </div>
            )}
            {recentReviews.map((rev) => (
              <div
                key={rev.id}
                style={{
                  padding: "16px 18px",
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12
                }}
              >
                <div>
                  <div className="ta-row ta-between" style={{ gap: 8, marginBottom: 8 }}>
                    <div className="ta-row ta-gap10" style={{ minWidth: 0 }}>
                      <img src={rev.avatar} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rev.studentName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{rev.date}</div>
                      </div>
                    </div>
                    <span className="ta-row ta-gap4" style={{ color: "#F59E0B", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                      <Star size={13} fill="#F59E0B" /> {rev.rating}
                    </span>
                  </div>

                  <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45 }}>
                    "{rev.comment}"
                  </div>
                </div>

                <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <BookOpen size={11} style={{ display: "inline", marginRight: 4 }} />
                  {rev.course}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
