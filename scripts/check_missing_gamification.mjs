process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function checkMissingGamification() {
  const { data: allProfiles } = await supabase.from('user_profiles').select('id, organization_id, display_name');
  const { data: allStats } = await supabase.from('user_gamification_stats').select('user_id');
  const statsSet = new Set((allStats || []).map(s => s.user_id));
  
  const missing = (allProfiles || []).filter(p => !statsSet.has(p.id));
  console.log(`Total profiles in DB: ${allProfiles?.length}`);
  console.log(`Total stats in DB: ${allStats?.length}`);
  console.log(`Profiles without gamification stats: ${missing.length}`);
  
  // Breakdown of missing by org
  const byOrg = {};
  missing.forEach(m => {
    byOrg[m.organization_id] = (byOrg[m.organization_id] || 0) + 1;
  });
  console.log('Missing by org ID:', byOrg);
}
checkMissingGamification();
