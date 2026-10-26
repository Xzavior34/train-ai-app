// Pure provider boundary: AI can rank real YouTube records, never invent URLs.
export function durationSeconds(value: string): number {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(
    value || "",
  );
  return m
    ? Number(m[1] || 0) * 86400 +
        Number(m[2] || 0) * 3600 +
        Number(m[3] || 0) * 60 +
        Number(m[4] || 0)
    : 0;
}
export function verifiedVideos(items: any[], region = "NG") {
  return (items || [])
    .filter(
      (v) =>
        /^[\w-]{11}$/.test(v.id) &&
        v.status?.privacyStatus === "public" &&
        v.status?.embeddable === true &&
        v.status?.uploadStatus === "processed" &&
        v.snippet?.liveBroadcastContent === "none" &&
        v.contentDetails?.contentRating?.ytRating !== "ytAgeRestricted" &&
        !(v.contentDetails?.regionRestriction?.blocked || []).includes(
          region,
        ) &&
        (!v.contentDetails?.regionRestriction?.allowed ||
          v.contentDetails.regionRestriction.allowed.includes(region)) &&
        durationSeconds(v.contentDetails?.duration) > 0,
    )
    .map((v) => ({
      video_id: v.id,
      title: String(v.snippet.title).slice(0, 300),
      description: String(v.snippet.description || "").slice(0, 4000),
      channel_title: String(v.snippet.channelTitle).slice(0, 200),
      published_at: v.snippet.publishedAt,
      duration_seconds: durationSeconds(v.contentDetails.duration),
    }));
}
export function rankedSuggestions(videos: any[], ranking: any, level: string) {
  const byId = new Map(videos.map((v) => [v.video_id, v]));
  const seen = new Set();
  const result = [];
  for (const entry of ranking?.suggestions || []) {
    const video = byId.get(entry.video_id);
    if (
      !video ||
      seen.has(entry.video_id) ||
      typeof entry.reason !== "string" ||
      !entry.reason.trim()
    )
      continue;
    seen.add(entry.video_id);
    result.push({
      ...video,
      reason: entry.reason.slice(0, 1200),
      cautions: String(entry.cautions || "").slice(0, 1000),
      category: String(entry.category || "General").slice(0, 100),
      level,
      rank: result.length + 1,
    });
    if (result.length === 6) break;
  }
  return result;
}
