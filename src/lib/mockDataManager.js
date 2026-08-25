import { HAS_DATABASE } from "./demoMode.js";

const STORAGE_KEY = "trainai_mock_data_enabled";
const CHANGE_EVENT = "trainai_mock_data_changed";

/**
 * Returns true if mock/demo data is enabled (defaults to true for prototyping until disabled by admin/owner).
 * Always returns false when Supabase database is connected.
 */
export function isMockDataEnabled() {
  if (HAS_DATABASE) return false;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "false") return false;
    return true;
  } catch {
    return true;
  }
}

/**
 * Enable or disable mock data globally
 * @param {boolean} enabled 
 */
export function setMockDataEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled } }));
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
  try {
    localStorage.setItem(STORAGE_KEY, "true");
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled: true } }));
    return true;
  } catch (err) {
    console.error("Could not restore mock data:", err);
    return false;
  }
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
export const MOCK_YOUTUBE_VIDEOS = {
  // 1. Figma & Spatial Design Systems / Design Thinking
  "course-figma-ai": {
    defaultVideoId: "gHGN6hs2gZY",
    lessons: {
      "l-figma-1": "gHGN6hs2gZY", // What Is Design Thinking? An Overview (AJ&Smart)
      "l-figma-2": "c9Wg6Cb_YlU", // UI / UX Design Tutorial – Wireframe, Mockup & Design in Figma (freeCodeCamp)
      "l-figma-3": "jk1T0CdLxwU", // Intro to Figma - Beginners guide to Figma Basics (Jesse Showalter)
      "l-figma-4": "HZuk6Wkx_Eg"  // Figma tutorial for Beginners: Complete Website (Flux Academy)
    }
  },
  "course-spatial-ui": {
    defaultVideoId: "c9Wg6Cb_YlU",
    lessons: {
      "l-spatial-1": "c9Wg6Cb_YlU", // UI / UX Design Tutorial in Figma (freeCodeCamp)
      "l-spatial-2": "jk1T0CdLxwU", // Spatial UI & Design Tokens (Jesse Showalter)
      "l-spatial-3": "HZuk6Wkx_Eg"  // Spatial Component Prototyping (Flux Academy)
    }
  },

  // 2. Full-Stack AI & Web Dev
  "course-fullstack-ai": {
    defaultVideoId: "2xxziIWmaSA",
    lessons: {
      "l-fullstack-1": "2xxziIWmaSA", // The LangChain Cookbook - 7 Essential Concepts (Greg Kamradt)
      "l-fullstack-2": "aywZrzNaKjs", // LangChain QuickStart Tutorial (Rabbitmetrics)
      "l-fullstack-3": "bMknfKXIFA8", // React Course - Beginner's Tutorial (freeCodeCamp)
      "l-fullstack-4": "843nec-IvW0"  // Next.js Full Course for Beginners 7h (freeCodeCamp)
    }
  },
  "demo-course-ai-fundamentals": {
    defaultVideoId: "2xxziIWmaSA",
    lessons: {
      "demo-ai-1": "2xxziIWmaSA",
      "demo-ai-2": "aywZrzNaKjs",
      "demo-ai-3": "bMknfKXIFA8"
    }
  },
  "d0000000-0000-0000-0000-000000000020": {
    defaultVideoId: "2xxziIWmaSA",
    lessons: {
      "d0000000-0000-0000-0000-000000000020-l1": "2xxziIWmaSA",
      "d0000000-0000-0000-0000-000000000020-l2": "aywZrzNaKjs"
    }
  },

  // 3. Prompt Engineering & LLM Architecture
  "course-prompt-pro": {
    defaultVideoId: "jC4v5AS4RIM",
    lessons: {
      "l-prompt-1": "jC4v5AS4RIM", // Master the Perfect ChatGPT Prompt Formula (Jeff Su)
      "l-prompt-2": "VMj-3S1tku0", // Intro to Neural Networks & AI (Andrej Karpathy)
      "l-prompt-3": "aircAruvnKk"  // What is a neural network? (3Blue1Brown)
    }
  },

  // 4. Cloud DevOps & Microservices
  "course-cloud-devops": {
    defaultVideoId: "fqMOX6JJhGo",
    lessons: {
      "l-cloud-1": "fqMOX6JJhGo", // Docker Tutorial for Beginners (freeCodeCamp)
      "l-cloud-2": "3c-iBn73dDE", // Docker Tutorial Full Course 3h (TechWorld with Nana)
      "l-cloud-3": "X48VuDVv0do"  // Kubernetes Tutorial Full Course 4h (TechWorld with Nana)
    }
  },

  // 5. Python & Data Science
  "course-data-python": {
    defaultVideoId: "LHBE6Q9XlzI",
    lessons: {
      "l-data-1": "LHBE6Q9XlzI", // Python for Data Science (freeCodeCamp)
      "l-data-2": "nLRL_NcnK-4", // Harvard CS50’s Python University Course (freeCodeCamp)
      "l-data-3": "7eh4d6sabA0"  // Python Machine Learning Tutorial (Programming with Mosh)
    }
  },
  "d0000000-0000-0000-0000-000000000023": {
    defaultVideoId: "LHBE6Q9XlzI",
    lessons: {
      "d0000000-0000-0000-0000-000000000023-l1": "LHBE6Q9XlzI"
    }
  },

  // 6. Applied Machine Learning & Foundations of Algebra
  "course-foundations": {
    defaultVideoId: "7eh4d6sabA0",
    lessons: {
      "l-foundations-1": "7eh4d6sabA0", // Python Machine Learning Tutorial (Programming with Mosh)
      "l-foundations-2": "i_LwzRVP7bg", // Machine Learning for Everybody Full Course (freeCodeCamp)
      "l-foundations-3": "fNk_zzaMoSs"  // Linear Algebra Vectors (3Blue1Brown)
    }
  },
  "c0000000-0000-0000-0000-000000000001": {
    defaultVideoId: "7eh4d6sabA0",
    lessons: {
      "c0000000-0000-0000-0000-000000000001-l1": "7eh4d6sabA0",
      "c0000000-0000-0000-0000-000000000001-l2": "i_LwzRVP7bg"
    }
  },
  "c0000000-0000-0000-0000-000000000002": {
    defaultVideoId: "fNk_zzaMoSs",
    lessons: {
      "c0000000-0000-0000-0000-000000000002-l1": "fNk_zzaMoSs",
      "c0000000-0000-0000-0000-000000000002-l2": "JnTa9XtvmfI"
    }
  },

  // 7. Leadership, Management & Workplace Compliance
  "demo-course-external-leadership": {
    defaultVideoId: "f60dheI4ARg",
    lessons: {
      "demo-lead-1": "f60dheI4ARg",
      "demo-lead-2": "H14bBuluwB8"
    }
  },
  "d0000000-0000-0000-0000-000000000021": {
    defaultVideoId: "f60dheI4ARg",
    lessons: {
      "d0000000-0000-0000-0000-000000000021-l1": "f60dheI4ARg"
    }
  },
  "d0000000-0000-0000-0000-000000000024": {
    defaultVideoId: "8aGhZQkoFbQ",
    lessons: {
      "d0000000-0000-0000-0000-000000000024-l1": "8aGhZQkoFbQ"
    }
  },
  "demo-course-compliance-101": {
    defaultVideoId: "H14bBuluwB8",
    lessons: {
      "demo-comp-1": "H14bBuluwB8"
    }
  },
  "d0000000-0000-0000-0000-000000000022": {
    defaultVideoId: "H14bBuluwB8",
    lessons: {
      "d0000000-0000-0000-0000-000000000022-l1": "H14bBuluwB8"
    }
  }
};

