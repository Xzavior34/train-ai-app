process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry(fn, maxRetries = 5, delay = 500) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await sleep(delay * (i + 1));
    }
  }
  throw lastErr;
}

async function runOverhaul() {
  console.log('=== STARTING 10X CREDIT AND PRICING OVERHAUL ===');

  // 1. Update AI Operation Costs
  console.log('\n1. Updating AI Operation Costs...');
  const opCosts = [
    { operation_key: 'ai_chat_message', credit_cost: 10, label: 'AI Coach message (1 question)' },
    { operation_key: 'ai_insight', credit_cost: 10, label: 'AI insight telemetry' },
    { operation_key: 'ai_recommendation', credit_cost: 10, label: 'AI recommendation analysis' },
    { operation_key: 'quiz_generation', credit_cost: 20, label: 'AI-generated interactive quiz' },
  ];

  for (const op of opCosts) {
    await retry(async () => {
      const { error } = await supabase.from('ai_operation_costs').upsert(op);
      if (error) throw error;
    });
    console.log(`✓ ${op.operation_key} -> ${op.credit_cost} credits`);
  }

  // 2. Update Billing Prices
  console.log('\n2. Updating Billing Prices...');
  await retry(async () => {
    await supabase.from('billing_prices').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  });

  const newPrices = [
    // Basic Tier (Starter category: 250,000 NGN / $250 USD / £190 GBP / €220 EUR)
    { category: 'org_subscription_starter', currency: 'NGN', unit_amount_minor: 25000000, is_active: true },
    { category: 'org_subscription_starter', currency: 'USD', unit_amount_minor: 25000, is_active: true },
    { category: 'org_subscription_starter', currency: 'GBP', unit_amount_minor: 19000, is_active: true },
    { category: 'org_subscription_starter', currency: 'EUR', unit_amount_minor: 22000, is_active: true },

    // Intermediate Tier (Growth category: 500,000 NGN / $500 USD / £400 GBP / €440 EUR)
    { category: 'org_subscription_growth', currency: 'NGN', unit_amount_minor: 50000000, is_active: true },
    { category: 'org_subscription_growth', currency: 'USD', unit_amount_minor: 50000, is_active: true },
    { category: 'org_subscription_growth', currency: 'GBP', unit_amount_minor: 40000, is_active: true },
    { category: 'org_subscription_growth', currency: 'EUR', unit_amount_minor: 44000, is_active: true },

    // Additional Seat Subscriptions (Default: 15k NGN, $15 USD, £12 GBP, €14 EUR)
    { category: 'seat_subscription', currency: 'NGN', unit_amount_minor: 1500000, is_active: true },
    { category: 'seat_subscription', currency: 'USD', unit_amount_minor: 1500, is_active: true },
    { category: 'seat_subscription', currency: 'GBP', unit_amount_minor: 1200, is_active: true },
    { category: 'seat_subscription', currency: 'EUR', unit_amount_minor: 1400, is_active: true },
  ];

  await retry(async () => {
    const { data: insertedPrices, error: priceErr } = await supabase.from('billing_prices').insert(newPrices).select();
    if (priceErr) throw priceErr;
    console.log(`✓ Inserted ${insertedPrices?.length} active pricing tiers.`);
  });

  // 3. Scale AI Credit Accounts by 10x
  console.log('\n3. Scaling AI Credit Accounts by 10x...');
  const { data: accounts, error: accErr } = await supabase.from('ai_credit_accounts').select('*');
  if (accErr) {
    console.error('Error fetching accounts:', accErr);
  } else {
    let scaledCount = 0;
    let alreadyScaledCount = 0;
    for (const acc of accounts) {
      if (acc.lifetime_credited <= 50) {
        const newBal = acc.balance * 10;
        const newCred = acc.lifetime_credited * 10;
        const newCons = acc.lifetime_consumed * 10;
        try {
          await retry(async () => {
            const { error: updErr } = await supabase
              .from('ai_credit_accounts')
              .update({
                balance: newBal,
                lifetime_credited: newCred,
                lifetime_consumed: newCons,
                updated_at: new Date().toISOString(),
              })
              .eq('id', acc.id);
            if (updErr) throw updErr;
          });
          scaledCount++;
          await sleep(50);
        } catch (err) {
          console.error(`Failed to update account ${acc.id}:`, err?.message || err);
        }
      } else {
        alreadyScaledCount++;
      }
    }
    console.log(`✓ Scaled ${scaledCount} accounts by 10x. (${alreadyScaledCount} accounts already at 10x scale).`);
  }

  // 4. Scale AI Credit Transactions by 10x
  console.log('\n4. Scaling AI Credit Transactions by 10x...');
  const { data: txs, error: txErr } = await supabase.from('ai_credit_transactions').select('*');
  if (txErr) {
    console.error('Error fetching transactions:', txErr);
  } else {
    let scaledTxCount = 0;
    let skippedTxCount = 0;
    for (const tx of txs) {
      if (Math.abs(tx.amount) <= 50) {
        const newAmount = tx.amount * 10;
        const newBefore = (tx.balance_before || 0) * 10;
        const newAfter = (tx.balance_after || 0) * 10;
        try {
          await retry(async () => {
            const { error: updErr } = await supabase
              .from('ai_credit_transactions')
              .update({
                amount: newAmount,
                balance_before: newBefore,
                balance_after: newAfter,
              })
              .eq('id', tx.id);
            if (updErr) throw updErr;
          });
          scaledTxCount++;
          await sleep(50);
        } catch (err) {
          console.error(`Failed to update tx ${tx.id}:`, err?.message || err);
        }
      } else {
        skippedTxCount++;
      }
    }
    console.log(`✓ Scaled ${scaledTxCount} ledger transactions by 10x. (${skippedTxCount} already at 10x scale).`);
  }

  console.log('\n=== OVERHAUL COMPLETED SUCCESSFULLY ===');
}

runOverhaul().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
