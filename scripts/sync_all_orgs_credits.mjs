process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function syncAllOrgsCredits() {
  console.log('=== SYNCING ALL ORGANIZATIONS FOR AI CREDITS ===');
  
  // 1. Fetch all organizations
  const { data: orgs } = await supabase.from('organizations').select('id, name, slug');
  console.log(`Found ${orgs?.length} organizations.`);

  for (const org of orgs) {
    // Ensure Org Pool Account exists
    const { data: existingOrgAcc } = await supabase
      .from('ai_credit_accounts')
      .select('id, balance')
      .eq('organization_id', org.id)
      .eq('account_type', 'organization')
      .maybeSingle();

    if (!existingOrgAcc) {
      console.log(`Creating org pool account for ${org.name}...`);
      const { error: orgAccErr } = await supabase.from('ai_credit_accounts').insert({
        organization_id: org.id,
        account_type: 'organization',
        balance: 0,
        lifetime_credited: 0,
        lifetime_consumed: 0,
      });
      if (orgAccErr) console.error(`Error creating org pool account for ${org.name}:`, orgAccErr);
      else console.log(`Created org pool account for ${org.name}.`);
    }

    // Fetch all profiles for this org
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .eq('organization_id', org.id);

    console.log(`Org ${org.name}: ${profiles?.length || 0} member profiles.`);

    for (const p of (profiles || [])) {
      // Check learner account
      const { data: existingLearnerAcc } = await supabase
        .from('ai_credit_accounts')
        .select('id, balance, lifetime_credited')
        .eq('owner_user_id', p.id)
        .eq('account_type', 'learner')
        .maybeSingle();

      if (!existingLearnerAcc) {
        // Create account with 10 initial credits
        console.log(`Granting 10 initial credits to ${p.display_name} (${p.id}) in ${org.name}...`);
        const { data: newAcc, error: createErr } = await supabase
          .from('ai_credit_accounts')
          .insert({
            organization_id: org.id,
            owner_user_id: p.id,
            account_type: 'learner',
            balance: 10,
            lifetime_credited: 10,
            lifetime_consumed: 0,
          })
          .select('id')
          .single();

        if (createErr) {
          console.error(`Error creating account for ${p.display_name}:`, createErr);
        } else if (newAcc) {
          // Insert initial grant transaction
          await supabase.from('ai_credit_transactions').insert({
            organization_id: org.id,
            account_id: newAcc.id,
            user_id: p.id,
            transaction_type: 'top_up',
            amount: 10,
            balance_before: 0,
            balance_after: 10,
            reference_type: 'initial_org_grant',
            reference_id: 'initial_10_credits',
            metadata: { reason: `Initial 10 credits grant for ${org.name}` },
          });
        }
      } else if (existingLearnerAcc.balance < 10 && existingLearnerAcc.lifetime_credited === 0) {
        // Top up uncredited existing account to 10
        console.log(`Topping up uncredited account for ${p.display_name} to 10...`);
        await supabase
          .from('ai_credit_accounts')
          .update({ balance: 10, lifetime_credited: 10 })
          .eq('id', existingLearnerAcc.id);

        await supabase.from('ai_credit_transactions').insert({
          organization_id: org.id,
          account_id: existingLearnerAcc.id,
          user_id: p.id,
          transaction_type: 'top_up',
          amount: 10,
          balance_before: existingLearnerAcc.balance,
          balance_after: 10,
          reference_type: 'initial_org_grant',
          reference_id: 'initial_10_credits',
          metadata: { reason: `Initial 10 credits grant for ${org.name}` },
        });
      }
    }
  }

  console.log('=== SYNC COMPLETED SUCCESSFULLY ===');
}

syncAllOrgsCredits();
