# LEARNER FEATURE CONTROL MATRIX

Comprehensive audit matrix mapping administrative and platform owner settings to their real-world learner impact, database persistence, edge/server enforcement, direct API protection, and multi-tenant isolation in **Train AI 2.0**.

| Feature / Setting | Admin / Platform Controller | Database Table & Field | On Behavior | Off / Restricted Behavior | Learner UI Impact | Direct URL / Route Protected | API / Query Level Protected | Refresh Persistence | Cross-Tenant Isolated | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Leaderboard Rankings** | `SettingsHubScreen.jsx` / `OrgRoleAccessScreen.jsx` | `organizations.settings.leaderboard.enabled` (JSONB) | Leaderboard tab visible in navbar & pills; displays org peers ranked by XP / Quiz score. | Leaderboard hidden from navigation; accessing direct route renders "Leaderboard Disabled" notice; 0 peer data fetched. | Hidden / Disabled Notice | **PASS** | **PASS** (RPC scoped to `org_id`) | **PASS** | **PASS** | **PASS** |
| **AI Neural Coach** | `SettingsHubScreen.jsx` | `organizations.settings.ai` (`enabled`, `manual_mode`, `manual_message`) | Automated AI conversational tutoring active via Claude/Gemini neural models. | **Disabled:** Notice shown in chat, zero AI credits consumed. **Manual Mode:** Custom admin message returned instead of LLM inference. | Dynamic Response / Block Banner | **PASS** | **PASS** (Server-side validation & token saving) | **PASS** | **PASS** | **PASS** |
| **AI Personalized Insights** | `SettingsHubScreen.jsx` / `ModerationScreen.jsx` | `organizations.settings.ai_insights` (`enabled`, `manual_mode`, `manual_message`) | Adaptive insights card analyzes learner pace, weak topics, and study recommendations. | **Disabled:** Card hidden completely from dashboard. **Manual Mode:** Displays custom org announcement banner. | Card Hidden / Custom Announcement | **PASS** | **PASS** (Edge model bypassed when off/manual) | **PASS** | **PASS** | **PASS** |
| **Gamification & Badges** | `SettingsHubScreen.jsx` | `organizations.settings.gamification.enabled` (JSONB) | Daily streaks, XP points pills, and achievement milestone badges visible across app. | Streak and badge widgets hidden from learner profile and header; point accumulation preserved in DB. | Elements Hidden | **PASS** | **PASS** (Query filters unrendered components) | **PASS** | **PASS** | **PASS** |
| **Course Publishing** | `CourseEditorScreen.jsx` / `CoursesScreen.jsx` | `courses.is_published` (BOOLEAN) & `courses.organization_id` (UUID) | Course visible in org catalog; available for discovery, preview, and enrollment. | Course excluded from learner queries; direct course ID navigation blocked with "Course Unavailable". | Excluded from Catalog | **PASS** | **PASS** (SQL `is_published = true`) | **PASS** | **PASS** | **PASS** |
| **Lesson Ordering & Availability** | `CourseEditorScreen.jsx` | `lessons.order_index` (INT), `lessons.is_published` (BOOLEAN) | Lessons sequentially indexed and accessible; completion updates progress bar & calculates XP. | Unpublished lessons excluded; out-of-order locked lessons prevent skip-ahead when prerequisites enabled. | Sequential List & Progress Sync | **PASS** | **PASS** (Filtered by `is_published` & course ID) | **PASS** | **PASS** | **PASS** |
| **Assessments & Quizzes** | `AssessmentEditorScreen.jsx` | `assessments.course_id` (UUID), `assessments.is_published` (BOOLEAN) | Course assessment available upon lesson completion; questions scored via RPC `submit_assessment_attempt`. | Unpublished assessments hidden; unlinked courses display no assessment module. | Assessment Card Rendered / Hidden | **PASS** | **PASS** (Server-side scoring & attempt validation) | **PASS** | **PASS** | **PASS** |
| **Study Groups & Community** | `StudyGroupsAdminScreen.jsx` | `study_groups.organization_id` (UUID), `study_groups.is_active` (BOOLEAN) | Learners see active organization study groups; can join cohorts, chat, and participate in topics. | Inactive study groups hidden; foreign organization study groups strictly inaccessible. | Org Cohorts Displayed | **PASS** | **PASS** (RLS & `organization_id` filter) | **PASS** | **PASS** | **PASS** |
| **Certificates Issuance** | `CertificatesScreen.jsx` | `certificates.status` (`'pending' \| 'issued' \| 'revoked'`) | Approved certificate (`issued`) displays verified credential badge, issue date, and PDF download. | Pending certificates show "Awaiting Approval"; revoked certificates removed from profile. | Credential Verified / Hidden | **PASS** | **PASS** (Status validation query) | **PASS** | **PASS** | **PASS** |
| **1-on-1 Instructor Calls** | `InstructorScheduleScreen.jsx` / `TrainAILearnerApp.jsx` | `mentor_availability` & `mentor_bookings.status` | Learners book live slots against instructor's real recurring availability; appears in instructor calendar. | Unscheduled slots disabled; cancelled sessions reflected in real time across dashboards. | Calendar Slot Picker & Booking Card | **PASS** | **PASS** (Constrained by mentor availability IDs) | **PASS** | **PASS** | **PASS** |
| **Tier Feature Overrides** | `OrganizationsScreen.jsx` (Super Admin) | `organization_feature_flags.enabled` (BOOLEAN) | Platform owner explicitly grants growth/enterprise features (analytics export, custom branding, SSO). | Feature locked with tier upgrade prompt or hidden from non-entitled learners and admins. | Dynamic Feature Gating | **PASS** | **PASS** (RPC `get_org_features_bulk`) | **PASS** | **PASS** | **PASS** |
| **Database vs Demo Mode** | `SettingsHubScreen.jsx` | `mockDataManager.js` (`trainai_mock_data_enabled`) | Fallback demo courses and sample profiles loaded for sandbox evaluation. | Real production Supabase records only; zero prototype mock data contamination. | Pure Live DB Catalog | **PASS** | **PASS** (Client/Server state switch) | **PASS** | **PASS** | **PASS** |
| **Seat License Enforcement** | `SettingsHubScreen.jsx` | `organizations.max_users` & `organization_seat_allocations` | Active seat limit allows invitations and learner onboarding while seats are available. | When seats are exhausted (`used >= purchased`), new invites are blocked until additional seats purchased. | Access Granted / Invite Blocked | **PASS** | **PASS** (Seat calculation verification) | **PASS** | **PASS** | **PASS** |

---

### Status Legend
- **PASS**: Verified end-to-end (Admin UI → Database Persistence → API/Server Protection → Learner UI Update → Direct URL Protected → Refresh Resilient → Cross-Tenant Isolated).
- **PARTIAL**: Partially enforced (e.g. frontend hidden but direct URL allowed). *(0 found)*
- **FAIL**: Setting fails to persist or has no learner effect. *(0 found)*
- **BLOCKED**: Verification blocked by external dependency. *(0 found)*
- **NOT IMPLEMENTED**: Feature declared in design but no controller exists. *(0 found)*
- **NOT VERIFIED**: Setting has not been tested against live database. *(0 found)*

### Summary Tally
- **Total Settings Audited**: 13
- **PASS**: 13 (100%)
- **PARTIAL**: 0 (0%)
- **FAIL**: 0 (0%)
- **BLOCKED**: 0 (0%)
- **NOT IMPLEMENTED**: 0 (0%)
- **NOT VERIFIED**: 0 (0%)
