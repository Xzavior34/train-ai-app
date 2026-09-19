# LEARNER FEATURE BEHAVIOR REPORT

Detailed verification report on individual feature behaviors across ON and OFF states, direct route navigation, API level enforcement, database persistence, and cross-organization isolation in **Train AI 2.0**.

---

## 1. Leaderboard Rankings

- **Feature Name**: Leaderboard & Competitive Rankings
- **Admin Setting Controller**: `SettingsHubScreen.jsx` & `OrgRoleAccessScreen.jsx` → `updateOrgLeaderboardSettings(orgId, { enabled })`
- **Database Table & Field**: `organizations.settings.leaderboard.enabled` (JSONB)
- **ON State Behavior**:
  - Leaderboard tab appears in top and sub navigation bars.
  - XP points pill links directly to `go("leaderboard")`.
  - Data fetched via RPC `get_leaderboard_with_profiles(100, org_id)`.
  - Ranks learners exclusively within their tenant organization.
- **OFF State Behavior**:
  - Leaderboard tab is hidden from navigation menus.
  - XP pill fallback redirects to `go("achievements")`.
  - No background RPC queries executed.
- **Direct Route / Deep Link Verification**:
  - Navigating directly to `screen = "leaderboard"` renders a secure fallback notice: *"Leaderboard Disabled: Rankings and leaderboards are currently disabled by your organization administrator."*
  - Zero peer data is requested or rendered.
- **API & Query Level Protection**:
  - `fetchLeaderboard(100, orgId)` enforces `if (!leaderboardEnabled) return null;`
  - Database RPC `get_leaderboard_with_profiles` enforces `WHERE user_profiles.organization_id = p_org_id`.
- **Database Persistence & Refresh Resilience**:
  - Stored permanently in `organizations.settings->'leaderboard'->>'enabled'`.
  - Browser refresh reloads setting directly from Supabase; state remains consistent.
- **Cross-Organization Tenant Isolation**:
  - Verified with `QA_ORG_A` (Disabled) and `QA_ORG_B` (Enabled): Org A learners never receive Org B peer rankings.
- **Verification Result**: **PASS**

---

## 2. AI Neural Coach (Tutoring Assistant)

- **Feature Name**: AI Neural Coach
- **Admin Setting Controller**: `SettingsHubScreen.jsx` → `updateOrgAISettings(orgId, { enabled, manual_mode, manual_message })`
- **Database Table & Field**: `organizations.settings.ai` (`{ enabled: boolean, manual_mode: boolean, manual_message: string }`)
- **ON State Behavior (Automatic AI Mode)**:
  - AI Coach active in chat interface.
  - Generates real-time contextual hints and responses using Gemini/Claude models.
  - Consumes user AI credits appropriately.
- **ON State Behavior (Manual Moderation Mode)**:
  - Returns the organization administrator's pre-configured custom message immediately.
  - Bypasses external LLM API calls entirely, preserving AI tokens.
- **OFF State Behavior**:
  - AI chat input indicates AI Coach is disabled for the organization.
  - Submitting a message triggers an immediate notification: *"AI Coach has been turned off for your organization. Reach out to your instructor for help."*
  - Zero AI credits consumed.
- **Direct Route / Deep Link Verification**:
  - Opening the AI Coach screen while disabled blocks message dispatching and prompts the user with the disabled policy.
- **API & Query Level Protection**:
  - `TrainAILearnerApp.jsx` evaluates `orgAISettings.enabled` before invoking serverless edge inference functions.
- **Database Persistence & Refresh Resilience**:
  - Persisted under `organizations.settings->'ai'`.
  - Survives page reload, session token refresh, and cross-device sign-in.
- **Cross-Organization Tenant Isolation**:
  - Verified: Changing Org A to disabled does not impact Org B's active AI Coach.
- **Verification Result**: **PASS**

---

## 3. AI Personalized Insights

- **Feature Name**: AI Learning Insights Card
- **Admin Setting Controller**: `SettingsHubScreen.jsx` & `ModerationScreen.jsx` → `updateOrgAIInsightsSettings(orgId, { enabled, manual_mode, manual_message })`
- **Database Table & Field**: `organizations.settings.ai_insights` (`{ enabled: boolean, manual_mode: boolean, manual_message: string }`)
- **ON State Behavior (Automatic AI Mode)**:
  - Renders `AIInsightsCard` on the learner dashboard.
  - Analyzes completion pace, quiz strengths, and provides actionable recommendations.
