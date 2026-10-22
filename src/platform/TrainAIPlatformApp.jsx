import { LoadingSkeleton } from "./../components/common/PageLoadingBoundary.jsx";
import { PageLoadingBoundary, PageSkeleton, skeletonLayoutFor } from "../components/common/PageLoadingBoundary.jsx";
import { useAssignmentRefresh } from "../lib/useAssignmentRefresh.js";
import React, { useState, useEffect, lazy, Suspense } from "react";
import { usePlatformData } from "./hooks/usePlatformData.js";
import { useSupabaseQuery } from "../lib/useSupabaseQuery.js";
import { fetchMentorProfile, fetchCohortSessions, fetchMyManagedStudyGroups } from "../lib/api/schemaHelper.js";
import { fetchMentorActiveCohorts } from "../lib/api/platform.js";
import { fetchLeaderboard } from "../lib/api/learner.js";
import { TOKENS, Sidebar, DashboardSwitcher, MobileMenuContext, ToastContext, NavigationContext, WorkspaceContext, ActiveDashboardContext, SignOutContext, WorkspaceProfileContext } from "./components/PlatformUI.jsx";
import { AdminDashboardScreen } from "./admin/AdminDashboardScreen.jsx";
import { CheckCircle2 } from "lucide-react";
import { defaultWorkspaceForRoles, getAllowedWorkspaces, getAvailableDashboards, DASHBOARDS, isPlatformOwnerEmail } from "../lib/roleRouting.js";

// Picks which workspace tab a signed-in platform user lands on by default,
// in descending order of privilege - admin/super_admin keep the previous
// hardcoded "admin" default, mentor keeps its own tab, and manager (which
// previously had no tab to fall into at all and landed on the Admin
// workspace's full CRUD screens by accident) gets its own scoped landing
// spot instead. HR removed entirely - confirmed directly that HR is not an
// organization role; Admin/Manager/Instructor is the full set.
import { fetchAllOrganizations } from "../lib/api/platform.js";

