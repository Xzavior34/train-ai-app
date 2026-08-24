import React, { useState } from "react";
import { TopBar, Avatar, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import {
  Bookmark, BookOpen, Video, Code2, FileText, Trash2, ExternalLink, Play,
  FolderPlus, Search, Check, Heart, Sparkles, Clock, Star, ArrowRight, Share2, Copy
} from "lucide-react";

export function BookmarksScreen({ push, back, showToast, session }) {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "courses" | "lessons" | "snippets" | "notes"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("all");
  const [copiedSnippetId, setCopiedSnippetId] = useState(null);

  const [savedCourses, setSavedCourses] = useState([
    {
      id: "course-figma-ai",
      title: "Master Design Systems in Figma with Generative AI",
      category: "Design & UX",
      instructor: "Astrid Larsson",
      instructorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviewsCount: 1840,
      hours: 18,
      lessonsCount: 24,
      progress: 45,
      coverImageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
      collection: "Design Systems",
      savedDate: "Aug 18, 2026"
    },
    {
      id: "course-fullstack-ai",
      title: "Full-Stack AI Application Engineering & LLM APIs",
      category: "AI & Machine Learning",
      instructor: "Dr. Elena Vance",
      instructorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
      rating: 4.9,
      reviewsCount: 2310,
      hours: 24,
      lessonsCount: 32,
      progress: 20,
      coverImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
      collection: "Full-Stack AI",
      savedDate: "Aug 19, 2026"
    },
    {
      id: "course-spatial-ui",
      title: "Spatial Computing Interfaces & VisionOS UX",
      category: "Spatial & VR",
      instructor: "Kenji Sato",
      instructorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
      rating: 4.8,
      reviewsCount: 950,
      hours: 14,
      lessonsCount: 18,
      progress: 0,
      coverImageUrl: "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800&auto=format&fit=crop&q=80",
      collection: "Spatial Design",
      savedDate: "Aug 20, 2026"
    }
  ]);

  const [savedLessons, setSavedLessons] = useState([
    {
      id: "lesson-tokens-1",
      courseId: "course-figma-ai",
      courseTitle: "Master Design Systems in Figma",
      title: "Module 3: Configuring Semantic Color & Spacing Variables",
      duration: "18 min",
      type: "video",
      thumbnail: "https://images.unsplash.com/photo-1558655146-d09347e92766?w=600&auto=format&fit=crop&q=80",
      instructor: "Astrid Larsson",
      collection: "Design Systems",
      savedDate: "Aug 19, 2026"
    },
    {
      id: "lesson-rag-1",
      courseId: "course-fullstack-ai",
      courseTitle: "Full-Stack AI Application Engineering",
      title: "Module 5: Vector Chunking Strategies & Hybrid Search",
      duration: "24 min",
      type: "interactive",
      thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80",
      instructor: "Dr. Elena Vance",
      collection: "Full-Stack AI",
      savedDate: "Aug 20, 2026"
    }
  ]);

  const [savedSnippets, setSavedSnippets] = useState([
    {
      id: "snippet-1",
      title: "Figma Variables Exporter Script (JSON to CSS Tokens)",
      language: "JavaScript / Node",
      source: "Design Systems with Figma AI • Lesson 8",
      collection: "Design Systems",
      code: `export function transformFigmaTokens(tokens) {
  return Object.entries(tokens).reduce((acc, [key, val]) => {
    acc[\`--color-\${key}\`] = val.$value || val.value;
    return acc;
  }, {});
}`
    },
    {
      id: "snippet-2",
      title: "LangChain RAG Pipeline with Cosine Similarity Filter",
      language: "Python 3.12",
      source: "Full-Stack AI Engineering • Lesson 14",
      collection: "Full-Stack AI",
      code: `from langchain_community.vectorstores import SupabaseVectorStore
from langchain_openai import OpenAIEmbeddings

vector_store = SupabaseVectorStore(
    client=supabase,
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    table_name="knowledge_embeddings",
    query_name="match_documents"
)
results = vector_store.similarity_search(query, k=4)`
    }
  ]);

  const [savedNotes, setSavedNotes] = useState([
    {
      id: "note-1",
      title: "Key Takeaways: Spatial UI Depth & Gaze Targets",
      source: "Spatial Computing Interfaces • Lesson 4",
      content: "Ensure interactive UI targets have a minimum 60pt bounding box to prevent eye strain during micro-fixations. Always maintain subtle parallax depth on glass layers.",
      date: "Aug 21, 2026",
      collection: "Spatial Design"
    }
  ]);

  const COLLECTIONS = [
    { id: "all", label: "All Items", count: savedCourses.length + savedLessons.length + savedSnippets.length + savedNotes.length },
    { id: "Design Systems", label: "Design Systems", count: 3 },
    { id: "Full-Stack AI", label: "Full-Stack AI", count: 3 },
    { id: "Spatial Design", label: "Spatial Design", count: 2 }
  ];

  function handleCopySnippet(id, code) {
    navigator.clipboard?.writeText(code);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
    showToast?.("Code snippet copied to clipboard!");
  }

  function handleRemoveCourse(id) {
    setSavedCourses(prev => prev.filter(c => c.id !== id));
    showToast?.("Course removed from bookmarks.");
  }

  function handleRemoveLesson(id) {
    setSavedLessons(prev => prev.filter(l => l.id !== id));
    showToast?.("Lesson removed from bookmarks.");
  }

  function handleRemoveSnippet(id) {
    setSavedSnippets(prev => prev.filter(s => s.id !== id));
    showToast?.("Snippet removed from bookmarks.");
  }

  function handleRemoveNote(id) {
    setSavedNotes(prev => prev.filter(n => n.id !== id));
    showToast?.("Note removed from bookmarks.");
  }

  // Filter items by collection and search
  const filteredCourses = savedCourses.filter(c => {
    if (selectedCollection !== "all" && c.collection !== selectedCollection) return false;
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredLessons = savedLessons.filter(l => {
    if (selectedCollection !== "all" && l.collection !== selectedCollection) return false;
    if (searchQuery && !l.title.toLowerCase().includes(searchQuery.toLowerCase()) && !l.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredSnippets = savedSnippets.filter(s => {
    if (selectedCollection !== "all" && s.collection !== selectedCollection) return false;
    if (searchQuery && !s.title.toLowerCase().includes(searchQuery.toLowerCase()) && !s.code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredNotes = savedNotes.filter(n => {
    if (selectedCollection !== "all" && n.collection !== selectedCollection) return false;
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase()) && !n.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalFilteredCount =
    (activeTab === "all" ? (filteredCourses.length + filteredLessons.length + filteredSnippets.length + filteredNotes.length) :
    activeTab === "courses" ? filteredCourses.length :
    activeTab === "lessons" ? filteredLessons.length :
    activeTab === "snippets" ? filteredSnippets.length :
    filteredNotes.length);

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* =========================================================================
          HERO BANNER: Dedicated Bookmarks & Study Library
          ========================================================================= */}
      <div style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,27,75,0.85) 100%)",
        color: "#FFFFFF",
        padding: "clamp(24px, 4vw, 32px)",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.35)",
        border: "1px solid rgba(99, 102, 241, 0.4)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Background Stock Image with Gradient Overlay */}
        <img
          src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1400&auto=format&fit=crop&q=85"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.38, zIndex: 0
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(100deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.78) 55%, rgba(15,23,42,0.6) 100%)",
          zIndex: 0
        }} />

        <div className="tai-row tai-between" style={{ position: "relative", zIndex: 1, flexWrap: "wrap", gap: 18, alignItems: "center" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: "clamp(22px, 2.8vw, 28px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", color: "#FFFFFF", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              Saved Library &amp; Bookmarks
            </h1>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.5, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
              Quick access to your bookmarked masterclasses, core video lessons, reusable code snippets, and personalized study notes.
            </p>
          </div>

          <button
            className="tai-btn"
            onClick={() => push("courses")}
            style={{
              background: "#4F46E5", color: "#FFFFFF", fontWeight: 800, fontSize: 13.5,
              padding: "12px 22px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
              boxShadow: "0 6px 20px rgba(79, 70, 229, 0.45)", flexShrink: 0
            }}
          >
            Explore Catalog →
          </button>
        </div>
      </div>

      {/* =========================================================================
          CONTROLS: Search Bar & Collection Folders Strip
          ========================================================================= */}
      <div className="tai-col tai-gap12">
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
          
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: 280, position: "relative" }}>
            <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search saved courses, video lessons, code or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", height: 44, paddingLeft: 42, paddingRight: 14,
                borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface)",
                fontSize: 13.5, color: "var(--text)", outline: "none"
              }}
            />
          </div>

          {/* Collection Filter Chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {COLLECTIONS.map(col => {
              const isSelected = selectedCollection === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => setSelectedCollection(col.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                    background: isSelected ? "var(--primary-tint)" : "var(--surface)",
                    color: isSelected ? "var(--primary)" : "var(--text-2)",
                    fontSize: 12.5,
                    fontWeight: isSelected ? 800 : 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "var(--primary-light)"; e.currentTarget.style.color = "var(--text)"; } }}
                  onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)"; } }}
                >
                  <span>{col.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>({col.count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Type Filter Pills */}
        <div className="tai-row tai-gap8" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {[
            { k: "all", label: `All (${savedCourses.length + savedLessons.length + savedSnippets.length + savedNotes.length})`, icon: Bookmark },
            { k: "courses", label: `Courses (${savedCourses.length})`, icon: BookOpen },
            { k: "lessons", label: `Lessons & Videos (${savedLessons.length})`, icon: Video },
            { k: "snippets", label: `Code Snippets (${savedSnippets.length})`, icon: Code2 },
            { k: "notes", label: `Study Notes (${savedNotes.length})`, icon: FileText },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setActiveTab(t.k)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "#FFFFFF" : "var(--text-3)",
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "var(--surface-2)"; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; } }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          CONTENT SECTION: COURSES
          ========================================================================= */}
      {(activeTab === "all" || activeTab === "courses") && filteredCourses.length > 0 && (
        <div className="tai-col tai-gap14">
          <div className="tai-row tai-between">
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--text)" }}>
              Saved Courses &amp; Masterclasses ({filteredCourses.length})
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {filteredCourses.map(course => (
              <div
                key={course.id}
                className="tai-card-hover"
                style={{
                  background: "var(--surface)",
                  borderRadius: 18,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(15,23,42,0.03)"
                }}
                onClick={() => push("courseDetail", { id: course.id })}
              >
                <div style={{ position: "relative", height: 160 }}>
                  <img src={course.coverImageUrl} alt={course.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)" }} />

                  <span style={{ position: "absolute", top: 12, left: 12, background: "rgba(15,23,42,0.75)", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
                    {course.category}
                  </span>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveCourse(course.id); }}
                    style={{
                      position: "absolute", top: 12, right: 12, width: 32, height: 32,
                      borderRadius: "50%", background: "rgba(15,23,42,0.6)", border: "none",
                      color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
                    }}
                    title="Remove from Bookmarks"
                  >
                    <Heart size={16} fill="#EF4444" />
                  </button>

                  {course.progress > 0 && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.3)" }}>
                      <div style={{ height: "100%", width: `${course.progress}%`, background: "#4F46E5" }} />
                    </div>
                  )}
                </div>

                <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", margin: "0 0 6px", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {course.title}
                    </h4>
                    <div className="tai-row tai-gap8" style={{ fontSize: 12, color: "var(--text-3)" }}>
                      <span>{course.instructor}</span>
                      <span>•</span>
                      <span>{course.lessonsCount} lessons</span>
                      <span>•</span>
                      <span>{course.hours} hrs</span>
                    </div>
                  </div>

                  <div className="tai-row tai-between" style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)" }}>
                      {course.progress > 0 ? `${course.progress}% Complete` : "Ready to Start"}
                    </span>

                    <button className="tai-btn tai-btn-primary tai-btn-sm" style={{ padding: "6px 14px", borderRadius: 8, fontWeight: 700 }}>
                      {course.progress > 0 ? "Resume →" : "Start Course →"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTENT SECTION: SAVED LESSONS & VIDEOS
          ========================================================================= */}
      {(activeTab === "all" || activeTab === "lessons") && filteredLessons.length > 0 && (
        <div className="tai-col tai-gap14">
          <div className="tai-row tai-between">
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--text)" }}>
              Saved Lessons &amp; Video Labs ({filteredLessons.length})
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
            {filteredLessons.map(lesson => (
              <div
                key={lesson.id}
                className="tai-card tai-card-hover"
                style={{ padding: 16, borderRadius: 16, display: "flex", gap: 14, cursor: "pointer" }}
                onClick={() => push("lesson", { id: lesson.courseId, lessonId: lesson.id })}
              >
                <div style={{ position: "relative", width: 100, height: 75, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                  <img src={lesson.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Play size={12} color="var(--primary)" fill="var(--primary)" style={{ marginLeft: 2 }} />
                    </div>
                  </div>
                  <span style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 9.5, fontWeight: 700, padding: "1px 4px", borderRadius: 4 }}>
                    {lesson.duration}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>{lesson.courseTitle}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text)", margin: "2px 0 0", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {lesson.title}
                    </div>
                  </div>

                  <div className="tai-row tai-between" style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>Saved {lesson.savedDate}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveLesson(lesson.id); }}
                      style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer" }}
                      title="Remove bookmark"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTENT SECTION: CODE SNIPPETS & FORMULAS
          ========================================================================= */}
      {(activeTab === "all" || activeTab === "snippets") && filteredSnippets.length > 0 && (
        <div className="tai-col tai-gap14">
          <div className="tai-row tai-between">
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--text)" }}>
              Saved Code Snippets &amp; Cheatsheets ({filteredSnippets.length})
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
            {filteredSnippets.map(snippet => (
              <div key={snippet.id} className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
                <div className="tai-row tai-between" style={{ marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#818CF8", background: "rgba(99, 102, 241, 0.1)", padding: "2px 8px", borderRadius: 6 }}>
                      {snippet.language}
                    </span>
                    <h4 style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text)", margin: "6px 0 2px" }}>
                      {snippet.title}
                    </h4>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{snippet.source}</div>
                  </div>

                  <div className="tai-row tai-gap6">
                    <button
                      className="tai-btn tai-btn-outline tai-btn-sm"
                      onClick={() => handleCopySnippet(snippet.id, snippet.code)}
                      style={{ padding: "4px 10px", fontSize: 11.5 }}
                    >
                      {copiedSnippetId === snippet.id ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                      <span>{copiedSnippetId === snippet.id ? "Copied" : "Copy"}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveSnippet(snippet.id)}
                      style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 4 }}
                      title="Remove snippet"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <pre style={{
                  background: "#0F172A", color: "#E2E8F0", padding: "14px 16px",
                  borderRadius: 12, fontSize: 12, lineHeight: 1.5, overflowX: "auto", margin: "10px 0 0",
                  fontFamily: "monospace"
                }}>
                  <code>{snippet.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTENT SECTION: STUDY NOTES & HIGHLIGHTS
          ========================================================================= */}
      {(activeTab === "all" || activeTab === "notes") && filteredNotes.length > 0 && (
        <div className="tai-col tai-gap14">
          <div className="tai-row tai-between">
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--text)" }}>
              Saved Study Notes &amp; Highlights ({filteredNotes.length})
            </h3>
          </div>

          <div className="tai-col tai-gap12">
            {filteredNotes.map(note => (
              <div key={note.id} className="tai-card" style={{ padding: 18, borderRadius: 16, background: "var(--surface-3)" }}>
                <div className="tai-row tai-between">
                  <div>
                    <h4 style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text)", margin: "0 0 2px" }}>
                      {note.title}
                    </h4>
                    <div style={{ fontSize: 11.5, color: "var(--primary)", fontWeight: 700 }}>{note.source}</div>
                  </div>
                  <div className="tai-row tai-gap8" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{note.date}</span>
                    <button
                      onClick={() => handleRemoveNote(note.id)}
                      style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer" }}
                      title="Remove note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, margin: "10px 0 0" }}>
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          EMPTY STATE
          ========================================================================= */}
      {totalFilteredCount === 0 && (
        <div className="tai-card" style={{ textAlign: "center", padding: "60px 24px", borderRadius: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--primary-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Bookmark size={28} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "0 0 6px" }}>
            No Bookmarks Found in This View
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.5 }}>
            {searchQuery
              ? `No saved items match "${searchQuery}". Try clearing your search query.`
              : "You haven't saved any items to this collection yet. Browse courses and click the bookmark icon to save key lessons, code, and notes."}
          </p>
          <button
            className="tai-btn tai-btn-primary"
            style={{ padding: "10px 22px", borderRadius: 12, fontWeight: 800 }}
            onClick={() => { setSearchQuery(""); setSelectedCollection("all"); push("courses"); }}
          >
            Browse Courses Catalog →
          </button>
        </div>
      )}

    </div>
  );
}