- **ON State Behavior (Manual Mode)**:
  - Replaces automated analysis with a custom organization announcement header *"A note from your organization"* containing the admin's broadcast.
- **OFF State Behavior**:
  - `AIInsightsCard` returns `null` and unmounts completely from the DOM.
- **Direct Route / Deep Link Verification**:
  - Dashboard loads cleanly with zero layout shifts or placeholder errors.
- **API & Query Level Protection**:
  - When disabled or in manual mode, discretionary LLM analysis calls are omitted.
- **Database Persistence & Refresh Resilience**:
  - Persisted in `organizations.settings->'ai_insights'`.
  - Re-fetched on session initialization.
- **Cross-Organization Tenant Isolation**:
  - Verified: Org A's manual broadcast is isolated from Org B's live AI insight stream.
- **Verification Result**: **PASS**

---

## 4. Gamification, Streaks & Badges

- **Feature Name**: Gamification System (Streaks, Badges & Points)
- **Admin Setting Controller**: `SettingsHubScreen.jsx` → `updateOrgGamificationSettings(orgId, { enabled })`
- **Database Table & Field**: `organizations.settings.gamification.enabled` (JSONB)
- **ON State Behavior**:
  - Displays consecutive study streaks, earned XP badges, and gamification milestone banners.
  - Header displays level progression and daily goal check-ins.
- **OFF State Behavior**:
  - Streak icons and badge showcases hidden from profile and dashboard.
  - Focuses user experience purely on course completion and formal certification.
  - Historical XP and streak values remain preserved in the database.
- **Direct Route / Deep Link Verification**:
  - Profile screen cleanly suppresses gamification widgets without errors.
- **API & Query Level Protection**:
  - Client state gates rendering; database records continue collecting passive progress.
- **Database Persistence & Refresh Resilience**:
  - Persisted in `organizations.settings->'gamification'->>'enabled'`.
- **Cross-Organization Tenant Isolation**:
  - Scoped strictly to the learner's organization settings.
- **Verification Result**: **PASS**

---

## 5. Course Publishing & Catalog Visibility

- **Feature Name**: Course Publishing & Catalog Gating
- **Admin Setting Controller**: `CourseEditorScreen.jsx` & `CoursesScreen.jsx` → `updateCourse(courseId, { is_published })`
- **Database Table & Field**: `courses.is_published` (BOOLEAN) & `courses.organization_id` (UUID)
- **ON State Behavior (`is_published: true`)**:
  - Course is searchable, visible in the organization catalog, and available for learner enrollment.
- **OFF State Behavior (`is_published: false`)**:
  - Course is hidden from catalog searches and learner discovery feeds.
- **Direct Route / Deep Link Verification**:
  - Navigating directly to `courseDetail` with an unpublished course ID returns `"Course not found or unavailable"` and redirects to catalog.
- **API & Query Level Protection**:
  - Supabase query enforces: `.eq("is_published", true).or(\`organization_id.eq.${orgId},organization_id.is.null\`)`.
- **Database Persistence & Refresh Resilience**:
  - Persisted directly in `courses` table in Supabase.
- **Cross-Organization Tenant Isolation**:
  - Org A private courses are invisible to Org B learners even if published (`organization_id` isolation).
- **Verification Result**: **PASS**

---

## 6. Lesson Ordering & Progress Tracking

- **Feature Name**: Lesson Availability & Progress Persistence
- **Admin Setting Controller**: `CourseEditorScreen.jsx` → `reorderLessons`, `updateLesson`
- **Database Table & Field**: `lessons.order_index` (INT), `lessons.is_published` (BOOLEAN), `lesson_progress` (TABLE)
- **ON State Behavior**:
  - Lessons rendered in exact sequential order according to `order_index`.
  - Completing a lesson creates or updates a `lesson_progress` record (`is_completed = true, completed_at = now()`).
  - Course completion percentage dynamically updates.
- **OFF State Behavior**:
  - Unpublished lessons are omitted from the curriculum playlist.
  - Incomplete lessons remain marked as pending.
- **Direct Route / Deep Link Verification**:
  - Direct lesson navigation validates that the lesson belongs to an active, published course.
- **API & Query Level Protection**:
  - Scoped by `course_id` and `is_published = true`.
- **Database Persistence & Refresh Resilience**:
  - Stored in `lesson_progress` table keyed by `(user_id, lesson_id)`. Survives all session reloads.
- **Cross-Organization Tenant Isolation**:
  - Progress records reference specific user and course UUIDs scoped to organization.
