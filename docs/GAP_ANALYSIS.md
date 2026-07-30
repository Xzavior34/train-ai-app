# Gap analysis: train-ai-app vs train-ai-ltd-main

Comparing this repo (`train-ai-app`, plain JS/Vite, 137-table schema) against the uploaded `train-ai-ltd-main.zip` (TypeScript/shadcn, 165-table live Supabase schema — no SQL migrations ship in that repo, so its schema was reverse-engineered from `src/integrations/supabase/types.ts`, the SQL under its `supabase/migrations/`, and its `docs/`).

## Database schema — done

`supabase/migrations/0007_missing_schema.sql` adds the 21 tables the source app has that represented real functionality gaps here, each with RLS enabled and explicit policies following this repo's existing conventions (user-owned / cohort-scoped / org-scoped / admin-only):

career_goal_progress, cohort_learner_courses, cohort_posts, cohort_post_replies, cohort_post_reactions, cohort_resources, cohort_sessions, external_course_progress, external_course_certificates, learning_path_enrollments, course_files, course_uploads, lesson_uploads, file_uploads, course_quality_reviews, course_analytics, course_mentor_discussions, mentor_achievements, polls, poll_options, poll_votes.

8 more tables exist in the source app but were intentionally skipped as legacy/duplicate variants of tables this schema already has in a cleaner form (`profiles`→`user_profiles`, `roles`→`user_roles`/`platform_role` enum, `real_courses`→`courses`, `user_course_progress`→`course_enrollments`, `user_progress`→`lesson_progress`, `chat_messages`→`study_group_messages`, `mentor_availability_slots`→`mentor_availability`, `reschedule_requests`→`session_reschedule_requests`). Say the word if you'd rather have any of those added back 1:1 instead of collapsed.

Run `0007_missing_schema.sql` after the existing 6 migrations (`supabase db push`, or paste into the SQL editor in order).

## Feature/functionality gap — the bigger piece

This is the part worth flagging clearly: **train-ai-ltd-main is a fully wired production app** (real Stripe/Paystack checkout, real AI chat via an edge function, real course builder that writes to the DB, real messaging, a 3,489-line admin/mentor "platform" app and a 2,161-line learner app, 35 backend edge functions). **train-ai-app is a scaffold** — its screens are mostly built with realistic mock data, while a real, working API layer already exists underneath (`src/lib/api/learner.js`, `platform.js`, `schemaHelper.js`, `gdprService.js`, `auditService.js`) that most screens simply don't call yet. Concretely, in the learner app: the leaderboard and GDPR/DSAR actions are genuinely wired to Supabase; course browsing/lesson completion/notes are real; but quiz-taking, notifications, messaging, mentor booking, and community (beyond leaderboard) are mock-data UI sitting on top of real, unused fetch functions. In the platform app: org member management and super-admin org management are real; cohorts, compliance, content/course builder, analytics, and mentor workspace screens are mock UI over real, unused fetch functions.

Porting every source feature 1:1 (35 edge functions, payments, full admin suite, AI chat backend, TypeScript→plain-JS translation of ~500 components) is a multi-week rebuild, not a single pass. The pragmatic, high-value next step is **wiring the screens that already have a real backend function sitting unused** — that's bounded, testable, and closes the most functionality gap per hour of work:

1. Notifications screen → `fetchMyNotifications`/`markNotificationRead` (real_notifications)
2. Quiz flow → `check_quiz_answers` RPC (server-side scoring already exists)
3. Mentor booking → `bookMentorshipSession` in `schemaHelper.js`
4. Cohorts/Compliance admin screens → `fetchCohorts`/`fetchComplianceAssignments`
5. Messaging → `messages`/`mentor_messages` real-time wiring

Beyond that tier: course builder persistence (writes to `courses`/`lessons` instead of in-memory state), real AI chat (needs an edge function + API key, currently mock), and payments (Stripe/Paystack — needs real API keys and edge functions) are each their own project.

## Recommendation

Tell me which of the 5 items above (or others) to wire up next, or say "all of them" and I'll work through them in that order.
