// Used only by the isolated local preview, never by the production bundle.
const post = {
  id: 'fixture-post', user_id: 'fixture-author', post_type: 'general',
  created_at: '2026-10-22T08:00:00Z',
  content: 'Fixture community update. ' + 'Long learning discussion with practical examples. '.repeat(30) + ' END_OF_FULL_POST',
  user_profiles: { display_name: 'Fixture author' },
  post_reactions: [{ user_id: 'fixture-other' }],
  post_comments: [{ id: 'fixture-comment', content: 'A comment from another member.', user_profiles: { display_name: 'Fixture commenter' }, created_at: '2026-10-22T09:00:00Z' }],
};
export async function fetchCommunityPosts() { return structuredClone([post, { ...post, id: 'fixture-short', content: 'A short community update.', post_comments: [], post_reactions: [] }]); }
export async function addPostComment({ postId, userId, content }) {
  if (postId !== post.id || !content.trim()) throw Error('Invalid fixture comment');
  post.post_comments.push({ id: 'reply-' + post.post_comments.length, content, user_id: userId, user_profiles: { display_name: 'Fixture learner' }, created_at: new Date().toISOString() });
}
export async function togglePostReaction({ postId, userId }) {
  if (postId !== post.id) throw Error('Invalid fixture post');
  const index = post.post_reactions.findIndex(row => row.user_id === userId);
  if (index >= 0) post.post_reactions.splice(index, 1);
  else post.post_reactions.push({ user_id: userId });
  return { reacted: index < 0 };
}
export async function createCommunityPost({ content }) { if (!content.trim()) throw Error('Empty fixture post'); }
