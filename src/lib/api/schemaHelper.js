import { supabase } from "../supabaseClient.js";
import { isRealDatabaseId } from "../mockDataManager.js";

// Helper utilities for full 164-table database operations

// Almost nothing in this schema declares a real foreign key from a
// user/mentor/learner id column to `user_profiles` (most of those columns
// point straight at auth.users, which isn't introspectable by PostgREST), so
// `.select("*, user_profiles(...)")`-style embeds fail at runtime with a
// "could not find a relationship" error. This batches a manual second query
// instead. IMPORTANT: `user_profiles` has its own separate, auto-generated
// `id` PK AND a required `user_id` column that stores the real auth.uid()
// (confirmed against the live project's generated types) - every OTHER
// table's user/mentor/learner id column (mentors.user_id, community_posts.
// user_id, learner_id, etc.) stores that same raw auth uid directly, so the
// lookup query and the returned map must both be keyed on `user_id`, not the
// internal `id`.
export async function fetchProfilesByUserIds(userIds, columns = "id, display_name, avatar_url, role") {
  if (!supabase || !userIds || !userIds.length) return {};
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};

  // This helper is the single path by which almost every admin/mentor screen
  // attaches a real name and avatar to rows from tables that only store a raw
  // auth uid (compliance assignments, course applications, payouts, sessions,
  // mentors, moderation...). `user_profiles` has no `user_id` column at all -
  // its own `id` column IS the auth uid (supabase/migrations/0001_init_schema.sql:
  // "id uuid primary key references auth.users(id)"). There is also no `email`
  // column on this table (email lives only in auth.users, which PostgREST
  // can't query directly). Both of those were live bugs here before: the
  // default `columns` asked for a non-existent `email`, and callers like
  // fetchComplianceAssignments/fetchOrgActivityLog passed "user_id, ..." as
  // a column to SELECT (not just a value to filter by) - Postgres rejected
  // every one of those requests outright (42703 undefined column), so the
  // profile lookup silently returned {} and every list fell back to
  // "Learner"/"Mentor" placeholders, and any org filter keyed off the
  // (always-missing) organization_id field dropped every row.
  //
  // Only real, always-present user_profiles columns are used below; the map
  // this returns is keyed by `id`, which is what every caller already passes
  // in as `userIds` (the raw auth uid stored on every other table's
  // user_id/learner_id/mentor_id column).
  const safeColumns = columns.replace(/\buser_id\b/g, "id").replace(/\bemail\b/g, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "");

  // Callers pass everything from a handful of ids up to a whole org's
  // learner roster (700+ for Sara Foundation Africa) - a single unchunked
  // .in("id", ids) built a URL long enough that Postgres/the gateway
  // rejected it outright with a plain 400, so this returned {} for any
  // large org and every list using it fell back to "Learner"/"Mentor"
  // placeholders. Chunking in batches of 30 (same size safeInQuery in
  // platform.js already uses for the identical reason) keeps every request
  // well under the URL length that trips this.
  async function queryChunked(cols, idColumn) {
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    // Fired in parallel rather than one chunk at a time - this helper backs
    // ~40 call sites, so on a large org sequential chunking meant every one
    // of those lists took several extra seconds to populate even once the
    // query itself was correct.
    const results = await Promise.all(chunks.map((chunk) => supabase.from("user_profiles").select(cols).in(idColumn, chunk)));
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) return { error: firstError, rows: null };
    const rows = [];
    for (const { data } of results) rows.push(...(data || []));
    return { error: null, rows };
  }

  const { error, rows } = await queryChunked(safeColumns, "id");
  if (!error && rows) return Object.fromEntries(rows.map((p) => [p.id, p]));

  // Last-resort fallback if even the sanitized column list somehow fails.
  const basic = await queryChunked("id, display_name, avatar_url", "id");
  if (!basic.error && basic.rows) return Object.fromEntries(basic.rows.map((p) => [p.id, p]));

  console.warn("fetchProfilesByUserIds warning:", error);
  return {};
}

