import React, { useState, useEffect } from "react";
import { usePlatformData } from "./hooks/usePlatformData.js";
import { useSupabaseQuery } from "../lib/useSupabaseQuery.js";
import { fetchMentorProfile } from "../lib/api/schemaHelper.js";
import { TOKENS, Sidebar, DashboardSwitcher, MobileMenuContext, ToastContext, NavigationContext } from "./components/PlatformUI.jsx";
import { OrgPaymentCallbackScreen } from "./OrgPaymentCallbackScreen.jsx";
import { AdminDashboardScreen } from "./admin/AdminDashboardScreen.jsx";
import { PeopleScreen } from "./admin/PeopleScreen.jsx";
import { ContentScreen } from "./admin/ContentScreen.jsx";
import { LearningPathsScreen } from "./admin/LearningPathsScreen.jsx";
import { WorkforceIntelligenceScreen } from "./admin/WorkforceIntelligenceScreen.jsx";
import { ModerationScreen } from "./admin/ModerationScreen.jsx";
import { AdminStudyGroupsScreen } from "./admin/AdminStudyGroupsScreen.jsx";
import { AdminAnalyticsScreen } from "./admin/AdminAnalyticsScreen.jsx";
import { CohortsScreen } from "./admin/CohortsScreen.jsx";
import { OrgRoleAccessScreen } from "./admin/OrgRoleAccessScreen.jsx";
import { CohortDetailScreen } from "./admin/CohortDetailScreen.jsx";
import { ComplianceScreen } from "./admin/ComplianceScreen.jsx";
import { IntegrationsScreen } from "./admin/IntegrationsScreen.jsx";
import { SettingsHubScreen } from "./admin/SettingsHubScreen.jsx";
import { MentorDashboardScreen } from "./mentor/MentorDashboardScreen.jsx";
import { MentorStudyGroupsScreen } from "./mentor/MentorStudyGroupsScreen.jsx";
import { MentorScheduleScreen } from "./mentor/MentorScheduleScreen.jsx";
import { MenteesScreen } from "./mentor/MenteesScreen.jsx";
import { MentorMessagesScreen } from "./mentor/MentorMessagesScreen.jsx";
import { DiscussionsScreen } from "./mentor/DiscussionsScreen.jsx";
import { MentorAnalyticsScreen } from "./mentor/MentorAnalyticsScreen.jsx";
import { AdministrativeScreen } from "./mentor/AdministrativeScreen.jsx";
import { MentorSettingsScreen } from "./mentor/MentorSettingsScreen.jsx";
import { CheckCircle2 } from "lucide-react";
import { ManagerDashboardScreen } from "./manager/ManagerDashboardScreen.jsx";
import { getAvailableDashboards, DASHBOARDS } from "../lib/roleRouting.js";

// Picks which workspace tab a signed-in platform user lands on by default,
// in descending order of privilege - admin/super_admin keep the previous
// hardcoded "admin" default, mentor keeps its own tab, and manager (which
// previously had no tab to fall into at all and landed on the Admin
// workspace's full CRUD screens by accident) gets its own scoped landing
// spot instead. HR removed entirely - confirmed directly that HR is not an
// organization role; Admin/Manager/Instructor is the full set.
function defaultWorkspaceForRoles(roles = []) {
  if (roles.includes("admin") || roles.includes("super_admin")) return "admin";
  if (roles.includes("mentor")) return "mentor";
  if (roles.includes("manager")) return "manager";
  return "admin";
}

import { fetchAllOrganizationsWithUserCounts } from "../lib/api/platform.js";

