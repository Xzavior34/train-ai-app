import React, { useState, useEffect } from "react";
import {
  ShoppingBag, Search, Filter, Star, BookOpen, Clock, Users,
  ArrowRight, Check, ShieldCheck, DollarSign, Sparkles, Building2,
  Layers, ChevronRight, X, Play
} from "lucide-react";
import {
  fetchMarketplaceCourses,
  fetchInstructorSeatPlans,
  calculateMarketplaceSplit
} from "../../lib/api/marketplace.js";

export default function MarketplacePage({ onGoHome, onBookDemo, onSignIn }) {
  const [tab, setTab] = useState("courses"); // courses | plans
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSkill, setSelectedSkill] = useState("all");
  
  // Course Detail & Purchase Modal
  const [selectedCourse, setSelectedCourse] = useState(null);

  const plans = fetchInstructorSeatPlans();

  async function loadCourses() {
    setLoading(true);
    try {
      const data = await fetchMarketplaceCourses({
        category: selectedCategory,
        skillLevel: selectedSkill,
        searchQuery,
      });
      setCourses(data);
    } catch (e) {
      console.warn("Could not load marketplace courses:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, [selectedCategory, selectedSkill]);

  function handlePurchase() {
    setSelectedCourse(null);
    onSignIn?.();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0F19",
        color: "#F1F5F9",
        fontFamily: "var(--font-sans, 'Plus Jakarta Sans', sans-serif)",
      }}
    >
      {/* Header Bar */}
      <nav
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(11, 15, 25, 0.8)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={onGoHome}>
          <img src="/brand/train-ai-logo.png" alt="Train AI" style={{ width: 32, height: 32, objectFit: "contain" }} />
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.02em" }}>
            TRAIN<span style={{ color: "#3B82F6" }}>AI</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#60A5FA", marginLeft: 8, background: "rgba(59,130,246,0.15)", padding: "2px 8px", borderRadius: 6, textTransform: "uppercase" }}>
              Academy Marketplace
            </span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBookDemo}
            style={{
              background: "transparent",
              color: "#CBD5E1",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Institutional Demo
          </button>
          <button
            onClick={onSignIn}
            className="ta-btn ta-btn-primary"
            style={{ padding: "8px 18px", fontSize: 13 }}
          >
            Learner Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{ padding: "60px 24px 40px", maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#60A5FA",
            padding: "4px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 16,
            textTransform: "uppercase",
            letterSpacing: ".04em",
          }}
        >
          <Sparkles size={13} /> Independent Academies &amp; Certified Instructors
        </div>

        <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 auto 16px", maxWidth: 780, lineHeight: 1.2 }}>
          Learn Industry-Grade AI, Engineering &amp; Product from Top Tech Academies
        </h1>
        <p style={{ fontSize: 15, color: "#94A3B8", maxWidth: 640, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Explore self-paced courses and live cohort bootcamps delivered by verified training institutions. Coexists alongside private enterprise training on the Train AI infrastructure.
        </p>

        {/* Tab Switcher */}
        <div style={{ display: "inline-flex", background: "#1E293B", padding: 4, borderRadius: 10, border: "1px solid #334155" }}>
          <button
            onClick={() => setTab("courses")}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: tab === "courses" ? "#2563EB" : "transparent",
              color: tab === "courses" ? "#FFFFFF" : "#94A3B8",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <BookOpen size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Browse Courses
          </button>
          <button
            onClick={() => setTab("plans")}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: tab === "plans" ? "#2563EB" : "transparent",
              color: tab === "plans" ? "#FFFFFF" : "#94A3B8",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <Users size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Instructor Seat Plans
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 80px" }}>
        {tab === "courses" && (
          <>
            {/* Filter Bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "space-between",
                alignItems: "center",
                background: "#111827",
                padding: "16px 20px",
                borderRadius: 12,
                border: "1px solid #1F2937",
                marginBottom: 28,
              }}
            >
              <div style={{ display: "flex", gap: 10, flex: "1 1 300px" }}>
                <div style={{ position: "relative", width: "100%" }}>
                  <Search size={15} color="#64748B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    className="ta-input"
                    style={{
                      width: "100%",
                      paddingLeft: 36,
                      background: "#1E293B",
                      border: "1px solid #334155",
                      color: "#FFF",
                    }}
                    placeholder="Search courses, skills, academies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadCourses()}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <select
                  className="ta-input"
                  style={{ background: "#1E293B", border: "1px solid #334155", color: "#FFF", width: "auto", fontSize: 13 }}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="Artificial Intelligence">Artificial Intelligence</option>
                  <option value="Data Science">Data Science</option>
                  <option value="Software Engineering">Software Engineering</option>
                  <option value="Product Management">Product Management</option>
                </select>

                <select
                  className="ta-input"
                  style={{ background: "#1E293B", border: "1px solid #334155", color: "#FFF", width: "auto", fontSize: 13 }}
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                >
                  <option value="all">All Levels</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
            </div>

            {/* Course Grid */}
            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>Loading courses...</div>
            ) : courses.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#94A3B8" }}>No courses found matching your criteria.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
                {courses.map((course) => {
                  const split = calculateMarketplaceSplit(course.price_amount, course.platform_commission_percent);
                  return (
                    <div
                      key={course.id}
                      style={{
                        background: "#111827",
                        border: "1px solid #1F2937",
                        borderRadius: 14,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        transition: "transform .15s ease, border-color .15s ease",
                      }}
                    >
                      <div style={{ position: "relative", height: 180, overflow: "hidden", background: "#1E293B" }}>
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            background: "rgba(15, 23, 42, 0.8)",
                            backdropFilter: "blur(4px)",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#60A5FA",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          {course.skill_level}
                        </div>
                      </div>

                      <div style={{ padding: 20, flex: 1, display: "flex", flexDirection: "column" }}>
                        <div style={{ fontSize: 11.5, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                          {course.academy_name}
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px", color: "#FFFFFF", lineHeight: 1.35 }}>
                          {course.title}
                        </h3>
                        <p style={{ fontSize: 12.5, color: "#94A3B8", lineHeight: 1.5, margin: "0 0 16px", flex: 1 }}>
                          {course.description}
                        </p>

                        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#CBD5E1", borderTop: "1px solid #1F2937", paddingTop: 12, marginBottom: 14 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <BookOpen size={13} color="#60A5FA" /> {course.modules_count} Modules
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Users size={13} color="#10B981" /> {course.enrolled_count} Learners
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Star size={13} color="#F59E0B" fill="#F59E0B" /> {course.rating}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF" }}>
                              ${(course.price_amount / 100).toFixed(2)}
                            </span>
                            <span style={{ fontSize: 11, color: "#64748B", display: "block" }}>
                              15% platform commission after verified payment
                            </span>
                          </div>
                          <button
                            className="ta-btn ta-btn-primary ta-btn-sm"
                            onClick={() => {
                              setSelectedCourse(course);
                            }}
                          >
                            View &amp; Enroll <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "plans" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800 }}>Instructor Seat Plans for Training Academies</h2>
              <p style={{ color: "#94A3B8", fontSize: 14 }}>
                Deliver courses to your learners without enterprise license minimums. Scale instructors as your academy grows.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
              {plans.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: "#111827",
                    border: p.id === "3-instructors" ? "2px solid #2563EB" : "1px solid #1F2937",
                    borderRadius: 14,
                    padding: 28,
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                  }}
                >
                  {p.id === "3-instructors" && (
                    <div
                      style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "#2563EB",
                        color: "#FFF",
                        padding: "2px 10px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      Most Popular
                    </div>
                  )}

                  <div style={{ fontSize: 18, fontWeight: 800, color: "#FFFFFF" }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
                    Up to {p.instructorLimit} instructor seat{p.instructorLimit > 1 ? "s" : ""}
                  </div>

                  <div style={{ margin: "20px 0 24px" }}>
                    <span style={{ fontSize: 32, fontWeight: 900, color: "#FFFFFF" }}>
                      {p.monthlyPriceCents > 0 ? `$${p.monthlyPriceCents / 100}` : "Custom"}
                    </span>
                    {p.monthlyPriceCents > 0 && <span style={{ color: "#64748B", fontSize: 13 }}> / month</span>}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, marginBottom: 24 }}>
                    {p.features.map((feat, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#CBD5E1" }}>
                        <Check size={14} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    className={`ta-btn ${p.id === "3-instructors" ? "ta-btn-primary" : "ta-btn-outline"}`}
                    onClick={onBookDemo}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    {p.monthlyPriceCents > 0 ? "Apply for Academy Access" : "Talk to Sales"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Course Detail Modal */}
      {selectedCourse && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11, 15, 25, 0.8)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid #1F2937",
              borderRadius: 14,
              padding: 28,
              maxWidth: 540,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#60A5FA", textTransform: "uppercase" }}>
                  {selectedCourse.academy_name}
                </span>
                <h2 style={{ fontSize: 19, fontWeight: 800, margin: "4px 0 0", color: "#FFF" }}>
                  {selectedCourse.title}
                </h2>
              </div>
              <button
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                onClick={() => setSelectedCourse(null)}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.5, marginBottom: 20 }}>
              {selectedCourse.description}
            </p>

            {/* Financial Ledger Breakdown */}
            <div
              style={{
                background: "#1E293B",
                borderRadius: 10,
                padding: 16,
                border: "1px solid #334155",
                marginBottom: 20,
                fontSize: 12.5,
              }}
            >
              <div style={{ fontWeight: 700, color: "#CBD5E1", marginBottom: 8 }}>
                15% Platform Commission on Completed Payments
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#94A3B8", marginBottom: 4 }}>
                <span>Gross Course Price:</span>
                <span style={{ fontWeight: 700, color: "#FFF" }}>${(selectedCourse.price_amount / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#94A3B8", marginBottom: 4 }}>
                <span>Train AI Platform Fee (15%):</span>
                <span style={{ color: "#38BDF8" }}>
                  ${(calculateMarketplaceSplit(selectedCourse.price_amount, 15).platformFeeAmount / 100).toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#94A3B8", borderTop: "1px solid #334155", paddingTop: 6, marginTop: 6 }}>
                <span>Instructor / Academy Share (85%):</span>
                <span style={{ fontWeight: 700, color: "#10B981" }}>
                  ${(calculateMarketplaceSplit(selectedCourse.price_amount, 15).instructorRevenueAmount / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              className="ta-btn ta-btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 14 }}
              onClick={handlePurchase}
            >
              Sign in to purchase and enrol
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
