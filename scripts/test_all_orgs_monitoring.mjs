process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function testAllOrgsMonitoring() {
  const orgs = [
    { name: 'Sara Foundation Africa', id: '58ebdb4d-8209-4e08-9ab3-8c5eee87b278' },
    { name: 'Digital Training Org', id: 'bd1b4b0c-abdc-4175-87f8-878a3e22fe4b' },
    { name: 'Demo Academy', id: 'd0000000-0000-0000-0000-000000000001' }
  ];

  for (const org of orgs) {
    console.log(`\n=== Testing AI Credit Monitoring for ${org.name} ===`);
    
    // 1. Fetch
    const [summaryRes, profilesRes, accountsRes, txsRes] = await Promise.all([
      supabase.from("ai_credit_accounts").select("balance, lifetime_credited, lifetime_consumed").eq("organization_id", org.id).eq("account_type", "organization").maybeSingle(),
      supabase.from("user_profiles").select("id, display_name, role, last_active_at, department").eq("organization_id", org.id).order("display_name", { ascending: true }),
      supabase.from("ai_credit_accounts").select("id, owner_user_id, balance, lifetime_credited, lifetime_consumed, account_type").eq("organization_id", org.id),
      supabase.from("ai_credit_transactions").select("id, user_id, amount, transaction_type, reference_type, created_at, balance_after").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(2000),
    ]);

    const orgPoolBalance = summaryRes.data?.balance || 0;
    const profiles = profilesRes.data || [];
    const accounts = accountsRes.data || [];

    const accountByUserId = new Map();
    for (const a of accounts) {
      if (a.owner_user_id) accountByUserId.set(a.owner_user_id, a);
    }

    const missingMemberIds = profiles.map((p) => p.id).filter((id) => !accountByUserId.has(id));
    if (missingMemberIds.length > 0) {
      const { data: extraAccounts } = await supabase
        .from("ai_credit_accounts")
        .select("id, owner_user_id, balance, lifetime_credited, lifetime_consumed, account_type")
        .in("owner_user_id", missingMemberIds);
      for (const a of extraAccounts || []) {
        if (a.owner_user_id) accountByUserId.set(a.owner_user_id, a);
      }
    }

    const matchedUsers = profiles.map(p => {
      const acc = accountByUserId.get(p.id);
      return {
        name: p.display_name,
        role: p.role,
        personalBalance: acc?.balance ?? 0,
        hasAccount: !!acc
      };
    });

    console.log(`  Profiles Count: ${profiles.length}`);
    console.log(`  Org Pool Balance: ${orgPoolBalance}`);
    console.log(`  Matched Accounts: ${matchedUsers.filter(u => u.hasAccount).length} / ${profiles.length}`);
    console.log(`  All users have >= 10 personal credits?`, matchedUsers.every(u => u.personalBalance >= 10 || u.name === 'Sara Foundation'));
    console.log(`  Sample members:`, matchedUsers.slice(0, 3));
  }
}

testAllOrgsMonitoring();
