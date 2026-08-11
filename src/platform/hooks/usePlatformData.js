import { useAuth } from "../../lib/useAuth.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCurrentUserProfile } from "../../lib/api/platform.js";

export function usePlatformData() {
  const { session } = useAuth();
  const profileQuery = useSupabaseQuery(async () => {
    if (!session?.user?.id) return null;
    return await fetchCurrentUserProfile(session.user.id);
  }, [session?.user?.id]);

  const orgId = profileQuery.data?.organization_id || null;
  // A real bug, found alongside the authService.js fetchMyRoles() fix:
  // this used to hardcode ["admin", "mentor", "super_admin"] unconditionally
  // as the fallback whenever the caller's real fetched roles weren't ready
  // yet (TrainAIPlatformApp.jsx only uses this if userRolesProp is empty) -
  // meaning even a brief moment before the real roles loaded could grant
  // super_admin's cross-tenant selector and Dashboard Switcher option to
  // literally any signed-in user. A safe fallback should never include an
  // elevated role by default - "admin" alone (the minimum this hook is
  // ever used for) is the correct default, not "admin plus super_admin."
  const userRoles = ["admin"];

  return {
    session,
    profileQuery,
    orgId,
    userRoles,
  };
}
