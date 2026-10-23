import React, { useState } from 'react';
import { CohortScreen } from '../../src/learner/screens/CohortScreen.jsx';
import { TOKENS } from '../../src/learner/components/LearnerUI.jsx';

const cap = { id: 'cap-fixture', name: 'CAP Cohort 3', starts_at: '2026-10-10', ends_at: '2026-11-20' };
const flip = { id: 'flip-fixture', name: 'FLIP Fellow C2', description: 'Leadership and digital skills', starts_at: '2025-08-01', ends_at: '2026-10-31' };
export function CohortFixture() {
  const [selected, setSelected] = useState(cap.id);
  const [retried, setRetried] = useState(false);
  const mode = new URLSearchParams(location.search).get('cohort_mode');
  const query = data => ({ data, loading: false, refetch() {} });
  const membership = { ...query(mode === 'empty' || mode === 'error' || mode === 'loading' ? null : { cohort: cap, allCohorts: [cap, flip], allMemberships: [] }), loading: mode === 'loading', error: mode === 'error' && !retried ? 'Could not load your cohort assignments. Please retry.' : null, refetch: () => setRetried(true) };
  return <main className="tai" style={{ padding: 14, minHeight: '100vh' }}>
    <style>{TOKENS}</style>
    <CohortScreen cohort={membership.data?.cohort} cohortMembershipQuery={membership}
      params={membership.data ? { cohortId: selected } : {}} push={(_, params) => setSelected(params.cohortId)}
      cohortPostsQuery={query([{ id: selected + '-post', content: selected === cap.id ? 'Welcome to CAP Cohort 3' : 'Welcome to FLIP', created_at: '2026-10-22', user_profiles: { display_name: 'Instructor' } }])}
      cohortCoursesQuery={query([])} cohortResourcesQuery={query([])} cohortSessionsQuery={query([])} cohortMembersQuery={query([])}
      courses={[{ id: 'unrelated', title: 'Unrelated enrolled course', enrolled: true }]}
      user={{ role: 'learner' }} session={{ user: { id: 'learner', email: 'admin-name@example.invalid' } }} />
  </main>;
}
