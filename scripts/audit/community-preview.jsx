import React from 'react';
import {createRoot} from 'react-dom/client';
import {CommunityScreen} from '/src/learner/screens/CommunityScreen.jsx';
import {TOKENS} from '/src/learner/components/LearnerUI.jsx';
window.__auditNavigation=[];
window.__auditErrors=[];
window.addEventListener('error',event=>window.__auditErrors.push(event.message));
const entries=Array.from({length:6},(_,i)=>i+1);
const query=data=>({data,loading:false,refetch:()=>{}});
createRoot(document.getElementById('root')).render(<div className="tai" style={{padding:16,maxWidth:1200,margin:'auto'}}><style>{TOKENS}</style><CommunityScreen
 session={{user:{id:'fixture-learner'}}} user={{name:'Fixture learner'}}
 push={(screen,params)=>{window.__auditNavigation.push({screen,params});document.getElementById("audit-navigation").textContent="Navigation: "+screen;}} showToast={()=>{}}
 postsQuery={query(entries.map(i=>({id:'post-'+i,content:'Fixture discussion '+i+'\nA local regression preview with no production data.',user_id:'author-'+i,created_at:'2026-10-20T08:00:00Z',authorName:'Fixture author '+i})))}
 studyGroupsQuery={query(entries.map(i=>({id:'group-'+i,name:'Fixture study group '+i,description:'Local study group preview',memberCount:i})))}
 myGroupIdsQuery={query([])} mentorsList={entries.map(i=>({id:'mentor-'+i,name:'Fixture mentor '+i,display_name:'Fixture mentor '+i,title:'Learning mentor',specializations:['AI']}))}
 leaderboardQuery={query(entries.map(i=>({user_id:'rank-'+i,display_name:'Fixture contributor '+i,total_points:100-i,rank:i})))}
 gamificationStatsQuery={query({total_points:0,current_level:1})} myCommunityStatsQuery={query({totalPosts:0,totalComments:0,score:0})}
 /></div>);
