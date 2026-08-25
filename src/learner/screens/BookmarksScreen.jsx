import React, { useState, useMemo } from "react";
import { TopBar, Avatar, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import { PortalModal } from "../../components/common/PortalModal.jsx";
import {
  Bookmark, BookOpen, Video, Code2, FileText, Trash2, ExternalLink, Play,
  FolderPlus, Search, Check, Heart, Clock, Star, ArrowRight, Share2, Copy, Plus, X
} from "lucide-react";

export function BookmarksScreen({ push, back, showToast, session }) {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "courses" | "lessons" | "snippets" | "notes"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("all");
  const [copiedSnippetId, setCopiedSnippetId] = useState(null);

  // Add Note / Snippet Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("note"); // "note" | "snippet"
  const [newCollection, setNewCollection] = useState("Design Systems");
  const [newContent, setNewContent] = useState("");
  const [newLanguage, setNewLanguage] = useState("JavaScript");

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

  const query = (searchQuery || "").trim().toLowerCase();

  const filteredCourses = useMemo(() => {
    return savedCourses.filter(c => {
      const matchesColl = selectedCollection === "all" || c.collection === selectedCollection;
      const matchesQuery = !query || c.title?.toLowerCase().includes(query) || c.category?.toLowerCase().includes(query) || c.instructor?.toLowerCase().includes(query);
      return matchesColl && matchesQuery;
    });
  }, [savedCourses, selectedCollection, query]);

  const filteredLessons = useMemo(() => {
    return savedLessons.filter(l => {
      const matchesColl = selectedCollection === "all" || l.collection === selectedCollection;
      const matchesQuery = !query || l.title?.toLowerCase().includes(query) || l.courseTitle?.toLowerCase().includes(query) || l.instructor?.toLowerCase().includes(query);
      return matchesColl && matchesQuery;
    });
  }, [savedLessons, selectedCollection, query]);

  const filteredSnippets = useMemo(() => {
    return savedSnippets.filter(s => {
      const matchesColl = selectedCollection === "all" || s.collection === selectedCollection;
      const matchesQuery = !query || s.title?.toLowerCase().includes(query) || s.language?.toLowerCase().includes(query) || s.code?.toLowerCase().includes(query);
      return matchesColl && matchesQuery;
    });
  }, [savedSnippets, selectedCollection, query]);

  const filteredNotes = useMemo(() => {
    return savedNotes.filter(n => {
      const matchesColl = selectedCollection === "all" || n.collection === selectedCollection;
      const matchesQuery = !query || n.title?.toLowerCase().includes(query) || n.content?.toLowerCase().includes(query);
      return matchesColl && matchesQuery;
    });
  }, [savedNotes, selectedCollection, query]);

  const totalFilteredCount = useMemo(() => {
    if (activeTab === "all") return filteredCourses.length + filteredLessons.length + filteredSnippets.length + filteredNotes.length;
    if (activeTab === "courses") return filteredCourses.length;
    if (activeTab === "lessons") return filteredLessons.length;
    if (activeTab === "snippets") return filteredSnippets.length;
    if (activeTab === "notes") return filteredNotes.length;
    return 0;
  }, [activeTab, filteredCourses, filteredLessons, filteredSnippets, filteredNotes]);

  const COLLECTIONS = [
    { id: "all", label: "All Items", count: savedCourses.length + savedLessons.length + savedSnippets.length + savedNotes.length },
    { id: "Design Systems", label: "Design Systems", count: savedCourses.filter(c => c.collection === "Design Systems").length + savedLessons.filter(l => l.collection === "Design Systems").length + savedSnippets.filter(s => s.collection === "Design Systems").length + savedNotes.filter(n => n.collection === "Design Systems").length },
    { id: "Full-Stack AI", label: "Full-Stack AI", count: savedCourses.filter(c => c.collection === "Full-Stack AI").length + savedLessons.filter(l => l.collection === "Full-Stack AI").length + savedSnippets.filter(s => s.collection === "Full-Stack AI").length + savedNotes.filter(n => n.collection === "Full-Stack AI").length },
    { id: "Spatial Design", label: "Spatial Design", count: savedCourses.filter(c => c.collection === "Spatial Design").length + savedLessons.filter(l => l.collection === "Spatial Design").length + savedSnippets.filter(s => s.collection === "Spatial Design").length + savedNotes.filter(n => n.collection === "Spatial Design").length }
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

  function handleAddNoteOrSnippet() {
    if (!newTitle.trim() || !newContent.trim()) {
      showToast?.("Please enter a title and content.");
      return;
    }

    if (newType === "snippet") {
      const item = {
        id: `snippet-${Date.now()}`,
        title: newTitle.trim(),
        language: newLanguage,
        source: `Saved Note • ${newCollection}`,
        collection: newCollection,
        code: newContent.trim()
      };
      setSavedSnippets(prev => [item, ...prev]);
      setActiveTab("snippets");
      showToast?.("New code snippet added to library!");
    } else {
      const item = {
        id: `note-${Date.now()}`,
        title: newTitle.trim(),
        source: `Saved Note • ${newCollection}`,
        content: newContent.trim(),
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        collection: newCollection
      };
      setSavedNotes(prev => [item, ...prev]);
      setActiveTab("notes");
      showToast?.("New study note added to library!");
    }

    setAddModalOpen(false);
    setNewTitle("");
    setNewContent("");
  }

  return (
    <div className="tai-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      
      {/* =========================================================================
          HERO BANNER: Dedicated Bookmarks & Study Library (Adaptive Liquid Glass)
          ========================================================================= */}
      <div
        className="tai-card tai-hero-card anim-fluid-entrance"
        style={{
          borderRadius: 14,
          padding: "clamp(18px, 2.5vw, 24px)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div className="tai-glow-rose" />

        <div className="tai-row tai-between" style={{ position: "relative", zIndex: 1, flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div style={{ minWidth: 0, flex: "1 1 300px" }}>
            <h1 className="tai-hero-title" style={{ fontSize: "clamp(20px, 2.5vw, 25px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 4px", lineHeight: 1.2 }}>
              Saved Library &amp; Bookmarks
            </h1>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, maxWidth: 620, lineHeight: 1.45 }}>
              Quick access to your bookmarked masterclasses, core video lessons, reusable code snippets, and personalized study notes.
            </p>
          </div>

          <div className="tai-row tai-gap10" style={{ flexWrap: "wrap", alignItems: "center" }}>
            <div className="tai-hero-subcard" style={{ padding: "8px 14px", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>Total Saved</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text)" }}>{savedCourses.length + savedLessons.length + savedSnippets.length + savedNotes.length} Items</div>
            </div>
            <button
              className="tai-btn tai-btn-primary"
              onClick={() => setActiveTab("snippets")}
              style={{
                padding: "9px 16px", borderRadius: 8, fontWeight: 700,
                display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0
              }}
            >
              <Plus size={15} /> Add Snippet
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CONTROLS: Search Bar & Collection Folders Strip
          ========================================================================= */}
      <div className="tai-col tai-gap12">
        <div className="tai-row tai-between" style={{ flexWrap: "wrap", gap: 12 }}>
          
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search saved courses, video lessons, code or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", height: 44, paddingLeft: 42, paddingRight: 14,
                borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)",
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {filteredCourses.map(course => (
              <div
                key={course.id}
                className="tai-card-hover"
                style={{
                  background: "var(--surface)",
                  borderRadius: 10,
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
                      <div style={{ height: "100%", width: `${course.progress}%`, background: "#2563EB" }} />
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

                    <button
                      className="tai-btn tai-btn-primary tai-btn-sm"
                      style={{ padding: "6px 14px", borderRadius: 8, fontWeight: 700 }}
                      onClick={(e) => { e.stopPropagation(); push("courseDetail", { id: course.id }); }}
                    >
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {filteredLessons.map(lesson => (
              <div
                key={lesson.id}
                className="tai-card tai-card-hover"
                style={{ padding: 16, borderRadius: 10, display: "flex", gap: 14, cursor: "pointer" }}
                onClick={() => push("lesson", { id: lesson.courseId, lessonId: lesson.id })}
              >
                <div style={{ position: "relative", width: 100, height: 75, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                  <img src={lesson.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Play size={12} color="var(--primary)" fill="var(--primary)" style={{ marginLeft: 2 }} />
                    </div>
                  </div>
                </div>

                <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div className="tai-row tai-between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>{lesson.courseTitle}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{lesson.duration}</span>
                    </div>
                    <h4 style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", margin: 0, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {lesson.title}
                    </h4>
                  </div>
                  <div className="tai-row tai-between" style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-3)" }}>
                    <span>{lesson.instructor}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveLesson(lesson.id); }}
                      style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 2 }}
                      title="Remove lesson"
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {filteredSnippets.map(snippet => (
              <div key={snippet.id} className="tai-card" style={{ padding: 20, borderRadius: 10 }}>
                <div className="tai-row tai-between" style={{ marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#60A5FA", background: "rgba(59, 130, 246, 0.1)", padding: "2px 8px", borderRadius: 6 }}>
                      {snippet.language}
                    </span>
                    <h4 style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text)", margin: "6px 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {snippet.title}
                    </h4>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{snippet.source}</div>
                  </div>

                  <div className="tai-row tai-gap6" style={{ flexShrink: 0 }}>
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
                  borderRadius: 8, fontSize: 12, lineHeight: 1.5, overflowX: "auto", margin: "10px 0 0",
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
              <div key={note.id} className="tai-card" style={{ padding: 18, borderRadius: 10, background: "var(--surface-3)" }}>
                <div className="tai-row tai-between" style={{ gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                    <h4 style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {note.title}
                    </h4>
                    <div style={{ fontSize: 11.5, color: "var(--primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.source}</div>
                  </div>
                  <div className="tai-row tai-gap8" style={{ alignItems: "center", flexShrink: 0 }}>
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
        <div className="tai-card" style={{ textAlign: "center", padding: "60px 24px", borderRadius: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--primary-tint)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Bookmark size={26} color="var(--primary)" />
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
            style={{ padding: "10px 22px", borderRadius: 8, fontWeight: 800 }}
            onClick={() => { setSearchQuery(""); setSelectedCollection("all"); push("courses"); }}
          >
            Browse Courses Catalog →
          </button>
        </div>
      )}

      {/* =========================================================================
          ADD NOTE / CODE SNIPPET MODAL
          ========================================================================= */}
      {addModalOpen && (
        <PortalModal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)}>
          <div style={{ padding: 24, maxWidth: 520, width: "100%", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99, 102, 241, 0.12)", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text)" }}>Add New Note or Snippet</h3>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>Save custom study notes or reusable code to your library</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                  Item Type
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setNewType("note")}
                    className={`tai-btn ${newType === "note" ? "tai-btn-primary" : "tai-btn-outline"}`}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <FileText size={15} /> Study Note
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType("snippet")}
                    className={`tai-btn ${newType === "snippet" ? "tai-btn-primary" : "tai-btn-outline"}`}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Code2 size={15} /> Code Snippet
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                  Title / Subject
                </label>
                <input
                  type="text"
                  placeholder={newType === "snippet" ? "e.g. LangChain RAG Vector Retriever" : "e.g. Key Takeaways from Spatial UX Lesson"}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--surface)",
                    color: "var(--text)", fontSize: 13
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                    Collection
                  </label>
                  <select
                    value={newCollection}
                    onChange={(e) => setNewCollection(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 8,
                      border: "1px solid var(--border)", background: "var(--surface)",
                      color: "var(--text)", fontSize: 13
                    }}
                  >
                    <option value="Design Systems">Design Systems</option>
                    <option value="Full-Stack AI">Full-Stack AI</option>
                    <option value="Spatial Design">Spatial Design</option>
                    <option value="General">General Notes</option>
                  </select>
                </div>

                {newType === "snippet" && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                      Language
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Python, TypeScript, SQL"
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 8,
                        border: "1px solid var(--border)", background: "var(--surface)",
                        color: "var(--text)", fontSize: 13
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
                  {newType === "snippet" ? "Code Block" : "Note Content"}
                </label>
                <textarea
                  rows={5}
                  placeholder={newType === "snippet" ? "// Paste code snippet here..." : "Type your study summary or notes here..."}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--surface)",
                    color: "var(--text)", fontSize: 13, fontFamily: newType === "snippet" ? "monospace" : "inherit"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="tai-btn tai-btn-outline"
                  onClick={() => setAddModalOpen(false)}
                  style={{ padding: "9px 16px", borderRadius: 8 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="tai-btn tai-btn-primary"
                  onClick={handleAddNoteOrSnippet}
                  style={{ padding: "9px 20px", borderRadius: 8, fontWeight: 800 }}
                >
                  Save Item
                </button>
              </div>
            </div>
          </div>
        </PortalModal>
      )}

    </div>
  );
}
