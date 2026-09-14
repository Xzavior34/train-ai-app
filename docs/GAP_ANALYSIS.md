# Gap analysis — superseded, kept for historical record only

**This document is historical.** It originally compared an early version of
this repo against a different, unrelated codebase (`train-ai-ltd-main`) to
decide which of that project's database tables were worth porting over. That
comparison's schema conclusion was acted on and is still true: migration
`0007_missing_schema.sql` added the 21 tables that comparison identified as
genuine gaps (`career_goal_progress`, `cohort_learner_courses`,
`cohort_posts`, and others — see that migration's own header for the full
list and the tables intentionally left out as duplicates of this schema's
existing ones).

**What is no longer true, and should not be trusted**: this document's
"Feature/functionality gap" section claimed several features were "mock-data
UI sitting on top of real, unused fetch functions" — specifically calling out
quiz-taking, notifications, and mentor booking as disconnected. A later,
dedicated audit (see the repository's own audit history) traced each of
those three end-to-end and found all three genuinely wired: quiz submission
calls the real `check_quiz_answers` RPC and persists a real `quiz_attempts`
row; notifications flow from a real query into `NotificationsScreen.jsx`;
mentor booking calls a real handler in `MentorsScreen.jsx`. This document was
not updated when that changed, and sat here presenting a false claim as
current fact for an unknown period. Do not cite this file's feature-gap
claims for anything going forward — if you need to know what's currently
connected vs. not, retrace it directly against the current source rather
than trusting a document like this one to have stayed in sync.

This file is kept rather than deleted only for the historical schema-porting
record above. If a new comparison or gap analysis is ever needed, write a new,
dated document rather than editing this one back into an implied "current"
state.
