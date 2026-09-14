import React, { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { usePlatformData } from "./hooks/usePlatformData.js";
import { useSupabaseQuery } from "../lib/useSupabaseQuery.js";
import { SUPABASE_PROJECTS, activeProject, getSupabaseClientForProject, setActiveSupabaseProject } from "../services/supabaseClient.js";
import { TOKENS, OwnerSidebar, DashboardSwitcher, MobileMenuContext, ToastContext, NavigationContext } from "./components/PlatformUI.jsx";
import { OverviewScreen } from "./superadmin/OverviewScreen.jsx";
import { OrganizationsScreen } from "./superadmin/OrganizationsScreen.jsx";
import { OrgOnboardingWizard } from "./superadmin/OrgOnboardingWizard.jsx";
import { BrandingScreen } from "./superadmin/BrandingScreen.jsx";
import { PlatformSettingsScreen } from "./superadmin/PlatformSettingsScreen.jsx";
import { TracksScreen } from "./superadmin/TracksScreen.jsx";
import { EmailsScreen } from "./superadmin/EmailsScreen.jsx";
import { AccessControlScreen } from "./superadmin/AccessControlScreen.jsx";
import { SupportQueueScreen } from "./superadmin/SupportQueueScreen.jsx";
import { fetchAllOrganizationsWithUserCounts } from "../lib/api/platform.js";
import { getAvailableDashboards, DASHBOARDS } from "../lib/roleRouting.js";

const PROJECT_LABELS = {
  [SUPABASE_PROJECTS.SARA_FOUNDATION]: "Sara Foundation",
  [SUPABASE_PROJECTS.DIGITAL_TRAINING]: "Digital Training Org (+ Super Admin)",
  [SUPABASE_PROJECTS.B2B]: "B2B Organizations",
};

function ProjectSwitcherBanner({ activeProject: current, projectSessionStatus, onSwitch }) {
  return (
    <div className="ta-card ta-mt16" style={{ background: "var(--surface-2)" }}>
      <div className="ta-row ta-between" style={{ flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-2)" }}>DATABASE / PROJECT</div>
        <div className="ta-row ta-gap8" style={{ flexWrap: "wrap" }}>
          {Object.values(SUPABASE_PROJECTS).map((key) => {
            const status = projectSessionStatus?.[key];
            const isActive = key === current;
            return (
              <button
                key={key}
                className={isActive ? "ta-btn ta-btn-primary ta-btn-sm" : "ta-btn ta-btn-outline ta-btn-sm"}
                onClick={() => !isActive && onSwitch(key)}
                title={
                  status === "not_configured" ? "No real project connected yet - demo mode"
                  : status === "authenticated" ? "You have an active session here"
                  : "Configured, but you are not signed in here yet"
                }
              >
                {PROJECT_LABELS[key]}
                {status === "not_configured" && " (demo)"}
                {status === "no_session" && " (not signed in)"}
              </button>
            );
          })}
        </div>
      </div>
      {projectSessionStatus?.[current] === "no_session" && (
        <div style={{ fontSize: 11.5, color: "var(--warning, #B45309)", marginTop: 8 }}>
          This project is configured, but you don't have a session here yet - sign in with an account that has
          super_admin access in this specific project to see its real data.
        </div>
      )}
    </div>
  );
}

// The Platform Owner Dashboard - a genuinely separate top-level dashboard,
// not a tab inside the Organisation dashboard's Sidebar the way it used to
// be. App.jsx mounts this component directly when the active top-level
// dashboard is "owner", the same way it mounts TrainAILearnerApp for
// "learner" and TrainAIPlatformApp for "organisation" - three real
// dashboards, not one dashboard with a hidden extra tab.
export default function PlatformOwnerApp({
  onSwitchDashboard,
  userRoles: userRolesProp,
  superAdminSelectedOrgId: controlledOrgId,
  setSuperAdminSelectedOrgId: controlledSetOrgId,
  onSignOut
} = {}) {
  const { session, profileQuery, userRoles: hookRoles } = usePlatformData();
  const userRoles = userRolesProp || hookRoles;

  const allOrgsQuery = useSupabaseQuery(async () => fetchAllOrganizationsWithUserCounts(), [activeProject]);
  const allOrgs = allOrgsQuery.data || [];
  const [internalOrgId, setInternalOrgId] = useState("");
  const selectedOrgId = controlledOrgId !== undefined ? controlledOrgId : internalOrgId;
  const setSelectedOrgId = controlledSetOrgId || setInternalOrgId;
  const orgSelector = {
    orgs: allOrgs,
    selectedOrgId: selectedOrgId,
    onSelectOrg: (id) => setSelectedOrgId(id),
  };

  const [projectSessionStatus, setProjectSessionStatus] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const statuses = {};
      for (const projectKey of Object.values(SUPABASE_PROJECTS)) {
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

  const availableDashboards = getAvailableDashboards(userRoles);
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
              />

              <div className="ta-main">
                {screen === "overview" && <OverviewScreen orgSelector={orgSelector} />}
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
                    onSwitchProject={(key) => { setActiveSupabaseProject(key); setSuperAdminSelectedOrgId(""); window.location.reload(); }}
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
  );
}
