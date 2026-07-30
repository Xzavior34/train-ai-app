import { supabase } from "../supabaseClient.js";

// Helper utilities for full 164-table database operations

// Almost nothing in this schema declares a real foreign key from a
// user/mentor/learner id column to `user_profiles` (most of those columns
// point straight at auth.users, which isn't introspectable by PostgREST), so
// `.select("*, user_profiles(...)")`-style embeds fail at runtime with a
// "could not find a relationship" error. This batches a manual second query
// instead. IMPORTANT: `user_profiles` has its own separate, auto-generated
// `id` PK AND a required `user_id` column that stores the real auth.uid()
// (confirmed against the live project's generated types) — every OTHER
// table's user/mentor/learner id column (mentors.user_id, community_posts.
// user_id, learner_id, etc.) stores that same raw auth uid directly, so the
// lookup query and the returned map must both be keyed on `user_id`, not the
// internal `id`.
export async function fetchProfilesByUserIds(userIds, columns = "user_id, display_name, avatar_url") {
  if (!supabase || !userIds || !userIds.length) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase.from("user_profiles").select(columns).in("user_id", ids);
  if (error) { console.warn("Profiles batch fetch warning:", error); return {}; }
  return Object.fromEntries((data || []).map((p) => [p.user_id, p]));
}

// Same batching pattern as fetchProfilesByUserIds, but for gamification
// stats (real `user_gamification_stats` table) — used to show streak/level
// next to learners in the community Members directory without an N+1 query.
export async function fetchGamificationStatsByUserIds(userIds) {
  if (!supabase || !userIds || !userIds.length) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("user_gamification_stats")
    .select("user_id, total_points, current_level, streak_days")
    .in("user_id", ids);
  if (error) { console.warn("Gamification stats batch fetch warning:", error); return {}; }
  return Object.fromEntries((data || []).map((s) => [s.user_id, s]));
}

// Mentors & Availability
export async function fetchMentorProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("mentors")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) { console.warn("Mentor profile fetch warning:", error); return null; }
  if (!data) return null;
  const profiles = await fetchProfilesByUserIds([userId]);
  return { ...data, user_profiles: profiles[userId] || null };
}

export async function fetchMentorAvailability(mentorId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mentor_availability")
    .select("*")
    .eq("mentor_id", mentorId);
  if (error) console.warn("Mentor availability fetch warning:", error);
  return data || [];
}

export async function fetchMentorSessions(mentorId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mentorship_sessions")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("scheduled_at", { ascending: false });
  if (error) { console.warn("Mentor sessions fetch warning:", error); return []; }
  const rows = data || [];
  // learner_id has no declared FK to user_profiles (see fetchProfilesByUserIds
  // comment above), so the real learner name is attached via a manual lookup
  // instead of leaving every row's "learner_name" undefined.
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.learner_id));
  return rows.map((r) => ({ ...r, learner_name: profiles[r.learner_id]?.display_name || null }));
}

