import React from "react";
import { ProgressBar } from "./LearnerUI.jsx";
import { Sparkles } from "lucide-react";

// There is no dedicated skills/mastery table in the shared schema (no
// `skills`, `course_skills`, or `user_skill_progress` table — confirmed by
// reading the real table list in the reference schema; the closest things
// are a single free-text `user_personalization.skill_level` string and
// `courses.category`/`level`). Rather than invent a fake skills table, this
// mirrors the same honest derivation the super-admin "Learning Tracks"
// screen already uses (fetchLearningTracksSummary in lib/api/platform.js:
// tracks derived from courses.category) — here per-learner mastery per
// category is the average completion % across that learner's own enrolled
// courses in that category, using real `course_enrollments.progress_percentage`
// and `courses.category` only.
export function SkillMasteryCard({ courses = [] }) {
  const enrolled = courses.filter((c) => c.enrolled);
  if (!enrolled.length) return null;

  const byCategory = {};
  for (const c of enrolled) {
    const cat = c.category || "General";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
    byCategory[cat].total += c.progress || 0;
    byCategory[cat].count += 1;
  }

  const rows = Object.entries(byCategory)
    .map(([category, v]) => ({ category, mastery: Math.round(v.total / v.count), courses: v.count }))
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 4);

  return (
    <div className="tai-card tai-mt12">
      <div className="tai-row tai-gap8">
        <Sparkles size={16} color="var(--primary)" />
        <div className="tai-title-sm">Skill mastery</div>
      </div>
      <div className="tai-col tai-gap10 tai-mt10">
        {rows.map((r) => (
          <div key={r.category}>
            <div className="tai-row tai-between" style={{ fontSize: 12.5 }}>
              <span style={{ fontWeight: 600 }}>{r.category}</span>
              <span style={{ color: "var(--text-2)" }}>{r.mastery}% · {r.courses} course{r.courses === 1 ? "" : "s"}</span>
            </div>
            <div className="tai-mt6"><ProgressBar value={r.mastery} height={6} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
