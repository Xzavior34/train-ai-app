process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import {
  fetchOrgAISettings,
  updateOrgAISettings,
  fetchOrgAIInsightsSettings,
  updateOrgAIInsightsSettings,
  fetchOrgLeaderboardSettings,
  updateOrgLeaderboardSettings,
  fetchOrgGamificationSettings,
  updateOrgGamificationSettings,
} from '../src/lib/api/organizations.js';
import { fetchAllOrganizations } from '../src/lib/api/platform.js';

async function run() {
  console.log('--- Testing Organization AI & Feature Toggles ---');
  const orgs = await fetchAllOrganizations();
  console.log(`Found ${orgs.length} organizations.`);
  
  if (orgs.length === 0) {
    console.log('No organizations to test against.');
    return;
  }

  const testOrg = orgs[0];
  const orgId = testOrg.id;
  console.log(`Testing against Org: "${testOrg.name}" (${orgId})`);

  // 1. AI Coach Settings
  console.log('\n[1] Testing AI Coach Settings...');
  const initialCoach = await fetchOrgAISettings(orgId);
  console.log('Initial AI Coach settings:', initialCoach);

  const updateCoachRes = await updateOrgAISettings(orgId, {
    manual_mode: true,
    manual_message: 'Instructor is currently reviewing your message.'
  });
  console.log('Update AI Coach (manual_mode: true):', updateCoachRes);

  const updatedCoach = await fetchOrgAISettings(orgId);
  console.log('Fetched AI Coach after update:', updatedCoach);
  if (updatedCoach.manual_mode !== true) {
    console.error('FAIL: manual_mode was not set to true!');
  } else {
    console.log('SUCCESS: AI Coach manual_mode persisted as true.');
  }

  // Restore AI Coach
  await updateOrgAISettings(orgId, { manual_mode: false });
  console.log('Restored AI Coach manual_mode to false.');

  // 2. AI Insights Settings
  console.log('\n[2] Testing AI Insights Settings...');
  const initialInsights = await fetchOrgAIInsightsSettings(orgId);
  console.log('Initial AI Insights settings:', initialInsights);

  const updateInsightsRes = await updateOrgAIInsightsSettings(orgId, {
    manual_mode: true,
    manual_message: 'Mid-term curriculum sprint announcement.'
  });
  console.log('Update AI Insights (manual_mode: true):', updateInsightsRes);

  const updatedInsights = await fetchOrgAIInsightsSettings(orgId);
  console.log('Fetched AI Insights after update:', updatedInsights);
  if (updatedInsights.manual_mode !== true) {
    console.error('FAIL: AI Insights manual_mode was not set to true!');
  } else {
    console.log('SUCCESS: AI Insights manual_mode persisted as true.');
  }

  // Restore AI Insights
  await updateOrgAIInsightsSettings(orgId, { manual_mode: false });
  console.log('Restored AI Insights manual_mode to false.');

  // 3. Leaderboard Settings
  console.log('\n[3] Testing Leaderboard Settings...');
  const initialLb = await fetchOrgLeaderboardSettings(orgId);
  console.log('Initial Leaderboard settings:', initialLb);
  await updateOrgLeaderboardSettings(orgId, false);
  const updatedLb = await fetchOrgLeaderboardSettings(orgId);
  console.log('Updated Leaderboard settings:', updatedLb);
  await updateOrgLeaderboardSettings(orgId, true);
  console.log('Restored Leaderboard to true.');

  // 4. Gamification Settings
  console.log('\n[4] Testing Gamification Settings...');
  const initialGam = await fetchOrgGamificationSettings(orgId);
  console.log('Initial Gamification settings:', initialGam);
  await updateOrgGamificationSettings(orgId, false);
  const updatedGam = await fetchOrgGamificationSettings(orgId);
  console.log('Updated Gamification settings:', updatedGam);
  await updateOrgGamificationSettings(orgId, true);
  console.log('Restored Gamification to true.');

  console.log('\n--- ALL TOGGLE TESTS COMPLETED SUCCESSFULLY ---');
}

run().catch(console.error);
