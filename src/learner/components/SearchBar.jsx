import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, BookOpen, Users, MessageSquare } from "lucide-react";

// Universal search over data that's already loaded by useLearnerData
// courses, mentors and community posts. No new Supabase RPC/table is
// involved: the shared project has no full-text-search RPC for any of
// these (checked the reference app's generated types for a real one, the
// only hit is `search_mentionable_users`, which is unrelated), so this is
// deliberately just case-insensitive substring filtering client-side.
export function SearchBar({
  courses = [],
  mentors = [],
  posts = [],
  onOpenCourse,
  onOpenMentor,
  onOpenPost,
  placeholder = "Search courses, instructors, community...",
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (!query.trim()) setExpanded(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") {
        setQuery("");
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [query]);

  const q = query.trim().toLowerCase();

  const { courseResults, mentorResults, postResults } = useMemo(() => {
    if (q.length < 2) return { courseResults: [], mentorResults: [], postResults: [] };
    return {
      courseResults: courses
        .filter((c) => (c.title || "").toLowerCase().includes(q) || (c.category || "").toLowerCase().includes(q))
        .slice(0, 5),
      mentorResults: mentors
        .filter((m) =>
          (m.name || "").toLowerCase().includes(q) ||
          (m.title || "").toLowerCase().includes(q) ||
          (m.specializations || []).some((s) => (s || "").toLowerCase().includes(q))
        )
        .slice(0, 5),
      postResults: posts
        .filter((p) => (p.content || "").toLowerCase().includes(q) || (p.author || "").toLowerCase().includes(q))
        .slice(0, 5),
    };
  }, [q, courses, mentors, posts]);

  const totalResults = courseResults.length + mentorResults.length + postResults.length;

  function close() {
    setExpanded(false);
    setQuery("");
  }

  function pick(handler, arg) {
    if (handler) handler(arg);
    close();
  }

  if (!expanded) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button
          className="tai-iconbtn"
          aria-label="Search"
          onClick={() => {
            setExpanded(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <Search size={17} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", marginBottom: 14 }}>
      <div
        className="tai-row tai-gap8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "10px 14px",
        }}
      >
        <Search size={16} color="var(--text-3)" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="tai-search-input"
          style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 13.5, color: "var(--text)", fontFamily: "inherit" }}
        />
        <X
          size={16}
          color="var(--text-3)"
          style={{ cursor: "pointer" }}
          onClick={() => close()}
        />
      </div>

      {q.length >= 2 && (
        <div
          className="tai-card"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
            maxHeight: 360, overflowY: "auto", padding: 8,
          }}
        >
          {totalResults === 0 && (
            <div className="tai-empty" style={{ padding: "16px 8px" }}>No results for "{query}"</div>
          )}

          {courseResults.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div className="tai-label" style={{ padding: "6px 8px" }}>Courses</div>
              {courseResults.map((c) => (
                <div
                  key={`course-${c.id}`}
                  className="tai-row tai-gap10"
                  style={{ padding: "8px", borderRadius: 10, cursor: "pointer" }}
                  onClick={() => pick(onOpenCourse, c.id)}
                >
                  <BookOpen size={15} color="var(--primary)" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-2)" }}>{c.category}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mentorResults.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div className="tai-label" style={{ padding: "6px 8px" }}>Instructors</div>
              {mentorResults.map((m) => (
                <div
                  key={`mentor-${m.id}`}
                  className="tai-row tai-gap10"
                  style={{ padding: "8px", borderRadius: 10, cursor: "pointer" }}
                  onClick={() => pick(onOpenMentor, m.id)}
                >
                  <Users size={15} color="var(--primary)" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-2)" }}>{m.title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {postResults.length > 0 && (
            <div>
              <div className="tai-label" style={{ padding: "6px 8px" }}>Community</div>
              {postResults.map((p) => (
                <div
                  key={`post-${p.id}`}
                  className="tai-row tai-gap10"
                  style={{ padding: "8px", borderRadius: 10, cursor: "pointer" }}
                  onClick={() => pick(onOpenPost, p.id)}
                >
                  <MessageSquare size={15} color="var(--primary)" />
                  <div style={{ minWidth: 0, flex: 1, fontSize: 12.5, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
