process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function initMissingGamification() {
  const { data: allProfiles } = await supabase.from('user_profiles').select('id, organization_id, display_name');
  const { data: allStats } = await supabase.from('user_gamification_stats').select('user_id');
  const statsSet = new Set((allStats || []).map(s => s.user_id));
  
  const missing = (allProfiles || []).filter(p => !statsSet.has(p.id));
  console.log(`Inserting gamification stats for ${missing.length} profiles across all orgs...`);

  const rowsToInsert = missing.map(p => ({
    user_id: p.id,
    total_points: 0,
    current_level: 1,
    lessons_completed: 0,
    courses_completed: 0,
    sessions_completed: 0,
    streak_days: 1,
    streak_freezes_available: 1
  }));

  // Batch insert in chunks of 50
  for (let i = 0; i < rowsToInsert.length; i += 50) {
    const chunk = rowsToInsert.slice(i, i + 50);
    const { error } = await supabase.from('user_gamification_stats').insert(chunk);
    if (error) {
      console.error('Error inserting chunk:', error);
    } else {
      console.log(`Inserted chunk ${i} to ${i + chunk.length}`);
    }
  }

  const { count: finalCount } = await supabase.from('user_gamification_stats').select('user_id', { count: 'exact', head: true });
  console.log(`Final total stats in DB: ${finalCount}`);
}

initMissingGamification();
