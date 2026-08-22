// Centralized Mock Data & Real Database Mode Manager
// Allows toggling or purging demo / mock data globally across all learner and admin screens

const STORAGE_KEY = "trainai_mock_data_enabled";
const CHANGE_EVENT = "trainai_mock_data_changed";

/**
 * Returns true if mock/demo data is enabled (defaults to true for prototyping until disabled by admin/owner)
 */
export function isMockDataEnabled() {
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

// Educational Real YouTube Video Maps for Mock Masterclasses
export const MOCK_YOUTUBE_VIDEOS = {
  "course-figma-ai": {
    defaultVideoId: "jwEbff6X3vY", // Figma Design Systems & Variables Masterclass
    lessons: {
      "l-figma-1": "jwEbff6X3vY",
      "l-figma-2": "7gqG2_v-s_s",
      "l-figma-3": "b_3gLp0r-2w",
      "l-figma-4": "5A4Q4DqM3E8"
    }
  },
  "course-fullstack-ai": {
    defaultVideoId: "2F3TfH3Yf-A", // LangChain & Multi-Agent AI Python Architecture
    lessons: {
      "l-fullstack-1": "2F3TfH3Yf-A",
      "l-fullstack-2": "aywZrzNaKjs",
      "l-fullstack-3": "L_W_tXq3u3k"
    }
  },
  "course-prompt-pro": {
    defaultVideoId: "jC4v5AS4RIM", // Prompt Engineering & LLM Architecture
    lessons: {
      "l-prompt-1": "jC4v5AS4RIM",
      "l-prompt-2": "94S35K3mZ_k"
    }
  },
  "course-cloud-devops": {
    defaultVideoId: "d6WC5n9G_sM", // Docker & Kubernetes Full Course
    lessons: {
      "l-cloud-1": "d6WC5n9G_sM",
      "l-cloud-2": "X48VuDVv0do"
    }
  },
  "course-spatial-ui": {
    defaultVideoId: "Vb0nP_R590k", // VisionOS Spatial Computing UI Design
    lessons: {
      "l-spatial-1": "Vb0nP_R590k",
      "l-spatial-2": "7pL4f-O1o34"
    }
  },
  "course-data-python": {
    defaultVideoId: "LHBE6Q9XlzI", // Python for Data Science & Vector Stores
    lessons: {
      "l-data-1": "LHBE6Q9XlzI",
      "l-data-2": "nLRL_NcnK-4"
    }
  }
};

/**
 * Resolves the YouTube embed video ID or URL for any course / lesson
 */
export function getYouTubeEmbedId(courseId, lessonId) {
  if (!isMockDataEnabled()) return null;
  if (!courseId) return "jwEbff6X3vY";
  const courseConfig = MOCK_YOUTUBE_VIDEOS[courseId];
  if (courseConfig) {
    if (lessonId && courseConfig.lessons?.[lessonId]) {
      return courseConfig.lessons[lessonId];
    }
    return courseConfig.defaultVideoId;
  }
  return "jwEbff6X3vY";
}

/**
 * Universal video source parser supporting direct HTML5 videos (mp4, webm),
 * YouTube URLs/IDs, Vimeo URLs, and mock video fallbacks.
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

  // 6. If mock data is enabled, check mock YouTube dictionary
  if (isMockDataEnabled()) {
    const mockId = getYouTubeEmbedId(courseId, lessonId);
    if (mockId) {
      return { type: "youtube", videoId: mockId, isMock: true };
    }
  }

  return { type: "none" };
}
