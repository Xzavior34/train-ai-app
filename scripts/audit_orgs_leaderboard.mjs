process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function testLeaderboards() {
  const { data: orgs } = await supabase.from('organizations').select('id, name, slug');
  console.log('Testing leaderboards for all orgs:');
  for (const org of orgs) {
    const { data: profiles } = await supabase.from('user_profiles').select('id').eq('organization_id', org.id);
    const profIds = (profiles || []).map(p => p.id);
    let gamCount = 0;
    if (profIds.length > 0) {
      const { count } = await supabase.from('user_gamification_stats').select('user_id', { count: 'exact', head: true }).in('user_id', profIds);
      gamCount = count || 0;
    }
    console.log(`Org: ${org.name} (${org.id}) -> Profiles: ${profIds.length}, Gamification Stats: ${gamCount}`);
  }
}
testLeaderboards();
