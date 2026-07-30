import React, { useState } from "react";
import { usePlatformData } from "./hooks/usePlatformData.js";
import { useSupabaseQuery } from "../lib/useSupabaseQuery.js";
import { fetchMentorProfile } from "../lib/api/schemaHelper.js";
import { TOKENS, Sidebar, MobileMenuContext, ToastContext, NavigationContext } from "./components/PlatformUI.jsx";
import { AdminDashboardScreen } from "./admin/AdminDashboardScreen.jsx";
import { PeopleScreen } from "./admin/PeopleScreen.jsx";
import { ContentScreen } from "./admin/ContentScreen.jsx";
import { ModerationScreen } from "./admin/ModerationScreen.jsx";
import { AdminAnalyticsScreen } from "./admin/AdminAnalyticsScreen.jsx";
import { CohortsScreen } from "./admin/CohortsScreen.jsx";
import { CohortDetailScreen } from "./admin/CohortDetailScreen.jsx";
import { ForumsScreen } from "./admin/ForumsScreen.jsx";
import { ComplianceScreen } from "./admin/ComplianceScreen.jsx";
import { IntegrationsScreen } from "./admin/IntegrationsScreen.jsx";
import { GJPScreen } from "./admin/GJPScreen.jsx";
import { SettingsHubScreen } from "./admin/SettingsHubScreen.jsx";
import { MentorDashboardScreen } from "./mentor/MentorDashboardScreen.jsx";
import { MentorScheduleScreen } from "./mentor/MentorScheduleScreen.jsx";
import { MenteesScreen } from "./mentor/MenteesScreen.jsx";
import { MentorMessagesScreen } from "./mentor/MentorMessagesScreen.jsx";
import { DiscussionsScreen } from "./mentor/DiscussionsScreen.jsx";
import { MentorAnalyticsScreen } from "./mentor/MentorAnalyticsScreen.jsx";
import { AdministrativeScreen } from "./mentor/AdministrativeScreen.jsx";
import { MentorSettingsScreen } from "./mentor/MentorSettingsScreen.jsx";
import { OverviewScreen } from "./superadmin/OverviewScreen.jsx";
import { OrganizationsScreen } from "./superadmin/OrganizationsScreen.jsx";
import { OrgOnboardingWizard } from "./superadmin/OrgOnboardingWizard.jsx";
import { BrandingScreen } from "./superadmin/BrandingScreen.jsx";
import { PlatformSettingsScreen } from "./superadmin/PlatformSettingsScreen.jsx";
import { TracksScreen } from "./superadmin/TracksScreen.jsx";
import { EmailsScreen } from "./superadmin/EmailsScreen.jsx";
import { AccessControlScreen } from "./superadmin/AccessControlScreen.jsx";
import { HrDashboardScreen } from "./hr/HrDashboardScreen.jsx";
import { ManagerDashboardScreen } from "./manager/ManagerDashboardScreen.jsx";
import { CheckCircle2 } from "lucide-react";

// Picks which workspace tab a signed-in platform user lands on by default,
// in descending order of privilege — admin/super_admin keep the previous
// hardcoded "admin" default, mentor keeps its own tab, and hr/manager (which
// previously had no tab to fall into at all and landed on the Admin
// workspace's full CRUD screens by accident) now get their own scoped
// landing spot instead.
function defaultWorkspaceForRoles(roles = []) {
  if (roles.includes("admin") || roles.includes("super_admin")) return "admin";
  if (roles.includes("mentor")) return "mentor";
  if (roles.includes("hr")) return "hr";
  if (roles.includes("manager")) return "manager";
  return "admin";
}

import { fetchAllOrganizationsWithUserCounts } from "../lib/api/platform.js";