export default function TrainAIPlatformApp({ onSwitchToLearner, onSwitchDashboard, userRoles: userRolesProp, superAdminSelectedOrgId, setSuperAdminSelectedOrgId } = {}) {
  const { session, profileQuery, orgId, userRoles: fallbackUserRoles } = usePlatformData();
  const userRoles = userRolesProp && userRolesProp.length ? userRolesProp : fallbackUserRoles;

  const mentorProfileQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return null;
    return fetchMentorProfile(session.user.id);
  }, [session?.user?.id]);
  const mentorId = mentorProfileQuery.data?.id || null;

  const allOrgsQuery = useSupabaseQuery(async () => {
    if (userRoles.includes("super_admin")) {
      return await fetchAllOrganizationsWithUserCounts();
    }
    return [];
  }, [userRoles]);
  const allOrgs = allOrgsQuery.data || [];

  // superAdminSelectedOrgId is now a prop from App.jsx, shared with
  // PlatformOwnerApp - Super Admin picking "View" on an org from the Owner
  // dashboard needs this to survive the switch into this component, which
  // local state here couldn't do once Owner became a separate top-level
  // component instead of a workspace tab inside this one.
  const effectiveOrgId = (userRoles.includes("super_admin") && superAdminSelectedOrgId) ? superAdminSelectedOrgId : orgId;

  const orgSelector = userRoles.includes("super_admin") ? {
    orgs: allOrgs,
    selectedOrgId: superAdminSelectedOrgId,
    onSelectOrg: (id) => setSuperAdminSelectedOrgId(id),
  } : null;

  const [workspace, setWorkspace] = useState(() => defaultWorkspaceForRoles(userRoles));
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
  function setScreen(s) {
    setScreenByWorkspace(prev => ({ ...prev, [workspace]: s }));
  }

  function navigateToScreen(targetScreen, targetWs = null, extraState = {}) {
    let ws = targetWs;
    if (!ws) {
      if (["mentor-dashboard", "schedule", "mentees", "messages", "discussions", "mentor-analytics", "administrative", "mentor-settings"].includes(targetScreen)) {
        ws = "mentor";
      } else if (["manager-overview"].includes(targetScreen)) {
        ws = "manager";
      } else {
        ws = "admin";
      }
    }
    if (extraState?.courseId !== undefined) {
      setSelectedCourseId(extraState.courseId);
    }
    setWorkspace(ws);
    setScreenByWorkspace(prev => ({ ...prev, [ws]: targetScreen }));
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
  if (orgPaymentCallbackActive) {
    return <OrgPaymentCallbackScreen onDone={() => setOrgPaymentCallbackActive(false)} />;
  }

  return (
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
              />

            <div className="ta-main">
              {workspace === "admin" && (
                <>
                  {screen === "dashboard" && <AdminDashboardScreen orgId={effectiveOrgId} profileQuery={profileQuery} setScreen={setScreen} orgSelector={orgSelector} isPlatformOwner={userRoles.includes("super_admin")} />}
                  {screen === "people" && <PeopleScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} />}
                  {screen === "content" && <ContentScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} selectedCourseId={selectedCourseId} setSelectedCourseId={setSelectedCourseId} currentUserId={session?.user?.id} />}
                  {screen === "paths" && <LearningPathsScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} />}
                  {screen === "workforce" && <WorkforceIntelligenceScreen orgId={effectiveOrgId} orgSelector={orgSelector} />}
                  {screen === "moderation" && <ModerationScreen orgSelector={orgSelector} setScreen={setScreen} orgId={effectiveOrgId} currentUserId={session?.user?.id} />}
                  {screen === "studygroups" && <AdminStudyGroupsScreen orgId={effectiveOrgId} orgSelector={orgSelector} />}
                  {screen === "analytics" && <AdminAnalyticsScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} isPlatformOwner={userRoles.includes("super_admin")} />}
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
                  {screen === "roleaccess" && <OrgRoleAccessScreen orgId={effectiveOrgId} orgSelector={orgSelector} currentUserId={session?.user?.id} />}
                  {screen === "integrations" && <IntegrationsScreen orgId={effectiveOrgId} userId={session?.user?.id} orgSelector={orgSelector} setScreen={setScreen} isPlatformOwner={userRoles.includes("super_admin")} />}
                  {screen === "settings" && <SettingsHubScreen orgId={effectiveOrgId} profileQuery={profileQuery} orgSelector={orgSelector} setScreen={setScreen} userEmail={session?.user?.email} session={session} />}
                </>
              )}

              {workspace === "mentor" && (
                <>
                  {screen === "dashboard" && <MentorDashboardScreen mentorId={mentorId} orgSelector={orgSelector} currentUserId={session?.user?.id} profileQuery={profileQuery} orgId={effectiveOrgId} />}
                  {screen === "cohorts" && (
                    <CohortsScreen
                      orgId={effectiveOrgId}
                      orgSelector={orgSelector}
                      setScreen={setScreen}
                      currentUserId={session?.user?.id}
                      onOpenCohort={(cohortId) => {
                        setSelectedCohortId(cohortId);
                        setScreen("mentor-cohort-detail");
                      }}
                    />
                  )}
                  {screen === "mentor-cohort-detail" && (
                    <CohortDetailScreen
                      orgId={effectiveOrgId}
                      cohortId={selectedCohortId}
                      currentUserId={session?.user?.id}
                      onBack={() => setScreen("cohorts")}
                      orgSelector={orgSelector}
                      setScreen={setScreen}
                    />
                  )}
                  {screen === "studygroups" && <MentorStudyGroupsScreen mentorId={session?.user?.id} orgId={effectiveOrgId} orgSelector={orgSelector} />}
                  {screen === "content" && <ContentScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} selectedCourseId={selectedCourseId} setSelectedCourseId={setSelectedCourseId} currentUserId={session?.user?.id} />}
                  {screen === "schedule" && <MentorScheduleScreen mentorId={mentorId} orgSelector={orgSelector} />}
                  {screen === "mentees" && <MenteesScreen mentorId={mentorId} orgSelector={orgSelector} setScreen={setScreen} setSelectedLearnerForChat={setSelectedLearnerForChat} orgId={effectiveOrgId} currentUserId={session?.user?.id} />}
                  {screen === "messages" && <MentorMessagesScreen userId={session?.user?.id} mentorId={mentorId} orgSelector={orgSelector} selectedLearnerForChat={selectedLearnerForChat} setScreen={setScreen} orgId={effectiveOrgId} />}
                  {screen === "discussions" && <DiscussionsScreen mentorId={mentorId} orgSelector={orgSelector} />}
                  {screen === "analytics" && <MentorAnalyticsScreen mentorId={mentorId} mentorProfileQuery={mentorProfileQuery} orgSelector={orgSelector} />}
                  {screen === "admin" && <AdministrativeScreen mentorId={mentorId} orgSelector={orgSelector} mentorProfileQuery={mentorProfileQuery} currentUserId={session?.user?.id} />}
                  {screen === "settings" && <MentorSettingsScreen mentorId={mentorId} mentorProfileQuery={mentorProfileQuery} orgSelector={orgSelector} currentUserId={session?.user?.id} userProfileQuery={profileQuery} />}
                </>
              )}

              {workspace === "manager" && (
                <>
                  {screen === "dashboard" && <ManagerDashboardScreen userId={session?.user?.id} profileQuery={profileQuery} orgSelector={orgSelector} orgId={effectiveOrgId} />}
                  {screen === "workforce" && <WorkforceIntelligenceScreen orgId={effectiveOrgId} orgSelector={orgSelector} />}
                </>
              )}
            </div>
          </div>

          {toast && (
            <div className="tai-toast anim-pop" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, background: "var(--text)", color: "#fff", padding: "10px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
              <CheckCircle2 size={16} /> {toast}
            </div>
          )}

          {switcherOpen && (
            <DashboardSwitcher
              currentDashboard={DASHBOARDS.ORGANISATION}
              availableDashboards={getAvailableDashboards(userRoles)}
              roleLabel={userRoles.includes("super_admin") ? "Super Admin" : "Admin"}
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
);
}
