import React, { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { usePlatformData } from "./hooks/usePlatformData.js";
import { useSupabaseQuery } from "../lib/useSupabaseQuery.js";
import { SUPABASE_PROJECTS, activeProject, getSupabaseClientForProject, setActiveSupabaseProject } from "../services/supabaseClient.js";
import { TOKENS, OwnerSidebar, DashboardSwitcher, MobileMenuContext, ToastContext, NavigationContext, WorkspaceContext, ActiveDashboardContext, SignOutContext } from "./components/PlatformUI.jsx";
import { OverviewScreen } from "./superadmin/OverviewScreen.jsx";
import { OrganizationsScreen } from "./superadmin/OrganizationsScreen.jsx";
import { OrgOnboardingWizard } from "./superadmin/OrgOnboardingWizard.jsx";
import { BrandingScreen } from "./superadmin/BrandingScreen.jsx";
import { PlatformSettingsScreen } from "./superadmin/PlatformSettingsScreen.jsx";
import { TracksScreen } from "./superadmin/TracksScreen.jsx";
import { EmailsScreen } from "./superadmin/EmailsScreen.jsx";
import { AccessControlScreen } from "./superadmin/AccessControlScreen.jsx";
import { SupportQueueScreen } from "./superadmin/SupportQueueScreen.jsx";
import { DemoRequestsScreen } from "./superadmin/DemoRequestsScreen.jsx";
import { fetchAllOrganizationsWithUserCounts } from "../lib/api/platform.js";
import { getAvailableDashboards, DASHBOARDS, isPlatformOwnerEmail } from "../lib/roleRouting.js";

const PROJECT_LABELS = {
  [SUPABASE_PROJECTS.ORGANIZATION_DB]: "Train AI Unified Database (jeobggrtxeybxvlwpxvn)",
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: "Train AI Unified Database (jeobggrtxeybxvlwpxvn)",
};

const PROJECT_KEYS = [
  SUPABASE_PROJECTS.ORGANIZATION_DB,
];

// The Platform Owner Dashboard - a genuinely separate top-level dashboard,
// not a tab inside the Organisation dashboard's Sidebar the way it used to
// be. App.jsx mounts this component directly when the active top-level
// dashboard is "owner", the same way it mounts TrainAILearnerApp for
// "learner" and TrainAIPlatformApp for "organisation" - three real
// dashboards, not one dashboard with a hidden extra tab.
export default function PlatformOwnerApp({
  isActive = true,
  onSwitchDashboard,
  userRoles: userRolesProp,
  superAdminSelectedOrgId: controlledOrgId,
  setSuperAdminSelectedOrgId: controlledSetOrgId,
  onSignOut
} = {}) {
  const { session, profileQuery, userRoles: hookRoles } = usePlatformData();
  const userRoles = userRolesProp || hookRoles;
  const userEmail = session?.user?.email || profileQuery?.data?.email || "";

  useEffect(() => {
    setActiveSupabaseProject(SUPABASE_PROJECTS.ORGANIZATION_DB);
  }, []);

  if (session && !isPlatformOwnerEmail(userEmail)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#0F172A", background: "#F8FAFC", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Access Restricted</h2>
        <p style={{ color: "#64748B", maxWidth: 440 }}>The Platform Owner Dashboard is strictly reserved for Train AI staff (trainailtd@gmail.com). Organization administrators manage their cohorts and learners from the Organisation Dashboard.</p>
        <button
          onClick={() => onSwitchDashboard ? onSwitchDashboard(DASHBOARDS.ORGANISATION) : window.location.reload()}
          style={{ marginTop: 20, padding: "10px 24px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
        >
          Return to Organisation Dashboard
        </button>
      </div>
    );
  }

  const allOrgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), [activeProject]);
  const allOrgs = allOrgsQuery.data || [];
  const digitalOrg = allOrgs.find((o) => o.slug === "tech-learning" || o.slug === "digital-users") || allOrgs[0];
  const [internalOrgId, setInternalOrgId] = useState("");
  const selectedOrgId = (controlledOrgId !== undefined && controlledOrgId !== "") ? controlledOrgId : (internalOrgId || digitalOrg?.id || "");
  const setSelectedOrgId = controlledSetOrgId || setInternalOrgId;
  const orgSelector = {
    orgs: allOrgs,
    selectedOrgId: selectedOrgId,
    onSelectOrg: (id) => setSelectedOrgId(id),
  };

  useEffect(() => {
    if (!controlledOrgId && digitalOrg?.id && controlledSetOrgId) {
      controlledSetOrgId(digitalOrg.id);
    }
  }, [controlledOrgId, digitalOrg?.id, controlledSetOrgId]);

  const [projectSessionStatus, setProjectSessionStatus] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const statuses = {};
      for (const projectKey of PROJECT_KEYS) {
        const client = getSupabaseClientForProject(projectKey);
        if (!client) { statuses[projectKey] = "not_configured"; continue; }
        try {
          const { data } = await client.auth.getSession();
          statuses[projectKey] = data?.session ? "authenticated" : "no_session";
        } catch {
          statuses[projectKey] = "no_session";
        }
      }
      if (!cancelled) setProjectSessionStatus(statuses);
    })();
    return () => { cancelled = true; };
  }, [activeProject]);

  const [screen, setScreen] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const availableDashboards = getAvailableDashboards(userRoles, session?.user?.email || profileQuery?.data?.email);
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

  return (
    <ActiveDashboardContext.Provider value={isActive}>
    <WorkspaceContext.Provider value={"owner"}>
    <SignOutContext.Provider value={onSignOut}>
      <NavigationContext.Provider value={(target) => setScreen(target)}>
        <MobileMenuContext.Provider value={() => setMobileOpen(true)}>
          <ToastContext.Provider value={showToast}>
            <div className={`ta ${isDark ? "dark" : ""}`}>
              <style>{TOKENS}</style>
              <div className="ta-shell">
                <OwnerSidebar
                  screen={screen}
                  setScreen={setScreen}
                  mobileOpen={mobileOpen}
                  onClose={() => setMobileOpen(false)}
                  onOpenDashboardSwitcher={() => setSwitcherOpen(true)}
                  onSignOut={onSignOut}
                />

              <div className="ta-main">
                {screen === "overview" && <OverviewScreen orgSelector={orgSelector} onNavigate={(scr) => setScreen(scr)} />}
                {screen === "demos" && <DemoRequestsScreen orgSelector={orgSelector} />}
                {screen === "orgs" && (
                  <OrganizationsScreen
                    orgSelector={orgSelector}
                    onSwitchToOrgWorkspace={() => onSwitchDashboard && onSwitchDashboard(DASHBOARDS.ORGANISATION)}
                    onLaunchOnboarding={() => setScreen("onboarding")}
                    currentUserId={session?.user?.id}
                  />
                )}
                {screen === "onboarding" && (
                  <OrgOnboardingWizard
                    currentUserProfileId={profileQuery?.data?.id}
                    orgSelector={orgSelector}
                    onSwitchToOrgWorkspace={() => onSwitchDashboard && onSwitchDashboard(DASHBOARDS.ORGANISATION)}
                    onGoToOrgsList={() => setScreen("orgs")}
                  />
                )}
                {screen === "branding" && <BrandingScreen orgSelector={orgSelector} />}
                {screen === "settings" && (
                  <PlatformSettingsScreen
                    orgSelector={orgSelector}
                    activeProject={activeProject}
                    projectSessionStatus={projectSessionStatus}
                    onSwitchProject={(key) => { setActiveSupabaseProject(key); setSelectedOrgId(""); window.location.reload(); }}
                  />
                )}
                {screen === "tracks" && <TracksScreen orgSelector={orgSelector} />}
                {screen === "emails" && <EmailsScreen orgSelector={orgSelector} />}
                {screen === "support" && <SupportQueueScreen currentUserId={session?.user?.id} />}
                {screen === "access" && <AccessControlScreen orgSelector={orgSelector} />}
              </div>
            </div>

            {toast && (
              <div className="anim-pop" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", maxWidth: "calc(100vw - 32px)", zIndex: 999, background: "var(--text)", color: "#fff", padding: "10px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, boxShadow: "0 12px 32px -4px rgba(15,23,42,0.35)", boxSizing: "border-box" }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{toast}</span>
              </div>
            )}

            {switcherOpen && (
              <DashboardSwitcher
                currentDashboard={DASHBOARDS.OWNER}
                availableDashboards={availableDashboards}
                roleLabel="Super Admin"
                onSwitch={(key) => { setSwitcherOpen(false); onSwitchDashboard && onSwitchDashboard(key); }}
                onClose={() => setSwitcherOpen(false)}
              />
            )}
          </div>
        </ToastContext.Provider>
      </MobileMenuContext.Provider>
    </NavigationContext.Provider>
  </SignOutContext.Provider>
    </WorkspaceContext.Provider>
    </ActiveDashboardContext.Provider>
);
}
