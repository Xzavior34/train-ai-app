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
    // Clear any temporary demo bookmarks and local mock states
    localStorage.removeItem("trainai_mock_bookmarks");
    localStorage.removeItem("trainai_mock_notes");
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
