import { supabase } from '../supabaseClient.js';

export async function submitDSARRequest({ userId, email, requestType, notes = '' }) {
  if (!supabase) return { success: true, request: { id: `dsar_${Date.now()}`, user_id: userId, request_type: requestType, status: "pending" } };

  const payload = {
    user_id: userId,
    email: email,
    request_type: requestType, // 'export' | 'erasure' | 'rectification'
    status: 'pending',
    notes,
    requested_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('dsar_requests').insert(payload).select().single();
  if (error) {
    console.warn('DSAR submit error:', error);
    // Don't claim success on a request that was never actually recorded —
    // a GDPR request that silently fails to save is worse than one that
    // visibly fails and can be retried or escalated to support.
    return { success: false, error: error.message || String(error) };
  }
  return { success: true, request: data };
}

export async function fetchUserDSARRequests(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('dsar_requests')
    .select('*')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false });

  if (error) return [];
  return data || [];
}

// Admin-only: list DSAR requests across every user, newest first, so the
// compliance/people screens can show a pending-requests queue. Unlike
// fetchUserDSARRequests above this is NOT scoped to a single user_id — the
// dsar_requests table has no org_id column, so this is platform-wide.
export async function fetchAllDSARRequests(status = null) {
  if (!supabase) return [];
  let query = supabase.from('dsar_requests').select('*').order('requested_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    console.warn('DSAR list error:', error);
    return [];
  }
  return data || [];
}

// Admin-only: mark a DSAR request as processed/rejected once an admin has
// acted on it (e.g. ran the export, or ran deleteUserCascade for an erasure
// request). Kept separate from submitDSARRequest so learners can never set
// their own request's status.
export async function updateDSARRequestStatus(requestId, status, notes = undefined) {
  if (!supabase) return { success: true, data: { id: requestId, status } };

  // Only touch columns we know exist from submitDSARRequest's insert payload
  // above (user_id, email, request_type, status, notes, requested_at) — no
  // resolved_at/updated_at column is assumed here since it isn't used
  // elsewhere in this file.
  const patch = { status };
  if (notes !== undefined) patch.notes = notes;

  const { data, error } = await supabase
    .from('dsar_requests')
    .update(patch)
    .eq('id', requestId)
    .select()
    .single();

  if (error) return { success: false, error: error.message || String(error) };
  return { success: true, data };
}

export async function exportUserData(userId) {
  if (!supabase) {
    return {
      user_profiles: [{ id: userId, display_name: userId }],
      course_enrollments: [],
      lesson_progress: []
    };
  }

  // Cascading export across key tables. Table names must match the shared
  // database exactly — there is no `profiles` table, it's `user_profiles`.
  // NOTE: user_profiles has its own separate, auto-generated `id` PK AND a
  // required `user_id` column that stores the real auth.uid() (confirmed
  // against the live project's generated types) — same convention as every
  // other table below, which each have their own `user_id` column.
  const collections = {};
  const tables = [
    'user_profiles',
    'lesson_progress',
    'course_enrollments',
    'quiz_attempts',
    'assessment_attempts',
    'mentorship_sessions',
    'community_posts',
    'post_comments',
    'course_notes',
    'claimed_rewards'
  ];

  // mentorship_sessions has learner_id/mentor_id, not user_id — and mentor_id
  // points at mentors.id, not the auth user id, so resolve that row first.
  const { data: mentorRow } = await supabase.from('mentors').select('id').eq('user_id', userId).maybeSingle();

  for (const table of tables) {
    let query = supabase.from(table).select('*');
    if (table === 'user_profiles') {
      query = query.eq('user_id', userId);
    } else if (table === 'mentorship_sessions') {
      query = mentorRow?.id
        ? query.or(`learner_id.eq.${userId},mentor_id.eq.${mentorRow.id}`)
        : query.eq('learner_id', userId);
    } else {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    if (error) console.warn(`DSAR export: could not read ${table}:`, error);
    collections[table] = data || [];
  }

  return collections;
}

export async function deleteUserCascade(userId) {
  if (!supabase) return { success: true, details: { user_profiles: "deleted" } };

  // Cascading deletion order to prevent FK violations
  const dependentTables = [
    'post_reactions',
    'post_comments',
    'community_posts',
    'claimed_rewards',
    'daily_login_rewards',
    'daily_challenges',
    'mystery_boxes',
    'quiz_attempts',
    'assessment_attempts',
    'lesson_progress',
    'course_notes',
    'course_enrollments',
    'user_roles',
    'user_personalization'
  ];

  const results = {};
  for (const table of dependentTables) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    results[table] = error ? error.message : 'deleted';
  }

  // Delete the profile row itself last — it's `user_profiles`, not
  // `profiles` (there is no `profiles` table in this schema), and it's
  // matched by its `user_id` column (the real auth uid) — user_profiles.id
  // is a separate internal PK. Every table above also cascades back to
  // user_profiles in the migrations, so this single delete would actually
  // clear most of the rows above on its own; the explicit per-table loop is
  // kept so the caller gets a full audit trail of what was removed for this
  // erasure request.
  const { error: profileErr } = await supabase.from('user_profiles').delete().eq('user_id', userId);
  results['user_profiles'] = profileErr ? profileErr.message : 'deleted';

  const allSucceeded = Object.values(results).every((v) => v === 'deleted');
  return { success: allSucceeded, details: results };
}

export async function saveConsentPreferences(userId, prefs) {
  if (!supabase) return { success: true, data: { user_id: userId, notification_types: prefs } };

  const payload = {
    user_id: userId,
    notification_types: prefs,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return { success: false, error };
  return { success: true, data };
}

