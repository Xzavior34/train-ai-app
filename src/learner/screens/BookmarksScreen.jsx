import React, { useState, useMemo } from "react";
import { TopBar, Avatar, Tag, ProgressBar } from "../components/LearnerUI.jsx";
import { DEMO_MODE, liveOr } from "../../lib/demoMode.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import {
  fetchMyBookmarks, toggleCourseBookmark, fetchPublishedCourses,
  fetchPublishedLessonCounts, fetchMyEnrollments
} from "../../lib/api/learner.js";
import {
  fetchAllMyCourseNotes, fetchAllMyLessonNotes, deleteCourseNote, deleteLessonNote
} from "../../lib/api/live/learnerProgressLive.js";
import {
  Bookmark, BookOpen, Video, Code2, FileText, Trash2, ExternalLink, Play,
  FolderPlus, Search, Check, Heart, Sparkles, Clock, Star, ArrowRight, Share2, Copy
} from "lucide-react";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTimestamp(seconds) {
  if (seconds == null) return "";
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// Illustrative saved courses, kept ONLY for the no-database case. This whole
// screen used to be useState seed data: the real `bookmarks` table and the
// toggle that writes to it existed and were used from the catalog, but the
// Bookmarks screen itself never read either, so nothing a learner actually
// bookmarked ever appeared here and "remove" only mutated local state.
const DEMO_SAVED_COURSES = [
  {
    id: "course-figma-ai",
    title: "Master Design Systems in Figma with Generative AI",
    category: "Design & UX",
    instructor: "Astrid Larsson",
    lessonsCount: 24,
    hours: 18,
    progress: 45,
    coverImageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
    collection: "Design Systems"
  },
  {
    id: "course-fullstack-ai",
    title: "Full-Stack AI Application Engineering & LLM APIs",
    category: "AI & Machine Learning",
    instructor: "Dr. Elena Vance",
    lessonsCount: 32,
    hours: 24,
    progress: 20,
    coverImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    collection: "Full-Stack AI"
  },
  {
    id: "course-spatial-ui",
    title: "Spatial Computing Interfaces & VisionOS UX",
    category: "Spatial & VR",
    instructor: "Kenji Sato",
    lessonsCount: 18,
    hours: 14,
    progress: 0,
    coverImageUrl: "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800&auto=format&fit=crop&q=80",
    collection: "Spatial Design"
  }
];

// Bookmarking a single LESSON has no table: `bookmarks` holds only
// (user_id, course_id). So the saved-lessons section is demo-only.
const DEMO_SAVED_LESSONS = [
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
];

// Saved code snippets have no table either - nothing in the schema stores a
// clipped snippet, its language or its source lesson - so this section is
// demo-only as well.
const DEMO_SAVED_SNIPPETS = [
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
];

// Illustrative note for the no-database case. Real notes come from
// course_notes / lesson_notes (see the live fetchers) - neither table has a
// note title or a "collection", so those are derived from the course/lesson.
const DEMO_SAVED_NOTES = [
  {
    id: "note-1",
    title: "Key Takeaways: Spatial UI Depth & Gaze Targets",
    source: "Spatial Computing Interfaces • Lesson 4",
    content: "Ensure interactive UI targets have a minimum 60pt bounding box to prevent eye strain during micro-fixations. Always maintain subtle parallax depth on glass layers.",
    date: "Aug 21, 2026",
    collection: "Spatial Design"
  }
];

// Named collections/folders of saved items have no table: there is nothing to
// group bookmarks by and no per-collection count to read, so the folder strip
// is demo-only and its counts stay literal behind that guard.
const DEMO_COLLECTIONS = [
  { id: "Design Systems", label: "Design Systems", count: 3 },
  { id: "Full-Stack AI", label: "Full-Stack AI", count: 3 },
  { id: "Spatial Design", label: "Spatial Design", count: 2 }
];

export function BookmarksScreen({ push, back, showToast, session }) {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "courses" | "lessons" | "snippets" | "notes"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("all");
  const [copiedSnippetId, setCopiedSnippetId] = useState(null);

  // `session` was destructured here and never used - nothing on this screen
  // was fetched at all.
  const userId = session?.user?.id || null;

  // Demo-only lists stay in state so the remove buttons still do something
  // with no database behind them.
  const [demoCourses, setDemoCourses] = useState(DEMO_SAVED_COURSES);
  const [demoLessons, setDemoLessons] = useState(DEMO_SAVED_LESSONS);
  const [demoSnippets, setDemoSnippets] = useState(DEMO_SAVED_SNIPPETS);
  const [demoNotes, setDemoNotes] = useState(DEMO_SAVED_NOTES);

  // `bookmarks` stores only (user_id, course_id), so the saved-course cards
  // are the bookmarked ids joined against the published catalog, with lesson
  // counts and enrolment progress resolved the same way useLearnerData does.
  const bookmarksQuery = useSupabaseQuery(
    async () => (userId ? fetchMyBookmarks(userId) : []),
    [userId]
  );
  const coursesQuery = useSupabaseQuery(async () => fetchPublishedCourses(), []);
  const lessonCountsQuery = useSupabaseQuery(async () => fetchPublishedLessonCounts(), []);
  const enrollmentsQuery = useSupabaseQuery(
    async () => (userId ? fetchMyEnrollments(userId) : []),
    [userId]
  );
  // The "Study Notes" tab rendered one hardcoded note; both real notes tables
  // are now read across every course/lesson the learner wrote in.
  const courseNotesQuery = useSupabaseQuery(
    async () => (userId ? fetchAllMyCourseNotes(userId) : []),
    [userId]
  );
  const lessonNotesQuery = useSupabaseQuery(
    async () => (userId ? fetchAllMyLessonNotes(userId) : []),
    [userId]
  );

  const courseById = useMemo(
    () => new Map((coursesQuery.data || []).map((c) => [c.id, c])),
    [coursesQuery.data]
  );

  const liveSavedCourses = useMemo(() => {
    const lessonCounts = lessonCountsQuery.data || {};
    const enrollmentByCourseId = new Map(
      (enrollmentsQuery.data || []).map((e) => [e.course_id, e])
    );
    return (bookmarksQuery.data || [])
      .map((courseId) => courseById.get(courseId))
      .filter(Boolean)
      .map((c) => {
        const enrollment = enrollmentByCourseId.get(c.id);
        return {
          id: c.id,
          title: c.title,
          category: c.category || "General",
          // `courses` has an instructor_id but no resolvable name here, so
          // the byline is omitted rather than invented.
          instructor: null,
          lessonsCount: lessonCounts[c.id] || 0,
          hours: Number(c.duration_hours) || 0,
          progress: enrollment ? Math.round(enrollment.progress_percentage || 0) : 0,
          coverImageUrl: c.cover_image_url || null,
          collection: null,
        };
      });
  }, [bookmarksQuery.data, courseById, lessonCountsQuery.data, enrollmentsQuery.data]);

  const liveSavedNotes = useMemo(() => {
    const courseNotes = (courseNotesQuery.data || []).map((n) => ({
      id: n.id,
      kind: "course",
      // course_notes has no title column - the course it belongs to is the
      // only real heading available.
      title: courseById.get(n.course_id)?.title || "Course note",
      source: "Course note",
      content: n.content || "",
      date: formatDate(n.updated_at || n.created_at),
      collection: null,
    }));
    const lessonNotes = (lessonNotesQuery.data || []).map((n) => {
      const courseTitle = n.course_id ? courseById.get(n.course_id)?.title : null;
      return {
        id: n.id,
        kind: "lesson",
        title: n.lesson_title || "Lesson note",
        source: courseTitle ? `${courseTitle} • Lesson note` : "Lesson note",
        content: n.content || "",
        date: formatTimestamp(n.timestamp_seconds),
        collection: null,
      };
    });
    return [...courseNotes, ...lessonNotes];
  }, [courseNotesQuery.data, lessonNotesQuery.data, courseById]);

  const savedCourses = liveOr(liveSavedCourses, demoCourses);
  const savedNotes = liveOr(liveSavedNotes, demoNotes);
  // No table backs saved lessons or code snippets, so with a database
  // connected these lists are genuinely empty and their sections and tabs
  // are hidden entirely (see the DEMO_MODE guards below).
  const savedLessons = liveOr([], demoLessons);
  const savedSnippets = liveOr([], demoSnippets);

  const coursesLoading = !DEMO_MODE && (bookmarksQuery.loading || coursesQuery.loading);
  const notesLoading = !DEMO_MODE && (courseNotesQuery.loading || lessonNotesQuery.loading);
  const anythingLoading = coursesLoading || notesLoading;

  function handleCopySnippet(id, code) {
    navigator.clipboard?.writeText(code);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
    showToast?.("Code snippet copied to clipboard!");
  }

  // Removing a bookmark now deletes the real `bookmarks` row via the same
  // toggle the catalog uses, instead of only filtering a local array.
  async function handleRemoveCourse(id) {
    if (DEMO_MODE) {
      setDemoCourses(prev => prev.filter(c => c.id !== id));
      showToast?.("Course removed from bookmarks.");
      return;
    }
    try {
      await toggleCourseBookmark(userId, id, true);
      bookmarksQuery.refetch();
      showToast?.("Course removed from bookmarks.");
    } catch (e) {
      showToast?.(e?.message || "Could not remove that bookmark.");
    }
  }

  function handleRemoveLesson(id) {
    setDemoLessons(prev => prev.filter(l => l.id !== id));
    showToast?.("Lesson removed from bookmarks.");
  }

  function handleRemoveSnippet(id) {
    setDemoSnippets(prev => prev.filter(s => s.id !== id));
    showToast?.("Snippet removed from bookmarks.");
  }

  // Deletes the real course_notes / lesson_notes row so the note stays gone.
  async function handleRemoveNote(note) {
    if (DEMO_MODE) {
      setDemoNotes(prev => prev.filter(n => n.id !== note.id));
      showToast?.("Note removed from bookmarks.");
      return;
    }
    try {
      if (note.kind === "lesson") await deleteLessonNote(note.id, userId);
      else await deleteCourseNote(note.id, userId);
      if (note.kind === "lesson") lessonNotesQuery.refetch();
      else courseNotesQuery.refetch();
      showToast?.("Note deleted.");
    } catch (e) {
      showToast?.(e?.message || "Could not delete that note.");
    }
  }

  // Filter items by collection and search. The collection filter only ever
  // narrows anything in demo mode - real items have no collection.
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

  const totalSavedCount = savedCourses.length + savedLessons.length + savedSnippets.length + savedNotes.length;

  // "All Items" is the only collection chip with a real count behind it; the
  // named folders below it exist only in demo mode.
  const collections = [
    { id: "all", label: "All Items", count: totalSavedCount },
    ...(DEMO_MODE ? DEMO_COLLECTIONS : []),
  ];

  // The lessons and snippets tabs have no table behind them at all, so they
  // are not offered once a database is configured.
  const contentTabs = [
    { k: "all", label: `All (${totalSavedCount})`, icon: Bookmark },
    { k: "courses", label: `Courses (${savedCourses.length})`, icon: BookOpen },
    ...(DEMO_MODE ? [
      { k: "lessons", label: `Lessons & Videos (${savedLessons.length})`, icon: Video },
      { k: "snippets", label: `Code Snippets (${savedSnippets.length})`, icon: Code2 },
    ] : []),
    { k: "notes", label: `Study Notes (${savedNotes.length})`, icon: FileText },
  ];

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
            {/* Video lessons and code snippets cannot be saved against any
                table, so the live blurb only promises what exists. */}
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 620, lineHeight: 1.5, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
              {DEMO_MODE
                ? "Quick access to your bookmarked masterclasses, core video lessons, reusable code snippets, and personalized study notes."
                : "Quick access to the courses you bookmarked and every study note you have written."}
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
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder={DEMO_MODE
                ? "Search saved courses, video lessons, code or notes..."
                : "Search saved courses and study notes..."}
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
            {collections.map(col => {
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
          {contentTabs.map(t => {
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

      {/* Loading state for the real reads - an empty result is only ever
          reported as empty once the queries have actually resolved. */}
      {anythingLoading && totalSavedCount === 0 && (
        <div className="tai-card" style={{ padding: "40px 24px", borderRadius: 20, textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>
          Loading your saved library…
        </div>
      )}

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
                  {/* courses.cover_image_url is nullable - fall back to a
                      plain tint rather than a stock photo. */}
                  {course.coverImageUrl ? (
                    <img src={course.coverImageUrl} alt={course.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "var(--primary-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <BookOpen size={26} color="var(--primary)" />
                    </div>
                  )}
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
                      {/* No instructor name is resolvable from `courses`
                          here, so that segment is dropped when absent. */}
                      {course.instructor && (
                        <>
                          <span>{course.instructor}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{course.lessonsCount} lessons</span>
                      {course.hours > 0 && (
                        <>
                          <span>•</span>
                          <span>{course.hours} hrs</span>
                        </>
                      )}
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
          Demo-only: `bookmarks` cannot reference a lesson.
          ========================================================================= */}
      {DEMO_MODE && (activeTab === "all" || activeTab === "lessons") && filteredLessons.length > 0 && (
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
          Demo-only: no table stores a saved snippet.
          ========================================================================= */}
      {DEMO_MODE && (activeTab === "all" || activeTab === "snippets") && filteredSnippets.length > 0 && (
        <div className="tai-col tai-gap14">
          <div className="tai-row tai-between">
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--text)" }}>
              Saved Code Snippets &amp; Cheatsheets ({filteredSnippets.length})
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {filteredSnippets.map(snippet => (
              <div key={snippet.id} className="tai-card" style={{ padding: 20, borderRadius: 16 }}>
                <div className="tai-row tai-between" style={{ marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#818CF8", background: "rgba(99, 102, 241, 0.1)", padding: "2px 8px", borderRadius: 6 }}>
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
                      onClick={() => handleRemoveNote(note)}
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
      {totalFilteredCount === 0 && !anythingLoading && (
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
              : DEMO_MODE
                ? "You haven't saved any items to this collection yet. Browse courses and click the bookmark icon to save key lessons, code, and notes."
                : "Nothing saved yet. Bookmark a course from the catalog, or write a note while studying, and it will appear here."}
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