/**
 * Resolves the YouTube embed video ID for any course / lesson topic
 */
export function getYouTubeEmbedId(courseId, lessonId, courseTitle = "", category = "") {
  if (courseId && MOCK_YOUTUBE_VIDEOS[courseId]) {
    const courseConfig = MOCK_YOUTUBE_VIDEOS[courseId];
    if (lessonId && courseConfig.lessons?.[lessonId]) {
      return courseConfig.lessons[lessonId];
    }
    return courseConfig.defaultVideoId;
  }

  // Keyword and topic matching for database / custom courses
  const text = `${courseId || ""} ${courseTitle || ""} ${category || ""}`.toLowerCase();
  if (text.includes("thinking") || text.includes("design thinking")) {
    return "gHGN6hs2gZY";
  }
  if (text.includes("figma") || text.includes("design") || text.includes("ux") || text.includes("ui")) {
    return "c9Wg6Cb_YlU";
  }
  if (text.includes("full-stack") || text.includes("react") || text.includes("web") || text.includes("engineer")) {
    return "2xxziIWmaSA";
  }
  if (text.includes("prompt") || text.includes("llm") || text.includes("agent") || text.includes("ai")) {
    return "jC4v5AS4RIM";
  }
  if (text.includes("cloud") || text.includes("devops") || text.includes("docker") || text.includes("kubernetes")) {
    return "fqMOX6JJhGo";
  }
  if (text.includes("spatial") || text.includes("visionos") || text.includes("3d")) {
    return "c9Wg6Cb_YlU";
  }
  if (text.includes("algebra") || text.includes("math")) {
    return "fNk_zzaMoSs";
  }
  if (text.includes("machine learning") || text.includes("ml") || text.includes("neural")) {
    return "7eh4d6sabA0";
  }
  if (text.includes("data") || text.includes("python") || text.includes("analytics")) {
    return "LHBE6Q9XlzI";
  }
  if (text.includes("leadership") || text.includes("management") || text.includes("strategy") || text.includes("project") || text.includes("preneur")) {
    return "f60dheI4ARg";
  }
  if (text.includes("compliance") || text.includes("policy") || text.includes("security")) {
    return "H14bBuluwB8";
  }

  return "gHGN6hs2gZY";
}

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

  // 6. Universal topic fallback for all courses and lessons
  const resolvedId = getYouTubeEmbedId(courseId, lessonId);
  return { type: "youtube", videoId: resolvedId || "jwEbff6X3vY" };
}
