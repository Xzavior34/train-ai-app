-- =============================================================================
-- Train AI — RLS gap-fill for learner-app real-data wiring
--
-- Migrations 0001-0007 enable RLS with default-deny on every table (see the
-- header comment in 0006_rls_policies.sql), then add explicit policies only
-- for a subset of "central" tables. A handful of tables the learner app's
-- real (non-mock) screens depend on were left with RLS enabled and zero
-- policies — meaning every caller, including the row's own owner, gets
-- back an empty result set forever (indistinguishable in the UI from "no
-- data yet"), even though the client code and data are both correct.
--
-- This migration only ADDS policies. It does not alter, replace, or drop
-- anything defined in 0001-0007.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- AI Assistant — a conversation and its messages belong to one learner.
-- (The ai-chat edge function itself uses the service-role key and so is
-- unaffected by these policies; they matter for the client-side reads/writes
-- done directly from src/lib/api/schemaHelper.js.)
-- ---------------------------------------------------------------------------
create policy aic_select_own on ai_conversations for select using (user_id = auth.uid());
create policy aic_insert_own on ai_conversations for insert with check (user_id = auth.uid());
create policy aic_update_own on ai_conversations for update using (user_id = auth.uid());

create policy aim_select_own on ai_messages for select
  using (exists (select 1 from ai_conversations c where c.id = ai_messages.conversation_id and c.user_id = auth.uid()));
create policy aim_insert_own on ai_messages for insert
  with check (exists (select 1 from ai_conversations c where c.id = ai_messages.conversation_id and c.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- mentor_messages — mm_select_participant / mm_insert_sender already exist
-- (0006); marking a received message as read was the missing piece.
-- ---------------------------------------------------------------------------
create policy mm_update_receiver on mentor_messages for update
  using (receiver_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Quizzes — published quizzes are readable by any signed-in learner, the
-- same pattern as courses_select_published. quiz_questions stays locked
-- (qq_select_none, 0006) — safe_quiz_questions view remains the only way
-- to read questions client-side, so correct answers still never leak.
-- ---------------------------------------------------------------------------
create policy quizzes_select_published on quizzes for select using (is_published);
create policy quizzes_write_authorized on quizzes for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Learning paths — published paths are readable by any signed-in learner;
-- enrollments/progress are the learner's own rows.
-- ---------------------------------------------------------------------------
create policy lpaths_select_published on learning_paths for select using (is_published);
create policy lpaths_write_authorized on learning_paths for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create policy lpe_select_own on learning_path_enrollments for select using (user_id = auth.uid());
create policy lpe_write_own on learning_path_enrollments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Study groups — browsable directory for every signed-in learner;
-- membership rows are self-managed (join/leave).
-- ---------------------------------------------------------------------------
create policy sg_select_all on study_groups for select using (true);
create policy sg_write_authorized on study_groups for all
  using (created_by = auth.uid() or effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

create policy sgm_select_all on study_group_members for select using (true);
create policy sgm_write_own on study_group_members for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Daily challenges / mystery boxes — the learner's own gamification data.
-- ---------------------------------------------------------------------------
create policy dc_select_own on daily_challenges for select using (user_id = auth.uid());
create policy dc_write_own on daily_challenges for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy mb_select_own on mystery_boxes for select using (user_id = auth.uid());
create policy mb_insert_own on mystery_boxes for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Course reviews — readable by anyone signed in (used for the average
-- rating shown on course cards); writable by the reviewing learner only.
-- ---------------------------------------------------------------------------
create policy cr_select_all on course_reviews for select using (true);
create policy cr_write_own on course_reviews for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lesson notes / course notes — private to the learner who wrote them.
-- ---------------------------------------------------------------------------
create policy ln_select_own on lesson_notes for select using (user_id = auth.uid());
create policy ln_write_own on lesson_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy cn_select_own on course_notes for select using (user_id = auth.uid());
create policy cn_write_own on course_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Course discussion (general Q&A per course) — readable/postable by any
-- signed-in learner, matching lessons_select_published's "signed in" bar.
-- ---------------------------------------------------------------------------
create policy cd_select_all on course_discussions for select using (true);
create policy cd_insert_authenticated on course_discussions for insert with check (auth.uid() is not null);

create policy cdm_select_all on course_discussion_messages for select using (true);
create policy cdm_insert_own on course_discussion_messages for insert with check (sender_id = auth.uid());
