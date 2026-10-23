import React, { Suspense } from 'react';
import { CohortFixture } from './cohort-fixture.jsx';
import { LoadingFixture } from './loading-fixture.jsx';
import { createRoot } from 'react-dom/client';
import App from '../../src/App.jsx';
import ErrorBoundary from '../../src/components/common/ErrorBoundary.jsx';
import '../../src/index.css';
import { PLATFORM_OWNER_EMAILS } from '../../src/lib/roleRouting.js';
function choose(role) {
  localStorage.clear(); sessionStorage.clear();
  if(role!=='public') localStorage.setItem('trainai_active_session_v1',JSON.stringify({_demo:true,user:{id:'fixture-'+role,email:role==='owner'?PLATFORM_OWNER_EMAILS[0]:role+'@example.invalid',user_metadata:{display_name:'Fixture '+role,role:role==='owner'?'admin':role}}}));
  window.location.href='/';
}
const auditRole = new URLSearchParams(window.location.search).get('fixture_role');
if (['public','learner','mentor','admin','manager','owner'].includes(auditRole)) {
 localStorage.clear(); sessionStorage.clear();
 if(auditRole!=='public') localStorage.setItem('trainai_active_session_v1',JSON.stringify({_demo:true,user:{id:'fixture-'+auditRole,email:auditRole==='owner'?PLATFORM_OWNER_EMAILS[0]:auditRole+'@example.invalid',user_metadata:{display_name:'Fixture '+auditRole,role:auditRole==='owner'?'admin':auditRole}}}));
}
createRoot(document.getElementById('root')).render(<><nav aria-label="Local audit fixtures" style={{position:'sticky',top:0,zIndex:50000,display:'flex',flexWrap:'wrap',gap:8,padding:10,background:'#e8efff',fontSize:12}}><strong>Isolated local audit</strong>{['public','learner','mentor','admin','manager','owner'].map(role=><button key={role} onClick={()=>choose(role)}>{role} fixture</button>)}</nav><ErrorBoundary><Suspense fallback={<p>Loading...</p>}>{new URLSearchParams(location.search).has('fixture_cohort_test') ? <CohortFixture/> : new URLSearchParams(location.search).has('fixture_loading_test') ? <React.StrictMode><LoadingFixture /></React.StrictMode> : <App/>}</Suspense></ErrorBoundary></>);
