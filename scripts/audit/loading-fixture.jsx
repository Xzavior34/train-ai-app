import React, { useState } from 'react';
import { PageLoadingBoundary, LoadingSkeleton } from '../../src/components/common/PageLoadingBoundary.jsx';
import { useSupabaseQuery } from '../../src/lib/useSupabaseQuery.js';

function QueryFixture({ fail }) {
  const first = useSupabaseQuery(async () => { await new Promise(resolve => setTimeout(resolve, 450)); return 'first'; }, []);
  const second = useSupabaseQuery(async () => { await new Promise(resolve => setTimeout(resolve, 950)); if (fail) throw Error('Fixture query failed'); return 'second'; }, [fail]);
  return <div className="ta-content">
    <input aria-label="Draft kept during refresh" defaultValue="Keep my draft" />
    <button onClick={second.refetch}>Refresh fixture feature</button>
    <div>{first.data}</div>
    {second.loading ? <LoadingSkeleton label="Loading fixture feature" /> : second.error ? <div role="alert">{second.error}</div> : <div>Both fixture requests completed</div>}
  </div>;
}
export function LoadingFixture() {
  const [mode, setMode] = useState('success');
  return <div className="ta">
    <button onClick={() => setMode('failure')}>Fixture failure page</button>
    <button onClick={() => setMode('success')}>Fixture success page</button>
    <PageLoadingBoundary key={mode} screen="dashboard"><QueryFixture fail={mode === 'failure'} /></PageLoadingBoundary>
  </div>;
}
