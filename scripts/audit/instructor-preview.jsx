import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { InstructorCohortsScreen } from '../../src/platform/mentor/InstructorCohortsScreen.jsx';
import { MemberLearningTrack } from '../../src/platform/components/MemberLearningTrack.jsx';
import { TOKENS, ToastContext } from '../../src/platform/components/PlatformUI.jsx';
function Preview() {
  const [cohortId, setCohortId] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [toast, setToast] = useState('');
  return <div className="ta"><style>{TOKENS}{'.ta-input{max-width:100%;box-sizing:border-box;width:100%} label{display:block} .ta-row{flex-wrap:wrap} body{margin:0} .ta{min-height:100vh}'}</style>
    <ToastContext.Provider value={setToast}><div style={{ padding: 16 }}><strong>Local test fixture</strong> <button onClick={() => setAdmin(!admin)}>{admin ? 'Show instructor' : 'Show admin track'}</button> <span role="status">{toast}</span></div>
      {admin ? <main className="ta-content"><h1>Alex Learner — individual record</h1><MemberLearningTrack orgId="fixture-org" userId="fixture-learner" /></main> : <InstructorCohortsScreen key={cohortId || 'list'} currentUserId="fixture-teacher" cohortId={cohortId} onOpenCohort={setCohortId} onBack={() => setCohortId(null)} />}
    </ToastContext.Provider></div>;
}
createRoot(document.getElementById('root')).render(<Preview />);
