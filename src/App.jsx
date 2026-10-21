import { resolveMfaGate } from "./lib/securityGate.js";
import { parsePublicLocation } from "./lib/publicRouting.js";
import React, { lazy, useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./hooks/useAuth.js";
import LoadingScreen from "./components/common/LoadingScreen.jsx";
import ConsentBanner from "./components/common/ConsentBanner.jsx";
import OfflineIndicator from "./components/common/OfflineIndicator.jsx";
import CertificateVerificationPage from "./pages/public/CertificateVerificationPage.jsx";
import MarketplacePage from "./pages/public/MarketplacePage.jsx";
import { applyAccessibilityPrefs, getStoredAccessibilityPrefs } from "./components/common/AccessibilityPanel.jsx";
import { fetchMyRoles, fetchMyPersonalization, saveMyPersonalization } from "./services/authService.js";
import { resolveViewMode, getAvailableDashboards, DASHBOARDS, isPlatformOwnerEmail } from "./lib/roleRouting.js";
import { getAuthenticatorAssuranceLevel } from "./lib/api/mfa.js";
import { trackOrganizationJoinIntent, getPendingOrganizationJoin, joinOrganizationByReferral } from "./lib/api/organizations.js";

const TrainAILearnerApp = lazy(() => import("./learner/TrainAILearnerApp.jsx"));
const TrainAIPlatformApp = lazy(() => import("./platform/TrainAIPlatformApp.jsx"));
const PlatformOwnerApp = lazy(() => import("./platform/PlatformOwnerApp.jsx"));
const PlatformOwnerLoginScreen = lazy(() =>
  import("./pages/PlatformOwnerLoginScreen.jsx").then((module) => ({ default: module.PlatformOwnerLoginScreen }))
);
const LandingPage = lazy(() => import("./pages/public/LandingPage.jsx"));
const AppointmentBookingPage = lazy(() => import("./pages/public/AppointmentBookingPage.jsx"));
const AuthPage = lazy(() => import("./pages/auth/AuthPage.jsx"));
const MfaChallengeScreen = lazy(() => import("./pages/auth/MfaChallengeScreen.jsx"));
const AcceptInvitationScreen = lazy(() => import("./pages/auth/AcceptInvitationScreen.jsx"));

export default function App() {
  const {
    session, loading, authError, signIn, signUp, signOut, isDemoMode,
    isPasswordRecovery, recoverySessionReady, sendPasswordReset, verifyRecoveryOtp, completePasswordReset,
  } = useAuth();

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

  // Step-up MFA gate: "checking" while we ask Supabase for this session's
  // Authenticator Assurance Level, "required" when the user has a verified
  // TOTP factor but this session is still aal1 (needs MfaChallengeScreen
  // before anything else renders), "clear" otherwise. Demo mode (no
  // Supabase project configured) never has real MFA factors, so it always
  // resolves straight to "clear".
  const [mfaGate, setMfaGate] = useState("checking");
  const handleMfaVerified = useCallback(() => setMfaGate("clear"), []);
  const [mfaRetry, setMfaRetry] = useState(0);
  const [mfaError, setMfaError] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!session || isDemoMode) {
      setMfaGate("clear");
      return;
    }
    let cancelled = false;
    setMfaGate("checking");
    setMfaError(null);
    resolveMfaGate(getAuthenticatorAssuranceLevel)
      .then(gate => { if (!cancelled) setMfaGate(gate); })
      .catch(error => { if (!cancelled) { setMfaError(error.message); setMfaGate("error"); } });
    return () => { cancelled = true; };
  }, [loading, session?.user?.id, isDemoMode, mfaRetry]);

  // Apply persisted accessibility and theme preferences immediately on boot
  useEffect(() => {
    applyAccessibilityPrefs(getStoredAccessibilityPrefs());
    try {
      if (localStorage.getItem("trainai_theme_dark") === "true") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {}
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
      const search = new URLSearchParams(window.location.search);
      return search.get("invite") || search.get("token") || search.get("invite_token") || null;
    } catch {
      return null;
    }
  });

  const [certVerifyCode, setCertVerifyCode] = useState(() => parsePublicLocation(window.location).certCode);

  const [orgSlugParam] = useState(() => {
    try {
      const search = new URLSearchParams(window.location.search);
      const target = search.get("join") || search.get("org") || search.get("workspace") || search.get("ref_org") || null;
      if (target) {
        trackOrganizationJoinIntent(target);
      }
      return target;
    } catch {
      return null;
    }
  });

  // Prefills AuthPage's email field after an invitation is accepted for an
  // account this browser doesn't currently hold a session for (brand-new
  // signup, or an existing-but-signed-out account) - set right before
  // switching publicView to "auth" below.
  const [inviteAuthEmail, setInviteAuthEmail] = useState("");
  const [authInitialMode, setAuthInitialMode] = useState(() => parsePublicLocation(window.location).authMode);

  const handleAuthModeChange = useCallback(mode => {
    setAuthInitialMode(mode);
    const url = new URL(window.location.href);
    if (url.searchParams.get("mode") !== mode) {
      url.searchParams.set("view", "auth"); url.searchParams.set("mode", mode);
      window.history.pushState({}, "", url.toString());
    }
  }, []);

  const [demoSectorParam, setDemoSectorParam] = useState("academies");
  const [publicView, setPublicView] = useState(() => parsePublicLocation(window.location).view);

  // Auto-join if user is already authenticated and lands on an organization join/referral link or has pending intent
  useEffect(() => {
    if (session?.user?.id) {
      const pending = getPendingOrganizationJoin();
      const target = orgSlugParam || pending?.orgIdOrSlug;
      if (target) {
        const uEmail = session.user.email;
        const uName = session.user.user_metadata?.display_name || (uEmail ? uEmail.split("@")[0].replace(/[._-]/g, " ") : "Learner");
        joinOrganizationByReferral(target, pending?.role || "learner", session.user.id, { email: uEmail, displayName: uName })
          .catch((e) => console.warn("Auto-join referral notice:", e));
      }
    }
  }, [session?.user?.id, orgSlugParam]);

  // Handle browser back/forward buttons smoothly
  useEffect(() => {
    function handlePopState() {
      const route = parsePublicLocation(window.location);
      setCertVerifyCode(route.certCode);
      setInviteToken(route.inviteToken);
      setAuthInitialMode(route.authMode);
      setPublicView(route.view);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [session]);

  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [roleError, setRoleError] = useState(null);
  const [roleRefresh, setRoleRefresh] = useState(0);
  const previousRoles = useRef(null);
  useEffect(() => {
    if (!session?.user?.id) return;
    const refresh = () => setRoleRefresh(value => value + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("trainai-role-changed", refresh);
    const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 30000);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("trainai-role-changed", refresh); window.clearInterval(timer); };
  }, [session?.user?.id]);
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
    const userEmail = session?.user?.email || "";
    if (target === DASHBOARDS.OWNER && !isPlatformOwnerEmail(userEmail)) return;
    if (!getAvailableDashboards(userRoles, userEmail).includes(target)) return;
    if (target === DASHBOARDS.LEARNER) setViewMode("learner");
    else if (target === DASHBOARDS.ORGANISATION) setViewMode("platform");
    else if (target === DASHBOARDS.OWNER) setViewMode("owner");
  }

  useEffect(() => {
    if (loading) return;
    if (!session) {
      previousRoles.current = null;
      setUserRoles([]);
      setHasPlatformRole(false);
      setViewMode("learner");
      setRoleError(null);
      setOnboardingChecked(true);
      return;
    }

    let cancelled = false;
    if (!previousRoles.current?.startsWith(session.user.id + ":")) setOnboardingChecked(false);
    setRoleError(null);
    (async () => {
      try {
        const [personalization, roles] = await Promise.all([
          fetchMyPersonalization().catch(() => null),
          fetchMyRoles()
        ]);
        const rolesList = Array.isArray(roles) && roles.length > 0 ? roles : ["learner"];
        const userEmail = session.user?.email || "";
        const mode = resolveViewMode(rolesList, userEmail);
        if (!cancelled) {
          setUserRoles(rolesList);
          setHasPlatformRole(mode === "platform");
          const rolesKey = session.user.id + ":" + [...rolesList].sort().join(",");
          if (previousRoles.current !== rolesKey) setViewMode(mode);
          previousRoles.current = rolesKey;
          // Admin-Managed Grouping: organizations/admins now control learner
          // groupings, track badges, and course visibility directly (cohort
          // assignment + per-cohort course assignment in the admin People/
          // Cohort screens - both already real, schema-backed features).
          // The old self-selection onboarding wall duplicated and could
          // conflict with that admin-managed assignment, so it no longer
          // blocks anyone from entering the app. A learner who has never
          // personalized still gets a default row seeded quietly in the
          // background so nothing that reads user_personalization elsewhere
          // (e.g. SkillMasteryCard) breaks on a missing row.
          setNeedsOnboarding(false);
          if (!personalization && session?.user?.id) {
            saveMyPersonalization(session.user.id, [], "beginner").catch(() => {});
          }
          setOnboardingChecked(true);
        }
      } catch (error) {
        if (!cancelled) { setRoleError(error.message || "Could not verify workspace access."); setOnboardingChecked(true); }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, session?.user?.id, roleRefresh]);

  async function handleOnboardingComplete({ tracks, level }) {
    if (session?.user?.id) {
      await saveMyPersonalization(session.user.id, tracks, level);
      const roles = await fetchMyRoles().catch(() => ["learner"]);
      const rolesList = Array.isArray(roles) && roles.length > 0 ? roles : ["learner"];
      const userEmail = session.user?.email || "";
      const mode = resolveViewMode(rolesList, userEmail);
      setUserRoles(rolesList);
      setHasPlatformRole(mode === "platform");
      setViewMode(mode);
    }
    setNeedsOnboarding(false);
  }

  async function handleGlobalSignOut() {
    await signOut();
    setUserRoles(["learner"]);
    setHasPlatformRole(false);
    setViewMode("learner");
    setPublicView("landing");
    setOwnerPortalAuthenticated(false);
  }

  if (loading) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <LoadingScreen message="Connecting to Train AI..." />
      </>
    );
  }

  if (isOwnerPortalURL && (!ownerPortalAuthenticated || !session)) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <PlatformOwnerLoginScreen onAuthenticated={() => setOwnerPortalAuthenticated(true)} />
      </>
    );
  }
  // A password-reset email link click lands here with a real (temporary)
  // session already established by Supabase - checked before every other
  // gate below (including the normal !session -> AuthPage branch) since
  // otherwise a signed-in-looking session would just drop the visitor
  // straight into their dashboard with no prompt to actually set a new
  // password, silently defeating the whole reset flow.
  if (isPasswordRecovery) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <AuthPage
          recoveryMode
          recoverySessionReady={recoverySessionReady}
          onCompletePasswordReset={completePasswordReset}
        />
      </>
    );
  }

  // Certificate verification portal - accessible publicly with ?verify=CERT_CODE or /certificate/:id
  if (certVerifyCode) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <CertificateVerificationPage
          certCode={certVerifyCode === "1" ? "" : certVerifyCode}
          onGoHome={() => {
            try { window.history.pushState({}, "", "/"); } catch {}
            setCertVerifyCode(null);
            setPublicView("landing");
          }}
        />
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
            window.history.replaceState({}, "", "/");
            setInviteToken(null);
          }}
          onNeedsSignIn={(email) => {
            window.history.replaceState({}, "", "/");
            setInviteAuthEmail(email || "");
            setPublicView("auth");
            setInviteToken(null);
          }}
          onAccepted={() => {
            // Caller was already signed in as the account that just joined
            // the org - hard-reload so every downstream role/org lookup in
            // this file (userRoles, hasPlatformRole, viewMode, etc.) recomputes
            // from scratch instead of trying to patch each piece by hand.
            window.location.replace("/");
          }}
        />
        <ConsentBanner session={session} />
      </>
    );
  }

  if (!session) {
    if (publicView === "marketplace") {
      return (
        <>
          <OfflineIndicator mode={offlineMode} />
          <MarketplacePage
            onGoHome={() => {
              try { window.history.pushState({}, "", "/"); } catch {}
              setPublicView("landing");
            }}
            onBookDemo={() => {
              try { window.history.pushState({}, "", "?view=book-demo"); } catch {}
              setPublicView("book-demo");
            }}
            onSignIn={() => {
              setAuthInitialMode("signin");
              try { window.history.pushState({}, "", "?view=auth&mode=signin"); } catch {}
              setPublicView("auth");
            }}
          />
        </>
      );
    }
    if (publicView === "auth") {
      return (
        <>
          <OfflineIndicator mode={offlineMode} />
          <AuthPage
            onSignIn={signIn}
            onSignUp={signUp}
            authError={authError}
            initialEmail={inviteAuthEmail}
            initialMode={authInitialMode}
            onModeChange={handleAuthModeChange}
            onForgotPassword={sendPasswordReset}
            onVerifyRecoveryOtp={verifyRecoveryOtp}
            onCompletePasswordReset={completePasswordReset}
            onGoHome={() => {
              try { window.history.pushState({}, "", "/"); } catch {}
              setPublicView("landing");
            }}
            orgParam={orgSlugParam}
          />
          <ConsentBanner session={session} />
        </>
      );
    }
    if (publicView === "book-demo") {
      return (
        <>
          <OfflineIndicator mode={offlineMode} />
          <AppointmentBookingPage
            initialSector={demoSectorParam}
            onBack={() => {
              try { window.history.pushState({}, "", "/"); } catch {}
              setPublicView("landing");
            }}
            onNavigate={(target) => {
              if (["signin", "signup"].includes(target)) {
                const nextMode = target === "signup" ? "signup" : "signin";
                setAuthInitialMode(nextMode);
                try { window.history.pushState({}, "", `?view=auth&mode=${nextMode}`); } catch {}
                setPublicView("auth");
              } else if (target === "marketplace") {
                try { window.history.pushState({}, "", "?view=marketplace"); } catch {}
                setPublicView("marketplace");
              } else {
                try { window.history.pushState({}, "", "/"); } catch {}
                setPublicView("landing");
              }
            }}
          />
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
          onNavigate={(target, data) => {
            if (["signin", "signup", "courses", "mentors"].includes(target)) {
              const nextMode = target === "signin" ? "signin" : "signup";
              setAuthInitialMode(nextMode);
              try { window.history.pushState({}, "", `?view=auth&mode=${nextMode}`); } catch {}
              setPublicView("auth");
            } else if (target === "marketplace") {
              try { window.history.pushState({}, "", "?view=marketplace"); } catch {}
              setPublicView("marketplace");
            } else if (target === "demo" || target === "book-demo") {
              if (data?.sector) setDemoSectorParam(data.sector);
              try { window.history.pushState({}, "", "?view=book-demo"); } catch {}
              setPublicView("book-demo");
            } else {
              try { window.history.pushState({}, "", "/"); } catch {}
              setPublicView("landing");
            }
          }}
        />
        <ConsentBanner session={session} />
      </>
    );
  }

  if (mfaGate === "error") return <div role="alert" style={{ padding: 40 }}><p>{mfaError || "Could not verify account security."}</p><button onClick={() => setMfaRetry(value => value + 1)}>Retry security check</button> <button onClick={handleGlobalSignOut}>Sign out</button></div>;
  if (mfaGate === "checking") {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <LoadingScreen message="Verifying security credentials..." />
      </>
    );
  }
  if (mfaGate === "required") {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <MfaChallengeScreen onVerified={handleMfaVerified} onSignOut={handleGlobalSignOut} />
        <ConsentBanner session={session} />
      </>
    );
  }

  if (roleError) return <div role="alert" style={{ padding: 40 }}><p>Could not verify your workspace access. {roleError}</p><button onClick={() => setRoleRefresh(value => value + 1)}>Retry</button></div>;
  if (!onboardingChecked) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <LoadingScreen message="Loading your account..." />
      </>
    );
  }
  if (isOwnerPortalURL && ownerPortalAuthenticated && isPlatformOwnerEmail(session?.user?.email) && userRoles.includes("super_admin")) {
    return (
      <>
        <OfflineIndicator mode={offlineMode} />
        <PlatformOwnerApp
          onSwitchDashboard={switchDashboard}
          userRoles={userRoles}
          superAdminSelectedOrgId={superAdminSelectedOrgId}
          setSuperAdminSelectedOrgId={setSuperAdminSelectedOrgId}
          onSignOut={handleGlobalSignOut}
        />
      </>
    );
  }

  // needsOnboarding is intentionally always false now - see the effect above
  // for why (Admin-Managed Grouping: learners no longer self-select a track/
  // level before entering the app; admins assign cohorts/courses instead).
  // handleOnboardingComplete and OnboardingPage are kept, unused, in case a
  // future per-organization setting wants to bring self-service onboarding
  // back for organizations that prefer it.
  void needsOnboarding;
  void handleOnboardingComplete;

  return (
    <>
      <OfflineIndicator mode={offlineMode} />
      <div style={{ display: viewMode === "learner" ? "block" : "none" }}>
        <TrainAILearnerApp
          isActive={viewMode === "learner"}
          onSwitchToPlatform={hasPlatformRole ? () => setViewMode("platform") : undefined}
          onSwitchDashboard={switchDashboard}
          userRoles={userRoles}
          onSignOut={handleGlobalSignOut}
        />
      </div>
      {userRoles.some(role => ["admin", "mentor", "manager", "super_admin"].includes(role)) && <div style={{ display: viewMode === "platform" ? "block" : "none" }}>
        <TrainAIPlatformApp
          isActive={viewMode === "platform"}
          onSwitchToLearner={() => setViewMode("learner")}
          onSwitchDashboard={switchDashboard}
          userRoles={userRoles}
          superAdminSelectedOrgId={superAdminSelectedOrgId}
          setSuperAdminSelectedOrgId={setSuperAdminSelectedOrgId}
          onSignOut={handleGlobalSignOut}
        />
      </div>}
      {isPlatformOwnerEmail(session?.user?.email) && userRoles.includes("super_admin") && <div style={{ display: viewMode === "owner" ? "block" : "none" }}>
        <PlatformOwnerApp
          isActive={viewMode === "owner"}
          onSwitchDashboard={switchDashboard}
          userRoles={userRoles}
          superAdminSelectedOrgId={superAdminSelectedOrgId}
          setSuperAdminSelectedOrgId={setSuperAdminSelectedOrgId}
          onSignOut={handleGlobalSignOut}
        />
      </div>}
      <ConsentBanner session={session} />
    </>
  );
}
