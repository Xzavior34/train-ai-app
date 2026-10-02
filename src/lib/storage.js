/**
 * Train AI Safe Local Storage Utility
 * Prevents mobile browser crashes (Safari Private Browsing, disabled cookies)
 * when accessing localStorage or sessionStorage.
 */

export const safeStorage = {
  getItem(key, defaultValue = null) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return defaultValue;
      const val = window.localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  getJSON(key, defaultValue = null) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return defaultValue;
      const val = window.localStorage.getItem(key);
      if (!val) return defaultValue;
      return JSON.parse(val);
    } catch {
      return defaultValue;
    }
  },

  setItem(key, value) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      const str = typeof value === "string" ? value : JSON.stringify(value);
      window.localStorage.setItem(key, str);
      return true;
    } catch {
      return false;
    }
  },

  removeItem(key) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
};
