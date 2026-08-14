import React, { useState, useEffect } from "react";
import TrainAILearnerApp from "./learner/TrainAILearnerApp.jsx";
import TrainAIPlatformApp from "./platform/TrainAIPlatformApp.jsx";
import PlatformOwnerApp from "./platform/PlatformOwnerApp.jsx";
import { PlatformOwnerLoginScreen } from "./pages/PlatformOwnerLoginScreen.jsx";
import { useAuth } from "./hooks/useAuth.js";
import LandingPage from "./pages/public/LandingPage.jsx";
import AuthPage from "./pages/auth/AuthPage.jsx";
import MfaChallengeScreen from "./pages/auth/MfaChallengeScreen.jsx";
import AcceptInvitationScreen from "./pages/auth/AcceptInvitationScreen.jsx";
import OnboardingPage from "./pages/onboarding/OnboardingPage.jsx";
import LoadingScreen from "./components/common/LoadingScreen.jsx";
import ConsentBanner from "./components/common/ConsentBanner.jsx";
import OfflineIndicator from "./components/common/OfflineIndicator.jsx";
import { applyAccessibilityPrefs, getStoredAccessibilityPrefs } from "./components/common/AccessibilityPanel.jsx";
import { fetchMyRoles, fetchMyPersonalization, saveMyPersonalization } from "./services/authService.js";
import { resolveViewMode, DASHBOARDS } from "./lib/roleRouting.js";
import { getAuthenticatorAssuranceLevel } from "./lib/api/mfa.js";