// Same batching pattern as fetchProfilesByUserIds, but for gamification
// stats (real `user_gamification_stats` table) - used to show streak/level
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
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("mentors")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) { console.warn("Mentor profile fetch warning:", error); return null; }
  if (data) {
    const profiles = await fetchProfilesByUserIds([userId]);
    return { ...data, user_profiles: profiles[userId] || null };
  }

  // Auto-provision mentor row for user so Instructor screens function seamlessly
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profile) {
    const { data: newMentor, error: createErr } = await supabase
      .from("mentors")
      .insert([{
        user_id: userId,
        organization_id: profile.organization_id,
        title: "Instructor",
        bio: profile.bio || "Instructor",
        is_active: true,
        is_approved: true
      }])
      .select()
      .maybeSingle();

    if (!createErr && newMentor) {
      return { ...newMentor, user_profiles: profile };
    }
  }
  return null;
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
  try {
    let resolvedMentorIds = [];
    if (mentorId && mentorId !== "all" && mentorId !== "demo-mentor-id") {
      resolvedMentorIds.push(mentorId);
      // Check if mentorId is a user_id or mentors table id
      const { data: mentorRows } = await supabase
        .from("mentors")
        .select("id, user_id")
        .or(`id.eq.${mentorId},user_id.eq.${mentorId}`);
      for (const m of mentorRows || []) {
        if (m.id) resolvedMentorIds.push(m.id);
        if (m.user_id) resolvedMentorIds.push(m.user_id);
      }
      resolvedMentorIds = [...new Set(resolvedMentorIds)];
    }

    let query = supabase
      .from("mentorship_sessions")
      .select("*")
      .order("scheduled_at", { ascending: false });

    if (resolvedMentorIds.length === 1) {
      query = query.eq("mentor_id", resolvedMentorIds[0]);
    } else if (resolvedMentorIds.length > 1) {
      query = query.in("mentor_id", resolvedMentorIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];
    const profiles = await fetchProfilesByUserIds(data.map((r) => r.learner_id));
    return data.map((r) => ({ ...r, learner_name: profiles[r.learner_id]?.display_name || "Learner" }));
  } catch (err) {
    console.warn("fetchMentorSessions warning:", err);
    return [];
  }
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

export async function bookMentorshipSession({ learnerId, mentorId, title, scheduledAt, description, durationMinutes = 45, meetingUrl }) {
  if (!supabase) return { id: `session_${Date.now()}`, learner_id: learnerId, mentor_id: mentorId, title, scheduled_at: scheduledAt, status: "requested" };
  const { data, error } = await supabase
    .from("mentorship_sessions")
    .insert({
      learner_id: learnerId,
      mentor_id: mentorId,
      title: title || "1-on-1 Mentorship Session",
      scheduled_at: scheduledAt,
      description: description || null,
      learner_notes: description || null,
      duration_minutes: durationMinutes || 45,
      session_type: "one_on_one",
      // Real meeting link - the mentor's own persistent room (set in Instructor
      // Settings > Video Integration) rather than a throwaway ad-hoc link. If
      // the mentor hasn't set one yet this stays null and the UI shows
      // "No meeting link set" instead of inventing a fresh room on click.
      meeting_url: meetingUrl || null,
      status: "requested"
    })
    .select()
    .single();
  if (error) {
    console.warn("bookMentorshipSession Supabase insert error:", error);
    throw error;
  }
  return data;
}

export async function fetchMentorEarnings(mentorId) {
  if (!supabase) return [];
  try {
    let query = supabase
      .from("mentor_earnings")
      .select("*")
      .order("payout_date", { ascending: false, nullsFirst: false });

    if (mentorId && mentorId !== "all" && mentorId !== "demo-mentor-id") {
      query = query.eq("mentor_id", mentorId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("fetchMentorEarnings warning:", err);
    return [];
  }
}

// Instructor/mentor payouts are temporarily suspended - "Train AI is
// currently intended to be the sole payment recipient; instructor/mentor
// payouts are temporarily suspended" (explicit architecture decision).
// Confirmed a real, direct violation of this: this function let an
// instructor actually submit a real payout request with no restriction at
// all. Earnings tracking itself is unaffected (mentors can still see what
// they've earned) - only the ability to request a payout is blocked,
// matching "temporarily suspended" rather than removing earnings
// visibility entirely.
// Revised - payouts are no longer unconditionally blocked. A real,
// confirmed decision: "some instructors won't be paid as they work for
// an organisation, and some may be paid as they run like an academy."
// This now actually attempts the real insert; the database itself
// (mpr_insert_enabled_instructor_or_admin,
// 0133_per_instructor_payouts_and_learner_payments.sql) is the real
// enforcement - only an instructor the platform owner has explicitly
// enabled can succeed. A disabled instructor gets a real, honest
// rejection from the database, not a hardcoded blanket message that no
// longer reflects reality.
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
  if (error) {
    return { success: false, error: "Payouts aren't enabled for your account yet - contact Train AI if you expect to be paid directly." };
  }
  return { success: true, ...data };
}

// This mentor's own payout request history (real `mentor_payout_requests`
// table, same one `submitMentorPayoutRequest` inserts into and the admin
// side's `fetchOrgPayoutRequests`/`updatePayoutRequestStatus` in platform.js
// manage org-wide) - scoped to a single mentor_id for the Earnings screen.
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
    // mentor_credentials has no created_at column - ordering on it made PostgREST
    // reject the query, so this list came back empty every time.
    .order("issue_date", { ascending: false, nullsFirst: false });
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
    // refund_requests has no created_at column - ordering on it made PostgREST
    // reject the query, so this list came back empty every time.
    .order("session_date", { ascending: false, nullsFirst: false });
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
// the real `mentors` row - previously the Settings screen only showed a
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
    // learning_paths has no created_at column in this schema (id, title,
    // description, level_label, category, organization_id, created_by,
    // is_published). Ordering on it made PostgREST reject the entire query,
    // so every learning-path list came back empty - which is exactly why the
    // admin Learning Paths screen showed nothing at all. Ordered by title
    // instead, which is a real column and gives a stable, readable order.
    .order("title", { ascending: true });
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
//
// `community_posts` has no `study_group_id` column - it is a single global
// feed (see 0004_community_gamification_admin.sql); per-study-group
// discussion lives in the separate `study_group_messages` table instead.
// This used to filter on `study_group_id` regardless (`.is(..., null)` for
// the general feed, `.eq(...)` for a specific group), which errored on
// every call since the column doesn't exist - the only real caller
// (useLearnerData.js) always calls this with no id, so the community feed
// never loaded a single post. The `studyGroupId` parameter is kept for a
// future per-group feed but is a no-op until such a column/table exists.
export async function fetchCommunityPosts(studyGroupId = null, orgId = null) {
  if (!supabase) return [];
  let query = supabase
    .from("community_posts")
    .select("*, post_comments(*), post_reactions(*)")
    .order("created_at", { ascending: false });

  if (studyGroupId) {
    query = query.eq("study_group_id", studyGroupId);
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
  
  // Isolate posts to the learner's organization if orgId is provided
  const tenantRows = orgId
    ? rows.filter(r => profiles[r.user_id] && profiles[r.user_id].organization_id === orgId)
    : rows;

  return tenantRows.map((r) => ({
    ...r,
    user_profiles: profiles[r.user_id] || null,
    post_comments: (r.post_comments || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .filter((c) => !orgId || (profiles[c.user_id] && profiles[c.user_id].organization_id === orgId))
      .map((c) => ({ ...c, user_profiles: profiles[c.user_id] || null })),
  }));
}

export async function fetchStudyGroupPosts(groupId) {
  return fetchCommunityPosts(groupId);
}

export async function createCommunityPost({ userId, content, postType = "general", studyGroupId = null }) {
  if (!supabase) return { id: `post_${Date.now()}`, user_id: userId, content, post_type: postType, study_group_id: studyGroupId, moderation_status: "approved" };
  const insertPayload = {
    user_id: userId,
    content,
    post_type: postType || "general",
    created_at: new Date().toISOString()
  };
  if (studyGroupId) {
    insertPayload.study_group_id = studyGroupId;
  }
  const { data, error } = await supabase
    .from("community_posts")
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw error;

  // Real activity ticker feed (fetchCommunityActivityFeed) - the table
  // already existed but nothing ever wrote to it, so the ticker was always
  // empty. Best-effort/non-blocking: a failure here should never stop the
  // post itself from publishing.
  try {
    const { data: profile } = await supabase.from("user_profiles").select("display_name").eq("id", userId).maybeSingle();
    const name = profile?.display_name || "A learner";
    await supabase.from("community_activity_feed").insert({
      user_id: userId,
      activity_type: "post_created",
      activity_text: `${name} just shared a new post`,
      is_public: true,
      metadata: { post_id: data.id },
    });
  } catch (e) {
    console.warn("Activity feed insert failed:", e);
  }

  // Real post-insert AI moderation pass. The live `ai-content-moderation`
  // edge function is designed to run AFTER the row exists - it takes a
  // `contentId`, runs the content through an AI moderation model, then does
  // its own UPDATE on `community_posts` (moderation_score/ai_moderated/
  // moderation_status) plus an INSERT into `moderation_logs`. It does NOT
  // support `contentType: "comment"` cleanly against the live schema (the
  // `moderation_status`/`moderated_at`/`moderated_by` columns were dropped
  // from `post_comments` in a later migration than the one that added
  // `moderation_score`/`ai_moderated` back to it), so this is only wired for
  // posts here - calling it for comments would just fail server-side.
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
    // AI moderation degraded/unavailable (rate limit, credits, network)
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

// Delete a community post - RLS (`cp_delete_own`) already restricts this to
// the post's own author, `userId` here is just for the optimistic local
// removal callers do alongside this, not an extra permission check.
export async function deleteCommunityPost(postId) {
  if (!supabase || !postId) return;
  const { error } = await supabase.from("community_posts").delete().eq("id", postId);
  if (error) throw error;
}

// Real engagement stats for the "Your Community Status" card - computed
// live from actual community_posts/post_comments rows rather than the
// `community_engagement_stats` table, which nothing in this app has ever
// written to (no trigger maintains it, so every row there would just read
// zero forever). Tier thresholds mirror the reference 1.0 design.
export async function fetchMyCommunityStats(userId) {
  if (!supabase || !userId) return { totalPosts: 0, totalComments: 0, score: 0, tier: "newcomer" };
  const [{ count: totalPosts }, { count: totalComments }] = await Promise.all([
    supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("post_comments").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const posts = totalPosts || 0;
  const comments = totalComments || 0;
  const score = posts * 10 + comments * 5;
  let tier = "newcomer";
  if (score >= 500) tier = "champion";
  else if (score >= 200) tier = "leader";
  else if (score >= 100) tier = "engager";
  else if (score >= 50) tier = "contributor";
  return { totalPosts: posts, totalComments: comments, score, tier };
}

// Mentor directory (browse all active mentors). NOTE: the real schema has no
// separate "is_approved" flag on `mentors` (only `is_active`), so being
// active is the closest available proxy for "approved and listable".
export async function fetchAllMentors(orgId = null) {
  if (!supabase) return [];
  let query = supabase
    .from("mentors")
    .select("*")
    .eq("is_active", true)
    .order("rating", { ascending: false });

  if (orgId) {
    query = query.eq("organization_id", orgId);
  }

  const { data, error } = await query;
  if (error) { console.warn("Mentors directory fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  return rows.map((r) => {
    const prof = profiles[r.user_id] || {};
    return {
      ...r,
      name: prof.display_name || r.name || "Instructor",
      avatar: prof.avatar_url || r.avatar_url || r.avatar || null,
      user_profiles: prof,
    };
  });
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

// Messages - general learner-to-learner messaging (messages table)
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

// Messages - learner-to-mentor messaging (mentor_messages table). This is
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
export async function fetchStudyGroups(orgId = null) {
  if (!supabase) return [];
  let query = supabase
    .from("study_groups")
    .select("*, courses(title), study_group_members(count)")
    .order("name", { ascending: true });

  if (orgId) {
    query = query.eq("organization_id", orgId);
  }

  const { data, error } = await query;
  if (error) { console.warn("Study groups fetch warning:", error); return []; }
  return data || [];
}

export async function fetchMyStudyGroupIds(userId) {
  if (!supabase || !userId) return [];
  let actualUserId = userId;
  if (!isRealDatabaseId(actualUserId)) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id && isRealDatabaseId(userData.user.id)) {
        actualUserId = userData.user.id;
      } else {
        return [];
      }
    } catch {
      return [];
    }
  }
  const { data, error } = await supabase.from("study_group_members").select("group_id").eq("user_id", actualUserId);
  if (error) { console.warn("Study group membership fetch warning:", error); return []; }
  return (data || []).map((r) => r.group_id);
}

// Real members of a specific study group (not a generic community-people
// slice) - used by the Group Members tab in StudyGroupWorkspace.
export async function fetchStudyGroupMembers(groupId) {
  if (!supabase || !groupId || !isRealDatabaseId(groupId)) return [];
  const { data, error } = await supabase
    .from("study_group_members")
    .select("user_id, role, joined_at")
    .eq("group_id", groupId);
  if (error) { console.warn("Study group members fetch warning:", error); return []; }
  const rows = data || [];
  // Also fetches platform_role now (not just display_name/avatar) - needed
  // to filter this list down to instructors only, confirmed by repeated
  // direct instruction (no learner-to-learner visibility anywhere in
  // Community). "role" on the row above is this study group's own
  // lead/member distinction, unrelated to platform role.
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id), "user_id, display_name, avatar_url, role");
  return rows.map((r) => ({
    ...r,
    display_name: profiles[r.user_id]?.display_name || "Learner",
    avatar_url: profiles[r.user_id]?.avatar_url || null,
    platform_role: profiles[r.user_id]?.role || "learner",
    // Some consumers (StudyGroupScreen, AdminStudyGroupsScreen) read a
    // nested user_profiles object instead of the flat fields above -
    // provide both shapes so every call site renders real names.
    user_profiles: profiles[r.user_id] || null,
  }));
}

export async function joinStudyGroup({ studyGroupId, userId }) {
  if (!supabase || !studyGroupId) return { success: false, error: "Invalid study group." };

  let actualUserId = userId;
  if (!actualUserId) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      actualUserId = userData?.user?.id;
    } catch { /* ignore */ }
  }

  if (!actualUserId) {
    throw new Error("Please sign in to join this study group.");
  }

  // Gracefully handle demo mode or non-UUID inputs without database error
  if (!isRealDatabaseId(actualUserId) || !isRealDatabaseId(studyGroupId)) {
    return { success: true, demo: true };
  }

  // Upsert member record to prevent duplicate key errors (23505) on rapid or repeated clicks
  let { error } = await supabase
    .from("study_group_members")
    .upsert({ group_id: studyGroupId, user_id: actualUserId, role: "member" }, { onConflict: "group_id, user_id" });

  // If foreign key violation (23503), the user's profile is not yet in public.user_profiles.
  // Auto-provision the profile via join_default_organization RPC and retry.
  if (error && (error.code === "23503" || error.message?.includes("foreign key constraint"))) {
    try {
      await supabase.rpc("join_default_organization");
    } catch (rpcErr) {
      console.warn("Auto-provision profile via RPC failed:", rpcErr);
    }
    const retry = await supabase
      .from("study_group_members")
      .upsert({ group_id: studyGroupId, user_id: actualUserId, role: "member" }, { onConflict: "group_id, user_id" });
    error = retry.error;
  }

  // Duplicate key constraint - treat as idempotent success
  if (error && (error.code === "23505" || error.message?.includes("duplicate key"))) {
    return { success: true, alreadyMember: true };
  }

  if (error) {
    console.error("Failed to join study group:", error);
    throw new Error(error.message || "Failed to join study group. Please try again.");
  }

  return { success: true };
}

export async function leaveStudyGroup({ studyGroupId, userId }) {
  if (!supabase || !studyGroupId) return { success: true };

  let actualUserId = userId;
  if (!actualUserId) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      actualUserId = userData?.user?.id;
    } catch { /* ignore */ }
  }

  if (!actualUserId) return { success: true };

  if (!isRealDatabaseId(actualUserId) || !isRealDatabaseId(studyGroupId)) {
    return { success: true, demo: true };
  }

  const { error } = await supabase
    .from("study_group_members")
    .delete()
    .eq("group_id", studyGroupId)
    .eq("user_id", actualUserId);

  if (error) {
    console.error("Failed to leave study group:", error);
    throw new Error(error.message || "Failed to leave study group. Please try again.");
  }

  return { success: true };
}

