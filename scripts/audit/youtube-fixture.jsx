import React from "react";
import { YouTubeCourseDiscovery } from "../../src/platform/admin/YouTubeCourseDiscovery.jsx";
import { TOKENS } from "../../src/platform/components/PlatformUI.jsx";
const initial = {
  id: "suggestion-1",
  video_id: "ABCDEFGHIJK",
  title: "Product Management: Research, Roadmaps and Prioritization",
  description: "A synthetic course used for isolated interface verification.",
  channel_title: "Example Academy",
  duration_seconds: 7200,
  level: "beginner",
  reason: "Covers the requested foundations for new product managers.",
  cautions: "Review exercises before assigning.",
  verified_at: new Date().toISOString(),
  status: "pending",
  youtube_course_searches: { prompt: "Product management for beginners" },
};
function rows() {
  return JSON.parse(sessionStorage.getItem("youtube-fixture") || "[]");
}
const api = {
  discoveryStatus: async () => ({
    organizationCredits: sessionStorage.getItem('youtube-fixture') ? 49 : 50,
    ready: !new URLSearchParams(location.search).has("missing_key"),
    youtube: !new URLSearchParams(location.search).has("missing_key"),
    ai: true,
  }),
  listYouTubeSuggestions: async () => rows(),
  searchYouTubeCourses: async () => {
    if (new URLSearchParams(location.search).has("search_error"))
      throw Error("YouTube quota reached. Please try again later.");
    sessionStorage.setItem("youtube-fixture", JSON.stringify([initial]));
    return { count: 1 };
  },
  reviewYouTubeSuggestion: async (org, id, decision) => {
    if (new URLSearchParams(location.search).has("save_error"))
      throw Error("Could not save. Please retry.");
    sessionStorage.setItem(
      "youtube-fixture",
      JSON.stringify(
        rows().map((s) => ({
          ...s,
          status:
            decision === "accept"
              ? "accepted"
              : decision === "reject"
                ? "rejected"
                : "pending",
          course_id: decision === "accept" ? "accepted-course" : null,
        })),
      ),
    );
  },
  youTubeAssignmentTargets: async () => ({
    cohorts: [{ id: "cohort", name: "CAP Cohort 3" }],
    learners: [{ id: "learner", name: "Example Learner" }],
  }),
  publishAssignYouTubeCourse: async () => 1,
};
export function YouTubeFixture() {
  return (
    <main className="ta" style={{ padding: 16, minHeight: "100vh" }}>
      <style>{TOKENS}</style>
      <YouTubeCourseDiscovery
        orgId="fixture-org"
        api={api}
        onClose={() => {}}
        onManage={() => {}}
      />
    </main>
  );
}