export default function App() {
  const { session, loading, authError, signIn, signUp, signOut, isDemoMode } = useAuth();

  // Platform Owner's separate login - PRD Section 10: "not login from
  // initial login area - separate login." Checked before any of the
  // regular auth/session logic below runs, and returns immediately if
  // matched - this path never touches AuthPage, never shows the
  // Organization/Individual Learner choice, and isn't linked from
  // anywhere in the regular flow.
  const [ownerPortalAuthenticated, setOwnerPortalAuthenticated] = useState(false);
  const isOwnerPortalURL = (() => {
    try {
      // Two entry points into the exact same real login screen and role
      // check below - neither weakens the other. "?portal=owner" is the
      // permanent one. "/admin" is confirmed as a deliberately temporary
      // second path - "let access super admin temporary by typing
      // url/admin for now before database" - easier to remember for a
      // one-off review than a query string, explicitly meant to be
      // reconsidered once real database-driven access control is fully in
      // place (Philip's task list: "Prepare the system for database-driven
      // access controls once the database integration is complete" -
      // this is the temporary bridge to that, not a replacement for it).
      // It does not skip authentication or the super_admin check in
      // PlatformOwnerLoginScreen.jsx - it only changes how someone finds
      // their way to that same screen.
      const path = window.location.pathname.replace(/\/+$/, "");
      const isAdminPath = path === "/admin" || path.endsWith("/admin");
      return new URLSearchParams(window.location.search).get("portal") === "owner" || isAdminPath;
    } catch {
      return false;
    }
  })();
  if (isOwnerPortalURL && !ownerPortalAuthenticated) {
    return <PlatformOwnerLoginScreen onAuthenticated={() => setOwnerPortalAuthenticated(true)} />;
  }
  if (isOwnerPortalURL && ownerPortalAuthenticated) {
    return <PlatformOwnerApp onSwitchDashboard={() => {}} userRoles={["super_admin"]} />;
  }

  // Step-up MFA gate: "checking" while we ask Supabase for this session's
  // Authenticator Assurance Level, "required" when the user has a verified
  // TOTP factor but this session is still aal1 (needs MfaChallengeScreen
  // before anything else renders), "clear" otherwise. Demo mode (no
  // Supabase project configured) never has real MFA factors, so it always
  // resolves straight to "clear".
  const [mfaGate, setMfaGate] = useState("checking");

  useEffect(() => {
    if (loading) return;
    if (!session || isDemoMode) {
      setMfaGate("clear");
      return;
    }
    let cancelled = false;
    setMfaGate("checking");
    getAuthenticatorAssuranceLevel()
      .then(({ currentLevel, nextLevel }) => {
        if (cancelled) return;
        setMfaGate(currentLevel === "aal1" && nextLevel === "aal2" ? "required" : "clear");
      })
      .catch(() => {
        // Fail open on transient errors so a user is never trapped outside
        // their own account because an AAL lookup hiccuped.
        if (!cancelled) setMfaGate("clear");
      });
    return () => { cancelled = true; };
  }, [loading, session?.user?.id, isDemoMode]);

  // Apply persisted accessibility preferences (font size / high contrast /
  // reduced motion) immediately on boot, before the panel is ever opened,
  // so the choice actually sticks across reloads.
  useEffect(() => {
    applyAccessibilityPrefs(getStoredAccessibilityPrefs());
  }, []);

  // Native online/offline detection - no new dependency, just the browser's
  // navigator.onLine + window "online"/"offline" events. Drives the
  // OfflineIndicator banner rendered below on every screen this component
  // can return. When connectivity comes back, briefly show a "back online"
  // confirmation instead of just silently clearing the banner.
  const [offlineMode, setOfflineMode] = useState(() =>
    typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine ? "offline" : null
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    let backOnlineTimer = null;
    function handleOffline() {
      if (backOnlineTimer) clearTimeout(backOnlineTimer);
      setOfflineMode("offline");
    }
    function handleOnline() {
      setOfflineMode("online");
      backOnlineTimer = setTimeout(() => setOfflineMode(null), 3000);
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (backOnlineTimer) clearTimeout(backOnlineTimer);
    };
  }, []);

  // Org invitation links land here as `?invite=TOKEN` (no router in this
  // app, so - same convention as the ?reference=/?trxref=/?session_id=
  // Paystack/Stripe callback detection in TrainAILearnerApp.jsx - a query
  // param is read once at boot to decide what to render). Unlike the
  // payment callback, an invite can be the very first link a brand-new user
  // ever opens (no account yet), so it's intercepted here, above the
  // sign-in gate, rather than inside either authenticated app shell.
  const [inviteToken, setInviteToken] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("invite") || null;
    } catch {
      return null;
    }
  });
  // Prefills AuthPage's email field after an invitation is accepted for an
  // account this browser doesn't currently hold a session for (brand-new
  // signup, or an existing-but-signed-out account) - set right before
  // switching publicView to "auth" below.
  const [inviteAuthEmail, setInviteAuthEmail] = useState("");

  const [publicView, setPublicView] = useState("landing"); // "landing" | "auth"
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [viewMode, setViewMode] = useState("learner");
  const [hasPlatformRole, setHasPlatformRole] = useState(false);
  const [userRoles, setUserRoles] = useState([]);
  // Shared between TrainAIPlatformApp (Organisation dashboard) and
  // PlatformOwnerApp (Owner dashboard) - which org Super Admin is currently
  // looking at when they cross from one dashboard to the other (e.g.
  // clicking "View" on an org from the Owner dashboard's Organizations
  // screen). Lifted up here because the two are now separate top-level
  // components, mounted/unmounted independently by this file, rather than
  // one component with an internal workspace switch that could just keep
  // this in its own local state.
  const [superAdminSelectedOrgId, setSuperAdminSelectedOrgId] = useState("");

  function switchDashboard(target) {
    if (target === DASHBOARDS.LEARNER) setViewMode("learner");
    else if (target === DASHBOARDS.ORGANISATION) setViewMode("platform");
    else if (target === DASHBOARDS.OWNER) setViewMode("owner");
  }

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setOnboardingChecked(true);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled && !onboardingChecked) {
        setOnboardingChecked(true);
      }
    }, 400);

    (async () => {
      try {
        const [personalization, roles] = await Promise.all([
          fetchMyPersonalization().catch(() => null),
          fetchMyRoles().catch(() => ["learner"])
        ]);
        const rolesList = Array.isArray(roles) && roles.length > 0 ? roles : ["learner"];
        const mode = resolveViewMode(rolesList);
        if (!cancelled) {
          setUserRoles(rolesList);
          setHasPlatformRole(mode === "platform");
          setViewMode(mode);
          setNeedsOnboarding(!personalization);
          setOnboardingChecked(true);
        }
      } catch {
        if (!cancelled) {
          setUserRoles(["learner"]);
          setHasPlatformRole(false);
          setViewMode("learner");
          setNeedsOnboarding(false);
          setOnboardingChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loading, session?.user?.id]);

  async function handleOnboardingComplete({ tracks, level }) {
    if (session?.user?.id) {
      await saveMyPersonalization(session.user.id, tracks, level);
      const roles = await fetchMyRoles().catch(() => ["learner"]);
      const rolesList = Array.isArray(roles) && roles.length > 0 ? roles : ["learner"];
      const mode = resolveViewMode(rolesList);
      setUserRoles(rolesList);
      setHasPlatformRole(mode === "platform");
      setViewMode(mode);
    }
    setNeedsOnboarding(false);
  }

  if (loading) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <LoadingScreen message="Loading Train AI..." />
      </>
    );
  }

  // Invitation links are handled before every other boot gate (sign-in,
  // MFA, onboarding) since a brand-new invitee has no session, no MFA
  // factor and no onboarding state yet - none of those gates apply until
  // after the invite itself is resolved one way or another.
  if (inviteToken) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <AcceptInvitationScreen
          token={inviteToken}
          session={session}
          onGoHome={() => {
            window.history.replaceState({}, "", window.location.pathname);
            setInviteToken(null);
          }}
          onNeedsSignIn={(email) => {
            window.history.replaceState({}, "", window.location.pathname);
            setInviteAuthEmail(email || "");
            setPublicView("auth");
            setInviteToken(null);
          }}
          onAccepted={() => {
            // Caller was already signed in as the account that just joined
            // the org - hard-reload so every downstream role/org lookup in
            // this file (userRoles, hasPlatformRole, viewMode, etc.) recomputes
            // from scratch instead of trying to patch each piece by hand.
            window.location.replace(window.location.pathname);
          }}
        />
        <ConsentBanner session={session} />
      </>
    );
  }

  if (!session) {
    if (publicView === "auth") {
      return (
        <>
          <OfflineIndicator mode={offlineMode} />
          <AuthPage onSignIn={signIn} onSignUp={signUp} authError={authError} initialEmail={inviteAuthEmail} />
          <ConsentBanner session={session} />
        </>
      );
    }
    // "courses"/"mentors" send visitors into the signup flow because course
    // browsing and mentor discovery only exist inside the authenticated
    // learner app today - there is no public catalog page to link to.
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <LandingPage
          onNavigate={(target) =>
            setPublicView(["signin", "signup", "courses", "mentors"].includes(target) ? "auth" : "landing")
          }
        />
        <ConsentBanner session={session} />
      </>
    );
  }

  if (mfaGate === "checking") {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <LoadingScreen message="Loading Train AI..." />
      </>
    );
  }
  if (mfaGate === "required") {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <MfaChallengeScreen onVerified={() => setMfaGate("clear")} onSignOut={signOut} />
        <ConsentBanner session={session} />
      </>
    );
  }

  if (!onboardingChecked) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <LoadingScreen message="Loading Train AI..." />
      </>
    );
  }
  if (needsOnboarding) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <OnboardingPage onComplete={handleOnboardingComplete} />
        <ConsentBanner session={session} />
      </>
    );
  }

  return (
    <>
      <OfflineIndicator mode={offlineMode} />
      <div style={{ display: viewMode === "learner" ? "block" : "none" }}>
        <TrainAILearnerApp
          isActive={viewMode === "learner"}
          onSwitchToPlatform={hasPlatformRole ? () => setViewMode("platform") : undefined}
          onSwitchDashboard={switchDashboard}
          userRoles={userRoles}
        />
      </div>
      <div style={{ display: viewMode === "platform" ? "block" : "none" }}>
        <TrainAIPlatformApp
          isActive={viewMode === "platform"}
          onSwitchToLearner={() => setViewMode("learner")}
          onSwitchDashboard={switchDashboard}
          userRoles={userRoles}
          superAdminSelectedOrgId={superAdminSelectedOrgId}
          setSuperAdminSelectedOrgId={setSuperAdminSelectedOrgId}
        />
      </div>
      <div style={{ display: viewMode === "owner" ? "block" : "none" }}>
        <PlatformOwnerApp
          onSwitchDashboard={switchDashboard}
          userRoles={userRoles}
          superAdminSelectedOrgId={superAdminSelectedOrgId}
          setSuperAdminSelectedOrgId={setSuperAdminSelectedOrgId}
        />
      </div>
      <ConsentBanner session={session} />
    </>
  );
}