- **Verification Result**: **PASS**

---

## 7. Assessments & Course Quizzes

- **Feature Name**: Course Assessments
- **Admin Setting Controller**: `AssessmentEditorScreen.jsx` & `AssessmentsScreen.jsx` → `createAssessment`, `updateAssessment`
- **Database Table & Field**: `assessments.course_id` (UUID), `assessments.is_published` (BOOLEAN), `assessment_attempts`
- **ON State Behavior**:
  - Assessment module appears at the end of the course curriculum.
  - Learner submits answers scored securely via `submit_assessment_attempt` RPC.
  - Score and passing status recorded.
- **OFF State Behavior**:
  - Unpublished assessments are excluded from course details.
- **Direct Route / Deep Link Verification**:
  - Accessing an assessment requires enrollment and an active assessment ID.
- **API & Query Level Protection**:
  - Answers and correct option keys validated server-side.
- **Database Persistence & Refresh Resilience**:
  - Stored in `assessments` and `assessment_attempts` tables.
- **Cross-Organization Tenant Isolation**:
  - Linked to courses belonging to the organization.
- **Verification Result**: **PASS**

---

## 8. Study Groups & Community Tenant Isolation

- **Feature Name**: Study Groups & Cohorts
- **Admin Setting Controller**: `StudyGroupsAdminScreen.jsx` → `createStudyGroup`, `updateStudyGroup`
- **Database Table & Field**: `study_groups.organization_id` (UUID), `study_groups.is_active` (BOOLEAN)
- **ON State Behavior**:
  - Active study groups listed under Community → Study Groups.
  - Learners can join, post discussions, and view member lists.
- **OFF State Behavior**:
  - Inactive or archived study groups hidden from public group listing.
- **Direct Route / Deep Link Verification**:
  - Direct navigation to a group checks that the learner belongs to the group's organization.
- **API & Query Level Protection**:
  - Query filtered by `.eq("organization_id", orgId).eq("is_active", true)`.
- **Database Persistence & Refresh Resilience**:
  - Persisted in `study_groups` and `study_group_members` tables.
- **Cross-Organization Tenant Isolation**:
  - Verified: Org A learners cannot view or access Org B study groups.
- **Verification Result**: **PASS**

---

## 9. Certificates Issuance & Revocation

- **Feature Name**: Course Completion Certificates
- **Admin Setting Controller**: `CertificatesScreen.jsx` → `approveCertificate`, `revokeCertificate`
- **Database Table & Field**: `certificates.status` (`'pending' | 'issued' | 'revoked'`), `certificates.issued_at`
- **ON State Behavior (`status: 'issued'`)**:
  - Certificate badge, credential ID, and download link appear in learner profile under "Certificates".
- **OFF State Behavior (`status: 'pending'` / `'revoked'`)**:
  - Pending requests show "Pending Review" banner.
  - Revoked certificates are suppressed from verified credentials.
- **Direct Route / Deep Link Verification**:
  - Certificate verification URL verifies status against live database.
- **API & Query Level Protection**:
  - Queries filter on `user_id = auth.uid()` and `status = 'issued'`.
- **Database Persistence & Refresh Resilience**:
  - Persisted in `certificates` table in Supabase.
- **Cross-Organization Tenant Isolation**:
  - Certificates scoped to `organization_id`, `course_id`, and `user_id`.
- **Verification Result**: **PASS**

---

## 10. 1-on-1 Instructor Calls & Mentor Booking

- **Feature Name**: 1-on-1 Instructor Scheduling
- **Admin / Instructor Controller**: `InstructorScheduleScreen.jsx` → `setMentorAvailability`
- **Database Table & Field**: `mentor_availability`, `mentor_bookings.status` (`'pending' | 'confirmed' | 'cancelled'`)
- **ON State Behavior**:
  - Learner selects an instructor and chooses an available recurring time slot.
  - Booking is inserted into `mentor_bookings` and instantly reflected on the instructor's dashboard.
- **OFF State Behavior**:
  - Slots with existing bookings or unconfigured hours cannot be selected.
- **Direct Route / Deep Link Verification**:
  - Booking validation checks slot availability before creating the booking.
- **API & Query Level Protection**:
  - Database foreign keys ensure valid instructor and learner IDs.
- **Database Persistence & Refresh Resilience**:
  - Stored in `mentor_bookings` table.
- **Cross-Organization Tenant Isolation**:
  - Learners only match with instructors in their organization or global mentors.
- **Verification Result**: **PASS**
