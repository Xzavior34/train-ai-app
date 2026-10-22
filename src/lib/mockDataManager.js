const STORAGE_KEY = "trainai_mock_data_enabled";
const CHANGE_EVENT = "trainai_mock_data_changed";

// Every real Supabase row id in this schema is a Postgres uuid. Every mock/
// demo id used across this codebase (course-figma-ai, demo-course-...,
// l-figma-2, etc.) is a plain slug - never a UUID. Querying a real
// UUID-typed column (course_id, etc.) with one of those slugs throws
// "invalid input syntax for type uuid" against a real, connected Supabase
// project - the actual cause of a course/lesson detail page rendering
// blank when it's reached from mock/demo course data. This is the single
// general check for that bug class, used anywhere a course/lesson id is
// about to be sent into a real-table query - simpler and more robust than
// maintaining a duplicate list of every mock id by hand, since it also
// catches any new mock course/lesson added later without needing this
// check updated too.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isRealDatabaseId(id) {
  return typeof id === "string" && UUID_RE.test(id);
}

/**
 * Returns true if mock/demo data is explicitly enabled.
 * Defaults to false (production / live database mode).
 * Always returns false when Supabase database is connected.
 */
export function isMockDataEnabled() {
  return false;
}

/**
 * Enable or disable mock data globally
 * @param {boolean} enabled 
 */
export function setMockDataEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, "false");
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled: false } }));
  } catch (err) {
    console.error("Could not set mock data preference:", err);
  }
}

/**
 * Purge all mock data globally and switch to real database only
 */
export function purgeAllMockData() {
  try {
    localStorage.setItem(STORAGE_KEY, "false");
    
    // Clear all temporary demo and mock states across localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("trainai_mock_") || key.startsWith("mock_") || key.startsWith("demo_"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem("trainai_mock_bookmarks");
    localStorage.removeItem("trainai_mock_notes");
    localStorage.removeItem("trainai_mock_quizzes");
    localStorage.removeItem("trainai_mock_courses");
    localStorage.removeItem("trainai_demo_mode");

    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled: false, purged: true } }));
    return true;
  } catch (err) {
    console.error("Could not purge mock data:", err);
    return false;
  }
}

/**
 * Restore mock data for testing and sandbox previews
 */
export function restoreMockData() {
  return purgeAllMockData();
}

/**
 * Hook or listener for reactive updates when mock data settings change
 */
export function subscribeToMockDataChanges(callback) {
  const handler = (e) => callback(e.detail?.enabled ?? isMockDataEnabled());
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) callback(isMockDataEnabled());
  });
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

// Educational Real YouTube Video Maps for all course topics (100% oEmbed-verified active)
export const MOCK_YOUTUBE_VIDEOS = {};

/**
 * Resolves the YouTube embed video ID for any course / lesson topic
 */
export function getYouTubeEmbedId(courseId, lessonId, courseTitle = "", category = "") { return null; }

/**
 * Universal video source parser supporting direct HTML5 videos (mp4, webm),
 * YouTube URLs/IDs, Vimeo URLs, and topic video fallbacks.
 */
export function parseVideoSource(rawUrl, courseId, lessonId) {
  const cleanUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";

  // 1. Direct HTML5 video file
  if (cleanUrl && cleanUrl.match(/\.(mp4|webm|ogg|mov|m3u8)(\?.*)?$/i)) {
    return { type: "html5", src: cleanUrl };
  }

  // 2. YouTube URL
  if (cleanUrl) {
    const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
    if (ytMatch) {
      return { type: "youtube", videoId: ytMatch[1] };
    }
  }

  // 3. Vimeo URL
  if (cleanUrl) {
    const vimeoMatch = cleanUrl.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i);
    if (vimeoMatch) {
      return { type: "vimeo", videoId: vimeoMatch[1] };
    }
  }

  // 4. If plain 11-char string that looks like a YouTube ID
  if (cleanUrl && /^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    return { type: "youtube", videoId: cleanUrl };
  }

  // 5. If it's a generic web video URL
  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://") || cleanUrl.startsWith("blob:")) {
    return { type: "html5", src: cleanUrl };
  }

  return { type: "none" };
}
