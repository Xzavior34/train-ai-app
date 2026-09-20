process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function findStatsOrgs() {
  const { data: stats } = await supabase.from('user_gamification_stats').select('user_id, total_points').limit(20);
  console.log('Sample 5 stats user_ids:', stats?.slice(0, 5));
  const userIds = stats.map(s => s.user_id);
  const { data: profs } = await supabase.from('user_profiles').select('id, display_name, organization_id').in('id', userIds);
  console.log('Matching profiles with organization_id:');
  for (const p of profs) {
    const { data: org } = await supabase.from('organizations').select('id, name, slug').eq('id', p.organization_id).single();
    console.log(`User ${p.display_name} -> org: ${org?.name} (${org?.id})`);
  }
}
findStatsOrgs();
