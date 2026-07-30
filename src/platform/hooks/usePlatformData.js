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
  const userRoles = ["admin", "mentor", "super_admin"];

  return {
    session,
    profileQuery,
    orgId,
    userRoles,
  };
}