const lazyScreen = (load, name) => lazy(async () => ({ default: (await load())[name] }));
const InstructorCohortsScreen = lazyScreen(() => import("./mentor/InstructorCohortsScreen.jsx"), "InstructorCohortsScreen");
const OrgPaymentCallbackScreen = lazyScreen(() => import("./OrgPaymentCallbackScreen.jsx"), "OrgPaymentCallbackScreen");
const PeopleScreen = lazyScreen(() => import("./admin/PeopleScreen.jsx"), "PeopleScreen");
const ContentScreen = lazyScreen(() => import("./admin/ContentScreen.jsx"), "ContentScreen");
const LearningPathsScreen = lazyScreen(() => import("./admin/LearningPathsScreen.jsx"), "LearningPathsScreen");
const EmailCenterScreen = lazyScreen(() => import("./admin/EmailCenterScreen.jsx"), "EmailCenterScreen");
const PayoutsScreen = lazyScreen(() => import("./admin/PayoutsScreen.jsx"), "PayoutsScreen");
const SeatsScreen = lazyScreen(() => import("./admin/SeatsScreen.jsx"), "SeatsScreen");
const WorkforceIntelligenceScreen = lazyScreen(() => import("./admin/WorkforceIntelligenceScreen.jsx"), "WorkforceIntelligenceScreen");
const ModerationScreen = lazyScreen(() => import("./admin/ModerationScreen.jsx"), "ModerationScreen");
const AdminStudyGroupsScreen = lazyScreen(() => import("./admin/AdminStudyGroupsScreen.jsx"), "AdminStudyGroupsScreen");
const AdminAnalyticsScreen = lazyScreen(() => import("./admin/AdminAnalyticsScreen.jsx"), "AdminAnalyticsScreen");
const CohortsScreen = lazyScreen(() => import("./admin/CohortsScreen.jsx"), "CohortsScreen");
const OrgRoleAccessScreen = lazyScreen(() => import("./admin/OrgRoleAccessScreen.jsx"), "OrgRoleAccessScreen");
const CohortDetailScreen = lazyScreen(() => import("./admin/CohortDetailScreen.jsx"), "CohortDetailScreen");
const AssessmentsScreen = lazyScreen(() => import("./admin/AssessmentsScreen.jsx"), "AssessmentsScreen");
const ComplianceScreen = lazyScreen(() => import("./admin/ComplianceScreen.jsx"), "ComplianceScreen");
const IntegrationsScreen = lazyScreen(() => import("./admin/IntegrationsScreen.jsx"), "IntegrationsScreen");
const SettingsHubScreen = lazyScreen(() => import("./admin/SettingsHubScreen.jsx"), "SettingsHubScreen");
const DemoRequestsScreen = lazyScreen(() => import("./superadmin/DemoRequestsScreen.jsx"), "DemoRequestsScreen");
const MentorDashboardScreen = lazyScreen(() => import("./mentor/MentorDashboardScreen.jsx"), "MentorDashboardScreen");
const MentorStudyGroupsScreen = lazyScreen(() => import("./mentor/MentorStudyGroupsScreen.jsx"), "MentorStudyGroupsScreen");
const MentorScheduleScreen = lazyScreen(() => import("./mentor/MentorScheduleScreen.jsx"), "MentorScheduleScreen");
const MenteesScreen = lazyScreen(() => import("./mentor/MenteesScreen.jsx"), "MenteesScreen");
const MentorMessagesScreen = lazyScreen(() => import("./mentor/MentorMessagesScreen.jsx"), "MentorMessagesScreen");
const DiscussionsScreen = lazyScreen(() => import("./mentor/DiscussionsScreen.jsx"), "DiscussionsScreen");
const MentorAnalyticsScreen = lazyScreen(() => import("./mentor/MentorAnalyticsScreen.jsx"), "MentorAnalyticsScreen");
const AdministrativeScreen = lazyScreen(() => import("./mentor/AdministrativeScreen.jsx"), "AdministrativeScreen");
const MentorSettingsScreen = lazyScreen(() => import("./mentor/MentorSettingsScreen.jsx"), "MentorSettingsScreen");
const ManagerDashboardScreen = lazyScreen(() => import("./manager/ManagerDashboardScreen.jsx"), "ManagerDashboardScreen");
const LeaderboardScreen = lazyScreen(() => import("../learner/screens/LeaderboardScreen.jsx"), "LeaderboardScreen");
const CommunityScreen = lazyScreen(() => import("../learner/screens/CommunityScreen.jsx"), "CommunityScreen");

