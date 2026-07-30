-- =============================================================================
-- Train AI — RLS gap-fill for the Forums feature (community_gamification_admin
-- creates `forums`/`forum_posts` in 0004, but — like the tables 0008 already
-- patched — 0006's blanket RLS-enable pass left both with zero policies, so
-- every caller got back an empty result set forever, indistinguishable from
-- "no threads yet" in the UI even though the client code and data are both
-- correct. This migration only ADDS policies/functions; it does not alter,
-- replace, or drop anything defined in 0001-0008.
--
-- `forums` = discussion categories (course-scoped via course_id, or
-- `is_general`). `forum_posts` is self-referencing via parent_post_id: a row
-- with parent_post_id null is a thread's opening post, a row with it set is a
-- reply to that thread — same shape as cohort_posts/cohort_post_replies, just
-- collapsed into one table.
-- =============================================================================

-- Categories are structural, so only content managers/admins create them;
-- every signed-in learner can browse the list, matching study_groups'
-- sg_select_all pattern (0008).
create policy forums_select_all on forums for select using (true);
create policy forums_write_authorized on forums for all
  using (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()))
  with check (effective_has_permission(auth.uid(), 'manage_courses') or is_super_admin(auth.uid()));

-- Threads and replies are authored by any learner and world-readable, same
-- bar as course_discussion_messages (0008). Editing/deleting is restricted to
-- the author or a moderator/admin, mirroring cohort_posts (0007).
create policy fp_select_all on forum_posts for select using (true);
create policy fp_insert_own on forum_posts for insert with check (author_id = auth.uid());
create policy fp_update_own_or_moderator on forum_posts for update
  using (author_id = auth.uid() or can_moderate_content(auth.uid()) or is_super_admin(auth.uid()));
create policy fp_delete_own_or_moderator on forum_posts for delete
  using (author_id = auth.uid() or can_moderate_content(auth.uid()) or is_super_admin(auth.uid()));

-- Upvote/downvote counters live directly on forum_posts (no dedicated
-- forum_post_votes table exists in this schema), so any RLS update policy
-- broad enough to let another learner increment them would also let that
-- learner rewrite the post's content. A SECURITY DEFINER function that only
-- ever touches the two counter columns — same technique as set_post_pinned
-- in 0005_functions.sql — avoids that without a schema change.
--
-- Note: with no per-user vote table, this cannot track/undo an individual's
-- vote (a second click adds a second increment) — it is an honest "helpful"
-- tally, not a toggle. Building real one-vote-per-user tracking would need a
-- new table + migration, which is out of scope here.
create or replace function vote_forum_post(p_post_id uuid, p_direction text default 'up')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_direction = 'down' then
    update forum_posts set downvotes = downvotes + 1 where id = p_post_id;
  else
    update forum_posts set upvotes = upvotes + 1 where id = p_post_id;
  end if;
end;
$$;
