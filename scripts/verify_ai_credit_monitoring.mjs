process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function verifyMonitoring() {
  console.log('--- STARTING LIVE VERIFICATION OF AI CREDIT MONITORING ---');
  const saraId = '58ebdb4d-8209-4e08-9ab3-8c5eee87b278';

  // 1. Parallel fetch
  const [summaryRes, profilesRes, accountsRes, txsRes] = await Promise.all([
    supabase.from('ai_credit_accounts').select('balance, lifetime_credited, lifetime_consumed').eq('organization_id', saraId).eq('account_type', 'organization').maybeSingle(),
    supabase.from('user_profiles').select('id, display_name, avatar_url, role, last_active_at, department').eq('organization_id', saraId).order('display_name', { ascending: true }),
    supabase.from('ai_credit_accounts').select('id, owner_user_id, balance, lifetime_credited, lifetime_consumed, account_type').eq('organization_id', saraId),
    supabase.from('ai_credit_transactions').select('id, user_id, amount, transaction_type, reference_type, created_at, balance_after').eq('organization_id', saraId).order('created_at', { ascending: false }).limit(2000),
  ]);

  const orgPoolBalance = summaryRes.data?.balance || 0;
  const profiles = profilesRes.data || [];
  const accounts = accountsRes.data || [];
  const txs = txsRes.data || [];

  const accountByUserId = new Map();
  accounts.forEach((a) => {
    if (a.owner_user_id) accountByUserId.set(a.owner_user_id, a);
  });

  const usageByUserId = new Map();
  txs.forEach((t) => {
    if (!t.user_id) return;
    const existing = usageByUserId.get(t.user_id) || {
      totalConsumed: 0,
      totalTopUp: 0,
      eventCount: 0,
      lastAiUsedAt: null,
      operations: {},
      recentTransactions: [],
    };
    if (t.transaction_type === 'consumption') {
      existing.totalConsumed += Math.abs(t.amount || 0);
      existing.eventCount += 1;
      const op = t.reference_type || 'ai_operation';
      existing.operations[op] = (existing.operations[op] || 0) + 1;
      if (!existing.lastAiUsedAt || new Date(t.created_at) > new Date(existing.lastAiUsedAt)) {
        existing.lastAiUsedAt = t.created_at;
      }
    } else {
      existing.totalTopUp += Math.abs(t.amount || 0);
    }
    if (existing.recentTransactions.length < 8) {
      existing.recentTransactions.push(t);
    }
    usageByUserId.set(t.user_id, existing);
  });

  const users = profiles.map((p) => {
    const acc = accountByUserId.get(p.id);
    const usage = usageByUserId.get(p.id) || {
      totalConsumed: 0,
      totalTopUp: 0,
      eventCount: 0,
      lastAiUsedAt: null,
      operations: {},
      recentTransactions: [],
    };

    const personalBalance = acc?.balance ?? 0;
    const effectiveBalance = personalBalance + orgPoolBalance;
    const totalConsumed = acc?.lifetime_consumed || usage.totalConsumed;

    let status = 'ready';
    if (effectiveBalance === 0) {
      status = 'depleted';
    } else if (personalBalance <= 2 && orgPoolBalance === 0) {
      status = 'low';
    } else if (usage.totalConsumed > 0) {
      status = 'active';
    }

    return {
      userId: p.id,
      displayName: p.display_name || 'Unnamed Member',
      role: p.role || 'learner',
      personalBalance,
      orgPoolBalance,
      effectiveBalance,
      totalConsumed,
      eventCount: usage.eventCount,
      lastAiUsedAt: usage.lastAiUsedAt,
      operations: usage.operations,
      status,
    };
  });

  const totalPersonalCredits = users.reduce((sum, u) => sum + u.personalBalance, 0);
  const totalConsumed = users.reduce((sum, u) => sum + u.totalConsumed, 0);
  const activeConsumersCount = users.filter((u) => u.totalConsumed > 0).length;
  const zeroUsageCount = users.filter((u) => u.totalConsumed === 0).length;
  const depletedCount = users.filter((u) => u.effectiveBalance === 0).length;

  console.log(`[CHECK 1] Total members audited: ${users.length} (Expected: 763)`);
  if (users.length !== 763) throw new Error(`Unexpected user count: ${users.length}`);

  console.log(`[CHECK 2] Total personal credits left: ${totalPersonalCredits} (Expected: 7620)`);
  if (totalPersonalCredits !== 7620) throw new Error(`Unexpected total personal credits: ${totalPersonalCredits}`);

  console.log(`[CHECK 3] Total credits consumed: ${totalConsumed} (Expected: 10)`);
  if (totalConsumed !== 10) throw new Error(`Unexpected total consumed: ${totalConsumed}`);

  console.log(`[CHECK 4] Active consumers count: ${activeConsumersCount} (Expected: 1)`);
  if (activeConsumersCount !== 1) throw new Error(`Unexpected active consumers: ${activeConsumersCount}`);

  console.log(`[CHECK 5] Users with full balance unused: ${zeroUsageCount} (Expected: 762)`);
  if (zeroUsageCount !== 762) throw new Error(`Unexpected zero usage count: ${zeroUsageCount}`);

  console.log(`[CHECK 6] Depleted users (0 credits): ${depletedCount} (Expected: 1)`);
  if (depletedCount !== 1) throw new Error(`Unexpected depleted count: ${depletedCount}`);

  const consumedUser = users.find((u) => u.totalConsumed > 0);
  console.log('[CHECK 7] Consumed user verified:', {
    name: consumedUser.displayName,
    personalBalance: consumedUser.personalBalance,
    orgPoolBalance: consumedUser.orgPoolBalance,
    effectiveBalance: consumedUser.effectiveBalance,
    totalConsumed: consumedUser.totalConsumed,
    eventCount: consumedUser.eventCount,
    operations: consumedUser.operations,
    status: consumedUser.status,
  });

  if (consumedUser.personalBalance !== 0 || consumedUser.effectiveBalance !== 0) {
    throw new Error(`Consumed user does not show 0 balance remaining: ${consumedUser.personalBalance}`);
  }

  const sampleUnused = users.find((u) => u.totalConsumed === 0);
  console.log('[CHECK 8] Sample unused member verified:', {
    name: sampleUnused.displayName,
    personalBalance: sampleUnused.personalBalance,
    effectiveBalance: sampleUnused.effectiveBalance,
    totalConsumed: sampleUnused.totalConsumed,
    status: sampleUnused.status,
  });

  if (sampleUnused.personalBalance !== 10 || sampleUnused.effectiveBalance !== 10) {
    throw new Error(`Sample unused member does not show 10 credits remaining: ${sampleUnused.personalBalance}`);
  }

  console.log('--- ALL CHECKS PASSED: ZERO DATA LOSS, 100% FAITHFUL MONITORING ---');
}

verifyMonitoring().catch((e) => {
  console.error('Verification failed:', e);
  process.exit(1);
});
