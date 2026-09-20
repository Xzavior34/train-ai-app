process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function auditCreditAccountsAllOrgs() {
  const { data: orgs } = await supabase.from('organizations').select('id, name, slug');
  console.log('Auditing AI credit accounts across all orgs:');
  for (const org of orgs) {
    const { data: profiles } = await supabase.from('user_profiles').select('id').eq('organization_id', org.id);
    const profIds = (profiles || []).map(p => p.id);
    
    // Org account
    const { data: orgAcc } = await supabase.from('ai_credit_accounts').select('id, balance').eq('organization_id', org.id).eq('account_type', 'organization').maybeSingle();
    
    // Learner accounts
    const { data: learnerAccs } = await supabase.from('ai_credit_accounts').select('id, owner_user_id, balance').eq('organization_id', org.id).eq('account_type', 'learner');
    
    console.log(`Org: ${org.name} (${org.id})`);
    console.log(`  Profiles: ${profIds.length}`);
    console.log(`  Org Pool Account: ${orgAcc ? `Exists (Balance: ${orgAcc.balance})` : 'MISSING'}`);
    console.log(`  Learner Accounts: ${learnerAccs?.length || 0} / ${profIds.length}`);
  }
}
auditCreditAccountsAllOrgs();
