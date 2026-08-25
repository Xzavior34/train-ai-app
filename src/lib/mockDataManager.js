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

// Educational Real YouTube Video Maps for all course topics
export const MOCK_YOUTUBE_VIDEOS = {
  // 1. Figma & Spatial Design Systems
  "course-figma-ai": {
    defaultVideoId: "jwEbff6X3vY",
    lessons: {
      "l-figma-1": "jwEbff6X3vY", // Figma Design Systems & Variables Masterclass
      "l-figma-2": "7gqG2_v-s_s", // Figma Variables & Dark Mode Systems
      "l-figma-3": "b_3gLp0r-2w", // Figma Auto Layout 5.0 in Depth
      "l-figma-4": "5A4Q4DqM3E8"  // Figma to Code & AI Plugins
    }
  },
  "course-spatial-ui": {
    defaultVideoId: "Vb0nP_R590k",
    lessons: {
      "l-spatial-1": "Vb0nP_R590k", // VisionOS Spatial Computing UI Design
      "l-spatial-2": "7pL4f-O1o34", // Spatial UI & Glass Tokens
      "l-spatial-3": "fU_gZ5HwH3A"  // Spatial Prototyping Workshop
    }
  },

  // 2. Full-Stack AI & Web Dev
  "course-fullstack-ai": {
    defaultVideoId: "2xxziIWmaSA",
    lessons: {
      "l-fullstack-1": "2xxziIWmaSA", // LangChain GEN AI Tutorial – 6 Projects
      "l-fullstack-2": "aywZrzNaKjs", // LangChain Crash Course
      "l-fullstack-3": "N4tD1rFkSow", // Production RAG & Vector Databases
      "l-fullstack-4": "zR27t1908mQ"  // Next.js & Full-Stack App Engineering
    }
  },
  "demo-course-ai-fundamentals": {
    defaultVideoId: "2xxziIWmaSA",
    lessons: {
      "demo-ai-1": "2xxziIWmaSA",
      "demo-ai-2": "aywZrzNaKjs",
      "demo-ai-3": "N4tD1rFkSow"
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
    defaultVideoId: "s5R-5B-H62E",
    lessons: {
      "l-prompt-1": "s5R-5B-H62E", // Prompt Engineering Tutorial – Master ChatGPT & LLMs
      "l-prompt-2": "d76oHq4G4zM", // Prompt Engineering for Web Devs
      "l-prompt-3": "L_G8zYv863w"  // Prompt Engineering Full Course 2025
    }
  },

  // 4. Cloud DevOps & Microservices
  "course-cloud-devops": {
    defaultVideoId: "fqMOX6JJhGo",
    lessons: {
      "l-cloud-1": "fqMOX6JJhGo", // Docker Tutorial for Beginners - Full DevOps Course
      "l-cloud-2": "s_o8gnlrWoU", // Kubernetes Course - Full Beginners Tutorial
      "l-cloud-3": "pWbMrnB-J_w"  // Master Full-Stack Docker & CI/CD
    }
  },

  // 5. Python & Data Science
  "course-data-python": {
    defaultVideoId: "N4tqz8yP8T4",
    lessons: {
      "l-data-1": "N4tqz8yP8T4", // Python for Data Science Course – Hands-on Projects
      "l-data-2": "ua-CiDNq95s", // Learn Data Science Tutorial - Full Course
      "l-data-3": "7eh4d6sabA0"  // Machine Learning with Python Full Course
    }
  },
  "d0000000-0000-0000-0000-000000000023": {
    defaultVideoId: "N4tqz8yP8T4",
    lessons: {
      "d0000000-0000-0000-0000-000000000023-l1": "N4tqz8yP8T4"
    }
  },

  // 6. Applied Machine Learning & Foundations of Algebra
  "course-foundations": {
    defaultVideoId: "7eh4d6sabA0",
    lessons: {
      "l-foundations-1": "7eh4d6sabA0", // Machine Learning with Python
      "l-foundations-2": "0B5eIE_1v-o", // Scikit-Learn Course
      "l-foundations-3": "fXpMTcqms80"  // Linear Algebra Course for ML
    }
  },
  "c0000000-0000-0000-0000-000000000001": {
    defaultVideoId: "7eh4d6sabA0",
    lessons: {
      "c0000000-0000-0000-0000-000000000001-l1": "7eh4d6sabA0",
      "c0000000-0000-0000-0000-000000000001-l2": "0B5eIE_1v-o"
    }
  },
  "c0000000-0000-0000-0000-000000000002": {
    defaultVideoId: "fXpMTcqms80",
    lessons: {
      "c0000000-0000-0000-0000-000000000002-l1": "fXpMTcqms80",
      "c0000000-0000-0000-0000-000000000002-l2": "B18o7rP82sY"
    }
  },

  // 7. Leadership, Management & Workplace Compliance
  "demo-course-external-leadership": {
    defaultVideoId: "P3t8i_p4zJ8",
    lessons: {
      "demo-lead-1": "P3t8i_p4zJ8",
      "demo-lead-2": "8Tvy_g8bUfI"
    }
  },
  "d0000000-0000-0000-0000-000000000021": {
    defaultVideoId: "P3t8i_p4zJ8",
    lessons: {
      "d0000000-0000-0000-0000-000000000021-l1": "P3t8i_p4zJ8"
    }
  },
  "d0000000-0000-0000-0000-000000000024": {
    defaultVideoId: "pWbMrnB-J_w",
    lessons: {
      "d0000000-0000-0000-0000-000000000024-l1": "pWbMrnB-J_w"
    }
  },
  "demo-course-compliance-101": {
    defaultVideoId: "VwT_uG-Z7qA",
    lessons: {
      "demo-comp-1": "VwT_uG-Z7qA"
    }
  },
  "d0000000-0000-0000-0000-000000000022": {
    defaultVideoId: "VwT_uG-Z7qA",
    lessons: {
      "d0000000-0000-0000-0000-000000000022-l1": "VwT_uG-Z7qA"
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
  if (text.includes("figma") || text.includes("design") || text.includes("ux") || text.includes("ui")) {
    return "jwEbff6X3vY";
  }
  if (text.includes("full-stack") || text.includes("react") || text.includes("web") || text.includes("engineer")) {
    return "2xxziIWmaSA";
  }
  if (text.includes("prompt") || text.includes("llm") || text.includes("agent") || text.includes("ai")) {
    return "s5R-5B-H62E";
  }
  if (text.includes("cloud") || text.includes("devops") || text.includes("docker") || text.includes("kubernetes")) {
    return "fqMOX6JJhGo";
  }
  if (text.includes("spatial") || text.includes("visionos") || text.includes("3d")) {
    return "Vb0nP_R590k";
  }
  if (text.includes("algebra") || text.includes("math")) {
    return "fXpMTcqms80";
  }
  if (text.includes("machine learning") || text.includes("ml") || text.includes("neural")) {
    return "7eh4d6sabA0";
  }
  if (text.includes("data") || text.includes("python") || text.includes("analytics")) {
    return "N4tqz8yP8T4";
  }
  if (text.includes("leadership") || text.includes("management") || text.includes("strategy") || text.includes("project")) {
    return "P3t8i_p4zJ8";
  }
  if (text.includes("compliance") || text.includes("policy") || text.includes("security")) {
    return "VwT_uG-Z7qA";
  }

  return "jwEbff6X3vY";
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
