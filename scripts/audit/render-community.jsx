import React from 'react';
import {renderToString} from 'react-dom/server';
import {CommunityScreen} from '../../src/learner/screens/CommunityScreen.jsx';
const entries=Array.from({length:6},(_,i)=>i+1);
const query=data=>({data,loading:false,refetch:()=>{}});
const html=renderToString(<CommunityScreen session={{user:{id:'fixture-learner'}}} user={{name:'Fixture learner'}} push={()=>{}}
 postsQuery={query(entries.map(i=>({id:'post-'+i,content:'Fixture discussion '+i+'\nPreview text',user_id:'author-'+i,created_at:'2026-10-20T08:00:00Z'})))}
 studyGroupsQuery={query(entries.map(i=>({id:'group-'+i,name:'Fixture study group '+i,description:'Local preview'})))} myGroupIdsQuery={query([])}
 mentorsList={entries.map(i=>({id:'mentor-'+i,name:'Fixture mentor '+i,display_name:'Fixture mentor '+i,title:'Learning mentor'}))}
 leaderboardQuery={query(entries.map(i=>({user_id:'rank-'+i,display_name:'Fixture contributor '+i,total_points:100-i})))}
 />);
if(!html.includes('Fixture study group 2')||html.includes('Fixture study group 3')) throw new Error('Study-group preview limit failed');
if(!html.includes('Fixture mentor 2')||html.includes('Fixture mentor 3')) throw new Error('Mentor preview limit failed');
if(!html.includes('Fixture contributor 3')||html.includes('Fixture contributor 4')) throw new Error('Leaderboard preview limit failed');
if(!html.includes('Fixture discussion 2')||html.includes('Fixture discussion 3')) throw new Error('Discussion preview limit failed');
if(!html.includes('View All')||!html.includes('Full')) throw new Error('Full-list navigation missing');
console.log('PASS Community server render: two discussions, two groups, two mentors, three leaderboard entries, full-list controls.');

const empty=renderToString(<CommunityScreen postsQuery={query([])} studyGroupsQuery={query([])} />);
if(!empty.includes('No discussions yet') || !empty.includes('No study groups are available yet')) throw new Error('Community empty states missing');
const error=renderToString(<CommunityScreen postsQuery={{error:'Fixture unavailable'}} />);
if(!error.includes('role="alert"') || !error.includes('could not be loaded')) throw new Error('Community error state missing');
console.log('PASS Community empty and error states.');
