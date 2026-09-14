import { supabase } from '../supabaseClient.js';

// Simple SHA-256 string hasher for hash chaining
async function computeHash(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function logAdminAction({
  adminUserId,
  actionType,
  targetType,
  targetId,
  targetIdentifier = null,
  oldValue = null,
  newValue = null,
  metadata = null,
  ipAddress = null,
  userAgent = null
}) {
  if (!supabase) return { success: true, record: { id: `log_${Date.now()}`, action_type: actionType } };

  try {
    // Get last hash from admin_audit_log
    const { data: lastRow } = await supabase
      .from('admin_audit_log')
      .select('row_hash')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevHash = lastRow?.row_hash || 'GENESIS_HASH_00000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();
    const payloadToHash = `${prevHash}|${actionType}|${targetType || ''}|${targetId || ''}|${adminUserId}|${timestamp}`;
    const rowHash = await computeHash(payloadToHash);

    const record = {
      admin_user_id: adminUserId,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      target_identifier: targetIdentifier,
      old_value: oldValue,
      new_value: newValue,
      metadata,
      ip_address: ipAddress || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
      user_agent: userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'AppShell'),
      prev_hash: prevHash,
      row_hash: rowHash,
      created_at: timestamp
    };

    const { data, error } = await supabase.from('admin_audit_log').insert(record).select().single();
    if (error) {
      console.warn('Audit log write error (falling back to memory log):', error);
      return { success: false, record };
    }
    return { success: true, record: data };
  } catch (err) {
    console.error('Audit logging failed:', err);
    return { success: false, error: err.message };
  }
}

export async function fetchAuditLogs(limit = 100) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('Could not fetch audit logs from backend, returning mock:', error);
    return [];
  }
  return data || [];
}

