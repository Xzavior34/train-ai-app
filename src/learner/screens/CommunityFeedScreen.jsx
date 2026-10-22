import React, { useEffect, useState } from "react";
import { TopBar, Avatar, timeAgo, initialsOf } from "../components/LearnerUI.jsx";
import { Heart, MessageSquare, Plus, Search, Send } from "lucide-react";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCommunityPosts, createCommunityPost, togglePostReaction, addPostComment } from "../../lib/api/schemaHelper.js";

const TYPE_LABELS = { general: "General", question: "Questions", tip: "Tips", announcement: "Announcements" };
const authorName = row => row?.user_profiles?.display_name || row?.user_profiles?.full_name || row?.author?.display_name || "Community member";
const postComments = post => post?.post_comments || post?.comments || [];
const postReactions = post => post?.post_reactions || post?.reactions || [];

function PostText({ content }) {
  return <div className="tai-feed-full-text">{String(content || "").split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//i.test(part)
      ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      : <React.Fragment key={index}>{part}</React.Fragment>
  )}</div>;
}

export function CommunityFeedScreen({ session, showToast = () => {}, back, push, params = {} }) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState("general");
  const [publishing, setPublishing] = useState(false);
  const [comment, setComment] = useState("");
  const [replying, setReplying] = useState(false);
  const [reacting, setReacting] = useState(null);
  const [reactionOverrides, setReactionOverrides] = useState({});
  const [localPostId, setLocalPostId] = useState(null);
  const query = useSupabaseQuery(() => fetchCommunityPosts(), []);
  const posts = query.data || [];
  const selectedId = params.postId || localPostId;
  const selectedPost = posts.find(post => post.id === selectedId);
  const filteredPosts = posts.filter(post => {
    const text = [post.title, post.content, post.body, authorName(post)].join(" ").toLowerCase();
    return (!search.trim() || text.includes(search.trim().toLowerCase())) &&
      (selectedType === "all" || (post.post_type || "general") === selectedType);
  });
  useEffect(() => {
    setComment("");
    window.scrollTo({ top: 0 });
  }, [selectedId]);

  function openPost(post) {
    if (push) push("communityFeed", { postId: post.id });
    else setLocalPostId(post.id);
  }
  function closePost() {
    if (push && back) back();
    else setLocalPostId(null);
  }
  async function publish(event) {
    event.preventDefault();
    if (!draft.trim() || publishing || !session?.user?.id) return;
    setPublishing(true);
    try {
      await createCommunityPost({ userId: session.user.id, content: draft.trim(), postType: draftType });
      setDraft("");
      setComposerOpen(false);
      query.refetch();
      showToast("Post submitted. It will appear once approved.");
    } catch (error) { showToast(error.message || "Could not publish your post. Please retry."); }
    finally { setPublishing(false); }
  }
  async function like(post) {
    if (!session?.user?.id || reacting) return;
    setReacting(post.id);
    try {
      const result = await togglePostReaction({ postId: post.id, userId: session.user.id });
      const others = (reactionOverrides[post.id] || postReactions(post)).filter(row => row.user_id !== session.user.id);
      setReactionOverrides(previous => ({ ...previous, [post.id]: result.reacted ? [...others, { user_id: session.user.id, reaction_type: "like" }] : others }));
    } catch (error) { showToast(error.message || "Could not update your reaction."); }
    finally { setReacting(null); }
  }
  async function reply(event) {
    event.preventDefault();
    if (!selectedId || !comment.trim() || replying || !session?.user?.id) return;
    setReplying(true);
    try {
      await addPostComment({ postId: selectedId, userId: session.user.id, content: comment.trim() });
      setComment("");
      query.refetch();
    } catch (error) { showToast(error.message || "Could not post your comment. Please retry."); }
    finally { setReplying(false); }
  }
  function header(post) {
    const name = authorName(post);
    return <div className="tai-feed-author">
      <Avatar size={38} src={post.user_profiles?.avatar_url || post.author?.avatar_url} initials={initialsOf(name)} />
      <div style={{ minWidth: 0 }}>
        <div className="tai-feed-author-name">{name}</div>
        <div className="tai-feed-meta">{timeAgo(post.created_at)} · {TYPE_LABELS[post.post_type] || "General"}</div>
      </div>
    </div>;
  }
  function actions(post, detail = false) {
    const reactions = (reactionOverrides[post.id] || postReactions(post)).filter(row => !row.reaction_type || row.reaction_type === "like");
    const liked = reactions.some(reaction => reaction.user_id === session?.user?.id);
    const comments = postComments(post);
    return <div className="tai-feed-actions">
      <button type="button" className="tai-btn tai-btn-ghost tai-btn-sm" aria-pressed={liked}
        disabled={reacting === post.id} onClick={() => like(post)}>
        <Heart size={16} fill={liked ? "currentColor" : "none"} />
        {reactions.length} likes
      </button>
      {!detail && <button type="button" className="tai-btn tai-btn-ghost tai-btn-sm" onClick={() => openPost(post)}>
        <MessageSquare size={16} />{comments.length} comments
      </button>}
    </div>;
  }

  return <div className="tai-feed-page tai-fade-in">
    {selectedId ? <>
      <TopBar title="Discussion" onBack={closePost} />
      {query.loading && !selectedPost ? <div className="tai-card tai-empty">Loading discussion...</div> :
        selectedPost ? <>
          <article className="tai-card tai-feed-detail">
            {header(selectedPost)}
            {selectedPost.title && <h1 className="tai-feed-post-title">{selectedPost.title}</h1>}
            <PostText content={selectedPost.content || selectedPost.body} />
            {actions(selectedPost, true)}
          </article>
          <section className="tai-card tai-feed-comments" aria-label="Comments">
            <h2 className="tai-title-sm">Comments ({postComments(selectedPost).length})</h2>
            {postComments(selectedPost).length === 0 && <p className="tai-body-text">No comments yet. Start the conversation.</p>}
            {postComments(selectedPost).map(item => <article key={item.id} className="tai-feed-comment">
              <Avatar size={30} initials={initialsOf(authorName(item))} src={item.user_profiles?.avatar_url} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="tai-feed-author-name">{authorName(item)} <span className="tai-feed-meta">{timeAgo(item.created_at)}</span></div>
                <PostText content={item.content || item.body} />
              </div>
            </article>)}
            <form onSubmit={reply} className="tai-feed-reply">
              <label htmlFor="feed-comment" className="tai-label">Your comment</label>
              <textarea id="feed-comment" className="tai-input" rows={3} placeholder="Write a comment..."
                value={comment} onChange={event => setComment(event.target.value)} required />
              <button className="tai-btn tai-btn-primary" disabled={replying || !comment.trim() || !session?.user?.id}>
                <Send size={15} />{replying ? "Posting..." : "Post comment"}
              </button>
            </form>
          </section>
        </> : <div className="tai-card tai-empty" role="status">This post is unavailable. <button className="tai-btn tai-btn-outline" onClick={closePost}>Back to feed</button></div>}
    </> : <>
      <div className="tai-card tai-hero-card tai-feed-hero">
        <div><h1 className="tai-hero-title">Community feed</h1><p className="tai-hero-desc">Updates and conversations from your community.</p></div>
        <button type="button" className="tai-btn tai-btn-primary" onClick={() => setComposerOpen(value => !value)}><Plus size={16} />Create post</button>
      </div>
      {composerOpen && <form className="tai-card tai-feed-composer" onSubmit={publish}>
        <label htmlFor="feed-draft" className="tai-title-sm">New post</label>
        <textarea id="feed-draft" className="tai-input" rows={5} placeholder="What would you like to share?"
          value={draft} onChange={event => setDraft(event.target.value)} required />
        <label htmlFor="feed-type" className="tai-label">Post type</label>
        <select id="feed-type" className="tai-input" value={draftType} onChange={event => setDraftType(event.target.value)}>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <div className="tai-feed-actions"><button className="tai-btn tai-btn-primary" disabled={publishing || !draft.trim()}>{publishing ? "Publishing..." : "Publish post"}</button>
          <button type="button" className="tai-btn tai-btn-outline" onClick={() => setComposerOpen(false)}>Cancel</button></div>
      </form>}
      <div className="tai-feed-search"><Search size={17} aria-hidden="true" /><input className="tai-input" aria-label="Search community posts"
        placeholder="Search posts or people" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div className="tai-scrollx" aria-label="Filter posts">
        {[["all", "All"], ...Object.entries(TYPE_LABELS)].map(([value, label]) => <button type="button" key={value}
          className={`tai-btn tai-btn-sm ${selectedType === value ? "tai-btn-primary" : "tai-btn-outline"}`}
          aria-pressed={selectedType === value} onClick={() => setSelectedType(value)}>{label}</button>)}
      </div>
      {query.error && <div className="tai-card" role="alert">Could not load posts. <button className="tai-btn tai-btn-outline" onClick={query.refetch}>Retry</button></div>}
      {query.loading && <div className="tai-card tai-empty">Loading posts...</div>}
      {!query.loading && filteredPosts.length === 0 && <div className="tai-card tai-empty">No posts found.</div>}
      {filteredPosts.map(post => <article key={post.id} className="tai-card tai-feed-preview">
        {header(post)}
        <div className="tai-feed-open">
          {post.title && <h2 className="tai-feed-post-title">{post.title}</h2>}
          <p>{String(post.content || post.body || "").replace(/\s+/g, " ").trim().slice(0, 280)}{String(post.content || post.body || "").replace(/\s+/g, " ").trim().length > 280 && <>… <button type="button" className="tai-feed-see-more" onClick={() => openPost(post)} aria-label={`See more of post by ${authorName(post)}`}>See more</button></>}</p>
        </div>
        {actions(post)}
      </article>)}
    </>}
  </div>;
}
export default CommunityFeedScreen;