export default function TrainAIPlatformApp({ onSwitchToLearner, userRoles: userRolesProp } = {}) {
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

  const [superAdminSelectedOrgId, setSuperAdminSelectedOrgId] = useState("");
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
    hr: "dashboard",
    manager: "dashboard",
    superadmin: "overview",
  });
  const [selectedCohortId, setSelectedCohortId] = useState(null);
  const [selectedLearnerForChat, setSelectedLearnerForChat] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);

  const screen = screenByWorkspace[workspace] || "dashboard";
  function setScreen(s) {
    setScreenByWorkspace(prev => ({ ...prev, [workspace]: s }));
  }

  function navigateToScreen(targetScreen, targetWs = null, extraState = {}) {
    let ws = targetWs;
    if (!ws) {
      if (["overview", "organizations", "org-onboarding", "branding", "platform-settings", "tracks", "emails", "access-control"].includes(targetScreen)) {
        ws = "superadmin";
      } else if (["mentor-dashboard", "schedule", "mentees", "messages", "discussions", "mentor-analytics", "administrative", "mentor-settings"].includes(targetScreen)) {
        ws = "mentor";
      } else if (["hr-overview"].includes(targetScreen)) {
        ws = "hr";
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
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <NavigationContext.Provider value={navigateToScreen}>
      <MobileMenuContext.Provider value={() => setMobileOpen(true)}>
        <ToastContext.Provider value={showToast}>
          <div className="ta">
            <style>{TOKENS}</style>
            <div className="ta-shell">
              <Sidebar
                workspace={workspace}
                setWorkspace={setWorkspace}
                screen={screen}
                setScreen={setScreen}
                mobileOpen={mobileOpen}
                onClose={() => setMobileOpen(false)}
                onSwitchToLearner={onSwitchToLearner}
                userRoles={userRoles}
              />

            <div className="ta-main">
              {workspace === "admin" && (
                <>
                  {screen === "dashboard" && <AdminDashboardScreen orgId={effectiveOrgId} profileQuery={profileQuery} setScreen={setScreen} orgSelector={orgSelector} />}
                  {screen === "people" && <PeopleScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} />}
                  {screen === "content" && <ContentScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} selectedCourseId={selectedCourseId} setSelectedCourseId={setSelectedCourseId} currentUserId={session?.user?.id} />}
                  {screen === "moderation" && <ModerationScreen orgSelector={orgSelector} setScreen={setScreen} />}
                  {screen === "analytics" && <AdminAnalyticsScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} />}
                  {screen === "cohorts" && (
                    <CohortsScreen
                      orgId={effectiveOrgId}
                      orgSelector={orgSelector}
                      setScreen={setScreen}
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
                  {screen === "forums" && <ForumsScreen orgSelector={orgSelector} setScreen={setScreen} />}
                  {screen === "compliance" && <ComplianceScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} currentUserId={session?.user?.id} />}
                  {screen === "integrations" && <IntegrationsScreen orgId={effectiveOrgId} userId={session?.user?.id} orgSelector={orgSelector} setScreen={setScreen} />}
                  {screen === "gjp" && <GJPScreen orgId={effectiveOrgId} orgSelector={orgSelector} setScreen={setScreen} />}
                  {screen === "settings" && <SettingsHubScreen orgId={effectiveOrgId} profileQuery={profileQuery} orgSelector={orgSelector} setScreen={setScreen} />}
                </>
              )}

              {workspace === "mentor" && (
                <>
                  {screen === "dashboard" && <MentorDashboardScreen mentorId={mentorId} orgSelector={orgSelector} />}
                  {screen === "schedule" && <MentorScheduleScreen mentorId={mentorId} orgSelector={orgSelector} />}
                  {screen === "mentees" && <MenteesScreen mentorId={mentorId} orgSelector={orgSelector} setScreen={setScreen} setSelectedLearnerForChat={setSelectedLearnerForChat} />}
                  {screen === "messages" && <MentorMessagesScreen userId={session?.user?.id} mentorId={mentorId} orgSelector={orgSelector} selectedLearnerForChat={selectedLearnerForChat} setScreen={setScreen} />}
                  {screen === "discussions" && <DiscussionsScreen mentorId={mentorId} orgSelector={orgSelector} />}
                  {screen === "analytics" && <MentorAnalyticsScreen mentorId={mentorId} mentorProfileQuery={mentorProfileQuery} orgSelector={orgSelector} />}
                  {screen === "admin" && <AdministrativeScreen mentorId={mentorId} orgSelector={orgSelector} />}
                  {screen === "settings" && <MentorSettingsScreen mentorId={mentorId} mentorProfileQuery={mentorProfileQuery} orgSelector={orgSelector} />}
                </>
              )}

              {workspace === "hr" && (
                <>
                  {screen === "dashboard" && <HrDashboardScreen orgId={effectiveOrgId} profileQuery={profileQuery} orgSelector={orgSelector} />}
                </>
              )}

              {workspace === "manager" && (
                <>
                  {screen === "dashboard" && <ManagerDashboardScreen userId={session?.user?.id} profileQuery={profileQuery} orgSelector={orgSelector} />}
                </>
              )}

              {workspace === "superadmin" && (
                <>
                  {screen === "overview" && <OverviewScreen orgSelector={orgSelector} />}
                  {screen === "orgs" && (
                    <OrganizationsScreen
                      orgSelector={orgSelector}
                      onSwitchToOrgWorkspace={() => setWorkspace("admin")}
                      onLaunchOnboarding={() => setScreen("onboarding")}
                    />
                  )}
                  {screen === "onboarding" && (
                    <OrgOnboardingWizard
                      currentUserProfileId={profileQuery?.data?.id}
                      orgSelector={orgSelector}
                      onSwitchToOrgWorkspace={() => setWorkspace("admin")}
                      onGoToOrgsList={() => setScreen("orgs")}
                    />
                  )}
                  {screen === "branding" && <BrandingScreen orgSelector={orgSelector} />}
                  {screen === "settings" && <PlatformSettingsScreen orgSelector={orgSelector} />}
                  {screen === "tracks" && <TracksScreen orgSelector={orgSelector} />}
                  {screen === "emails" && <EmailsScreen orgSelector={orgSelector} />}
                  {screen === "access" && <AccessControlScreen orgSelector={orgSelector} />}
                </>
              )}
            </div>
          </div>

          {toast && (
            <div className="tai-toast anim-pop" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, background: "var(--text)", color: "#fff", padding: "10px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
              <CheckCircle2 size={16} /> {toast}
            </div>
          )}
        </div>
      </ToastContext.Provider>
    </MobileMenuContext.Provider>
  </NavigationContext.Provider>
);
}