export async function deleteStudyGroup(groupId) {
  if (!supabase || !groupId) return;
  if (!isRealDatabaseId(groupId)) return;
  const { error } = await supabase.from("study_groups").delete().eq("id", groupId);
  if (error) throw error;
}

// Study group chat - backed by the real `study_group_messages` table
// (study_group_id, sender_id, message, media_type/url, created_at).
export async function fetchStudyGroupMessages(groupId) {
  if (!supabase || !groupId || !isRealDatabaseId(groupId)) return [];
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

// Live activity ticker - backed by the real `community_activity_feed` table
// (activity_type, activity_text, is_public, metadata). No client-side
// derivation needed since this table already exists for exactly this
// purpose; only public rows are shown here.
export async function fetchCommunityActivityFeed(limit = 15, orgId = null) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_activity_feed")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit * 2);
  if (error) { console.warn("Community activity feed fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id));
  const filtered = orgId
    ? rows.filter((r) => profiles[r.user_id] && profiles[r.user_id].organization_id === orgId)
    : rows;
  return filtered.slice(0, limit).map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// ---------------------------------------------------------------------------
// Forums - distinct from study groups. Backed by the real `forums` table
// (discussion categories: course-scoped via course_id, or `is_general`) and
// `forum_posts` (self-referencing via parent_post_id - a row with it null is
// a thread's opening post, a row with it set is a reply). See
// supabase/migrations/0009_forum_rls_gapfill.sql for the RLS policies this
// depends on (0004 created the tables but left them with none).
// ---------------------------------------------------------------------------

// Category list for the Forums landing view. Thread count / latest activity
// per category isn't a stored aggregate anywhere in the schema, so it's
// computed client-side from forum_posts the same way CommunityScreen derives
// trendingTags from community_posts.tags - one extra lightweight query, no
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

// Upvote/downvote - routed through the `vote_forum_post` RPC (see
// 0009_forum_rls_gapfill.sql) rather than a direct `.update()`, since the
// counters live on the same row as the post's own content and there's no
// separate forum_post_votes table in this schema to scope a broader RLS
// update policy to. Note this is an honest one-way tally, not a per-user
// toggle - the schema has nowhere to record "this user already voted".
export async function voteForumPost(postId, direction = "up") {
  if (!supabase) return;
  const { error } = await supabase.rpc("vote_forum_post", { p_post_id: postId, p_direction: direction });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Cohort Space (learner-facing) - real `cohorts` / `cohort_members` /
// `cohort_posts` / `cohort_post_replies` / `cohort_post_reactions` tables
// (see supabase/migrations/0002_progress_quizzes_cohorts.sql for `cohorts`/
// `cohort_members` and 0007_missing_schema.sql for the posts/replies/
// reactions trio). The admin-side cohort builder already exists in
// lib/api/platform.js (fetchCohortDetail / createCohortPost / addCohortMember
// / etc., see CohortDetailScreen.jsx) - createCohortPost from there is reused
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
    .order("added_at", { ascending: false });
  if (error) { console.warn("Cohort membership fetch warning:", error); return null; }
  const valid = (data || []).filter((d) => !!d.cohorts);
  if (!valid.length) return null;
  return {
    membership: valid[0],
    cohort: valid[0].cohorts,
    allCohorts: valid.map((d) => d.cohorts),
    allMemberships: valid,
  };
}

export async function fetchMyCohortMemberships(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("cohort_members")
    .select("*, cohorts(*)")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) { console.warn("Cohort memberships fetch warning:", error); return []; }
  return (data || []).filter((d) => !!d.cohorts).map((d) => ({ membership: d, cohort: d.cohorts }));
}

// Cohort posts/announcements feed for one cohort - pinned posts first, then
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

// Create a post or message in a cohort (real `cohort_posts` table)
export async function createCohortPost({ cohortId, authorId, content, isAnnouncement = false, isPinned = false }) {
  if (!supabase || !cohortId || !authorId || !content?.trim()) return null;
  const { data, error } = await supabase
    .from("cohort_posts")
    .insert({
      cohort_id: cohortId,
      author_id: authorId,
      content: content.trim(),
      is_announcement: isAnnouncement,
      is_pinned: isPinned,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Reply to a cohort post (real `cohort_post_replies` table). The live RLS
// policy (cpr_insert_member in 0007_missing_schema.sql) only checks
// author_id = auth.uid() for inserts - no separate client-side membership
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
// table - unique on post_id/user_id/emoji), same toggle pattern as
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

// Cohort resources - read-only surface for learners of the same
// `cohort_resources` table an admin already writes to in
// lib/api/platform.js (addCohortResource/deleteCohortResource, used from
// CohortDetailScreen.jsx). RLS (cres_select_member, 0007_missing_schema.sql)
// allows any member of the cohort to select its rows - this was simply never
// read anywhere on the learner side, so admin-authored resources were
// invisible to the learners they were meant for.
export async function fetchCohortResources(cohortId) {
  if (!supabase || !cohortId) return [];
  const { data, error } = await supabase
    .from("cohort_resources")
    .select("*")
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });
  if (error) { console.warn("Cohort resources fetch warning:", error); return []; }
  return data || [];
}

// Cohort live sessions - read-only surface for learners of the same
// `cohort_sessions` table an admin already writes to (createCohortSession /
// deleteCohortSession in lib/api/platform.js). Same "admin can write it, no
// learner screen ever read it" gap as cohort_resources above. RLS
// (csess_select_member) already scopes this to the caller's own cohort
// membership.
export async function fetchCohortSessions(cohortId) {
  if (!supabase || !cohortId) return [];
  const { data, error } = await supabase
    .from("cohort_sessions")
    .select("*")
    .eq("cohort_id", cohortId)
    .order("starts_at", { ascending: true });
  if (error) { console.warn("Cohort sessions fetch warning:", error); return []; }
  return data || [];
}

// Community - suggested people to follow/connect with (strictly scoped to user's organization)
export async function fetchCommunityPeople(excludeUserId, limit = 20, orgId = null) {
  if (!supabase) return [];
  let query = supabase.from("user_profiles").select("*").limit(limit);
  if (excludeUserId) query = query.neq("id", excludeUserId);
  if (orgId) query = query.eq("organization_id", orgId);
  const { data, error } = await query;
  if (error) {
    let fallbackQuery = supabase.from("public_user_profiles").select("*").limit(limit);
    if (excludeUserId) fallbackQuery = fallbackQuery.neq("id", excludeUserId);
    if (orgId) fallbackQuery = fallbackQuery.eq("organization_id", orgId);
    const { data: fallbackData } = await fallbackQuery;
    return fallbackData || [];
  }
  return data || [];
}

// AI Assistant - conversation bootstrap + edge function call
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
  if (!supabase) return { error: "AI Assistant is unavailable: Supabase isn't configured in this environment." };
  try {
    const { data, error } = await supabase.functions.invoke("ai-chat", { body: { conversationId, message } });
    if (error) return { error: error.message || "AI Assistant is unavailable right now." };
    return data;
  } catch (e) {
    return { error: e?.message || "AI Assistant is unavailable right now." };
  }
}

// Real learner-scoped AI insights. The live `ai-insights` edge function
// takes no request body at all - it authenticates the caller from the
// Authorization header (which `supabase.functions.invoke` attaches
// automatically from the current session) and pulls THAT user's own
// `lesson_progress`, `course_enrollments`, and `quiz_attempts` rows
// server-side, then returns `{ insights: "<markdown>", stats: {
// completedLessons, totalHours, averageScore, enrolledCourses } }`.
export async function fetchAIInsights() {
  if (!supabase) return { error: "AI Insights are unavailable: Supabase isn't configured in this environment." };
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
// type, title, message, priority, dueDate }] }` - or `{ error, fallback:
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
// credits exhausted, 500 misconfigured/invalid AI output) - supabase-js
// surfaces that as `error` (a FunctionsHttpError), not `data`, matching the
// same shape acceptInvitation in invitations.js already unwraps via
// `error.context.json()`.
//
// A quiz generated this way has no row in `quizzes`/`quiz_questions`, so
// there's no quiz_id to score it against the real `check_quiz_answers` RPC
// (see submitQuizAnswers in learner.js) - callers must score the returned
// `correctAnswer` client-side themselves.
export async function generateAIQuiz({ topic, difficulty, questionCount, learningGoal } = {}) {
  if (!supabase) return { error: "AI Quiz Generator is unavailable: Supabase isn't configured in this environment." };
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
        // context body already consumed / not JSON - fall back to error.message below
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
  try {
    const existing = await fetchNotificationPreferences(userId);
    if (existing) {
      await supabase.from("notification_preferences").update(prefs).eq("user_id", userId);
    } else {
      await supabase.from("notification_preferences").insert({ user_id: userId, ...prefs });
    }
  } catch (e) {
    // Silently ignore preference save errors when table structure varies
  }
}

// Daily challenges removed per the product brief - see the note in
// lib/api/retention.js. fetchDailyChallenges was the other unused half of
// that dead feature.

export async function claimMysteryBox(userId) {
  if (!supabase) return { id: `box_${Date.now()}`, user_id: userId, is_opened: true, reward_value: { points: 50, streak_freeze: 1 } };
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

// Every real mystery box a learner has ever been given - confirmed
// directly against the real 1.0 reference codebase (MysteryBoxCard.tsx /
// useMysteryBox). Used only to count how many have already been claimed,
// so a new one is offered honestly once per real 7-day streak milestone
// reached - not on a random schedule, and never re-offered for a
// milestone already claimed.
export async function fetchMyMysteryBoxes(userId) {
  if (!supabase) return [];
  if (!userId) return [];
  const { data, error } = await supabase.from("mystery_boxes").select("*").eq("user_id", userId).order("opened_at", { ascending: false });
  if (error) { console.warn("Mystery boxes fetch warning:", error); return []; }
  return data || [];
}


// Cohort "Assigned Courses" and "Members" - PRD Section 7.4 explicitly
// lists both as required cohort structure ("Cohorts - Discussion,
// Sessions, Resources, Assigned Courses and Members"). Confirmed a real
// gap: cohort_courses and cohort_members both already existed as real
// tables (0002_progress_quizzes_cohorts.sql), but CohortScreen.jsx had
// zero references to either - only Chat/Resources/Sessions existed as
// tabs.
export async function fetchCohortAssignedCourses(cohortId) {
  if (!supabase || !cohortId) return [];
  const { data, error } = await supabase
    .from("cohort_courses")
    .select("id, due_at, courses(id, title, description)")
    .eq("cohort_id", cohortId);
  if (error) { console.warn("Cohort courses fetch warning:", error); return []; }
  return data || [];
}

export async function fetchCohortMembers(cohortId) {
  if (!supabase || !cohortId) return [];
  // `cohort_members` has two foreign keys to user_profiles (user_id and
  // added_by), so a bare `user_profiles(...)` embed is ambiguous and PostgREST
  // refuses the query outright - which is why cohort member lists rendered
  // with no names at all. Resolved via the batched profile lookup instead, and
  // the returned shape is unchanged so existing callers keep working.
  const { data, error } = await supabase
    .from("cohort_members")
    .select("id, added_at, user_id")
    .eq("cohort_id", cohortId);
  if (error) { console.warn("Cohort members fetch warning:", error); return []; }
  const rows = data || [];
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.user_id), "id, display_name, avatar_url, role");
  return rows.map((r) => ({ ...r, user_profiles: profiles[r.user_id] || null }));
}

// Admin-wide Study Groups view - confirmed directly: "Admins should be
// able to see and access all study groups." Org-scoped (via
// sg_select_own_org RLS, 0127_suspend_instructor_payouts.sql - a real
// cross-tenant leak was found and fixed here too, sg_select_all previously
// used "using (true)" ignoring organization_id entirely).
export async function fetchAllStudyGroupsForOrg(organizationId) {
  if (!supabase) return [];
  let query = supabase
    .from("study_groups")
    .select("*, courses(title), study_group_members(count)");

  if (organizationId && organizationId !== "demo-org-id") {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query.order("name", { ascending: true });
  if (error) { console.warn("Org study groups fetch warning:", error); return []; }
  return data || [];
}

// ============================================================================
// Instructor-side study group management - confirmed a real gap: an
// instructor could already create/manage a study group at the database
// level (sg_write_authorized already allowed created_by = auth.uid()),
// but there was no screen at all for them to actually do it. This is that
// screen's backend.
// ============================================================================
export async function fetchMyStudyGroups(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("study_groups")
    .select("*, courses(title), study_group_members(count)")
    .eq("created_by", userId)
    .order("name", { ascending: true });
  if (error) { console.warn("My study groups fetch warning:", error); return []; }
  return data || [];
}

export async function createStudyGroup({ organizationId, name, description, courseId, createdBy, maxMembers }) {
  if (!supabase) return null;

  let actualCreatedBy = createdBy;
  if (!actualCreatedBy) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      actualCreatedBy = userData?.user?.id;
    } catch { /* ignore */ }
  }

  let orgId = organizationId;
  if (!orgId || !isRealDatabaseId(orgId)) {
    if (actualCreatedBy && isRealDatabaseId(actualCreatedBy)) {
      try {
        const { data: prof } = await supabase.from("user_profiles").select("organization_id").eq("id", actualCreatedBy).maybeSingle();
        if (prof?.organization_id) orgId = prof.organization_id;
      } catch { /* ignore */ }
    }
  }

  if (!orgId || !isRealDatabaseId(orgId)) {
    try {
      const { data: defOrg } = await supabase.from("organizations").select("id").eq("slug", "tech-learning").maybeSingle();
      orgId = defOrg?.id || null;
    } catch { /* ignore */ }
  }

  const insertPayload = {
    organization_id: orgId,
    name,
    description: description || null,
    max_members: maxMembers || 50,
  };
  if (courseId && isRealDatabaseId(courseId)) {
    insertPayload.course_id = courseId;
  }
  if (actualCreatedBy && isRealDatabaseId(actualCreatedBy)) {
    insertPayload.created_by = actualCreatedBy;
  }

  const { data, error } = await supabase
    .from("study_groups")
    .insert(insertPayload)
    .select()
    .single();
  if (error) {
    console.error("Failed to create study group:", error);
    throw new Error(error.message || "Failed to create study group.");
  }

  // Creator is added as a real lead member too
  if (actualCreatedBy && data?.id && isRealDatabaseId(actualCreatedBy) && isRealDatabaseId(data.id)) {
    try {
      let { error: memErr } = await supabase
        .from("study_group_members")
        .upsert({ group_id: data.id, user_id: actualCreatedBy, role: "lead" }, { onConflict: "group_id, user_id" });
      if (memErr && (memErr.code === "23503" || memErr.message?.includes("foreign key constraint"))) {
        await supabase.rpc("join_default_organization").catch(() => {});
        await supabase
          .from("study_group_members")
          .upsert({ group_id: data.id, user_id: actualCreatedBy, role: "lead" }, { onConflict: "group_id, user_id" });
      }
    } catch (e) {
      console.warn("Could not auto-add study group creator as a member:", e);
    }
  }
  return data;
}

export async function updateStudyGroup(groupId, patch) {
  if (!supabase || !groupId) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("study_groups").update(patch).eq("id", groupId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update this study group." };
  }
}

export async function removeStudyGroupMember(groupId, userId) {
  if (!supabase || !groupId || !userId) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("study_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not remove this member." };
  }
}

