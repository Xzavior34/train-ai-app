// Retry read-only access checks only for temporary connection/service failures.
// Permission and session errors must still reach the access gate immediately.
export function isTemporaryAccessError(error) {
  if ([401, 403].includes(Number(error?.status)) || error?.code === "42501") return false;
  return [502, 503, 504].includes(Number(error?.status))
    || /failed to fetch|fetch failed|network ?error|network request failed|load failed|network connection/i.test(error?.message || "");
}

export async function checkWorkspaceAccess(check, { delays = [400, 1200], wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await check();
    } catch (error) {
      if (!isTemporaryAccessError(error) || attempt >= delays.length) throw error;
      await wait(delays[attempt]);
    }
  }
}
