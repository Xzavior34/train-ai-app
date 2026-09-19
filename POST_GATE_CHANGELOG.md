# POST-GATE CHANGELOG

## Acceptance Gate Baseline
- **HEAD Commit**: `fe2dfd7` ("docs: final adversarial learner control verification gate certification")
- **Platform Owner Acceptance Gate Commit**: `3c8997a` ("feat: ensure trainailtd@gmail.com has complete platform owner permissions and role verification")
- **Learner Control Acceptance Gate Commit**: `fe2dfd7`

## Modified Files After Acceptance Gates
1. `src/App.jsx` — Added `/superadmin` route support for Platform Owner portal login entry.
2. `src/hooks/useAuth.js` — Set `emailRedirectTo: window.location.origin + '/auth/callback'` in `signUp` and `resetPasswordForEmail`.
3. `src/index.css` — Added `.ta-content, .tai-content, .ta-app-main, .tai-app-main` desktop layout container max-width (`1400px`) and margin centering (`0 auto`).
4. `src/learner/screens/CohortScreen.jsx` — Dynamic milestone progress bar percentage rendering.
5. `src/learner/screens/CommunityFeedScreen.jsx` — Added `Study Groups` feed tag and filter logic (`post.study_group_id != null`).
6. `src/lib/api/platform.js` — Added `fetchCertificateRequests`, `approveCertificateRequest`, `updateUserOrgRole`, and updated `updateUserPlatformRole` to call `update_user_org_role` RPC.
7. `src/platform/admin/AdminAnalyticsScreen.jsx` — Added `startDate` and `endDate` date picker controls for telemetry filtering.
8. `src/platform/admin/ComplianceScreen.jsx` — Added **Certificate Approvals** tab UI using `certificate_requests` table and `approve_certificate_request` RPC.
9. `src/platform/admin/PeopleScreen.jsx` — Passed `currentUserId` to `MemberDetailModal` and wired `updateUserPlatformRole`.
10. `src/platform/admin/SeatsScreen.jsx` — Imported `updateUserPlatformRole` and added in-place role dropdown selector for active seated members.
11. `src/platform/mentor/LearnerFeedScreen.jsx` — Added `study_groups` filter tab (`p.study_group_id != null`).
12. `src/services/supabaseClient.js` — Configured project reference resolution.
13. `supabase/functions/invite-user/index.ts` — Updated invite Edge Function.
14. `supabase/migrations/0165_sso_domain_routing.sql` — Added SSO domain routing function `join_default_organization()`.
15. `supabase/migrations/0166_certificate_request_workflow.sql` — Added `certificate_requests` table, `approve_certificate_request` RPC, and `update_user_org_role` RPC.

## Summary of Functional Changes
- **Learner Feed / Study Groups**: `study_groups` filter tab filtering `study_group_id != null`.
- **Certificate Approvals**: Certificate request workflow with admin approval/rejection RPC.
- **In-Place Role Management**: In-place role dropdown promotion/demotion on Seats and People screens via `update_user_org_role` RPC.
- **Analytics Date Filter**: Date pickers (`startDate`, `endDate`) added to Admin Analytics.
- **Auth & Routing**: `/superadmin` URL routing and explicit `/auth/callback` redirect setting.
- **Layout Spacing**: `1400px` container max-width desktop spacing in `index.css`.