// Instructor-facing study group management - "How will instructor manage
// study group" was a real, direct question with a real, confirmed answer
// of "they currently can't at all": no nav entry existed, and while
// fixing the underlying access itself (0127_suspend_instructor_payouts.sql
// - which also caught and fixed a genuine infinite-recursion RLS bug
// found only by actually running a real UPDATE, not by reading either
// policy in isolation), there was still no actual screen to use that
// access from.
export async function fetchMyManagedStudyGroups(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("study_group_members")
    .select("group_id, study_groups(id, name, description, course_id, max_members, is_private, courses(title))")
    .eq("user_id", userId);
  if (error) { console.warn("Managed study groups fetch warning:", error); return []; }
  return (data || []).map((r) => r.study_groups).filter(Boolean);
}

export async function updateStudyGroupDetails(groupId, patch) {
  if (!supabase || !groupId) return { success: false, error: "Not available in demo mode." };
  try {
    const { error } = await supabase.from("study_groups").update(patch).eq("id", groupId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Could not update this study group." };
  }
}

// ============================================================================
// Full Instructor Settings - Communications, Sessions, Resources tabs.
// Every table here already existed in the original schema
// (0003_mentors_sessions_messaging.sql) but had zero RLS policies until
// 0131_mentor_settings_rls_gapfill.sql, and no client functions or UI ever
// surfaced any of it. Built to match the confirmed screen structure.
// ============================================================================

// --- Communications: Automated Reminders ---
export async function fetchReminderSettings(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase.from("reminder_settings").select("*").eq("mentor_id", mentorId);
  if (error) { console.warn("Reminder settings fetch warning:", error); return []; }
  return data || [];
}

export async function addReminderSetting(mentorId, { reminderType, hoursBefore, customMessage }) {
  if (!supabase || !mentorId) return null;
  const { data, error } = await supabase.from("reminder_settings").insert({
    mentor_id: mentorId, reminder_type: reminderType, hours_before: hoursBefore, custom_message: customMessage || null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteReminderSetting(id) {
  if (!supabase) return;
  const { error } = await supabase.from("reminder_settings").delete().eq("id", id);
  if (error) throw error;
}

// --- Sessions: Session Templates ---
export async function fetchSessionTemplates(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase.from("session_templates").select("*").eq("mentor_id", mentorId);
  if (error) { console.warn("Session templates fetch warning:", error); return []; }
  return data || [];
}

export async function addSessionTemplate(mentorId, { title, description, agenda, suggestedDuration }) {
  if (!supabase || !mentorId) return null;
  const { data, error } = await supabase.from("session_templates").insert({
    mentor_id: mentorId, title, description: description || null, agenda: agenda || null, suggested_duration: suggestedDuration || null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSessionTemplate(id) {
  if (!supabase) return;
  const { error } = await supabase.from("session_templates").delete().eq("id", id);
  if (error) throw error;
}

// --- Sessions: Cancellation Policies ---
export async function fetchCancellationPolicies(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase.from("cancellation_policies").select("*").eq("mentor_id", mentorId);
  if (error) { console.warn("Cancellation policies fetch warning:", error); return []; }
  return data || [];
}

export async function addCancellationPolicy(mentorId, { hoursBefore, feePercentage, description }) {
  if (!supabase || !mentorId) return null;
  const { data, error } = await supabase.from("cancellation_policies").insert({
    mentor_id: mentorId, hours_before: hoursBefore, fee_percentage: feePercentage, description: description || null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCancellationPolicy(id) {
  if (!supabase) return;
  const { error } = await supabase.from("cancellation_policies").delete().eq("id", id);
  if (error) throw error;
}

// --- Sessions: Video Integration ---
export async function fetchVideoIntegrationSettings(mentorId) {
  if (!supabase || !mentorId) return { preferred_platform: "jitsi", auto_generate_url: true };
  const { data, error } = await supabase.from("video_integration_settings").select("*").eq("mentor_id", mentorId).maybeSingle();
  if (error) { console.warn("Video integration settings fetch warning:", error); return { preferred_platform: "jitsi", auto_generate_url: true }; }
  return data || { preferred_platform: "jitsi", auto_generate_url: true };
}

export async function updateVideoIntegrationSettings(mentorId, patch) {
  if (!supabase || !mentorId) return;
  const { error } = await supabase.from("video_integration_settings").upsert({ mentor_id: mentorId, ...patch }, { onConflict: "mentor_id" });
  if (error) throw error;
}

// --- Resources: Resource Library ---
export async function fetchMentorResourceLibrary(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase.from("mentor_resources").select("*").eq("mentor_id", mentorId);
  if (error) { console.warn("Mentor resources fetch warning:", error); return []; }
  return data || [];
}

export async function addMentorResource(mentorId, { title, description, resourceType, externalUrl }) {
  if (!supabase || !mentorId) return null;
  const { data, error } = await supabase.from("mentor_resources").insert({
    mentor_id: mentorId, title, description: description || null, resource_type: resourceType || "link", external_url: externalUrl || null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMentorResource(id) {
  if (!supabase) return;
  const { error } = await supabase.from("mentor_resources").delete().eq("id", id);
  if (error) throw error;
}

// --- Resources: Mentorship Agreements ---
export async function fetchMentorshipAgreements(mentorId) {
  if (!supabase || !mentorId) return [];
  const { data, error } = await supabase.from("mentorship_agreements").select("*").eq("mentor_id", mentorId);
  if (error) { console.warn("Mentorship agreements fetch warning:", error); return []; }
  const rows = data || [];
  // Fetches learner names separately rather than guessing at Supabase's
  // auto-generated foreign key constraint name for an embedded join
  // (mentorship_agreements_learner_id_fkey) - unverified guesses at
  // constraint names are exactly the kind of thing that silently breaks
  // in a real, connected project even though it looks fine here; this
  // matches the same safer pattern already used in
  // fetchStudyGroupMembers().
  const profiles = await fetchProfilesByUserIds(rows.map((r) => r.learner_id));
  return rows.map((r) => ({ ...r, learner_name: profiles[r.learner_id]?.display_name || "Learner" }));
}

export async function createMentorshipAgreement(mentorId, { learnerId, agreementType, expectations, expiresAt }) {
  if (!supabase || !mentorId || !learnerId) return null;
  const { data, error } = await supabase.from("mentorship_agreements").insert({
    mentor_id: mentorId, learner_id: learnerId, agreement_type: agreementType || "standard", expectations: expectations || null, expires_at: expiresAt || null, status: "pending",
  }).select().single();
  if (error) throw error;
  return data;
}
