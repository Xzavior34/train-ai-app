-- ============================================================================
-- Allow moderators (can_moderate_content) to delete community_posts, not
-- just update their moderation_status. cp_update_own_or_moderator (0006)
-- already lets a moderator update a post; cp_delete_own only ever let the
-- post's own author delete it, with no moderator exception at all. Added
-- for the new Instructor "Learner Feed" management screen, where a mentor
-- needs to remove a learner's post (spam, policy violation, etc.), not just
-- flip its moderation_status.
-- ============================================================================

drop policy if exists cp_delete_own on community_posts;
create policy cp_delete_own_or_moderator on community_posts for delete
  using (user_id = auth.uid() or can_moderate_content(auth.uid()));
