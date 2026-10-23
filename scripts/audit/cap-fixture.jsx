import { LearningGoalPreference } from "../../src/learner/components/LearningGoalPreference.jsx";
import React from "react";
import CapCohort3Screen from "../../src/learner/screens/CapCohort3Screen.jsx";
import { TOKENS } from "../../src/learner/components/LearnerUI.jsx";
export function CapFixture() {
  return (
    <main className="tai" style={{ padding: 14, minHeight: "100vh" }}>
      <style>{TOKENS}</style>
      {new URLSearchParams(location.search).has("fixture_profile_goal") ? <LearningGoalPreference userId="learner"/> : <CapCohort3Screen
        cohortId="cap-fixture"
        cohortName="CAP Cohort 3"
        session={{ user: { id: "learner" } }}
        courses={[{ id: "actual-course", title: "Assigned Frontend Course" }]}
      />}
    </main>
  );
}
