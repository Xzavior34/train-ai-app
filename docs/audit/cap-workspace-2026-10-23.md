# CAP workspace and learner skill audit — 23 October 2026

## Findings and repair

The production project `jeobggrtxeybxvlwpxvn` did not contain `cap_teams`, `cap_team_members`, or `mentorship_checkins`. That caused the page's teams/check-ins error. The old page could also merge browser sample teams into live results, silently report failed review updates as successful, label a browser-only problem statement as validated, and show an arbitrary enrolled course as CAP curriculum.

Migration `202610230002_cap_workspace_and_specific_skills.sql` was applied successfully in the production SQL editor. CAP now uses one authenticated workspace read and scoped database functions for changes. No sample teams, fabricated reviews, or learner selections were inserted. Initial live verification returned admin access, 26 cohort members, 13 available track/skill choices, zero saved teams, and zero saved check-ins.

## Admin controls

Open **Admin → Cohorts → Manage CAP Cohort 3 → CAP programme & learner goals**. Admins can inspect learner goals and submitted problem statements, review those statements, configure available track/skill choices, create and archive/restore teams, manage team membership and roles, assign cohort instructors as mentors, change team phases, save Demo Day scores/feedback, and log check-ins, including private admin notes.

Learners can save their own specific goal (for example, **Code → Frontend development**), submit a problem statement for review, register/join a team, and edit their team's project details and links. They cannot change staff-only fields, private notes, or another learner's goal. Submitted statements remain “Submitted” until staff review them; editing a reviewed statement requires review again. A new team has no final score until one is recorded, and a score of 100 is supported.

## Profile learning goals outside CAP

Migration `202610230003_profile_learning_goal.sql` adds a self-only profile goal. Learners use **Courses → My learning goal** to save an exact track and skill without changing their course/cohort assignments. The authenticated database operation preserves all existing registration JSON and binds updates to the signed-in account. Admin member records show this profile goal with its source; CAP admin rosters show it alongside the cohort-specific goal. No existing learner choice is inferred or overwritten.

## Existing learning preferences

Existing registration choices were stored in `user_personalization.data.learningTracks` and `data.techInterest`, while the typed `learning_tracks` column was empty. The admin CAP roster and member learning record now expose these existing choices separately from the new explicit cohort goal. Broad software-engineering choices remain broad; Frontend/Backend is not inferred from courses, team roles, or a broad track label. Disabling a catalog option preserves prior learner selections.

## Verification

- `npm run test:cap`: isolated PostgreSQL-compatible database tests and 24 API/display regression tests passed. Covers persistence, exact preferences, review state, 100-point scores, assigned mentor/admin controls, private notes, cross-organization denial, suspended/unassigned denial, and anonymous denial.
- Existing unit suite: 33 tests passed.
- Screen rendering audit: 73 screens passed.
- Browser workflow: profile learning goal persistence, cohort selection/submission/team creation, admin review/team edits/check-ins/score, failed writes, and loading retry passed; layouts verified at 320, 390, 540, 768 and 1440 pixels.
- Production build passed. Browser workflow screenshots use isolated synthetic records. No test learners, teams or check-ins were created in production.