export default function TrainAIPlatformApp({ session, isActive = true, onSwitchToLearner, onSwitchDashboard, userRoles = [], superAdminSelectedOrgId, setSuperAdminSelectedOrgId, onSignOut } = {}) {
  const { profileQuery, orgId } = usePlatformData(session, userRoles);

  const userEmail = session?.user?.email || profileQuery?.data?.email || "";
  const isSuperAdminUser = isPlatformOwnerEmail(userEmail) && userRoles.includes("super_admin");

  const allOrgsQuery = useSupabaseQuery(async () => {
    if (isSuperAdminUser) {
      return await fetchAllOrganizations();
    }
    return [];
  }, [isSuperAdminUser]);
  const allOrgs = allOrgsQuery.data || [];

  // Default to the canonical Digital Users organization (tech-learning) where
  // unaffiliated / direct signups land, so the Platform Owner immediately
  // sees and manages the public/individual learners without an extra click.
  const digitalOrg = allOrgs.find((o) => o.slug === "tech-learning" || o.slug === "digital-users") || allOrgs[0];
  const defaultOrgId = digitalOrg ? digitalOrg.id : (orgId || "tech-learning");
  const effectiveOrgId = (isSuperAdminUser && superAdminSelectedOrgId)
    ? superAdminSelectedOrgId
    : (isSuperAdminUser ? defaultOrgId : orgId);

  useEffect(() => {
    if (isSuperAdminUser && !superAdminSelectedOrgId && digitalOrg?.id) {
      setSuperAdminSelectedOrgId?.(digitalOrg.id);
    }
  }, [isSuperAdminUser, superAdminSelectedOrgId, digitalOrg?.id, setSuperAdminSelectedOrgId]);

  const orgSelector = isSuperAdminUser ? {
    orgs: allOrgs,
    selectedOrgId: effectiveOrgId,
    onSelectOrg: (id) => setSuperAdminSelectedOrgId(id),
  } : null;

  const [requestedWorkspace, setRequestedWorkspace] = useState(() => defaultWorkspaceForRoles(userRoles));
  const allowedWorkspaces = getAllowedWorkspaces(userRoles);
  const workspace = allowedWorkspaces.includes(requestedWorkspace) ? requestedWorkspace : defaultWorkspaceForRoles(userRoles);
  function setWorkspace(value) { if (allowedWorkspaces.includes(value)) setRequestedWorkspace(value); }
  const [screenByWorkspace, setScreenByWorkspace] = useState({
    admin: "dashboard",
    mentor: "dashboard",
    manager: "dashboard",
  });
  const [selectedCohortId, setSelectedCohortId] = useState(null);
  const [selectedLearnerForChat, setSelectedLearnerForChat] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const screen = screenByWorkspace[workspace] || "dashboard";
  // Unvisited dashboards are not mounted. Keep these dependencies stable when
  // a visited workspace is hidden so switching dashboards does not clear drafts.
  const needsMentorData = workspace === "mentor";
  const needsMentorCommunity = needsMentorData && screen === "community";
  const mentorProfileQuery = useSupabaseQuery(async () => {
    if (!needsMentorData || !session?.user?.id) return null;
    return fetchMentorProfile(session.user.id);
  }, [session?.user?.id, needsMentorData]);
  const mentorId = mentorProfileQuery.data?.id || null;

  // Real data for the mentor's "Learner Community View" - this used to render
  // the same learner CommunityScreen but with none of its data queries wired
  // in, so it silently showed as empty for every mentor. Wire it to the
  // mentor's own first active cohort, their managed study groups, and the
  // org leaderboard - the same shape the learner-facing summary expects.
  const mentorCohortsForCommunityQuery = useSupabaseQuery(async () => (
    needsMentorCommunity && session?.user?.id ? fetchMentorActiveCohorts(session.user.id) : []
  ), [session?.user?.id, needsMentorCommunity]);
  useAssignmentRefresh(isActive && needsMentorCommunity ? session?.user?.id : null, mentorCohortsForCommunityQuery.refetch);
  const mentorFirstCohort = (mentorCohortsForCommunityQuery.data || [])[0] || null;
  const mentorCohortSessionsQuery = useSupabaseQuery(async () => (
    needsMentorCommunity && mentorFirstCohort?.id ? fetchCohortSessions(mentorFirstCohort.id) : []
  ), [mentorFirstCohort?.id, needsMentorCommunity]);
  const mentorStudyGroupsQuery = useSupabaseQuery(async () => (
    needsMentorCommunity && session?.user?.id ? fetchMyManagedStudyGroups(session.user.id) : []
  ), [session?.user?.id, needsMentorCommunity]);
  const mentorLeaderboardQuery = useSupabaseQuery(async () => needsMentorCommunity ? fetchLeaderboard(50) : [], [needsMentorCommunity]);
  const workspaceReady = !profileQuery.loading && (!isSuperAdminUser || !allOrgsQuery.loading)
    && (workspace !== "mentor" || !mentorProfileQuery.loading);


  function setScreen(s) {
    setScreenByWorkspace(prev => ({ ...prev, [workspace]: s }));
  }

  function navigateToScreen(targetScreen, targetWs = null, extraState = {}) {
    // Normalize mentor screen keys to match render block expectations
    const MENTOR_KEY_MAP = {
      "mentor-dashboard": "dashboard",
      "mentor-analytics": "analytics",
      "administrative": "admin",
      "mentor-settings": "settings",
    };
    const normalizedScreen = MENTOR_KEY_MAP[targetScreen] || targetScreen;
    let ws = targetWs;
    if (!ws) {
      if (["mentor-dashboard", "schedule", "mentees", "messages", "discussions", "mentor-analytics", "administrative", "mentor-settings"].includes(targetScreen)) {
        ws = "mentor";
      } else if (["manager-overview"].includes(targetScreen)) {
        ws = "manager";
      } else {
        ws = workspace;
      }
    }
    if (!allowedWorkspaces.includes(ws)) return;
    if (extraState?.courseId !== undefined) {
      setSelectedCourseId(extraState.courseId);
    }
    setWorkspace(ws);
    setScreenByWorkspace(prev => ({ ...prev, [ws]: normalizedScreen }));
  }

  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem("trainai_theme_dark") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const checkDark = () => {
      const active = localStorage.getItem("trainai_theme_dark") === "true" || document.documentElement.classList.contains("dark");
      setIsDark(active);
      if (active) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    };
    checkDark();
    window.addEventListener("storage", checkDark);
    window.addEventListener("trainai-theme-change", checkDark);
    return () => {
      window.removeEventListener("storage", checkDark);
      window.removeEventListener("trainai-theme-change", checkDark);
    };
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // Organization subscription payments (SettingsHubScreen.jsx's Billing &
  // Plan card) redirect back to this same page - no router in this app, so
  // this is the boot-time check, same pattern
  // TrainAILearnerApp.jsx uses for the learner-side credits/enrollment
  // payment contexts, which this app never had until now.
  const [orgPaymentCallbackActive, setOrgPaymentCallbackActive] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return !!(params.get("reference") || params.get("trxref") || params.get("session_id"));
    } catch {
      return false;
    }
  });
  if (!workspace) return <div className="ta-empty"><LoadingSkeleton label="Loading workspace permissions..." rows={3} /></div>;
  if (orgPaymentCallbackActive) {
    return <OrgPaymentCallbackScreen onDone={() => setOrgPaymentCallbackActive(false)} />;
  }

  return (
    <ActiveDashboardContext.Provider value={isActive}>
    <WorkspaceContext.Provider value={workspace}>
    <SignOutContext.Provider value={onSignOut}>
    <WorkspaceProfileContext.Provider value={profileQuery}>
      <NavigationContext.Provider value={navigateToScreen}>
        <MobileMenuContext.Provider value={() => setMobileOpen(true)}>
          <ToastContext.Provider value={showToast}>
            <div className={`ta ${isDark ? "dark" : ""}`}>
              <style>{TOKENS}</style>
              <div className="ta-shell">
                <Sidebar
                  workspace={workspace}
                  setWorkspace={setWorkspace}
                  screen={screen}
                  setScreen={setScreen}
                  mobileOpen={mobileOpen}
                  onClose={() => setMobileOpen(false)}
                  onOpenDashboardSwitcher={() => setSwitcherOpen(true)}
                  userRoles={userRoles}
                  onSignOut={onSignOut}
                />

            <div className="ta-main">
              <Suspense fallback={<PageSkeleton layout={skeletonLayoutFor(screen)} onOpenMenu={() => setMobileOpen(true)} />}>
              <PageLoadingBoundary key={`${workspace}:${screen}:${effectiveOrgId || "none"}`} screen={screen} waitForQueries={false}
                onOpenMenu={() => setMobileOpen(true)}
                loading={!workspaceReady}>
              {workspaceReady && <>
              {workspace === "admin" && (
                <>
                  {screen === "dashboard" && <AdminDashboardScreen orgId={effectiveOrgId} profileQuery={profileQuery} setScreen={setScreen} orgSelector={orgSelector} isPlatformOwner={isSuperAdminUser} />}
                  {screen === "demos" && <DemoRequestsScreen orgSelector={orgSelector} />}
                  {screen === "people" && <PeopleScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} currentUserId={session?.user?.id} />}
                  {screen === "content" && <ContentScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} selectedCourseId={selectedCourseId} setSelectedCourseId={setSelectedCourseId} currentUserId={session?.user?.id} />}
                  {screen === "paths" && <LearningPathsScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} />}
                  {/* Course Builder is its own Learning nav entry - same
                      ContentScreen, mounted with the builder wizard already
                      open. */}
                  {screen === "coursebuilder" && <ContentScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} selectedCourseId={selectedCourseId} setSelectedCourseId={setSelectedCourseId} currentUserId={session?.user?.id} openBuilderOnMount />}
                  {screen === "emails" && <EmailCenterScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} currentUserId={session?.user?.id} />}
                  {screen === "payouts" && <PayoutsScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} currentUserId={session?.user?.id} />}
                  {screen === "seats" && <SeatsScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} userEmail={session?.user?.email} />}
                  {screen === "workforce" && <WorkforceIntelligenceScreen orgId={effectiveOrgId} orgSelector={orgSelector} currentUserId={session?.user?.id} />}
                  {screen === "moderation" && <ModerationScreen orgSelector={orgSelector} setScreen={setScreen} orgId={effectiveOrgId} currentUserId={session?.user?.id} />}
                  {screen === "studygroups" && <AdminStudyGroupsScreen orgId={effectiveOrgId} orgSelector={orgSelector} />}
                  {screen === "analytics" && <AdminAnalyticsScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} isPlatformOwner={isSuperAdminUser} />}
                  {screen === "cohorts" && (
                    <CohortsScreen
                      orgId={effectiveOrgId}
                      orgSelector={orgSelector}
                      setScreen={setScreen}
                      currentUserId={session?.user?.id}
                      onOpenCohort={(cohortId) => {
                        setSelectedCohortId(cohortId);
                        setScreen("cohort-detail");
                      }}
                    />
                  )}
                  {screen === "cohort-detail" && (
                    <CohortDetailScreen
                      orgId={effectiveOrgId}
                      cohortId={selectedCohortId}
                      currentUserId={session?.user?.id}
                      onBack={() => setScreen("cohorts")}
                      orgSelector={orgSelector}
                      setScreen={setScreen}
                    />
                  )}
                  {screen === "compliance" && <ComplianceScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} currentUserId={session?.user?.id} />}
                  {screen === "leaderboard" && <LeaderboardScreen back={() => setScreen("dashboard")} push={(s) => setScreen(s)} />}
                  {screen === "assessments" && <AssessmentsScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} setSelectedCourseId={setSelectedCourseId} scope="admin" />}
                  {screen === "roleaccess" && <OrgRoleAccessScreen orgId={effectiveOrgId} orgSelector={orgSelector} currentUserId={session?.user?.id} />}
                  {screen === "integrations" && <IntegrationsScreen orgId={effectiveOrgId} userId={session?.user?.id} orgSelector={orgSelector} setScreen={setScreen} isPlatformOwner={isSuperAdminUser} />}
                  {screen === "settings" && <SettingsHubScreen orgId={effectiveOrgId} profileQuery={profileQuery} orgSelector={orgSelector} setScreen={setScreen} userEmail={session?.user?.email} session={session} />}
                </>
              )}

              {workspace === "mentor" && (
                <>
                  {screen === "dashboard" && <MentorDashboardScreen mentorId={mentorId} orgSelector={orgSelector} currentUserId={session?.user?.id} profileQuery={profileQuery} orgId={effectiveOrgId} onNavigate={navigateToScreen} />}
                  {screen === "cohorts" && <InstructorCohortsScreen profileQuery={profileQuery} currentUserId={session?.user?.id} onOpenCohort={id => { setSelectedCohortId(id); setScreen("mentor-cohort-detail"); }} />}
                  {screen === "mentor-cohort-detail" && <InstructorCohortsScreen profileQuery={profileQuery} key={selectedCohortId} currentUserId={session?.user?.id} cohortId={selectedCohortId} onBack={() => setScreen("cohorts")} />}
                  {screen === "studygroups" && <MentorStudyGroupsScreen mentorId={session?.user?.id} orgId={effectiveOrgId} orgSelector={orgSelector} />}
                  {screen === "leaderboard" && <LeaderboardScreen back={() => setScreen("dashboard")} push={(s) => setScreen(s)} />}
                  {screen === "assessments" && <AssessmentsScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} setSelectedCourseId={setSelectedCourseId} scope="mentor" />}
                  {screen === "content" && <ContentScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} selectedCourseId={selectedCourseId} setSelectedCourseId={setSelectedCourseId} currentUserId={session?.user?.id} />}
                  {screen === "schedule" && <MentorScheduleScreen mentorId={mentorId} orgSelector={orgSelector} />}
                  {screen === "mentees" && <MenteesScreen mentorId={mentorId} orgSelector={orgSelector} setScreen={setScreen} setSelectedLearnerForChat={setSelectedLearnerForChat} orgId={effectiveOrgId} currentUserId={session?.user?.id} />}
                  {screen === "messages" && <MentorMessagesScreen userId={session?.user?.id} mentorId={mentorId} orgSelector={orgSelector} selectedLearnerForChat={selectedLearnerForChat} setScreen={setScreen} orgId={effectiveOrgId} />}
                  {screen === "discussions" && <DiscussionsScreen mentorId={mentorId} orgSelector={orgSelector} />}
                  {screen === "analytics" && <MentorAnalyticsScreen mentorId={mentorId} mentorProfileQuery={mentorProfileQuery} orgSelector={orgSelector} onNavigate={navigateToScreen} />}
                  {screen === "admin" && <AdministrativeScreen mentorId={mentorId} orgSelector={orgSelector} mentorProfileQuery={mentorProfileQuery} currentUserId={session?.user?.id} />}
                  {screen === "settings" && <MentorSettingsScreen mentorId={mentorId} mentorProfileQuery={mentorProfileQuery} orgSelector={orgSelector} currentUserId={session?.user?.id} userProfileQuery={profileQuery} onNavigate={navigateToScreen} />}
                  {screen === "community" && (
                    <CommunityScreen
                      user={profileQuery?.data}
                      session={session}
                      push={(s, p) => navigateToScreen(s, p)}
                      back={() => setScreen("dashboard")}
                      showToast={showToast}
                      cohortMembershipQuery={{ data: { cohort: mentorFirstCohort }, loading: mentorCohortsForCommunityQuery.loading }}
                      cohortSessionsQuery={mentorCohortSessionsQuery}
                      studyGroupsQuery={mentorStudyGroupsQuery}
                      myGroupIdsQuery={{ data: (mentorStudyGroupsQuery.data || []).map((g) => g.id) }}
                      leaderboardQuery={mentorLeaderboardQuery}
                      upcomingSessionsQuery={mentorCohortSessionsQuery}
                    />
                  )}
                </>
              )}

              {workspace === "manager" && (
                <>
                  {screen === "dashboard" && <ManagerDashboardScreen userId={session?.user?.id} profileQuery={profileQuery} orgSelector={orgSelector} orgId={effectiveOrgId} />}
                  {screen === "workforce" && <WorkforceIntelligenceScreen orgId={effectiveOrgId} orgSelector={orgSelector} currentUserId={session?.user?.id} />}
                </>
              )}
              </>}
              </PageLoadingBoundary>
              </Suspense>
            </div>
          </div>

          {toast && (
            // Not `.tai-toast` - that class is only styled by LearnerUI's
            // TOKENS, which this (platform) app never loads, so this was
            // relying entirely on the inline style below. That style had no
            // maxWidth/left, so anchoring purely via `right` let a long
            // message's left edge run off a narrow phone screen, getting
            // clipped by the global overflow-x:hidden safety net.
            <div className="anim-pop" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", maxWidth: "calc(100vw - 32px)", zIndex: 999, background: "var(--text)", color: "#fff", padding: "10px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, boxShadow: "0 12px 32px -4px rgba(15,23,42,0.35)", boxSizing: "border-box" }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{toast}</span>
            </div>
          )}

          {switcherOpen && (
            <DashboardSwitcher
              currentDashboard={DASHBOARDS.ORGANISATION}
              availableDashboards={getAvailableDashboards(userRoles, session?.user?.email || profileQuery?.data?.email)}
              roleLabel={
                isSuperAdminUser
                  ? "Super Admin"
                  : userRoles.includes("admin") || userRoles.includes("manager")
                    ? "Admin"
                    : "Instructor"
              }
              onSwitch={(key) => {
                setSwitcherOpen(false);
                if (key === DASHBOARDS.LEARNER) onSwitchToLearner && onSwitchToLearner();
                else onSwitchDashboard && onSwitchDashboard(key);
              }}
              onClose={() => setSwitcherOpen(false)}
            />
          )}
        </div>
      </ToastContext.Provider>
    </MobileMenuContext.Provider>
  </NavigationContext.Provider>
    </WorkspaceProfileContext.Provider>
    </SignOutContext.Provider>
    </WorkspaceContext.Provider>
    </ActiveDashboardContext.Provider>
);
}