export async function fetchLearnerSessions(learnerId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mentorship_sessions")
    .select("*, mentors(*)")
    .eq("learner_id", learnerId)
    .order("scheduled_at", { ascending: false });
  if (error) { console.warn("Learner sessions fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.mentors?.user_id));
  return rows.map((r) => ({ ...r, mentors: r.mentors ? { ...r.mentors, user_profiles: profiles[r.mentors.user_id] || null } : null }));
}

export async function bookMentorshipSession({ learnerId, mentorId, title, scheduledAt, description, durationMinutes }) {
  if (!supabase) return { id: `session_${Date.now()}`, learner_id: learnerId, mentor_id: mentorId, title, scheduled_at: scheduledAt };
  // Callers (learner MentorsScreen) pass a camelCase payload, but
  // `mentorship_sessions` columns are snake_case (learner_id, mentor_id,
  // scheduled_at) — inserting the camelCase keys directly previously failed
  // at the DB with "could not find column" since none of them match a real
  // column name, so no session was ever actually booked.
  const { data, error } = await supabase
    .from("mentorship_sessions")
    .insert({
      learner_id: learnerId,
      mentor_id: mentorId,
      title,
      scheduled_at: scheduledAt,
      description: description || null,
      duration_minutes: durationMinutes || 30,
      // Matches the status vocabulary the rest of the app already filters
      // on (see fetchUpcomingSessionsForOrg in platform.js: "confirmed" /
      // "requested") rather than inventing a new "pending" status value.
      status: "requested",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMentorEarnings(mentorId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mentor_earnings")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("created_at", { ascending: false });
  if (error) console.warn("Mentor earnings fetch warning:", error);
  return data || [];
}

export async function submitMentorPayoutRequest(mentorId, amount, paymentMethod) {
  if (!supabase) return { id: `payout_${Date.now()}`, mentor_id: mentorId, amount, status: "pending" };
  const { data, error } = await supabase
    .from("mentor_payout_requests")
    .insert({
      mentor_id: mentorId,
      amount,
      payment_method: paymentMethod,
      status: "pending",
      requested_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// This mentor's own payout request history (real `mentor_payout_requests`
// table, same one `submitMentorPayoutRequest` inserts into and the admin
// side's `fetchOrgPayoutRequests`/`updatePayoutRequestStatus` in platform.js
// manage org-wide) — scoped to a single mentor_id for the Earnings screen.
export async function fetchMentorPayoutRequests(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase
    .from("mentor_payout_requests")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("requested_at", { ascending: false });
  if (error) { console.warn("Mentor payout requests fetch warning:", error); return []; }
  return data || [];
}

// Weekly recurring availability (real `mentor_availability` table: mentor_id,
// day_of_week 0-6, start_time/end_time "HH:MM[:SS]", is_available, timezone).
// fetchMentorAvailability(mentorId) already exists above; these add write
// support for the Schedule screen's Availability tab.
export async function createAvailabilitySlot(mentorId, dayOfWeek, startTime, endTime, timezone = "UTC") {
  if (!supabase) return { id: `avail_${Date.now()}`, mentor_id: mentorId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, is_available: true };
  const { data, error } = await supabase
    .from("mentor_availability")
    .insert({ mentor_id: mentorId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, timezone, is_available: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAvailabilitySlot(id) {
  if (!supabase) return;
  const { error } = await supabase.from("mentor_availability").delete().eq("id", id);
  if (error) throw error;
}

// Mentor credentials / certifications (real `mentor_credentials` table).
export async function fetchMentorCredentials(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase
    .from("mentor_credentials")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Mentor credentials fetch warning:", error); return []; }
  return data || [];
}

export async function addMentorCredential(mentorId, { title, credentialType, issuingOrganization, issueDate, expiryDate, documentUrl, verificationUrl }) {
  if (!supabase) return { id: `cred_${Date.now()}`, mentor_id: mentorId, title, is_verified: false };
  const { data, error } = await supabase
    .from("mentor_credentials")
    .insert({
      mentor_id: mentorId,
      title,
      credential_type: credentialType,
      issuing_organization: issuingOrganization,
      issue_date: issueDate || null,
      expiry_date: expiryDate || null,
      document_url: documentUrl || null,
      verification_url: verificationUrl || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMentorCredential(id) {
  if (!supabase) return;
  const { error } = await supabase.from("mentor_credentials").delete().eq("id", id);
  if (error) throw error;
}

// Mentor portfolio items (real `mentor_portfolio_items` table).
export async function fetchMentorPortfolioItems(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase
    .from("mentor_portfolio_items")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("display_order", { ascending: true, nullsFirst: false });
  if (error) { console.warn("Mentor portfolio fetch warning:", error); return []; }
  return data || [];
}

export async function addMentorPortfolioItem(mentorId, { title, itemType, description, mediaUrl }) {
  if (!supabase) return { id: `pf_${Date.now()}`, mentor_id: mentorId, title };
  const { data, error } = await supabase
    .from("mentor_portfolio_items")
    .insert({
      mentor_id: mentorId,
      title,
      item_type: itemType || "link",
      description: description || null,
      media_urls: mediaUrl ? [mediaUrl] : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMentorPortfolioItem(id) {
  if (!supabase) return;
  const { error } = await supabase.from("mentor_portfolio_items").delete().eq("id", id);
  if (error) throw error;
}

// Refund / dispute requests raised by learners against a mentor's sessions
// (real `refund_requests` table: learner_id, mentor_id, session_id, amount,
// reason, type, status, mentor_response, resolved_by/resolved_at).
export async function fetchRefundRequestsForMentor(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase
    .from("refund_requests")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Refund requests fetch warning:", error); return []; }
  return data || [];
}

export async function respondToRefundRequest(id, status, mentorResponse, resolvedBy) {
  if (!supabase) return;
  const { error } = await supabase
    .from("refund_requests")
    .update({
      status,
      mentor_response: mentorResponse || null,
      resolved_by: resolvedBy || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

// Persists mentor Settings screen edits (hourly rate / bio / tagline) onto
// the real `mentors` row — previously the Settings screen only showed a
// toast without writing anything back to Supabase.
export async function updateMentorProfile(mentorId, patch) {
  if (!supabase || !mentorId) return;
  const { error } = await supabase.from("mentors").update(patch).eq("id", mentorId);
  if (error) throw error;
}

// Learning Paths & Sequential Unlocking
export async function fetchLearningPaths() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("learning_paths")
    .select("*, learning_path_courses(*, courses(*))")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) console.warn("Learning paths fetch warning:", error);
  return data || [];
}

export async function fetchLearningPathProgress(userId, pathId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .maybeSingle();
  if (error) console.warn("Path enrollment fetch warning:", error);
  return data;
}

export async function fetchMyLearningPathEnrollments(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .select("*")
    .eq("user_id", userId);
  if (error) { console.warn("Learning path enrollments fetch warning:", error); return []; }
  return data || [];
}

export async function enrollInLearningPath(userId, pathId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .upsert({ user_id: userId, path_id: pathId, current_course_index: 0, status: "in_progress" }, { onConflict: "user_id,path_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// AI Assistant & AI Quizzes
export async function fetchAIChatMessages(conversationId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) console.warn("AI messages fetch warning:", error);
  return data || [];
}

export async function sendAIChatMessage({ conversationId, userId, content, role = "user" }) {
  if (!supabase) return { id: `msg_${Date.now()}`, conversation_id: conversationId, content, role };
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      role,
      content
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Community & Groups
export async function fetchCommunityPosts(studyGroupId = null) {
  if (!supabase) return [];
  let query = supabase
    .from("community_posts")
    .select("*, post_comments(*), post_reactions(*)")
    .order("created_at", { ascending: false });

  if (studyGroupId) {
    query = query.eq("study_group_id", studyGroupId);
  } else {
    query = query.is("study_group_id", null);
  }

  const { data, error } = await query;
  if (error) { console.warn("Community posts fetch warning:", error); return []; }
  const rows = data || [];
  // Batch-fetch profiles for both post authors AND comment authors in one
  // round trip, so comment threads can show real names/avatars instead of
  // a generic "Learner" placeholder.
  const postAuthorIds = rows.map((r) => r.user_id);
  const commentAuthorIds = rows.flatMap((r) => (r.post_comments || []).map((c) => c.user_id));
  const profiles = await fetchProfilesByUserIds([...postAuthorIds, ...commentAuthorIds]);
  return rows.map((r) => ({
    ...r,
    user_profiles: profiles[r.user_id] || null,
    post_comments: (r.post_comments || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((c) => ({ ...c, user_profiles: profiles[c.user_id] || null })),
  }));
}

export async function createCommunityPost({ userId, content, postType = "text", studyGroupId = null }) {
  if (!supabase) return { id: `post_${Date.now()}`, user_id: userId, content, post_type: postType, moderation_status: "approved" };
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      user_id: userId,
      content,
      post_type: postType,
      study_group_id: studyGroupId,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) throw error;

  // Real post-insert AI moderation pass. The live `ai-content-moderation`
  // edge function is designed to run AFTER the row exists — it takes a
  // `contentId`, runs the content through an AI moderation model, then does
  // its own UPDATE on `community_posts` (moderation_score/ai_moderated/
  // moderation_status) plus an INSERT into `moderation_logs`. It does NOT
  // support `contentType: "comment"` cleanly against the live schema (the
  // `moderation_status`/`moderated_at`/`moderated_by` columns were dropped
  // from `post_comments` in a later migration than the one that added
  // `moderation_score`/`ai_moderated` back to it), so this is only wired for
  // posts here — calling it for comments would just fail server-side.
  //
  // `community_posts.moderation_status` defaults to 'pending' at insert
  // time, and the live RLS policy ("Users can view approved posts") already
  // hides anything not 'approved' from everyone except the author and
  // admins/super_admins. So this call is what actually determines whether
  // the post becomes visible to the rest of the community, or stays hidden
  // and shows up in the real admin ModerationScreen queue.
  try {
    const { data: modResult, error: modError } = await supabase.functions.invoke("ai-content-moderation", {
      body: { content, contentType: "post", contentId: data.id },
    });
    if (!modError && modResult && typeof modResult.approved === "boolean") {
      return {
        ...data,
        moderation_status: modResult.approved ? "approved" : "rejected",
        moderation_score: modResult.score,
        ai_moderated: true,
        ai_moderation_reason: modResult.reason,
        ai_moderation_flags: modResult.flags || [],
      };
    }
  } catch (e) {
    // AI moderation degraded/unavailable (rate limit, credits, network) —
    // leave the post at the DB default ('pending') rather than blocking
    // publishing entirely. It's still only visible to its author + admins
    // until moderation succeeds or an admin resolves it manually.
    console.warn("AI content moderation unavailable, post left pending:", e?.message || e);
  }
  return data;
}

export async function addPostComment({ postId, userId, content }) {
  if (!supabase) return { id: `comment_${Date.now()}`, post_id: postId, user_id: userId, content };
  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      user_id: userId,
      content,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function togglePostReaction({ postId, userId, reactionType = "like" }) {
  if (!supabase) return { reacted: true };
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("reaction_type", reactionType)
    .maybeSingle();

  if (existing) {
    await supabase.from("post_reactions").delete().eq("id", existing.id);
    return { reacted: false };
  } else {
    await supabase.from("post_reactions").insert({
      post_id: postId,
      user_id: userId,
      reaction_type: reactionType
    });
    return { reacted: true };
  }
}

// Mentor directory (browse all active mentors). NOTE: the real schema has no
// separate "is_approved" flag on `mentors` (only `is_active`), so being
// active is the closest available proxy for "approved and listable".
export async function fetchAllMentors() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("mentors")
    .select("*")
    .eq("is_active", true)
    .order("rating", { ascending: false });
  if (error) { console.warn("Mentors directory fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// Upcoming mentorship sessions for the Schedule screen
export async function fetchUpcomingLearnerSessions(learnerId) {
  if (!supabase || !learnerId) return [];
  const { data, error } = await supabase
    .from("mentorship_sessions")
    .select("*, mentors(*)")
    .eq("learner_id", learnerId)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });
  if (error) { console.warn("Upcoming sessions fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.mentors?.user_id));
  return rows.map((r) => ({ ...r, mentors: r.mentors ? { ...r.mentors, user_profiles: profiles[r.mentors.user_id] || null } : null }));
}

// Messages — general learner-to-learner messaging (messages table)
export async function fetchMyMessages(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Messages fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.flatMap((r) => [r.sender_id, r.receiver_id]));
  return rows.map((r) => ({ ...r, sender: profiles[r.sender_id] || null, receiver: profiles[r.receiver_id] || null }));
}

export async function sendMessage({ senderId, receiverId, content, subject = null }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, content, subject })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Messages — learner-to-mentor messaging (mentor_messages table). This is
// what actually powers the Messages/Conversation screens, since every
// existing thread in this app is a conversation with a mentor.
export async function fetchMentorMessageThreads(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("mentor_messages")
    .select("*")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Mentor message threads fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.flatMap((r) => [r.sender_id, r.receiver_id]));
  return rows.map((r) => ({ ...r, sender: profiles[r.sender_id] || null, receiver: profiles[r.receiver_id] || null }));
}

export async function fetchMentorMessageThread(userId, counterpartId) {
  if (!supabase || !userId || !counterpartId) return [];
  const { data, error } = await supabase
    .from("mentor_messages")
    .select("*")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });
  if (error) { console.warn("Mentor message thread fetch warning:", error); return []; }
  return data || [];
}

export async function sendMentorMessage({ senderId, receiverId, content }) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("mentor_messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markMentorMessagesRead(userId, counterpartId) {
  if (!supabase || !userId || !counterpartId) return;
  await supabase.from("mentor_messages").update({ is_read: true }).eq("receiver_id", userId).eq("sender_id", counterpartId);
}

// Study groups
export async function fetchStudyGroups() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("study_groups")
    .select("*, courses(title), study_group_members(count)")
    .order("name", { ascending: true });
  if (error) { console.warn("Study groups fetch warning:", error); return []; }
  return data || [];
}

export async function fetchMyStudyGroupIds(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase.from("study_group_members").select("group_id").eq("user_id", userId);
  if (error) { console.warn("Study group membership fetch warning:", error); return []; }
  return (data || []).map((r) => r.group_id);
}

// Real members of a specific study group (not a generic community-people
// slice) — used by the Group Members tab in StudyGroupWorkspace.
export async function fetchStudyGroupMembers(groupId) {
  if (!supabase || !groupId) return [];
  const { data, error } = await supabase
    .from("study_group_members")
    .select("user_id, role, joined_at")
    .eq("group_id", groupId);
  if (error) { console.warn("Study group members fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    ...r,
    display_name: profiles[r.user_id]?.display_name || "Learner",
    avatar_url: profiles[r.user_id]?.avatar_url || null,
  }));
}

export async function joinStudyGroup({ studyGroupId, userId }) {
  if (!supabase) return;
  const { error } = await supabase.from("study_group_members").insert({ group_id: studyGroupId, user_id: userId, role: "member" });
  if (error) throw error;
}

export async function leaveStudyGroup({ studyGroupId, userId }) {
  if (!supabase) return;
  const { error } = await supabase.from("study_group_members").delete().eq("group_id", studyGroupId).eq("user_id", userId);
  if (error) throw error;
}

// Study group chat — backed by the real `study_group_messages` table
// (study_group_id, sender_id, message, media_type/url, created_at).
export async function fetchStudyGroupMessages(groupId) {
  if (!supabase || !groupId) return [];
  const { data, error } = await supabase
    .from("study_group_messages")
    .select("*")
    .eq("study_group_id", groupId)
    .order("created_at", { ascending: true });
  if (error) { console.warn("Study group messages fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.sender_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.sender_id] || null }));
}

export async function sendStudyGroupMessage({ studyGroupId, senderId, message }) {
  if (!supabase) return { id: `sgm_${Date.now()}`, study_group_id: studyGroupId, sender_id: senderId, message };
  const { data, error } = await supabase
    .from("study_group_messages")
    .insert({ study_group_id: studyGroupId, sender_id: senderId, message })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Live activity ticker — backed by the real `community_activity_feed` table
// (activity_type, activity_text, is_public, metadata). No client-side
// derivation needed since this table already exists for exactly this
// purpose; only public rows are shown here.
export async function fetchCommunityActivityFeed(limit = 15) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_activity_feed")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.warn("Community activity feed fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// ---------------------------------------------------------------------------
// Forums — distinct from study groups. Backed by the real `forums` table
// (discussion categories: course-scoped via course_id, or `is_general`) and
// `forum_posts` (self-referencing via parent_post_id — a row with it null is
// a thread's opening post, a row with it set is a reply). See
// supabase/migrations/0009_forum_rls_gapfill.sql for the RLS policies this
// depends on (0004 created the tables but left them with none).
// ---------------------------------------------------------------------------

// Category list for the Forums landing view. Thread count / latest activity
// per category isn't a stored aggregate anywhere in the schema, so it's
// computed client-side from forum_posts the same way CommunityScreen derives
// trendingTags from community_posts.tags — one extra lightweight query, no
// per-category round trip.
export async function fetchForumCategories() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("forums")
    .select("*, courses(title)")
    .order("is_general", { ascending: false })
    .order("title", { ascending: true });
  if (error) { console.warn("Forum categories fetch warning:", error); return []; }
  const forums = data || [];

  const { data: threadRows, error: threadErr } = await supabase
    .from("forum_posts")
    .select("forum_id, created_at")
    .is("parent_post_id", null);
  if (threadErr) console.warn("Forum thread counts fetch warning:", threadErr);

  const countsByForum = {};
  const latestByForum = {};
  (threadRows || []).forEach((r) => {
    countsByForum[r.forum_id] = (countsByForum[r.forum_id] || 0) + 1;
    if (!latestByForum[r.forum_id] || new Date(r.created_at) > new Date(latestByForum[r.forum_id])) {
      latestByForum[r.forum_id] = r.created_at;
    }
  });

  return forums.map((f) => ({
    ...f,
    thread_count: countsByForum[f.id] || 0,
    last_activity_at: latestByForum[f.id] || null,
  }));
}

// Threads (top-level forum_posts, parent_post_id is null) within one category.
export async function fetchForumThreads(forumId) {
  if (!supabase || !forumId) return [];
  const { data, error } = await supabase
    .from("forum_posts")
    .select("*")
    .eq("forum_id", forumId)
    .is("parent_post_id", null)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Forum threads fetch warning:", error); return []; }
  const threads = data || [];
  const threadIds = threads.map((t) => t.id);

  let replyCounts = {};
  if (threadIds.length) {
    const { data: replies, error: repErr } = await supabase
      .from("forum_posts")
      .select("parent_post_id")
      .in("parent_post_id", threadIds);
    if (repErr) console.warn("Forum reply counts fetch warning:", repErr);
    (replies || []).forEach((r) => { replyCounts[r.parent_post_id] = (replyCounts[r.parent_post_id] || 0) + 1; });
  }

  const profiles = await fetchProfilesByUserIds(threads.map((t) => t.author_id));
  return threads.map((t) => ({
    ...t,
    user_profiles: profiles[t.author_id] || null,
    reply_count: replyCounts[t.id] || 0,
  }));
}

// A single thread (its opening forum_posts row) plus every reply to it,
// ordered oldest-first so the conversation reads top-to-bottom.
export async function fetchForumThread(threadId) {
  if (!supabase || !threadId) return null;
  const { data: thread, error } = await supabase
    .from("forum_posts")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();
  if (error) { console.warn("Forum thread fetch warning:", error); return null; }
  if (!thread) return null;

  const { data: replies, error: repErr } = await supabase
    .from("forum_posts")
    .select("*")
    .eq("parent_post_id", threadId)
    .order("created_at", { ascending: true });
  if (repErr) console.warn("Forum replies fetch warning:", repErr);

  const rows = [thread, ...(replies || [])];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.author_id));
  return {
    ...thread,
    user_profiles: profiles[thread.author_id] || null,
    replies: (replies || []).map((r) => ({ ...r, user_profiles: profiles[r.author_id] || null })),
  };
}

export async function createForumThread({ forumId, authorId, content }) {
  if (!supabase) return { id: `thread_${Date.now()}`, forum_id: forumId, author_id: authorId, content, parent_post_id: null };
  const { data, error } = await supabase
    .from("forum_posts")
    .insert({ forum_id: forumId, author_id: authorId, content, parent_post_id: null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createForumReply({ forumId, parentPostId, authorId, content }) {
  if (!supabase) return { id: `reply_${Date.now()}`, forum_id: forumId, parent_post_id: parentPostId, author_id: authorId, content };
  const { data, error } = await supabase
    .from("forum_posts")
    .insert({ forum_id: forumId, parent_post_id: parentPostId, author_id: authorId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Upvote/downvote — routed through the `vote_forum_post` RPC (see
// 0009_forum_rls_gapfill.sql) rather than a direct `.update()`, since the
// counters live on the same row as the post's own content and there's no
// separate forum_post_votes table in this schema to scope a broader RLS
// update policy to. Note this is an honest one-way tally, not a per-user
// toggle — the schema has nowhere to record "this user already voted".
export async function voteForumPost(postId, direction = "up") {
  if (!supabase) return;
  const { error } = await supabase.rpc("vote_forum_post", { p_post_id: postId, p_direction: direction });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Cohort Space (learner-facing) — real `cohorts` / `cohort_members` /
// `cohort_posts` / `cohort_post_replies` / `cohort_post_reactions` tables
// (see supabase/migrations/0002_progress_quizzes_cohorts.sql for `cohorts`/
// `cohort_members` and 0007_missing_schema.sql for the posts/replies/
// reactions trio). The admin-side cohort builder already exists in
// lib/api/platform.js (fetchCohortDetail / createCohortPost / addCohortMember
// / etc., see CohortDetailScreen.jsx) — createCohortPost from there is reused
// directly for the learner-facing composer rather than duplicated here. This
// adds the "what cohort am I actually in, and what's in its feed" read
// surface the learner Community screen's Cohort Channels tab was missing (it
// previously rendered hardcoded sample cohort/announcement copy instead of
// querying anything real).
// ---------------------------------------------------------------------------

// Which cohort (if any) the signed-in learner belongs to. A learner could in
// principle be a member of more than one cohort (cohort_members only has a
// unique constraint on cohort_id+user_id, not one per user across cohorts),
// so this picks the most recently-added membership. cohort_members.cohort_id
// IS a real declared FK to cohorts (unlike the auth.users-pointing id
// columns elsewhere in this schema that need the manual
// fetchProfilesByUserIds workaround), so the embed below works.
export async function fetchMyCohortMembership(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("cohort_members")
    .select("*, cohorts(*)")
    .eq("user_id", userId)
    .order("added_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.warn("Cohort membership fetch warning:", error); return null; }
  if (!data || !data.cohorts) return null;
  return { membership: data, cohort: data.cohorts };
}

// Cohort posts/announcements feed for one cohort — pinned posts first, then
// most recent, each with its replies (cohort_post_replies) and its reaction
// rows (cohort_post_reactions, so the caller can both count them and tell
// whether the current user already reacted). Authors resolved via the same
// batched fetchProfilesByUserIds pattern used for forums/community posts
// above.
export async function fetchCohortPostsFeed(cohortId) {
  if (!supabase || !cohortId) return [];
  const { data, error } = await supabase
    .from("cohort_posts")
    .select("*, cohort_post_replies(*), cohort_post_reactions(id, user_id)")
    .eq("cohort_id", cohortId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) { console.warn("Cohort posts fetch warning:", error); return []; }
  const rows = data || [];
  const replyAuthorIds = rows.flatMap((r) => (r.cohort_post_replies || []).map((rep) => rep.author_id));
  const profiles = await fetchProfilesByUserIds([...rows.map((r) => r.author_id), ...replyAuthorIds]);
  return rows.map((r) => ({
    ...r,
    user_profiles: profiles[r.author_id] || null,
    reaction_count: (r.cohort_post_reactions || []).length,
    cohort_post_replies: (r.cohort_post_replies || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((rep) => ({ ...rep, user_profiles: profiles[rep.author_id] || null })),
  }));
}

// Reply to a cohort post (real `cohort_post_replies` table). The live RLS
// policy (cpr_insert_member in 0007_missing_schema.sql) only checks
// author_id = auth.uid() for inserts — no separate client-side membership
// gate is faked here since the DB doesn't actually enforce one beyond that.
export async function addCohortPostReply({ postId, authorId, content }) {
  if (!supabase || !postId || !authorId || !content?.trim()) return null;
  const { data, error } = await supabase
    .from("cohort_post_replies")
    .insert({ post_id: postId, author_id: authorId, content: content.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Toggle a "like" reaction on a cohort post (real `cohort_post_reactions`
// table — unique on post_id/user_id/emoji), same toggle pattern as
// togglePostReaction for community_posts above.
export async function toggleCohortPostReaction({ postId, userId, emoji = "like" }) {
  if (!supabase || !postId || !userId) return { reacted: true };
  const { data: existing } = await supabase
    .from("cohort_post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existing) {
    await supabase.from("cohort_post_reactions").delete().eq("id", existing.id);
    return { reacted: false };
  }
  await supabase.from("cohort_post_reactions").insert({ post_id: postId, user_id: userId, emoji });
  return { reacted: true };
}

// Community — suggested people to follow/connect with
export async function fetchCommunityPeople(excludeUserId, limit = 20) {
  if (!supabase) return [];
  // user_profiles has its own internal `id` PK plus a separate `user_id`
  // column that stores the real auth uid (see fetchProfilesByUserIds above)
  // — filter on user_id so it actually matches the caller's own auth id.
  let query = supabase.from("user_profiles").select("*").limit(limit);
  if (excludeUserId) query = query.neq("user_id", excludeUserId);
  const { data, error } = await query;
  if (error) {
    // Retry with public_user_profiles if user_profiles query fails
    const { data: fallbackData } = await supabase.from("public_user_profiles").select("*").limit(limit);
    return fallbackData || [];
  }
  return data || [];
}

// AI Assistant — conversation bootstrap + edge function call
export async function fetchOrCreateAIConversation(userId) {
  if (!supabase || !userId) return null;
  const { data: existing, error: exErr } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (exErr) console.warn("AI conversation fetch warning:", exErr);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title: "AI Assistant chat" })
    .select()
    .single();
  if (error) { console.warn("AI conversation create warning:", error); return null; }
  return data;
}

export async function requestAIReply({ conversationId, message }) {
  if (!supabase) return { error: "AI Assistant is unavailable — Supabase isn't configured in this environment." };
  try {
    const { data, error } = await supabase.functions.invoke("ai-chat", { body: { conversationId, message } });
    if (error) return { error: error.message || "AI Assistant is unavailable right now." };
    return data;
  } catch (e) {
    return { error: e?.message || "AI Assistant is unavailable right now." };
  }
}

// Real learner-scoped AI insights. The live `ai-insights` edge function
// takes no request body at all — it authenticates the caller from the
// Authorization header (which `supabase.functions.invoke` attaches
// automatically from the current session) and pulls THAT user's own
// `lesson_progress`, `course_enrollments`, and `quiz_attempts` rows
// server-side, then returns `{ insights: "<markdown>", stats: {
// completedLessons, totalHours, averageScore, enrolledCourses } }`.
export async function fetchAIInsights() {
  if (!supabase) return { error: "AI Insights are unavailable — Supabase isn't configured in this environment." };
  try {
    const { data, error } = await supabase.functions.invoke("ai-insights", {});
    if (error) return { error: error.message || "Could not generate insights right now." };
    if (!data || data.error) return { error: data?.error || "Could not generate insights right now." };
    return { insights: data.insights || "", stats: data.stats || null };
  } catch (e) {
    return { error: e?.message || "Could not generate insights right now." };
  }
}

// Real AI-generated course/practice recommendations. The live
// `generate-ai-recommendations` edge function expects
// `{ userContext: { learningTrack, skillLevel, completedCoursesCount,
// inProgressCoursesCount, averageProgress, goals[], interests[] },
// userProgress }` and returns `{ recommendations: [{ type, title,
// description, reason, priority, actionUrl, metadata }], reminders: [{
// type, title, message, priority, dueDate }] }` — or `{ error, fallback:
// true }` on rate limit / quota / failure. Returns null on any failure so
// callers can fall back to their own client-side derivation.
export async function fetchAIRecommendations({ userContext, userProgress } = {}) {
  if (!supabase || !userContext) return null;
  try {
    const { data, error } = await supabase.functions.invoke("generate-ai-recommendations", {
      body: { userContext, userProgress },
    });
    if (error || !data || data.error) return null;
    return {
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      reminders: Array.isArray(data.reminders) ? data.reminders : [],
    };
  } catch (e) {
    console.warn("AI recommendations unavailable, falling back to client-side picks:", e?.message || e);
    return null;
  }
}

// Real AI-generated quiz-on-any-topic (distinct from the pre-authored
// `quizzes`/`quiz_questions` bank read via fetchAvailableQuizzes/
// fetchSafeQuizQuestions in learner.js). The live `ai-generate-quiz` edge
// function (source read directly from
// supabase/functions/ai-generate-quiz/index.ts) expects
// `{ topic, difficulty?: 'easy'|'medium'|'hard'|'beginner'|'intermediate'|
// 'advanced', questionCount?: number, learningGoal?: string }` and, on
// success, returns `{ assessment: { title, description, estimatedTime,
// difficulty, questions: [{ id, question, options: string[4],
// correctAnswer: number (0-based index into options), explanation,
// difficulty }] } }`. On failure it responds with a non-2xx status and a
// `{ error: string }` body (400 missing topic, 429 rate limited, 402 AI
// credits exhausted, 500 misconfigured/invalid AI output) — supabase-js
// surfaces that as `error` (a FunctionsHttpError), not `data`, matching the
// same shape acceptInvitation in invitations.js already unwraps via
// `error.context.json()`.
//
// A quiz generated this way has no row in `quizzes`/`quiz_questions`, so
// there's no quiz_id to score it against the real `check_quiz_answers` RPC
// (see submitQuizAnswers in learner.js) — callers must score the returned
// `correctAnswer` client-side themselves.
export async function generateAIQuiz({ topic, difficulty, questionCount, learningGoal } = {}) {
  if (!supabase) return { error: "AI Quiz Generator is unavailable — Supabase isn't configured in this environment." };
  if (!topic || !topic.trim()) return { error: "Topic is required" };
  try {
    const { data, error } = await supabase.functions.invoke("ai-generate-quiz", {
      body: { topic: topic.trim(), difficulty, questionCount, learningGoal: learningGoal || undefined },
    });
    if (error) {
      let serverMessage = null;
      try {
        if (error?.context?.json) {
          const body = await error.context.json();
          serverMessage = body?.error || null;
        }
      } catch {
        // context body already consumed / not JSON — fall back to error.message below
      }
      return { error: serverMessage || error.message || "Couldn't generate a quiz on that topic, try rephrasing or a different topic." };
    }
    if (!data || data.error) {
      return { error: data?.error || "Couldn't generate a quiz on that topic, try rephrasing or a different topic." };
    }
    const assessment = data.assessment;
    if (!assessment || !Array.isArray(assessment.questions) || assessment.questions.length === 0) {
      return { error: "Couldn't generate a quiz on that topic, try rephrasing or a different topic." };
    }
    return { assessment };
  } catch (e) {
    return { error: e?.message || "Couldn't generate a quiz on that topic, try rephrasing or a different topic." };
  }
}

// Notification preferences
export async function fetchNotificationPreferences(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) { console.warn("Notification preferences fetch warning:", error); return null; }
  return data;
}

export async function upsertNotificationPreferences(userId, prefs) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
  if (error) console.warn("Notification preferences save warning:", error);
}

// Gamification: Daily Challenges, Mystery Boxes, Login Rewards
export async function fetchDailyChallenges(userId) {
  if (!supabase) return [];
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("daily_challenges")
    .select("*")
    .eq("user_id", userId)
    .eq("challenge_date", today);
  if (error) console.warn("Daily challenges fetch warning:", error);
  return data || [];
}

export async function claimMysteryBox(userId) {
  if (!supabase) return { id: `box_${Date.now()}`, user_id: userId, is_opened: true };
  const { data, error } = await supabase
    .from("mystery_boxes")
    .insert({
      user_id: userId,
      trigger_type: "daily_login",
      reward_type: "points",
      reward_value: { points: 50, streak_freeze: 1 },
      is_opened: true,
      opened_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

