/**
 * Train AI Authentication Rate Limiter
 * Enforces brute-force protection with a maximum of 10 failed password trials.
 * Temporarily locks out sign-in for 15 minutes after 10 failed attempts.
 */

export const MAX_PASSWORD_TRIALS = 10;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const STORAGE_PREFIX = "tai_auth_ratelimit_";

function getStorageKey(identifier) {
  const normalized = (identifier || "global").toLowerCase().trim();
  return `${STORAGE_PREFIX}${normalized}`;
}

/**
 * Retrieves the current rate limit status for a given identifier (email or client key).
 * Handles automatic expiration of lockouts when time expires.
 */
export function getRateLimitStatus(identifier = "global") {
  try {
    const key = getStorageKey(identifier);
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        isLocked: false,
        attempts: 0,
        maxAttempts: MAX_PASSWORD_TRIALS,
        remainingAttempts: MAX_PASSWORD_TRIALS,
        remainingMs: 0,
        lockedUntil: null
      };
    }

    const data = JSON.parse(raw);
    const now = Date.now();

    // Check if lockout is active
    if (data.lockedUntil && now < data.lockedUntil) {
      return {
        isLocked: true,
        attempts: data.attempts || MAX_PASSWORD_TRIALS,
        maxAttempts: MAX_PASSWORD_TRIALS,
        remainingAttempts: 0,
        remainingMs: data.lockedUntil - now,
        lockedUntil: data.lockedUntil
      };
    }

    // Lockout expired: reset attempts
    if (data.lockedUntil && now >= data.lockedUntil) {
      localStorage.removeItem(key);
      return {
        isLocked: false,
        attempts: 0,
        maxAttempts: MAX_PASSWORD_TRIALS,
        remainingAttempts: MAX_PASSWORD_TRIALS,
        remainingMs: 0,
        lockedUntil: null
      };
    }

    const attempts = data.attempts || 0;
    const remaining = Math.max(0, MAX_PASSWORD_TRIALS - attempts);

    return {
      isLocked: false,
      attempts,
      maxAttempts: MAX_PASSWORD_TRIALS,
      remainingAttempts: remaining,
      remainingMs: 0,
      lockedUntil: null
    };
  } catch (err) {
    console.warn("Could not read auth rate limit:", err);
    return {
      isLocked: false,
      attempts: 0,
      maxAttempts: MAX_PASSWORD_TRIALS,
      remainingAttempts: MAX_PASSWORD_TRIALS,
      remainingMs: 0,
      lockedUntil: null
    };
  }
}

/**
 * Records a failed password attempt and activates lockout if trial count reaches 10.
 */
export function recordFailedPasswordAttempt(identifier = "global") {
  try {
    const key = getStorageKey(identifier);
    const current = getRateLimitStatus(identifier);
    const newAttempts = current.attempts + 1;
    const now = Date.now();

    let lockedUntil = null;
    let isLocked = false;

    if (newAttempts >= MAX_PASSWORD_TRIALS) {
      lockedUntil = now + LOCKOUT_DURATION_MS;
      isLocked = true;
    }

    const payload = {
      attempts: newAttempts,
      lockedUntil,
      lastAttemptAt: now
    };

    localStorage.setItem(key, JSON.stringify(payload));

    return {
      isLocked,
      attempts: newAttempts,
      maxAttempts: MAX_PASSWORD_TRIALS,
      remainingAttempts: Math.max(0, MAX_PASSWORD_TRIALS - newAttempts),
      remainingMs: lockedUntil ? LOCKOUT_DURATION_MS : 0,
      lockedUntil
    };
  } catch (err) {
    console.warn("Could not save failed auth attempt:", err);
    return {
      isLocked: false,
      attempts: 1,
      maxAttempts: MAX_PASSWORD_TRIALS,
      remainingAttempts: MAX_PASSWORD_TRIALS - 1,
      remainingMs: 0,
      lockedUntil: null
    };
  }
}

/**
 * Clears rate limiting on successful authentication.
 */
export function resetPasswordRateLimit(identifier = "global") {
  try {
    const key = getStorageKey(identifier);
    localStorage.removeItem(key);
  } catch (err) {
    console.warn("Could not reset auth rate limit:", err);
  }
}

/**
 * Helper to format remaining milliseconds into MM:SS string.
 */
export function formatLockoutTime(remainingMs) {
  if (!remainingMs || remainingMs <= 0) return "00:00";
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
