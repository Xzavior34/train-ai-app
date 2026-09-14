import { createClient } from "@supabase/supabase-js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SUPABASE_URL = "https://jeobggrtxeybxvlwpxvn.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implb2JnZ3J0eGV5Ynh2bHdweHZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMyNjM1NywiZXhwIjoyMTAyOTAyMzU3fQ.uDCs11c1ti9xGopgIcrVAGALgvjrhYSLMZyu5A_F-_Y";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("==========================================================");
  console.log(" STEP 1 — IDENTIFY AND REMOVE FAKE DEMO COMMUNITY ROWS");
  console.log("==========================================================");

  // 1. Find demo org ID
  const { data: demoOrgs } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .or("slug.eq.demo-academy-sample,name.ilike.%demo academy%");

  const demoOrgIds = new Set((demoOrgs || []).map(o => o.id));
  demoOrgIds.add("d0000000-0000-0000-0000-000000000001");

  console.log("Demo Organization IDs:", Array.from(demoOrgIds));

  // 2. Find demo user IDs
  const { data: demoProfiles } = await supabase
    .from("user_profiles")
    .select("id, display_name, email, role, organization_id");

  const demoUserIds = new Set();
  (demoProfiles || []).forEach(p => {
    const email = (p.email || "").toLowerCase();
    const id = p.id || "";
    if (
      demoOrgIds.has(p.organization_id) ||
      email.endsWith("@demoacademy.sample") ||
      email.includes("demoacademy") ||
      email.endsWith("@sample") ||
      email.endsWith(".sample") ||
      id.startsWith("d0000000-")
    ) {
      demoUserIds.add(id);
    }
  });

  // Explicitly add known demo user UUIDs from seed-demo-data.mjs
  for (let i = 1; i <= 20; i++) {
    const hex = i.toString(16).padStart(12, '0');
    demoUserIds.add(`d0000000-0000-0000-0000-${hex}`);
  }

  console.log(`Identified ${demoUserIds.size} potential demo user IDs.`);

  // 3. Find demo posts to remove
  // Target posts created by demo users OR matching the 5 seeded titles/contents
  const SEEDED_TITLES = [
    "First ML Project Complete!",
    "Need help with BERT fine-tuning",
    "Start Simple: ML Best Practice",
    "Speaking at AI Conference",
    "Best AI Research Resources?"
  ];

  const { data: allPosts } = await supabase.from("community_posts").select("*");
  const postsToDelete = (allPosts || []).filter(p => {
    if (demoUserIds.has(p.user_id)) return true;
    const content = p.content || "";
    return SEEDED_TITLES.some(t => content.includes(t));
  });

  const postIdsToDelete = postsToDelete.map(p => p.id);
  console.log(`Found ${postIdsToDelete.length} community posts to remove.`);

  // 4. Delete post_comments on target posts or from demo users
  let removedCommentsCount = 0;
  if (postIdsToDelete.length > 0) {
    const { data: comments, error } = await supabase
      .from("post_comments")
      .delete()
      .in("post_id", postIdsToDelete)
      .select();
    removedCommentsCount = comments?.length || 0;
  }
  // Also clean comments by demo users
  const { data: demoComments } = await supabase
    .from("post_comments")
    .delete()
    .in("user_id", Array.from(demoUserIds))
    .select();
  removedCommentsCount += (demoComments?.length || 0);

  // 5. Delete post_reactions on target posts or from demo users
  let removedReactionsCount = 0;
  if (postIdsToDelete.length > 0) {
    const { data: reactions } = await supabase
      .from("post_reactions")
      .delete()
      .in("post_id", postIdsToDelete)
      .select();
    removedReactionsCount = reactions?.length || 0;
  }
  const { data: demoReactions } = await supabase
    .from("post_reactions")
    .delete()
    .in("user_id", Array.from(demoUserIds))
    .select();
  removedReactionsCount += (demoReactions?.length || 0);

  // 6. Delete community_activity_feed rows for demo users
  const { data: feedDel } = await supabase
    .from("community_activity_feed")
    .delete()
    .in("user_id", Array.from(demoUserIds))
    .select();
  const removedFeedCount = feedDel?.length || 0;

  // 7. Delete community_posts
  let removedPostsCount = 0;
  if (postIdsToDelete.length > 0) {
    const { data: postsDel } = await supabase
      .from("community_posts")
      .delete()
      .in("id", postIdsToDelete)
      .select();
    removedPostsCount = postsDel?.length || 0;
  }

  // 8. Find and delete study_groups
  const SEEDED_GROUPS = [
    "JavaScript Fundamentals Study Group",
    "Machine Learning Book Club",
    "React Projects Collaboration",
    "Data Science Career Prep",
    "Python Coding Challenges",
    "AI/ML Fundamentals Study Group",
    "Deep Learning Researchers",
    "Python for Data Science",
    "Computer Vision Projects",
    "NLP & Text Analytics",
    "AI Fundamentals Study Circle"
  ];

  const { data: allGroups } = await supabase.from("study_groups").select("*");
  const groupsToDelete = (allGroups || []).filter(g => {
    if (demoUserIds.has(g.created_by)) return true;
    if (demoOrgIds.has(g.organization_id)) return true;
    return SEEDED_GROUPS.includes(g.name);
  });

  const groupIdsToDelete = groupsToDelete.map(g => g.id);
  console.log(`Found ${groupIdsToDelete.length} study groups to remove.`);

  // Delete study_group_members
  let removedGroupMembersCount = 0;
  if (groupIdsToDelete.length > 0) {
    const { data: sgmDel } = await supabase
      .from("study_group_members")
      .delete()
      .in("group_id", groupIdsToDelete)
      .select();
    removedGroupMembersCount = sgmDel?.length || 0;
  }
  const { data: demoSgm } = await supabase
    .from("study_group_members")
    .delete()
    .in("user_id", Array.from(demoUserIds))
    .select();
  removedGroupMembersCount += (demoSgm?.length || 0);

  // Delete study_groups
  let removedGroupsCount = 0;
  if (groupIdsToDelete.length > 0) {
    const { data: sgDel } = await supabase
      .from("study_groups")
      .delete()
      .in("id", groupIdsToDelete)
      .select();
    removedGroupsCount = sgDel?.length || 0;
  }

  // 9. Delete mentors rows created for demo users
  const { data: demoMentors } = await supabase
    .from("mentors")
    .delete()
    .or(`organization_id.eq.d0000000-0000-0000-0000-000000000001,user_id.in.(${Array.from(demoUserIds).join(",")})`)
    .select();

  const removedMentorsCount = demoMentors?.length || 0;

  console.log("\n--- STEP 1 REMOVAL SUMMARY ---");
  console.log(`- community_posts removed: ${removedPostsCount}`);
  console.log(`- post_comments removed: ${removedCommentsCount}`);
  console.log(`- post_reactions removed: ${removedReactionsCount}`);
  console.log(`- community_activity_feed removed: ${removedFeedCount}`);
  console.log(`- study_groups removed: ${removedGroupsCount}`);
  console.log(`- study_group_members removed: ${removedGroupMembersCount}`);
  console.log(`- mentors (demo rows) removed: ${removedMentorsCount}`);

  console.log("\n==========================================================");
  console.log(" STEP 2 — FIND SARA'S ACTUAL REAL USERS AND INSTRUCTORS");
  console.log("==========================================================");

  // Fetch all auth users
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data: res } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const users = res?.users || [];
    if (!users.length) break;
    allAuthUsers = allAuthUsers.concat(users);
    if (users.length < 1000) break;
    page++;
  }

  // Filter out demo accounts
  const realAuthUsers = allAuthUsers.filter(u => {
    const email = (u.email || "").toLowerCase();
    const id = u.id || "";
    return !demoUserIds.has(id) &&
      !email.endsWith("@demoacademy.sample") &&
      !email.includes("demoacademy") &&
      !email.endsWith("@sample") &&
      !email.endsWith(".sample");
  });

  // Also query user_profiles for metadata & role
  const { data: profilesData } = await supabase.from("user_profiles").select("*");
  const profileMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]));

  // Combine auth.users and user_profiles to build clean real users list
  const realUsersList = realAuthUsers.map(u => {
    const p = profileMap[u.id] || {};
    const meta = u.user_metadata || {};
    const displayName = p.display_name || meta.display_name || meta.full_name || meta.name || meta.username || u.email.split("@")[0];
    return {
      id: u.id,
      email: u.email,
      display_name: displayName.trim(),
      role: p.role || meta.role || "learner",
      organization_id: p.organization_id || null
    };
  });

  console.log(`\nFound ${realUsersList.length} real non-demo users in the database.`);

  if (realUsersList.length < 2) {
    console.error("ERROR: Fewer than 2 real non-demo users found in the database!");
    console.error("Stopping process as instructed by Step 2 guidelines.");
    return;
  }

  console.log("\nSample Real Users for Reseeding (Top 15):");
  console.table(realUsersList.slice(0, 15));

  // Find genuine instructors/mentors among real users
  const { data: realCourses } = await supabase.from("courses").select("id, title, instructor_id, created_at");
  const courseInstructorIds = new Set((realCourses || []).map(c => c.instructor_id).filter(Boolean));

  const realInstructors = realUsersList.filter(u => 
    u.role === "mentor" || u.role === "instructor" || u.role === "admin" || courseInstructorIds.has(u.id)
  );

  console.log(`\nReal Instructors / Admins count: ${realInstructors.length}`);
  console.table(realInstructors);

  console.log("\n==========================================================");
  console.log(" STEP 3 — RESEED COMMUNITY CONTENT ATTACHED ONLY TO REAL USERS");
  console.log("==========================================================");

  // Pick distinct real users for content attribution
  const user1 = realUsersList[0];
  const user2 = realUsersList[1];
  const user3 = realUsersList[2] || user1;
  const user4 = realUsersList[3] || user2;
  const user5 = realUsersList[4] || user1;

  console.log("Selected author accounts:");
  console.log(`- Post 1: ${user1.display_name} (${user1.email})`);
  console.log(`- Post 2: ${user2.display_name} (${user2.email})`);
  console.log(`- Post 3: ${user3.display_name} (${user3.email})`);
  console.log(`- Post 4: ${user4.display_name} (${user4.email})`);
  console.log(`- Post 5: ${user5.display_name} (${user5.email})`);

  // Ensure user_profiles exist for these selected users so foreign keys succeed
  for (const u of [user1, user2, user3, user4, user5, ...realUsersList.slice(0, 10)]) {
    await supabase.from("user_profiles").upsert({
      id: u.id,
      display_name: u.display_name,
      role: u.role,
      last_active_at: new Date().toISOString()
    }, { onConflict: "id" });
  }

  // 1. Insert 5 community_posts
  const postsToInsert = [
    {
      user_id: user1.id,
      post_type: "achievement",
      content: "First ML Project Complete! 🎉\n\nJust completed my first machine learning project! Built a simple image classifier using TensorFlow. The feeling of seeing it work for the first time is incredible. Any tips for optimization?\n\n#MachineLearning #TensorFlow #ImageClassification #Beginner",
      is_pinned: false,
      ai_moderated: true,
      moderation_status: "approved",
      created_at: new Date(Date.now() - 4 * 3600000).toISOString()
    },
    {
      user_id: user2.id,
      post_type: "question",
      content: "Need help with BERT fine-tuning\n\nHas anyone worked with transformer models for NLP tasks? I am struggling with fine-tuning BERT for sentiment analysis. Would love to connect with others who have experience in this area.\n\n#NLP #BERT #Transformers #SentimentAnalysis",
      is_pinned: false,
      ai_moderated: true,
      moderation_status: "approved",
      created_at: new Date(Date.now() - 3 * 3600000).toISOString()
    },
    {
      user_id: user3.id,
      post_type: "tip",
      content: "Start Simple: ML Best Practice\n\nPro tip: Always start with a simple baseline model before jumping into complex architectures. I learned this the hard way after spending weeks on a complex CNN that barely outperformed logistic regression.\n\n#MachineLearning #BestPractices #CNN #Baseline",
      is_pinned: true,
      ai_moderated: true,
      moderation_status: "approved",
      created_at: new Date(Date.now() - 2 * 3600000).toISOString()
    },
    {
      user_id: user4.id,
      post_type: "news",
      content: "Speaking at AI Conference 🎤\n\nExcited to announce that I will be giving a talk at the upcoming AI conference about \"Ethical AI in Healthcare\". Looking forward to sharing insights and learning from the community!\n\n#Conference #EthicalAI #Healthcare #Speaking",
      is_pinned: false,
      ai_moderated: true,
      moderation_status: "approved",
      created_at: new Date(Date.now() - 1 * 3600000).toISOString()
    },
    {
      user_id: user5.id,
      post_type: "question",
      content: "Best AI Research Resources?\n\nWhat are your favorite resources for staying updated with the latest AI research? I currently follow ArXiv and a few newsletters, but always looking for more quality sources.\n\n#Research #AI #Learning #Resources",
      is_pinned: false,
      ai_moderated: true,
      moderation_status: "approved",
      created_at: new Date().toISOString()
    }
  ];

  const { data: insertedPosts, error: postErr } = await supabase
    .from("community_posts")
    .insert(postsToInsert)
    .select();

  if (postErr) {
    console.error("Error inserting community_posts:", postErr);
    return;
  }

  console.log(`Successfully inserted ${insertedPosts.length} community posts.`);

  // 2. Insert comments
  // Post 1 comment by user2
  // Post 2 comment by user1
  const commentsToInsert = [
    {
      post_id: insertedPosts[0].id,
      user_id: user2.id,
      content: "Congratulations! That's a huge milestone. For optimization, I'd recommend looking into transfer learning if you haven't already.",
      created_at: new Date(Date.now() - 3.5 * 3600000).toISOString()
    },
    {
      post_id: insertedPosts[1].id,
      user_id: user1.id,
      content: "I've had good success with Hugging Face's transformers library. Their documentation for BERT fine-tuning is excellent. Happy to help if you run into specific issues!",
      created_at: new Date(Date.now() - 2.5 * 3600000).toISOString()
    }
  ];

  const { data: insertedComments, error: commentErr } = await supabase
    .from("post_comments")
    .insert(commentsToInsert)
    .select();

  if (commentErr) console.warn("Comments insert warning:", commentErr);
  else console.log(`Successfully inserted ${insertedComments?.length || 0} comments.`);

  // 3. Insert reactions from real users
  const reactionsToInsert = [
    { post_id: insertedPosts[0].id, user_id: user2.id, reaction_type: "celebrate" },
    { post_id: insertedPosts[0].id, user_id: user3.id, reaction_type: "like" },
    { post_id: insertedPosts[1].id, user_id: user1.id, reaction_type: "like" },
    { post_id: insertedPosts[2].id, user_id: user4.id, reaction_type: "heart" },
    { post_id: insertedPosts[3].id, user_id: user5.id, reaction_type: "celebrate" }
  ];

  const { data: insertedReactions, error: reactErr } = await supabase
    .from("post_reactions")
    .insert(reactionsToInsert)
    .select();

  if (reactErr) console.warn("Reactions insert warning:", reactErr);
  else console.log(`Successfully inserted ${insertedReactions?.length || 0} post reactions.`);

  // 4. Insert community_activity_feed entries
  const feedToInsert = insertedPosts.map((p, idx) => {
    const author = [user1, user2, user3, user4, user5][idx];
    return {
      user_id: author.id,
      activity_type: "post_created",
      activity_text: `${author.display_name} just shared a new post`,
      is_public: true,
      metadata: { post_id: p.id },
      created_at: p.created_at
    };
  });

  const { data: insertedFeed, error: feedErr } = await supabase
    .from("community_activity_feed")
    .insert(feedToInsert)
    .select();

  if (feedErr) console.warn("Activity feed insert warning:", feedErr);
  else console.log(`Successfully inserted ${insertedFeed?.length || 0} activity feed entries.`);

  // 5. Insert 10 study_groups
  const studyGroupsContent = [
    { name: "JavaScript Fundamentals Study Group", description: "Learn JavaScript basics together. Perfect for beginners who want to master the fundamentals.", max_members: 15 },
    { name: "Machine Learning Book Club", description: "Reading and discussing \"Hands-On Machine Learning\" by Aurélien Géron. Weekly chapter discussions.", max_members: 12 },
    { name: "React Projects Collaboration", description: "Building real-world React projects together. Share code, get feedback, and learn from each other.", max_members: 10 },
    { name: "Data Science Career Prep", description: "Preparing for data science interviews and discussing career transitions into the field.", max_members: 20 },
    { name: "Python Coding Challenges", description: "Solving LeetCode and HackerRank problems together. Daily challenges and solutions sharing.", max_members: 25 },
    { name: "AI/ML Fundamentals Study Group", description: "A group for beginners in artificial intelligence and machine learning", max_members: 30 },
    { name: "Deep Learning Researchers", description: "Advanced discussions on deep learning techniques and research papers", max_members: 25 },
    { name: "Python for Data Science", description: "Learn Python programming specifically for data science applications", max_members: 40 },
    { name: "Computer Vision Projects", description: "Hands-on computer vision projects and discussions", max_members: 20 },
    { name: "NLP & Text Analytics", description: "Natural language processing and text analysis study group", max_members: 35 }
  ];

  const groupsToInsert = studyGroupsContent.map((g, idx) => {
    const creator = realUsersList[idx % realUsersList.length];
    return {
      name: g.name,
      description: g.description,
      max_members: g.max_members,
      created_by: creator.id,
      is_private: false
    };
  });

  const { data: insertedGroups, error: groupErr } = await supabase
    .from("study_groups")
    .insert(groupsToInsert)
    .select();

  if (groupErr) {
    console.error("Error inserting study_groups:", groupErr);
    return;
  }

  console.log(`Successfully inserted ${insertedGroups.length} study groups.`);

  // Insert study_group_members
  const groupMembersToInsert = [];
  insertedGroups.forEach((g, idx) => {
    const creator = realUsersList[idx % realUsersList.length];
    // Creator as admin
    groupMembersToInsert.push({
      group_id: g.id,
      user_id: creator.id,
      role: "admin",
      joined_at: new Date().toISOString()
    });
    // Add 1-2 additional members from real users
    const member1 = realUsersList[(idx + 1) % realUsersList.length];
    const member2 = realUsersList[(idx + 2) % realUsersList.length];
    if (member1.id !== creator.id) {
      groupMembersToInsert.push({
        group_id: g.id,
        user_id: member1.id,
        role: "member",
        joined_at: new Date().toISOString()
      });
    }
    if (member2.id !== creator.id && member2.id !== member1.id) {
      groupMembersToInsert.push({
        group_id: g.id,
        user_id: member2.id,
        role: "member",
        joined_at: new Date().toISOString()
      });
    }
  });

  const { data: insertedGroupMembers, error: groupMemberErr } = await supabase
    .from("study_group_members")
    .insert(groupMembersToInsert)
    .select();

  if (groupMemberErr) console.warn("Group members insert warning:", groupMemberErr);
  else console.log(`Successfully inserted ${insertedGroupMembers?.length || 0} study group members.`);

  // 6. Mentors table — insert mentor rows only for real instructors
  if (realInstructors.length > 0) {
    const mentorsToInsert = realInstructors.map(inst => ({
      user_id: inst.id,
      organization_id: inst.organization_id || null,
      title: "Instructor & Mentor",
      bio: "Expert mentor guiding learners on Train AI platform.",
      is_active: true,
      is_approved: true,
      rating: 5.0
    }));

    const { data: insertedMentors, error: mentorErr } = await supabase
      .from("mentors")
      .upsert(mentorsToInsert, { onConflict: "user_id" })
      .select();

    if (mentorErr) console.warn("Mentors upsert warning:", mentorErr);
    else console.log(`Successfully updated/inserted ${insertedMentors?.length || 0} mentor rows for real instructors.`);
  }

  console.log("\n==========================================================");
  console.log(" STEP 4 — VERIFICATION & FINAL AUDIT");
  console.log("==========================================================");

  // Check 0 rows reference demo users
  const { data: finalPosts } = await supabase.from("community_posts").select("id, user_id");
  const { data: finalGroups } = await supabase.from("study_groups").select("id, created_by");
  const { data: finalMentors } = await supabase.from("mentors").select("id, user_id, organization_id");

  const demoPostsFound = (finalPosts || []).filter(p => demoUserIds.has(p.user_id));
  const demoGroupsFound = (finalGroups || []).filter(g => demoUserIds.has(g.created_by));
  const demoMentorsFound = (finalMentors || []).filter(m => demoUserIds.has(m.user_id) || demoOrgIds.has(m.organization_id));

  console.log(`- Demo posts remaining: ${demoPostsFound.length}`);
  console.log(`- Demo groups remaining: ${demoGroupsFound.length}`);
  console.log(`- Demo mentors remaining: ${demoMentorsFound.length}`);

  if (demoPostsFound.length === 0 && demoGroupsFound.length === 0 && demoMentorsFound.length === 0) {
    console.log("\nVERIFICATION CONFIRMED: ZERO demo-academy-sample rows remain in Community tables!");
  } else {
    console.warn("\nWARNING: Demo rows still detected!");
  }

  console.log("\nReseeded Community Summary:");
  console.log(`- 5 Community Posts authored by: ${[user1, user2, user3, user4, user5].map(u => u.display_name).join(", ")}`);
  console.log(`- 10 Study Groups created by real users`);
  console.log(`- Real instructors in mentors table: ${realInstructors.map(i => i.display_name).join(", ") || "None"}`);
}

main().catch(console.error);
