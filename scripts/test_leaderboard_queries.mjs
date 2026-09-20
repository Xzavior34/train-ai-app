process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const url = 'https://jeobggrtxeybxvlwpxvn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y';
const supabase = createClient(url, key);

async function testLeaderboardQueries() {
  const orgs = [
    { name: 'Sara Foundation Africa', id: '58ebdb4d-8209-4e08-9ab3-8c5eee87b278' },
    { name: 'Digital Training Org', id: 'bd1b4b0c-abdc-4175-87f8-878a3e22fe4b' },
    { name: 'Demo Academy', id: 'd0000000-0000-0000-0000-000000000001' }
  ];

  for (const org of orgs) {
    console.log(`\nTesting org: ${org.name} (${org.id})`);
    
    // 1. RPC test
    const rpcRes = await supabase.rpc('get_leaderboard_with_profiles', {
      p_limit: 10,
      p_org_id: org.id
    });
    console.log('  RPC Error:', rpcRes.error);
    console.log('  RPC count:', rpcRes.data?.length);
    if (rpcRes.data?.length > 0) {
      console.log('  Sample RPC row:', rpcRes.data[0]);
    }

    // 2. Direct query test
    const dirRes = await supabase
      .from('user_gamification_stats')
      .select('user_id, total_points, streak_days, current_level, lessons_completed, courses_completed, user_profiles!inner(id, display_name, avatar_url, role, organization_id)')
      .eq('user_profiles.organization_id', org.id)
      .order('total_points', { ascending: false })
      .limit(10);
    console.log('  Direct Error:', dirRes.error);
    console.log('  Direct count:', dirRes.data?.length);
    if (dirRes.data?.length > 0) {
      console.log('  Sample direct row:', dirRes.data[0]);
    }
  }
}
testLeaderboardQueries();
